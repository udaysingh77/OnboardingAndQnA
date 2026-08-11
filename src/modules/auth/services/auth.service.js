// ==================================================================
// Auth service - OTP flow + JWT issuance + logout.
// Uses the pluggable OTP provider (mock now, SMS later) and the
// token blacklist (in-memory now, Redis later).
// Users are App_Accounts rows; AccountId is a bigint (stringified for JWT).
// ==================================================================
import jwt from 'jsonwebtoken';
import { badRequestError, unauthorizedError } from '../../../shared/errors.js';
import { signAccessToken } from '../../../utils/token.js';
import { userRepository } from '../../user/repositories/user.repository.js';
import { createOtpProvider } from './otp/otpProvider.factory.js';
import { tokenBlacklist } from './tokenBlacklist.js';

export function createAuthService({ otpProvider = createOtpProvider() } = {}) {
  async function sendOtp({ phone }) {
    await otpProvider.send(phone);

    // Dev-only: echo the generated OTP so the flow can be exercised
    // without an SMS gateway.
    const mockOtp =
      typeof otpProvider.getLastOtp === 'function'
        ? await otpProvider.getLastOtp(phone)
        : null;

    return { message: 'OTP sent', ...(mockOtp ? { otp: mockOtp } : {}) };
  }

  async function verifyOtp({ phone, otp }) {
    const valid = await otpProvider.verify({ phone, otp });
    if (!valid) throw badRequestError('Invalid or expired OTP', { errorCode: 'INVALID_OTP' });

    let user = await userRepository.findByAccountMobile(phone);
    if (!user) {
      user = await userRepository.create({
        AccountGroupId: 0,
        AccountMobile: phone,
      });
    }

    const registrationStatus = deriveRegistrationStatus(user);
    const token = signAccessToken({
      sub: String(user.AccountId),
      phone: user.AccountMobile,
      registrationStatus,
    });

    return { user: publicUser(user), token };
  }

  function logout(token) {
    const decoded = jwt.decode(token);
    if (!decoded) throw unauthorizedError('Invalid token');

    const jti = decoded.jti ?? token;
    const expiresAtMs = decoded.exp ? decoded.exp * 1000 : Date.now() + 60_000;
    tokenBlacklist.add(jti, expiresAtMs);

    return { loggedOut: true };
  }

  function isTokenBlacklisted(jti) {
    return tokenBlacklist.has(jti);
  }

  return { sendOtp, verifyOtp, logout, isTokenBlacklisted };
}

// ApplicationStatus 1 = fully registered, everything else = onboarding.
function deriveRegistrationStatus(user) {
  return user.ApplicationStatus === 1 ? 'completed' : 'started';
}

function publicUser(user) {
  return {
    id: String(user.AccountId),
    phone: user.AccountMobile,
    name: user.AccountName,
    email: user.AccountEmail,
    registrationStatus: deriveRegistrationStatus(user),
  };
}

export const authService = createAuthService();

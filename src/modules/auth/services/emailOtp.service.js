import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { badRequestError, appError } from '../../../shared/errors.js';
import { emailOtpStore } from './emailOtpStore.js';
import { env } from '../../../config/env.js';
import { sendEmail } from '../../../utils/email.js';
import { buildEmailVerificationTemplate } from '../email-templates/emailVerification.template.js';
import { logger } from '../../../utils/logger.js';

export function createEmailOtpService({ store = emailOtpStore, mailer = sendEmail, cfg = env, log = logger } = {}) {
  const length = cfg.EMAIL_OTP_LENGTH;
  const expiryMinutes = cfg.EMAIL_OTP_EXPIRY_MINUTES;
  const maxAttempts = cfg.EMAIL_OTP_MAX_ATTEMPTS;
  const resendCooldownSeconds = cfg.EMAIL_OTP_RESEND_COOLDOWN_SECONDS;

  async function generateOtpString() {
    const max = 10 ** length;
    const n = crypto.randomInt(0, max);
    return String(n).padStart(length, '0');
  }

  async function sendEmailOtp({ email }) {
    if (!email) throw badRequestError('Email is required');

    const now = new Date();

    const active = store.get(email);
    if (active && !active.verifiedAt && active.expiresAt > now) {
      const sinceMs = now.getTime() - active.createdAt.getTime();
      if (sinceMs < resendCooldownSeconds * 1000) {
        // Say how long, not just "wait" - this message is shown to the member verbatim (the
        // conversation engine passes err.message straight into describeOtpProblem), and "please
        // wait" with no number leaves them retrying blind.
        const retryAfterSeconds = Math.ceil((resendCooldownSeconds * 1000 - sinceMs) / 1000);
        throw badRequestError(
          `Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before requesting another OTP.`,
          { details: { retryAfterSeconds } },
        );
      }
    }

    const otp = await generateOtpString();
    const tpl = buildEmailVerificationTemplate({ otp, expiryMinutes, companyName: 'IPRS' });

    // Try to send email first; if sending fails, do not persist OTP
    try {
      await mailer({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
    } catch (err) {
      log.error({ err, email }, 'SMTP send failed');
      throw appError('Failed to send OTP email');
    }

    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // A new OTP for the same email replaces whatever was there - equivalent to the old code's
    // "invalidate any previous active OTPs", just implicit (there's only ever one record per key).
    store.set(email, { otpHash, expiresAt, attempts: 0, verifiedAt: null, createdAt: now });

    return { message: 'OTP sent successfully' };
  }

  async function verifyEmailOtp({ email, otp }) {
    if (!email) throw badRequestError('Email is required');
    if (!otp) throw badRequestError('OTP is required');

    const now = new Date();

    const record = store.get(email);

    if (!record || record.verifiedAt) throw badRequestError('OTP not found. Please request a new OTP.');

    if (record.expiresAt <= now) {
      throw badRequestError('OTP has expired. Please request a new OTP.');
    }

    if (record.attempts >= maxAttempts) {
      throw badRequestError('Maximum OTP verification attempts exceeded. Please request a new OTP.');
    }

    const ok = await bcrypt.compare(otp, record.otpHash);
    if (!ok) {
      record.attempts += 1;
      store.set(email, record);
      if (record.attempts >= maxAttempts) {
        throw badRequestError('Maximum OTP verification attempts exceeded. Please request a new OTP.');
      }
      const remaining = maxAttempts - record.attempts;
      throw badRequestError(`Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`, {
        details: { attemptsRemaining: remaining },
      });
    }

    // mark verified
    record.verifiedAt = now;
    store.set(email, record);

    return { message: 'Email verified successfully' };
  }

  return { sendEmailOtp, verifyEmailOtp };
}

export const emailOtpService = createEmailOtpService();

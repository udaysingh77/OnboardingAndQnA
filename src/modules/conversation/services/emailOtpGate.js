// ==================================================================
// Gates the Typebot conversation's "Provide your email id" step:
// blocks progression until the answered email is OTP-verified via the
// existing emailOtpService (send-email-otp/verify-email-otp). Mirrors
// spotifyGate.js's variableId-based recognition, but this step needs a
// send-then-verify sub-conversation rather than a single pass/fail check.
// ==================================================================
import { emailOtpService } from '../../auth/services/emailOtp.service.js';

// The "Provide your email id" email-input block's variableId in the
// current Typebot flow - same id already mapped to AccountEmail in
// conversationFieldMap.js. Update both if that block's variable is
// re-created in Studio.
export const EMAIL_VARIABLE_ID = 'virpfcnue17syf7ua2hbuj5d1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailStep(variableId) {
  return variableId === EMAIL_VARIABLE_ID;
}

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value ?? '').trim());
}

export const sendVerificationOtp = (email) => emailOtpService.sendEmailOtp({ email });
export const verifyVerificationOtp = (email, otp) => emailOtpService.verifyEmailOtp({ email, otp });

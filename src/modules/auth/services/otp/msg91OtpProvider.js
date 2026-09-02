// ==================================================================
// MSG91 OTP provider - real SMS OTP via the MSG91 v5 API.
//   - send(): POST https://control.msg91.com/api/v5/otp
//   - verify(): GET https://control.msg91.com/api/v5/otp/verify
//   - MSG91 verifies purely by mobile + otp (no reference concept).
//   - Selected via OTP_PROVIDER=sms in otpProvider.factory.js.
// ==================================================================
import { env } from '../../../../config/env.js';
import { appError, badRequestError } from '../../../../shared/errors.js';
import { normalizePhone } from '../../../../utils/phone.js';

const BASE_URL = 'https://control.msg91.com/api/v5/otp';

export function createMsg91OtpProvider() {
  if (!env.MSG91_AUT_KEY || !env.MSG91_TEMP_ID) {
    throw appError('MSG91_AUT_KEY and MSG91_TEMP_ID are required when OTP_PROVIDER=sms', {
      statusCode: 500,
      errorCode: 'OTP_PROVIDER_MISCONFIGURED',
    });
  }

  async function send(phone) {
    const params = new URLSearchParams({
      template_id: env.MSG91_TEMP_ID,
      mobile: toMobile(phone),
      authkey: env.MSG91_AUT_KEY,
      otp_length: String(env.MSG91_OTP_LENGTH),
      otp_expiry: String(env.MSG91_OTP_EXPIRY),
    });

    await request(`${BASE_URL}?${params}`, { method: 'POST' });
  }

  async function verify({ phone, otp }) {
    const params = new URLSearchParams({
      otp,
      mobile: toMobile(phone),
      authkey: env.MSG91_AUT_KEY,
    });

    const body = await request(`${BASE_URL}/verify?${params}`, { method: 'GET' });
    return body?.type === 'success';
  }

  return { send, verify };
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw appError('Unable to reach the MSG91 OTP gateway', {
      statusCode: 502,
      errorCode: 'OTP_PROVIDER_UNREACHABLE',
      cause: err,
    });
  }

  let body = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON response; leave body empty
  }

  if (!res.ok || body?.type !== 'success') {
    throw badRequestError(body?.message || 'MSG91 OTP request failed', {
      errorCode: body?.type === 'error' ? 'OTP_REQUEST_FAILED' : 'OTP_PROVIDER_ERROR',
    });
  }

  return body;
}

// auth.service.js normalizes before it ever gets here, so this is belt-and-braces - it keeps the
// number the gateway sees and the number stored in AccountMobile on the same canonical form even
// if some future caller forgets. Falls back to the old "just strip the +" behaviour rather than
// sending nothing when the helper rejects the input.
function toMobile(phone) {
  return normalizePhone(phone) ?? String(phone).replace(/^\+/, '');
}

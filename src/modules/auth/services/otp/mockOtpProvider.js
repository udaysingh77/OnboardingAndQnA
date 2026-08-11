// ==================================================================
// Mock OTP provider (local/testing).
//   - Generates a 6-digit OTP stored in-memory with a TTL.
//   - Returns the OTP via getLastOtp() so the flow is testable without
//     SMS (dev only). In production use MSG91 via OTP_PROVIDER=sms.
//   - In-memory store is single-instance only; swap for Redis-backed
//     storage in later milestones.
// ==================================================================
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

const TTL_MS = env.OTP_TTL_SECONDS * 1000;

export function createMockOtpProvider() {
  const store = new Map(); // phone -> { otp, expiresAt }

  async function send(phone) {
    const otp = env.OTP_MOCK_VALUE ?? generateOtp();

    store.set(phone, {
      otp,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  async function verify({ phone, otp }) {
    const record = store.get(phone);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      store.delete(phone);
      return false;
    }

    const valid = record.otp === otp;
    if (valid) store.delete(phone); // OTPs are single-use
    return valid;
  }

  /** Expose the generated OTP for mock/local testing (dev only). */
  async function getLastOtp(phone) {
    return store.get(phone)?.otp ?? null;
  }

  return { send, verify, getLastOtp };
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

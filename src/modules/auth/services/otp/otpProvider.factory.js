// ==================================================================
// OTP provider factory - selects implementation from OTP_PROVIDER env.
// Add SMS providers here, flip the env var, done.
// ==================================================================
import { createMockOtpProvider } from './mockOtpProvider.js';
import { createMsg91OtpProvider } from './msg91OtpProvider.js';

export function createOtpProvider() {
  switch (process.env.OTP_PROVIDER ?? 'mock') {
    case 'sms':
      return createMsg91OtpProvider();
    default:
      return createMockOtpProvider();
  }
}

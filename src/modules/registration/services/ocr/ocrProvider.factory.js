// ==================================================================
// OCR provider factory - selects implementation from OCR_PROVIDER env.
// Mirrors modules/auth/services/otp/otpProvider.factory.js.
// ==================================================================
import { env } from '../../../../config/env.js';
import { createHttpOcrProvider } from './httpOcrProvider.js';
import { createStubOcrProvider } from './stubOcrProvider.js';

export function createOcrProvider() {
  switch (env.OCR_PROVIDER) {
    case 'stub':
      return createStubOcrProvider();
    default:
      return createHttpOcrProvider();
  }
}

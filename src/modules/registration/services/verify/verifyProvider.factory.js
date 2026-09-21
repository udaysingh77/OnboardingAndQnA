// ==================================================================
// Verify provider factory - selects implementation from OCR_PROVIDER env,
// same switch as ../ocr/ocrProvider.factory.js. Not a separate env var:
// the verify endpoints live on the same service (ocr.choira.io) as
// document OCR, so "real vs stub" is one operational choice, not two.
// ==================================================================
import { env } from '../../../../config/env.js';
import { createHttpVerifyProvider } from './httpVerifyProvider.js';
import { createStubVerifyProvider } from './stubVerifyProvider.js';

export function createVerifyProvider() {
  switch (env.OCR_PROVIDER) {
    case 'stub':
      return createStubVerifyProvider();
    default:
      return createHttpVerifyProvider();
  }
}

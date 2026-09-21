// ==================================================================
// Stub verify provider - mirrors ../ocr/stubOcrProvider.js. Selected via
// OCR_PROVIDER=stub for offline dev; always throws so a misconfigured
// deploy fails loudly instead of silently treating every GSTIN/TAN as
// verified.
// ==================================================================
import { appError } from '../../../../shared/errors.js';

export function createStubVerifyProvider() {
  async function verify({ docType }) {
    throw appError(`Verification is not implemented yet (docType=${docType})`, {
      statusCode: 501,
      errorCode: 'VERIFY_NOT_IMPLEMENTED',
    });
  }

  return { verify };
}

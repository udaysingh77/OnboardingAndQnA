// ==================================================================
// Stub OCR provider - the real OCR API is a separate project that is
// still under development. Registration document endpoints save the
// document URL only; nothing calls extract() yet. This file exists so
// the next milestone can implement it and flip a factory switch,
// mirroring modules/auth/services/otp/mockOtpProvider.js.
// ==================================================================
import { appError } from '../../../../shared/errors.js';

export function createStubOcrProvider() {
  async function extract({ docType }) {
    throw appError(`OCR extraction is not implemented yet (docType=${docType})`, {
      statusCode: 501,
      errorCode: 'OCR_NOT_IMPLEMENTED',
    });
  }

  return { extract };
}

// ==================================================================
// HTTP OCR provider - calls the real ocr.choira.io document
// verification service (see Document Verification API.postman_collection.json).
// One endpoint per doc type, all shaped { documentUrl } -> { data }.
// Any failure (422 "not found", non-2xx, network/timeout) is surfaced
// as a single OCR_EXTRACTION_FAILED error - the caller decides what
// "failed extraction" means for persistence (see registration.service.js).
// ==================================================================
import { appError } from '../../../../shared/errors.js';
import { env } from '../../../../config/env.js';

const DOC_TYPE_PATHS = {
  PAN: 'pan',
  AADHAAR: 'aadhaar',
  BANK: 'bank',
};

export function createHttpOcrProvider() {
  async function extract({ docType, documentUrl }) {
    const path = DOC_TYPE_PATHS[docType];
    if (!path) {
      throw appError(`No OCR endpoint for docType=${docType}`, {
        statusCode: 400,
        errorCode: 'OCR_UNSUPPORTED_DOC_TYPE',
      });
    }

    let response;
    try {
      response = await fetch(`${env.OCR_API_BASE_URL}/api/documents/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl }),
        signal: AbortSignal.timeout(env.OCR_REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw appError('OCR service unreachable', { errorCode: 'OCR_EXTRACTION_FAILED', cause });
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.success) {
      throw appError(body?.message ?? `OCR request failed with status ${response.status}`, {
        statusCode: response.status,
        errorCode: 'OCR_EXTRACTION_FAILED',
        details: body,
      });
    }

    return body.data;
  }

  return { extract };
}

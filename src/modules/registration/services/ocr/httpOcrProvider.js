// ==================================================================
// HTTP OCR provider - calls the real ocr.choira.io document
// verification service (see Document Verification API.postman_collection.json).
// One endpoint per doc type, all shaped { documentUrl } -> { data }.
// This service's transport contract has flip-flopped between JSON and
// multipart more than once during development - always re-probe live
// (curl) before trusting this comment if OCR starts failing again.
// Currently confirmed live (see AGENTS.md): JSON { documentUrl } is
// accepted; a multipart upload is explicitly rejected with
// 415 UPLOAD_NOT_SUPPORTED.
// Any failure (4xx from the service, non-2xx, network/timeout) is
// surfaced as a single OCR_EXTRACTION_FAILED error - the caller decides
// what "failed extraction" means for persistence (see registration.service.js).
// ==================================================================
import { appError } from '../../../../shared/errors.js';
import { env } from '../../../../config/env.js';

const DOC_TYPE_PATHS = {
  PAN: 'pan',
  AADHAAR: 'aadhaar',
  BANK: 'bank',
  DRIVING_LICENCE: 'driving-licence',
  VOTER_ID: 'voter-id',
  ELECTRICITY: 'electricity',
  PASSPORT: 'passport',
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
      throw appError('OCR service unreachable', { errorCode: 'OCR_EXTRACTION_FAILED', details: { stage: 'ocr_call' }, cause });
    }

    const body = await response.json().catch(() => null);

    // body.success only means the API call itself didn't error - it stays true even when the
    // document failed real verification (e.g. VERIFICATION_UNAVAILABLE). body.status is the one
    // that reflects whether OCR/verification actually succeeded, so that's the field that decides
    // failure here.
    if (!response.ok || !body?.status) {
      throw appError(body?.message ?? `OCR request failed with status ${response.status}`, {
        statusCode: response.status,
        errorCode: 'OCR_EXTRACTION_FAILED',
        details: { stage: 'ocr_call', ...body },
      });
    }

    return body.data;
  }

  return { extract };
}

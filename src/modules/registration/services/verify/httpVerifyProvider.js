// ==================================================================
// HTTP verify provider - calls the government-lookup verify endpoint on
// the same ocr.choira.io service used for document OCR, but for a typed
// value (GSTIN) rather than a document image. TAN is deliberately not
// wired in yet - see verifyGate.js.
//
// PASS/FAIL RULE (confirmed, not guessed): decided by the response's own
// TOP-LEVEL `success` field alone. A live probe against a syntactically
// wrong GSTIN returned `{ success: true, verified: false, message:
// "Invalid GSTIN", data: null }` - so `verified`/`data.gstin_status`/
// `data.gstin_checksum_valid` are NOT used to reject an answer; only a
// genuine service/transport problem (network error, non-2xx, or the
// service's own success:false) blocks the member. Once `success` is
// true, the answer is treated as passed regardless of what the nested
// fields say.
// ==================================================================
import { appError } from '../../../../shared/errors.js';
import { env } from '../../../../config/env.js';

const DOC_TYPE_PATHS = { GSTIN: 'gstin' };
const REQUEST_FIELD = { GSTIN: 'gstin' };

export function createHttpVerifyProvider() {
  async function verify({ docType, value }) {
    const path = DOC_TYPE_PATHS[docType];
    const field = REQUEST_FIELD[docType];
    if (!path) {
      throw appError(`No verify endpoint for docType=${docType}`, {
        statusCode: 400,
        errorCode: 'VERIFY_UNSUPPORTED_DOC_TYPE',
      });
    }

    let response;
    try {
      response = await fetch(`${env.OCR_API_BASE_URL}/api/verify/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
        signal: AbortSignal.timeout(env.OCR_REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw appError('Verify service unreachable', { errorCode: 'VERIFY_REQUEST_FAILED', details: { stage: 'verify_call', docType }, cause });
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.success) {
      throw appError(body?.message ?? `Verify request failed with status ${response.status}`, {
        statusCode: response.status,
        errorCode: 'VERIFY_REQUEST_FAILED',
        details: { stage: 'verify_call', docType, ...body },
      });
    }

    // Reaching here means body.success was already true (checked above) - `verified` on the
    // returned result reflects that alone, never the nested fields. See the pass/fail rule above.
    return { verified: true, message: body.message, data: body.data };
  }

  return { verify };
}

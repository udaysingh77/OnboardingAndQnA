// ==================================================================
// Typebot Chat API client - backend drives the conversation on behalf
// of the frontend (relay model, not the widget-embed model). Mirrors
// modules/registration/services/ocr/httpOcrProvider.js's style.
// See docs.typebot.com/api-reference/chat/{start-chat,continue-chat,
// generate-upload-url,start-preview-chat}.
//
// TYPEBOT_PREVIEW_MODE=true uses .../typebots/{id}/preview/startChat
// (internal id, no publish needed - answers aren't saved by Typebot
// and some of its own blocks like "Send email" are skipped, per their
// docs) instead of .../typebots/{publicId}/startChat, for testing
// before the bot is published (a paid feature).
// ==================================================================
import { appError } from '../../../../shared/errors.js';
import { env } from '../../../../config/env.js';
import { logger } from '../../../../utils/logger.js';

function requireTypebotId() {
  if (!env.TYPEBOT_ID) {
    throw appError('Typebot is not configured yet (TYPEBOT_ID is unset)', {
      statusCode: 503,
      errorCode: 'TYPEBOT_NOT_CONFIGURED',
    });
  }
  return env.TYPEBOT_ID;
}

async function callTypebot(path, body) {
  let response;
  try {
    response = await fetch(`${env.TYPEBOT_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.TYPEBOT_API_TOKEN ? { Authorization: `Bearer ${env.TYPEBOT_API_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.TYPEBOT_REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw appError('Typebot service unreachable', { errorCode: 'TYPEBOT_REQUEST_FAILED', cause });
  }

  const responseBody = await response.json().catch(() => null);
  logger.debug({ path, body, status: response.status, responseBody }, 'DEBUG typebot call');

  if (!response.ok) {
    throw appError(responseBody?.message ?? `Typebot request failed with status ${response.status}`, {
      statusCode: response.status,
      errorCode: 'TYPEBOT_REQUEST_FAILED',
      details: responseBody,
    });
  }

  return responseBody;
}

async function startChat({ prefilledVariables }) {
  const typebotId = requireTypebotId();
  const path = env.TYPEBOT_PREVIEW_MODE
    ? `/api/v1/typebots/${typebotId}/preview/startChat`
    : `/api/v1/typebots/${typebotId}/startChat`;
  return callTypebot(path, { prefilledVariables });
}

async function continueChat({ sessionId, message }) {
  return callTypebot(`/api/v1/sessions/${sessionId}/continueChat`, { message });
}

async function generateUploadUrl({ sessionId, blockId, fileName, fileType, fileSize }) {
  return callTypebot('/api/v3/generate-upload-url', { sessionId, blockId, fileName, fileType, fileSize });
}

// Uploads the actual file bytes to the presigned URL generateUploadUrl() returned.
// Not a call to Typebot's own API - it's whatever storage (S3) Typebot fronts.
async function uploadToPresignedUrl({ presignedUrl, formData, fileBuffer, fileName, fileType }) {
  let response;
  try {
    if (formData && Object.keys(formData).length > 0) {
      const body = new FormData();
      for (const [key, value] of Object.entries(formData)) {
        body.append(key, value);
      }
      body.append('file', new Blob([fileBuffer], { type: fileType }), fileName);
      response = await fetch(presignedUrl, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(env.TYPEBOT_REQUEST_TIMEOUT_MS),
      });
    } else {
      response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': fileType },
        body: fileBuffer,
        signal: AbortSignal.timeout(env.TYPEBOT_REQUEST_TIMEOUT_MS),
      });
    }
  } catch (cause) {
    throw appError('File upload to storage failed', { errorCode: 'TYPEBOT_UPLOAD_FAILED', cause });
  }

  const responseText = await response.text().catch(() => '');
  logger.debug(
    { presignedUrl, formDataKeys: formData ? Object.keys(formData) : [], status: response.status, responseText },
    'DEBUG typebot storage upload'
  );

  if (!response.ok) {
    throw appError(`File upload failed with status ${response.status}`, {
      statusCode: response.status,
      errorCode: 'TYPEBOT_UPLOAD_FAILED',
    });
  }
}

// --- Expired sessions -------------------------------------------------------
//
// Typebot drops idle chat sessions (observed live: a session went 20m51s without a turn and the
// next continueChat 404'd). We hold the sessionId in memory, so without this the same dead id is
// resent on every following message and the member is wedged permanently - the only cure being a
// server restart. See AGENTS.md.
//
// The two endpoints report it differently, confirmed by calling both with a bogus sessionId:
//   continueChat       404 { code: 'NOT_FOUND',   message: 'Session not found.' }
//   generateUploadUrl  400 { code: 'BAD_REQUEST', message: "Can't find session" }
// so matching on 404 alone would miss uploads.
//
// Deliberately narrow. A 404 from startChat means TYPEBOT_ID is wrong, which must keep failing
// loudly rather than being retried as a "stale session" - callers only consult this around
// continueChat/generateUploadUrl.
export function isDeadSessionError(err) {
  if (err?.errorCode !== 'TYPEBOT_REQUEST_FAILED') return false;
  if (err.statusCode !== 404 && err.statusCode !== 400) return false;
  return /session not found|can'?t find session/i.test(String(err.message ?? ''));
}

export const typebotClient = {
  startChat,
  continueChat,
  generateUploadUrl,
  uploadToPresignedUrl,
};

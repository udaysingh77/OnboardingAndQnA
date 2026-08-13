// ==================================================================
// Registration engine - drives the Typebot-based onboarding flow.
// Relay model: this backend calls Typebot's Chat API on behalf of the
// frontend (frontend never talks to Typebot directly) - see
// modules/conversation/services/typebot/typebotClient.js. Session
// state (Typebot's sessionId + current input block) lives in
// typebotSessionStore. Response shape stays close to Typebot's own -
// no custom transformation, since the frontend's exact expectations
// aren't specified; adjust here if it needs a different shape.
// ==================================================================
import { badRequestError } from '../../../shared/errors.js';
import { logger } from '../../../utils/logger.js';
import { registrationService } from '../../registration/services/registration.service.js';
import { typebotClient } from '../services/typebot/typebotClient.js';
import { typebotSessionStore } from '../services/typebot/typebotSessionStore.js';
import { resolveDocumentType } from '../services/typebot/documentTypeMap.js';
import { resolveConversationField } from '../services/typebot/conversationFieldMap.js';
import { isSpotifyUrlStep, verifySpotifyClaim } from '../services/spotifyGate.js';

/**
 * @param {{ userId: string, token: string, message?: string, attachedFileUrls?: string[] }} input
 */
export async function handle({ userId, token, message, attachedFileUrls }) {
  const existing = typebotSessionStore.get(userId);

  // The Spotify-link step is gated: the conversation only advances past it
  // once the claimed track's credits actually match the account's name or
  // alias. A failed/invalid attempt never reaches Typebot's continueChat -
  // the session stays exactly where it was, and the same question is
  // re-asked, so the user can try another link.
  if (existing?.input && message && isSpotifyUrlStep(existing.input.options?.variableId)) {
    let verified = false;
    try {
      verified = await verifySpotifyClaim(userId, message);
    } catch (err) {
      logger.warn({ userId, err }, 'Spotify claim verification failed, blocking progression');
    }

    if (!verified) {
      return {
        sessionEnded: false,
        messages: [
          {
            id: 'spotify-verification-failed',
            type: 'text',
            content: {
              type: 'richText',
              richText: [
                {
                  type: 'p',
                  children: [
                    {
                      text: 'Invalid Spotify link - the credited artist name does not match your registered name or stage name. Please enter another Spotify link.',
                    },
                  ],
                },
              ],
            },
          },
        ],
        input: existing.input,
        progress: null,
      };
    }
  }

  // Typebot's own widget puts the file URL(s) in `text` too (not just
  // attachedFileUrls) when answering a file-input step - an empty text
  // answers gets rejected as "Invalid message" even though the docs say
  // text may be empty. Mirror the widget's behavior exactly.
  const text = message ?? (attachedFileUrls?.length ? attachedFileUrls.join(', ') : '');

  const response = existing
    ? await typebotClient.continueChat({
        sessionId: existing.sessionId,
        message: { type: 'text', text, attachedFileUrls },
      })
    : await typebotClient.startChat({
        prefilledVariables: { token, registrationId: userId },
      });

  // `message` answers the question the user was just asked (existing.input),
  // not the new one in `response.input` - persist it before overwriting the session.
  if (existing?.input && message) {
    const field = resolveConversationField(existing.input.options?.variableId);
    if (field) {
      try {
        await registrationService.saveConversationField(userId, userId, field, message);
      } catch (err) {
        logger.warn({ userId, field, err }, 'Failed to persist conversation answer, continuing relay');
      }
    }
  }

  // continueChat's response doesn't repeat sessionId - keep the one we already have.
  const sessionId = existing ? existing.sessionId : response.sessionId;
  const ended = !response.input;

  if (ended) {
    typebotSessionStore.clear(userId);
  } else {
    typebotSessionStore.set(userId, { sessionId, input: response.input });
  }

  return {
    sessionEnded: ended,
    messages: response.messages,
    input: response.input ?? null,
    progress: response.progress ?? null,
  };
}

// Handles a raw file upload for the current file-input step: gets a
// presigned URL from Typebot, uploads the bytes, persists the document
// (+ OCR, via the same saveDocument() the old Studio HTTP blocks used
// to call) when the current block maps to a known document type, then
// advances the conversation exactly like a normal message would.
/**
 * @param {{ userId: string, token: string, file: { originalname: string, mimetype: string, size: number, buffer: Buffer } }} input
 */
export async function handleUpload({ userId, token, file }) {
  const session = typebotSessionStore.get(userId);
  if (!session?.input || session.input.type !== 'file input') {
    throw badRequestError('No active file-upload step in the conversation');
  }

  const { id: blockId, options } = session.input;
  const variableId = options?.variableId;

  const { presignedUrl, formData, fileUrl } = await typebotClient.generateUploadUrl({
    sessionId: session.sessionId,
    blockId,
    fileName: file.originalname,
    fileType: file.mimetype,
    fileSize: file.size,
  });

  await typebotClient.uploadToPresignedUrl({
    presignedUrl,
    formData,
    fileBuffer: file.buffer,
    fileName: file.originalname,
    fileType: file.mimetype,
  });

  const docType = resolveDocumentType(variableId);
  if (docType) {
    await registrationService.saveDocument(userId, userId, docType, fileUrl);
  }

  return handle({ userId, token, attachedFileUrls: [fileUrl] });
}

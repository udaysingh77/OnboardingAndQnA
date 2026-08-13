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

// Only these fields are shown to the user for confirmation (per doc type,
// in this order) - see "Document Verification API" for the real OCR
// response shape. Everything else (isValid, documentType, holderTypeCode,
// accountNumberSource, ifscSource, ifscVerified, bankCode, branchCode) is
// internal/provenance metadata, not something a user confirms.
const OCR_FIELD_LABELS = {
  PAN: { name: 'Name', pan: 'PAN Number', dob: 'Date of Birth', holderType: 'Holder Type' },
  AADHAAR: { name: 'Name', aadhaar: 'Aadhaar Number', dob: 'Date of Birth', gender: 'Gender', address: 'Address' },
  BANK: {
    bankName: 'Bank Name',
    accountNumber: 'Account Number',
    ifsc: 'IFSC Code',
    branch: 'Branch',
    city: 'City',
    state: 'State',
    micr: 'MICR Code',
  },
};

function isAffirmative(message) {
  const normalized = String(message ?? '').trim().toLowerCase();
  return ['yes, confirm', 'yes', 'y', 'confirm'].includes(normalized);
}

function textMessage(id, text) {
  return {
    id,
    type: 'text',
    content: { type: 'richText', richText: [{ type: 'p', children: [{ text }] }] },
  };
}

function buildOcrConfirmationMessages(docType, extracted) {
  const labels = OCR_FIELD_LABELS[docType] ?? {};
  const lines = Object.entries(labels)
    .map(([key, label]) => [label, extracted?.[key]])
    .filter(([, value]) => value != null && value !== '')
    .map(([label, value]) => `${label}: ${value}`);

  return [
    textMessage('ocr-confirmation-intro', `We extracted the following ${docType} details:`),
    textMessage('ocr-confirmation-values', lines.join('\n')),
    textMessage('ocr-confirmation-prompt', 'Is this correct?'),
  ];
}

const OCR_CONFIRM_CHOICE_INPUT = {
  id: 'ocr-confirmation',
  type: 'choice input',
  items: [
    { id: 'ocr-confirm-yes', content: 'Yes, confirm' },
    { id: 'ocr-confirm-no', content: 'No, re-upload' },
  ],
};

/**
 * @param {{ userId: string, token: string, message?: string, attachedFileUrls?: string[] }} input
 */
export async function handle({ userId, token, message, attachedFileUrls }) {
  let existing = typebotSessionStore.get(userId);

  // A stored session can be a leftover from an earlier, never-finished
  // conversation (in-memory store, only clears on completion or server
  // restart - logging in again doesn't touch it). An empty call (no
  // message, no attachedFileUrls) is never a valid answer to a real
  // pending question - it's exactly the shape of a genuine "start" call -
  // so treat it as intent to start over rather than failing with
  // "Invalid message" against a question the caller doesn't know about.
  if (existing && message === undefined && (!attachedFileUrls || attachedFileUrls.length === 0)) {
    logger.warn({ userId }, 'Discarding stale conversation session on empty start call');
    typebotSessionStore.clear(userId);
    existing = null;
  }

  // Resolve a pending OCR-confirmation before doing anything else - the
  // incoming `message` answers "is this correct?", not whatever Typebot
  // question was live before the upload.
  if (existing?.pendingDocConfirmation && message !== undefined) {
    const { fileUrl } = existing.pendingDocConfirmation;

    if (!isAffirmative(message)) {
      typebotSessionStore.set(userId, { sessionId: existing.sessionId, input: existing.input });
      return {
        sessionEnded: false,
        messages: [textMessage('ocr-confirmation-rejected', 'No problem - please upload the document again.')],
        input: existing.input,
        progress: null,
      };
    }

    // Confirmed: replay this exactly as handleUpload() would have advanced
    // the conversation before this confirmation step existed.
    typebotSessionStore.set(userId, { sessionId: existing.sessionId, input: existing.input });
    existing = typebotSessionStore.get(userId);
    message = undefined;
    attachedFileUrls = [fileUrl];
  }

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
    // Mark the registration complete in-process now that the Typebot flow has
    // genuinely run out of questions - don't rely on a Studio HTTP block to do
    // this externally (same reasoning as handleUpload() saving documents
    // in-process). complete() is idempotent and validates basic details +
    // required docs itself; REGISTRATION_INCOMPLETE is an expected outcome
    // for an early/abandoned session, not a failure worth warning about.
    try {
      await registrationService.complete(userId, userId);
    } catch (err) {
      if (err.errorCode === 'REGISTRATION_INCOMPLETE') {
        logger.info({ userId, missing: err.details?.missing }, 'Typebot session ended but registration is still incomplete');
      } else {
        logger.warn({ userId, err }, 'Failed to auto-complete registration on session end');
      }
    }
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
  let result = null;
  if (docType) {
    result = await registrationService.saveDocument(userId, userId, docType, fileUrl);
  }

  // OCR was attempted (result carries an `extracted` key, even if null) -
  // gate on the user confirming what was read, or ask for a better image
  // if nothing could be read at all. Non-OCR doc types (no `extracted` key
  // present) fall straight through to the normal advance, unchanged.
  if (result && Object.prototype.hasOwnProperty.call(result, 'extracted')) {
    if (result.extracted) {
      typebotSessionStore.set(userId, {
        sessionId: session.sessionId,
        input: session.input,
        pendingDocConfirmation: { fileUrl },
      });

      return {
        sessionEnded: false,
        messages: buildOcrConfirmationMessages(docType, result.extracted),
        input: OCR_CONFIRM_CHOICE_INPUT,
        progress: null,
      };
    }

    return {
      sessionEnded: false,
      messages: [
        textMessage(
          'ocr-extraction-failed',
          `We couldn't read this ${docType} document clearly. Please upload a clearer, better-quality image.`,
        ),
      ],
      input: session.input,
      progress: null,
    };
  }

  return handle({ userId, token, attachedFileUrls: [fileUrl] });
}

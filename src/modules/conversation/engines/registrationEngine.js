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
import { registrationService, OCR_TYPE_BY_DOC_TYPE } from '../../registration/services/registration.service.js';
import { typebotClient, isDeadSessionError } from '../services/typebot/typebotClient.js';
import { typebotSessionStore } from '../services/typebot/typebotSessionStore.js';
import { resolveDocumentType } from '../services/typebot/documentTypeMap.js';
import { resolveConversationField } from '../services/typebot/conversationFieldMap.js';
import {
  isWorkLinkStep,
  confirmsSong,
  wantsAnotherLink,
  describeSong,
  describeCredits,
  MAX_WORK_LINKS,
  MAX_ALIAS_ATTEMPTS,
  WORK_LINK_CONFIRM_INPUT,
  WORK_LINK_ALIAS_INPUT,
  WORK_LINK_MORE_INPUT,
} from '../services/typebot/workLinkGate.js';
import { workLinkService } from '../../work/services/workLink.service.js';
import { resolveWorkLink } from '../../work/services/workLinkResolver.service.js';
import { matchCredits, MATCH_TRUST } from '../../work/services/workMatch.service.js';
import {
  isPaymentStep,
  confirmsReview,
  describeReview,
  describeCorrection,
  PAYMENT_REVIEW_INPUT,
} from '../services/typebot/paymentGate.js';
import { registrationReviewService } from '../../registration/services/registrationReview.service.js';
import { resolveProgress } from '../services/typebot/progressMap.js';
import {
  isEmailStep,
  isValidEmail,
  isResendKeyword,
  isChangeEmailKeyword,
  sendVerificationOtp,
  verifyVerificationOtp,
  describeOtpSent,
  describeOtpProblem,
  describeChangeLimitReached,
  MAX_EMAIL_CHANGES,
} from '../services/emailOtpGate.js';
import { isAddressProofTypeStep, resolveAddressProofOcrType, isManualAddressAnswer } from '../services/typebot/addressProofTypeMap.js';

// Only these fields are shown to the user for confirmation (per doc type,
// in this order) - see "Document Verification API" for the real OCR
// response shape. Everything else (isValid, documentType, holderTypeCode,
// accountNumberSource, ifscSource, ifscVerified, bankCode, branchCode) is
// internal/provenance metadata, not something a user confirms.
export const OCR_FIELD_LABELS = {
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
  // Not live on ocr.choira.io yet (see registration.service.js's OCR_DOC_TYPES comment) - wired
  // ahead of deployment. Curated user-facing subset of the "Document Verification API" collection's
  // fields, not the internal-only meta fields (detectionScore/formatTier/ocrValid/governmentVerified).
  DRIVING_LICENCE: {
    name: 'Name',
    drivingLicence: 'Licence Number',
    state: 'State',
    validTill: 'Valid Till',
    vehicleClasses: 'Vehicle Classes',
    issuingAuthority: 'Issuing Authority',
    address: 'Address',
  },
  VOTER_ID: {
    name: 'Name',
    epicNumber: 'EPIC Number',
    fatherOrHusbandName: 'Relation Name',
    gender: 'Gender',
    address: 'Address',
    state: 'State',
    assemblyConstituency: 'Assembly Constituency',
  },
  // `name` and `dob` are composed by normalizeExtracted() in registration.service.js - the passport
  // module itself returns surname/givenName and dateOfBirth. passportNumberValid (the MRZ check
  // digit) is deliberately not shown: it is provenance for staff, not something a member confirms.
  PASSPORT: {
    name: 'Name',
    passportNumber: 'Passport Number',
    dob: 'Date of Birth',
    dateOfExpiry: 'Valid Till',
    nationality: 'Nationality',
  },
  //
  // Same caveat as PAN/DRIVING_LICENCE above - collection only documents "Bill name + address" for
  // ELECTRICITY, not yet confirmed against a real success response.
  ELECTRICITY: { name: 'Name', address: 'Address' },
};

// Upload slots whose document type isn't known from the upload block itself - it was recorded a
// turn earlier from the paired "what type of document is this?" choice question (see
// addressProofTypeMap.js). Individual/NRI paths use the first two; the company paths add three more.
const ADDRESS_PROOF_UPLOAD_TYPES = new Set([
  'PERMANENT_ADDRESS_PROOF',
  'CURRENT_ADDRESS_PROOF',
  'REGISTERED_ADDRESS_PROOF',
  'COMM_ADDRESS_PROOF',
  'COMM_ADDRESS_PROOF_2',
]);

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

// Shown when Typebot dropped an idle session and we started a fresh chat underneath the member.
// Typebot has no "resume at block X", so the questions do start again - but everything already
// answered is in our own database, not in Typebot's session, so say that plainly rather than
// letting them think the uploads are gone.
function describeSessionRestart() {
  return "You were away for a while, so the chat timed out and we've started it again. Nothing you already sent is lost - your uploaded documents and answers are saved.";
}

// Same situation, but hit on a file upload. The file can't be re-aimed at a chat that no longer has
// that question, so we don't silently restart here - we hand the next turn back to handle().
function describeSessionRestartOnUpload() {
  return "You were away for a while, so the chat timed out and this file wasn't attached. Your earlier documents and answers are saved - send any message to carry on, and we'll ask for it again.";
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

// Synthetic block for the email-OTP step - not a real Typebot block, Studio
// needs no changes (same non-Typebot-block pattern as OCR_CONFIRM_CHOICE_INPUT).
const EMAIL_OTP_INPUT = { id: 'email-otp-verification', type: 'text input', options: {} };

// Hold the conversation on the work-link step and ask again. Typebot is never advanced, so the
// member can retry as often as they need without burning one of their MAX_WORK_LINKS slots.
function askForAnotherLink(existing, text) {
  return {
    sessionEnded: false,
    messages: [textMessage('work-link-retry', text)],
    input: existing.input,
    progress: resolveProgress(existing.input.id),
  };
}

// Persist the confirmed song, then either offer another slot or fall through to Typebot.
// Returns either a full reply (the member is under the cap and is offered another link) or
// `{ advance, notice }` - the conversation should carry on to Typebot, and `notice` is what to tell
// the member on the way past. The notice matters: at the cap this used to return nothing at all, so
// the fifth link saved silently and a sixth was discarded silently, both while the other four each
// got a "Saved - that's N of 5" line. Confirming a song and being told nothing reads as a bug.
async function saveAndOfferAnother({ userId, existing, resolved, trust, note }) {
  let count = null;
  let stored = null;
  try {
    // Only a name that was on file beforehand counts as verified - see workMatch.service.js.
    stored = await workLinkService.saveWorkLink({ userId, resolved, matched: trust === MATCH_TRUST.TRUSTED });
    count = await workLinkService.countWorkLinks(userId);
  } catch (err) {
    // A storage failure must not strand the member on this step - log it and let the conversation
    // move on, same stance as the OCR persistence path.
    logger.warn({ userId, err }, 'Failed to save work link, advancing without the loop');
    return { advance: true, notice: null };
  }

  const saved = note ?? `Saved - that's ${count} of ${MAX_WORK_LINKS} links.`;

  if (count < MAX_WORK_LINKS) {
    typebotSessionStore.set(userId, {
      sessionId: existing.sessionId,
      input: existing.input,
      pendingWorkLinkChoice: { lastUrl: resolved.url },
    });

    return {
      sessionEnded: false,
      messages: [textMessage('work-link-saved', `${saved} Would you like to add another?`)],
      input: WORK_LINK_MORE_INPUT,
      progress: resolveProgress(existing.input.id),
    };
  }

  // At the cap. `stored` is null when saveWorkLink refused because the member was already at five
  // before this link - they confirmed a song that was not kept, and have to be told so.
  return {
    advance: true,
    notice: stored
      ? `${saved} That's the maximum, so we'll move on.`
      : `You've already added the maximum of ${MAX_WORK_LINKS} links, so this one wasn't saved.`,
  };
}

/**
 * @param {{ userId: string, token: string, message?: string, attachedFileUrls?: string[] }} input
 */
export async function handle({ userId, token, message, attachedFileUrls }) {
  let existing = typebotSessionStore.get(userId);
  let bypassEmailGate = false;
  let bypassWorkLinkSave = false;
  // Something to tell the member about their work link while the conversation moves past the step -
  // prepended to Typebot's own reply at the end of the relay.
  let workLinkNotice = null;

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
        progress: resolveProgress(existing.input.id),
      };
    }

    // Confirmed: replay this exactly as handleUpload() would have advanced
    // the conversation before this confirmation step existed.
    typebotSessionStore.set(userId, { sessionId: existing.sessionId, input: existing.input });
    existing = typebotSessionStore.get(userId);
    message = undefined;
    attachedFileUrls = [fileUrl];
  }

  // Resolve a pending email-OTP verification before anything else - the
  // incoming `message` answers "what's the OTP?" (or "resend"), not the
  // original email question.
  if (existing?.pendingEmailVerification && message !== undefined) {
    const { email } = existing.pendingEmailVerification;
    // typebotSessionStore.set() replaces the whole session object, so this counter has to be
    // carried forward explicitly by every set() on the email path - the OTP send, the change
    // branch and the post-verification replay. Miss one and the cap silently resets.
    const emailChanges = existing.emailChanges ?? 0;

    // A mistyped address is the one way this step used to wedge for good: no code ever arrives,
    // every guess fails, and resending just mails the same wrong address.
    if (isChangeEmailKeyword(message)) {
      if (emailChanges >= MAX_EMAIL_CHANGES) {
        return {
          sessionEnded: false,
          messages: [textMessage('email-change-limit', describeChangeLimitReached())],
          input: EMAIL_OTP_INPUT,
          progress: resolveProgress(existing.input.id),
        };
      }

      // Hand back the real Typebot email block. The next answer re-enters the email gate below and
      // is validated, duplicate-checked and sent an OTP exactly like the first one was.
      typebotSessionStore.set(userId, {
        sessionId: existing.sessionId,
        input: existing.input,
        emailChanges: emailChanges + 1,
      });

      return {
        sessionEnded: false,
        messages: [textMessage('email-change-prompt', 'No problem - what email address should we use instead?')],
        input: existing.input,
        progress: resolveProgress(existing.input.id),
      };
    }

    if (isResendKeyword(message)) {
      try {
        await sendVerificationOtp(email);
        return {
          sessionEnded: false,
          messages: [textMessage('email-otp-resent', describeOtpSent(email))],
          input: EMAIL_OTP_INPUT,
          progress: resolveProgress(existing.input.id),
        };
      } catch (err) {
        return {
          sessionEnded: false,
          messages: [textMessage('email-otp-resend-failed', describeOtpProblem(err.message))],
          input: EMAIL_OTP_INPUT,
          progress: resolveProgress(existing.input.id),
        };
      }
    }

    try {
      await verifyVerificationOtp(email, message);
    } catch (err) {
      return {
        sessionEnded: false,
        messages: [textMessage('email-otp-invalid', describeOtpProblem(err.message))],
        input: EMAIL_OTP_INPUT,
        progress: resolveProgress(existing.input.id),
      };
    }

    // Verified: replay this exactly as if the user had just answered the
    // original email question correctly - existing.input stays the real
    // Typebot email-input block, so the normal relay/persist logic below
    // treats `email` as the answer to it.
    typebotSessionStore.set(userId, { sessionId: existing.sessionId, input: existing.input, emailChanges });
    existing = typebotSessionStore.get(userId);
    bypassEmailGate = true;
    message = email;
  }

  // Resolve the pre-payment review. The stashed input is the real payment block Typebot handed
  // us a turn ago - either answer ends up returning it, because Typebot can't be driven backwards
  // and stranding someone on a review screen would be worse than letting them pay and write in.
  if (existing?.pendingPaymentReview && message !== undefined) {
    const { input } = existing.pendingPaymentReview;
    typebotSessionStore.set(userId, { sessionId: existing.sessionId, input });

    if (confirmsReview(message)) {
      return {
        sessionEnded: false,
        messages: [],
        input,
        progress: resolveProgress(input.id),
      };
    }

    return {
      sessionEnded: false,
      messages: [textMessage('payment-review-correction', describeCorrection(userId))],
      input,
      progress: resolveProgress(input.id),
    };
  }

  // Resolve a pending "is this your song?" answer. Nothing has been written yet at this point -
  // "No" simply drops the resolved song and re-asks, so a wrong link leaves no trace.
  if (existing?.pendingWorkLinkConfirm && message !== undefined) {
    const { resolved } = existing.pendingWorkLinkConfirm;
    typebotSessionStore.set(userId, { sessionId: existing.sessionId, input: existing.input });
    existing = typebotSessionStore.get(userId);

    if (!confirmsSong(message)) {
      return askForAnotherLink(existing, 'No problem - please share the correct link to your song.');
    }

    // Names already on file: the identity-document name and the registration stage name are
    // evidence; aliases the member gave at this step on an earlier song are only their own claim.
    const { trusted, claimed } = await registrationService.getIdentityNames(userId);
    const { matched, trust } = matchCredits(resolved, trusted, claimed);

    if (!matched) {
      // Not in the credits. The usual reason is a stage name we don't have on file rather than a
      // false claim, so ask for it instead of blocking - see AGENTS.md.
      typebotSessionStore.set(userId, {
        sessionId: existing.sessionId,
        input: existing.input,
        pendingWorkLinkAlias: { resolved, attempts: 0 },
      });

      return {
        sessionEnded: false,
        messages: [textMessage('work-link-credits-mismatch', describeCredits(resolved))],
        input: WORK_LINK_ALIAS_INPUT,
        progress: resolveProgress(existing.input.id),
      };
    }

    const outcome = await saveAndOfferAnother({ userId, existing, resolved, trust });
    if (!outcome.advance) return outcome;
    // At the cap: replay the url as the answer to the real Typebot step so the conversation
    // advances exactly as it would have without the loop, with the save bypassed. The notice
    // rides along so the member still hears what happened to the link they just confirmed.
    workLinkNotice = outcome.notice;
    bypassWorkLinkSave = true;
    message = resolved.url;
  }

  // Resolve a pending "what name are you credited under?" answer.
  if (existing?.pendingWorkLinkAlias && message !== undefined) {
    const { resolved, attempts } = existing.pendingWorkLinkAlias;
    const alias = message;
    typebotSessionStore.set(userId, { sessionId: existing.sessionId, input: existing.input });
    existing = typebotSessionStore.get(userId);

    // The member may give several names at once ("Aditya Prateek, AP").
    const names = registrationService.parseAliasList(alias);

    // Stored whether or not they match *this* song - that is the point of collecting them, and the
    // member's next links are matched against them without asking again. Never trusted: they were
    // supplied after we showed the credit list, so a match here is a claim, not a check.
    if (names.length > 0) {
      await registrationService.addAliases(userId, names).catch((err) => {
        logger.warn({ userId, err }, 'Could not store the credited names');
      });
    }

    const { matched } = matchCredits(resolved, [], names);

    if (!matched && attempts + 1 < MAX_ALIAS_ATTEMPTS) {
      typebotSessionStore.set(userId, {
        sessionId: existing.sessionId,
        input: existing.input,
        pendingWorkLinkAlias: { resolved, attempts: attempts + 1 },
      });

      return {
        sessionEnded: false,
        messages: [
          textMessage(
            'work-link-alias-retry',
            "That name isn't in the credits either. Please check how your name appears on the release and enter it exactly.",
          ),
        ],
        input: WORK_LINK_ALIAS_INPUT,
        progress: resolveProgress(existing.input.id),
      };
    }

    // Either the supplied name is in the credits, or attempts ran out - both save. A member must
    // never be stuck on this step; staff can find every claim from the CreatedBy marker.
    const outcome = await saveAndOfferAnother({
      userId,
      existing,
      resolved,
      trust: MATCH_TRUST.CLAIMED,
      note: matched
        ? "Thanks - we've saved this song, and we'll remember that name for your next one."
        : "We've saved this song. Our team will verify your credit on it.",
    });
    if (!outcome.advance) return outcome;
    workLinkNotice = outcome.notice;
    bypassWorkLinkSave = true;
    message = resolved.url;
  }

  // Resolve a pending "add another link?" answer - the incoming `message`
  // answers that synthetic question, not the real Typebot one underneath.
  // "Yes" re-asks for a link without advancing Typebot; "No" falls through
  // to the normal relay, which advances past the link step.
  if (existing?.pendingWorkLinkChoice && message !== undefined) {
    const { lastUrl } = existing.pendingWorkLinkChoice;
    typebotSessionStore.set(userId, { sessionId: existing.sessionId, input: existing.input });
    existing = typebotSessionStore.get(userId);

    if (wantsAnotherLink(message)) {
      return {
        sessionEnded: false,
        messages: [textMessage('work-link-next', 'Please share the next link to your work.')],
        input: existing.input,
        progress: resolveProgress(existing.input.id),
      };
    }

    // Declined - replay the last link as the answer to the real Typebot step
    // so the conversation advances exactly as it would have without the loop.
    // bypassWorkLinkSave stops that replay from saving the same link twice.
    bypassWorkLinkSave = true;
    message = lastUrl;
  }

  // Work links: the member may claim up to MAX_WORK_LINKS songs, but the flow asks once. Everything
  // between the paste and the save is driven from here with synthetic blocks (see workLinkGate.js):
  // identify the provider, fetch the song, show it back for confirmation, and - when the credits
  // don't carry the member's name - ask which name they are credited under. Nothing is written until
  // the member has confirmed the song; a rejected or unrecognised link never reaches Typebot, so the
  // session stays on this step and the question simply repeats.
  if (!bypassWorkLinkSave && existing?.input && message && isWorkLinkStep(existing.input.options?.variableId)) {
    let resolved;
    try {
      resolved = await resolveWorkLink(message);
    } catch (err) {
      logger.warn({ userId, err }, 'Could not resolve work link');
      return askForAnotherLink(existing, "We couldn't read that link. Please check it and share the link to your song again.");
    }

    if (!resolved) {
      return askForAnotherLink(existing, 'Please share a Spotify or YouTube link to your song.');
    }

    if (!resolved.isMusicVideo) {
      return askForAnotherLink(existing, "That doesn't look like a song. Please share a link to your song.");
    }

    typebotSessionStore.set(userId, {
      sessionId: existing.sessionId,
      input: existing.input,
      pendingWorkLinkConfirm: { resolved },
    });

    return {
      sessionEnded: false,
      messages: [textMessage('work-link-confirm', describeSong(resolved))],
      input: WORK_LINK_CONFIRM_INPUT,
      progress: resolveProgress(existing.input.id),
    };
  }

  // The email step is gated: a fresh answer to "Provide your email id"
  // triggers an OTP send instead of relaying straight to Typebot - the
  // conversation only advances once verifyVerificationOtp() succeeds
  // (handled above, on a later turn). Skipped on the post-verification
  // replay (bypassEmailGate) so a just-verified email doesn't re-trigger
  // a fresh OTP send.
  if (!bypassEmailGate && existing?.input && message && isEmailStep(existing.input.options?.variableId)) {
    if (!isValidEmail(message)) {
      return {
        sessionEnded: false,
        messages: [textMessage('email-invalid-format', 'That doesn\'t look like a valid email address. Please enter a valid email.')],
        input: existing.input,
        progress: resolveProgress(existing.input.id),
      };
    }

    // One account per email. Checked before the OTP is sent, so the member isn't walked through a
    // verification whose result could never be saved - and no mail is wasted on it either. The
    // filtered unique index on App_Accounts(AccountEmail) is the real guarantee; this is the
    // message that makes it comprehensible.
    if (await registrationService.isEmailTakenByAnotherAccount(userId, message)) {
      return {
        sessionEnded: false,
        messages: [textMessage('email-already-registered', 'That email is already registered to another account. Please enter a different one.')],
        input: existing.input,
        progress: resolveProgress(existing.input.id),
      };
    }

    try {
      await sendVerificationOtp(message);
    } catch (err) {
      return {
        sessionEnded: false,
        messages: [textMessage('email-otp-send-failed', err.message)],
        input: existing.input,
        progress: resolveProgress(existing.input.id),
      };
    }

    typebotSessionStore.set(userId, {
      sessionId: existing.sessionId,
      input: existing.input,
      pendingEmailVerification: { email: message },
      emailChanges: existing.emailChanges ?? 0,
    });

    return {
      sessionEnded: false,
      messages: [textMessage('email-otp-sent', describeOtpSent(message))],
      input: EMAIL_OTP_INPUT,
      progress: resolveProgress(existing.input.id),
    };
  }

  // Typebot's own widget puts the file URL(s) in `text` too (not just
  // attachedFileUrls) when answering a file-input step - an empty text
  // answers gets rejected as "Invalid message" even though the docs say
  // text may be empty. Mirror the widget's behavior exactly.
  const text = message ?? (attachedFileUrls?.length ? attachedFileUrls.join(', ') : '');

  const beginChat = () => typebotClient.startChat({ prefilledVariables: { token, registrationId: userId } });

  // The question this `message` is answering. Captured before the relay because an expired session
  // drops `existing` - the answer is still valid and still worth persisting, even though Typebot
  // has forgotten where it asked it.
  const answeredInput = existing?.input;
  let sessionExpired = false;
  let response;

  if (existing) {
    try {
      response = await typebotClient.continueChat({
        sessionId: existing.sessionId,
        message: { type: 'text', text, attachedFileUrls },
      });
    } catch (err) {
      if (!isDeadSessionError(err)) throw err;
      // Typebot dropped the session while the member was idle. Without this the same dead id goes
      // out on every later message and they can never get out - see typebotClient.isDeadSessionError.
      // One restart only: beginChat() failing is a real failure and must surface.
      logger.warn({ userId, sessionId: existing.sessionId }, 'Typebot session expired - restarting the conversation');
      typebotSessionStore.clear(userId);
      existing = null;
      sessionExpired = true;
      response = await beginChat();
    }
  } else {
    response = await beginChat();
  }

  // `message` answers the question the user was just asked (answeredInput),
  // not the new one in `response.input` - persist it before overwriting the session.
  let addressProofOcrType;
  if (answeredInput && message) {
    const field = resolveConversationField(answeredInput.options?.variableId);
    if (field) {
      try {
        await registrationService.saveConversationField(userId, userId, field, message);
      } catch (err) {
        logger.warn({ userId, field, err }, 'Failed to persist conversation answer, continuing relay');
      }
    }

    // Remember which document type the user just picked for their permanent/current address
    // proof - the paired file-upload question (next turn) has no way to know this on its own,
    // since the upload lands in one shared variable regardless of type. Consulted by
    // handleUpload() to decide OCR routing (see addressProofTypeMap.js).
    if (isAddressProofTypeStep(answeredInput.options?.variableId)) {
      addressProofOcrType = resolveAddressProofOcrType(message);
      if (addressProofOcrType === null && !isManualAddressAnswer(message)) {
        logger.warn({ userId, message }, 'Address-proof type answer did not resolve to an OCR type');
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
    typebotSessionStore.set(userId, {
      sessionId,
      input: response.input,
      ...(addressProofOcrType !== undefined ? { addressProofOcrType } : {}),
    });
  }

  // Notices that explain something about *this* turn, above whatever Typebot said. The expiry one
  // goes first: it explains why the member is suddenly looking at the first question again.
  const notices = [
    ...(sessionExpired ? [textMessage('session-expired', describeSessionRestart())] : []),
    ...(workLinkNotice ? [textMessage('work-link-cap', workLinkNotice)] : []),
  ];
  const messages = notices.length ? [...notices, ...(response.messages ?? [])] : (response.messages ?? []);

  // Typebot just offered the payment button. Hold it back one turn and show the member everything
  // on file first - much of it was read off their documents by OCR rather than typed, and this is
  // the last point at which a wrong bank account number can still be caught. Typebot's own messages
  // are kept above the review, so nothing the flow said is lost.
  if (!ended && isPaymentStep(response.input?.id)) {
    try {
      const sections = await registrationReviewService.buildReview(userId);

      typebotSessionStore.set(userId, {
        sessionId,
        input: response.input,
        pendingPaymentReview: { input: response.input },
      });

      return {
        sessionEnded: false,
        messages: [...messages, textMessage('payment-review', describeReview(sections))],
        input: PAYMENT_REVIEW_INPUT,
        progress: resolveProgress(response.input.id),
      };
    } catch (err) {
      // Never block payment because the summary couldn't be built - fall through to the button.
      logger.warn({ userId, err }, 'Could not build the pre-payment review, showing payment directly');
    }
  }

  return {
    sessionEnded: ended,
    messages,
    input: response.input ?? null,
    progress: ended ? 100 : resolveProgress(response.input?.id),
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

  let upload;
  try {
    upload = await typebotClient.generateUploadUrl({
      sessionId: session.sessionId,
      blockId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
    });
  } catch (err) {
    if (!isDeadSessionError(err)) throw err;
    // Typebot expired the session while the member was picking a file. `blockId` belongs to a
    // question that no longer exists, so this upload cannot be salvaged - but leaving the dead
    // session in the store would wedge every later message too. Restart the chat so they land on a
    // real question with a working input, and say why the file didn't go through.
    logger.warn({ userId, sessionId: session.sessionId }, 'Typebot session expired during upload - restarting the conversation');
    typebotSessionStore.clear(userId);

    const restarted = await typebotClient.startChat({ prefilledVariables: { token, registrationId: userId } });
    if (restarted.input) {
      typebotSessionStore.set(userId, { sessionId: restarted.sessionId, input: restarted.input });
    }

    return {
      sessionEnded: !restarted.input,
      messages: [
        textMessage('session-expired-upload', describeSessionRestartOnUpload()),
        ...(restarted.messages ?? []),
      ],
      input: restarted.input,
      progress: restarted.input ? resolveProgress(restarted.input.id) : 100,
    };
  }

  const { presignedUrl, formData, fileUrl } = upload;

  await typebotClient.uploadToPresignedUrl({
    presignedUrl,
    formData,
    fileBuffer: file.buffer,
    fileName: file.originalname,
    fileType: file.mimetype,
  });

  const docType = resolveDocumentType(variableId);
  // Address-proof uploads (permanent/current) don't carry their own document type - it was
  // recorded a turn earlier from the paired type-choice question (see addressProofTypeMap.js /
  // registrationEngine.handle()). null means an unsupported type (Passport/Electricity Bill/
  // Letter from Property Owner) or none recorded - saveDocument() falls back to docType itself,
  // which isn't in OCR_DOC_TYPES, so OCR is correctly skipped.
  const isAddressProofUpload = ADDRESS_PROOF_UPLOAD_TYPES.has(docType);
  const ocrDocType = isAddressProofUpload ? session.addressProofOcrType : undefined;
  if (isAddressProofUpload && ocrDocType == null) {
    logger.warn({ userId, docType }, 'Address-proof upload has no OCR type recorded in session - OCR will be skipped');
  }

  let result = null;
  if (docType) {
    result = await registrationService.saveDocument(userId, userId, docType, fileUrl, ocrDocType);
  }

  // OCR was attempted (result carries an `extracted` key, even if null) -
  // gate on the user confirming what was read, or ask for a better image
  // if nothing could be read at all. Non-OCR doc types (no `extracted` key
  // present) fall straight through to the normal advance, unchanged.
  if (result && Object.prototype.hasOwnProperty.call(result, 'extracted')) {
    // Label the card by the type OCR was actually run under, not the type the row is stored as.
    // Two doc types differ: an address proof (DRIVING_LICENCE etc., chosen in a preceding question
    // and passed in as ocrDocType) and COMPANY_PAN (always read as a PAN, mapped statically by
    // registration.service.js). OCR_FIELD_LABELS has no entry for either stored caption, so
    // without this the card lists no fields at all - which is how COMPANY_PAN uploads came back
    // showing an empty extraction even though OCR had succeeded.
    const labelDocType = ocrDocType ?? OCR_TYPE_BY_DOC_TYPE[docType] ?? docType;

    if (result.extracted) {
      typebotSessionStore.set(userId, {
        sessionId: session.sessionId,
        input: session.input,
        pendingDocConfirmation: { fileUrl },
      });

      return {
        sessionEnded: false,
        messages: buildOcrConfirmationMessages(labelDocType, result.extracted),
        input: OCR_CONFIRM_CHOICE_INPUT,
        // OCR_CONFIRM_CHOICE_INPUT is a synthetic block, not a real flow id - the
        // user hasn't actually left the real upload question yet, so use its progress.
        progress: resolveProgress(session.input.id),
      };
    }

    return {
      sessionEnded: false,
      messages: [
        textMessage(
          'ocr-extraction-failed',
          `We couldn't read this ${labelDocType} document clearly. Please upload a clearer, better-quality image.`,
        ),
      ],
      input: session.input,
      progress: resolveProgress(session.input.id),
    };
  }

  return handle({ userId, token, attachedFileUrls: [fileUrl] });
}

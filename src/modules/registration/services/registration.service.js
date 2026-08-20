// ==================================================================
// Registration service - business logic for the onboarding status
// and for the Typebot-driven, section-based registration flow.
// Status is derived from App_Accounts.ApplicationStatus (1 = done).
// ==================================================================
import { badRequestError, forbiddenError, notFoundError } from '../../../shared/errors.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { registrationRepository } from '../repositories/registration.repository.js';
import { createOcrProvider } from './ocr/ocrProvider.factory.js';

const REGISTERED = 1;
const DOC_TYPES = Object.freeze({
  PAN: 'PAN',
  AADHAAR: 'AADHAAR', // no longer collected by the live flow (replaced by address-proof below) -
  // kept for back-compat, still usable via a direct REST call.
  BANK: 'BANK',
  NOC: 'NOC',
  COMPANY_DOC: 'COMPANY_DOC',
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  // Generic "address proof" upload slots (permanent/current) - the live flow lets the user pick
  // one of 5 document types (Passport/Electricity Bill/Driving Licence/Voter ID/Letter from
  // Property Owner) for each, but always uploads into one of these two shared variables. Which
  // type was picked is routed to OCR conditionally - see addressProofTypeMap.js.
  PERMANENT_ADDRESS_PROOF: 'PERMANENT_ADDRESS_PROOF',
  CURRENT_ADDRESS_PROOF: 'CURRENT_ADDRESS_PROOF',
  // OCR-only doc types reachable via PERMANENT_ADDRESS_PROOF/CURRENT_ADDRESS_PROOF uploads when
  // the user picked one of these as their address-proof type - never a DocumentCaption on their
  // own, only ever passed as saveDocument()'s ocrDocType override. "Letter from Property Owner"
  // (the 5th address-proof choice) has no matching OCR endpoint anywhere and stays unmapped.
  DRIVING_LICENCE: 'DRIVING_LICENCE',
  VOTER_ID: 'VOTER_ID',
  PASSPORT: 'PASSPORT',
  ELECTRICITY: 'ELECTRICITY',
});
// Only these gate /complete - NOC/COMPANY_DOC/PROFILE_PHOTO/CURRENT_ADDRESS_PROOF are
// conditional/optional in the flow. PERMANENT_ADDRESS_PROOF replaces AADHAAR as the mandatory
// address-proof step - the live flow never asks for Aadhaar specifically anymore.
const REQUIRED_DOC_TYPES = [DOC_TYPES.PAN, DOC_TYPES.BANK, DOC_TYPES.PERMANENT_ADDRESS_PROOF];
// OCR runs for these - NOC/company docs/address-proof-with-an-unsupported-type are saved as-is.
const OCR_DOC_TYPES = [
  DOC_TYPES.PAN,
  DOC_TYPES.AADHAAR,
  DOC_TYPES.BANK,
  DOC_TYPES.DRIVING_LICENCE,
  DOC_TYPES.VOTER_ID,
  DOC_TYPES.PASSPORT,
  DOC_TYPES.ELECTRICITY,
  DOC_TYPES.PROFILE_PHOTO,
];
// AppAccounts has no PAN/Aadhaar-number columns beyond PANNo, so only PAN is persisted;
// Aadhaar OCR result is used for verification only. Bank OCR maps onto its existing columns.
const BANK_FIELD_MAP = { bankName: 'BankName', accountNumber: 'BankAcNo', ifsc: 'BankIFSCCode', branch: 'BankBranchName', micr: 'MicrCode' };
// Fields conversationFieldMap.js is allowed to write to - keeps an arbitrary
// mapped column name from being trusted blindly, even though the map only
// ever contains these three today.
const CONVERSATION_FIELDS = ['GSTNo', 'AccountAlias', 'AccountEmail', 'PlaceOfBirth', 'RollTypeIds', 'TeritoryAppFor'];

const ocrProvider = createOcrProvider();

// Used by the Spotify-claim gate (conversation module) to know which names
// to check a track's artist credits against.
async function getIdentityNames(userId) {
  const account = await registrationRepository.findByAccountId(userId);
  if (!account) throw notFoundError('User not found');
  return { accountName: account.AccountName, accountAlias: account.AccountAlias };
}

async function getStatus(userId) {
  const account = await registrationRepository.findByAccountId(userId);
  if (!account) throw notFoundError('User not found');
  return toPublic(account);
}

// The registrationId param must match the authenticated user - the id alone is
// never sufficient to touch another user's registration.
function assertOwnRegistration(userId, registrationId) {
  if (String(registrationId) !== String(userId)) {
    throw forbiddenError('Registration does not belong to the authenticated user');
  }
}

// `ocrDocType` lets a caller run OCR under a different type than the DocumentCaption being saved -
// used for PERMANENT_ADDRESS_PROOF/CURRENT_ADDRESS_PROOF uploads, where the DB row stays generic
// but the actual document might be a Driving Licence or Voter ID (see addressProofTypeMap.js).
async function saveDocument(userId, registrationId, docType, documentUrl, ocrDocType) {
  assertOwnRegistration(userId, registrationId);

  const account = await registrationRepository.findByAccountId(registrationId);
  if (!account) throw notFoundError('Registration not found');

  const effectiveOcrType = ocrDocType ?? docType;
  const ocrResult = OCR_DOC_TYPES.includes(effectiveOcrType)
    ? await runOcrAndPersist(registrationId, effectiveOcrType, documentUrl, docType)
    : null;

  // DocStatus: 0 = no OCR attempted (NOC/COMPANY_DOC/PROFILE_PHOTO), 1 = OCR-verified, 2 = OCR failed.
  const docStatus = ocrResult ? (ocrResult.verified ? 1 : 2) : 0;

  const doc = await registrationRepository.upsertDocument({
    accountId: registrationId,
    caption: docType,
    documentUrl,
    docStatus,
  });

  return toDocumentPublic(doc, ocrResult);
}

// Persists a single text/choice conversation answer (GST number, alias/stage
// name, email) onto its mapped AppAccounts column - see conversationFieldMap.js.
async function saveConversationField(userId, registrationId, field, value) {
  assertOwnRegistration(userId, registrationId);
  if (!CONVERSATION_FIELDS.includes(field)) return;

  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return;

  const update = { [field]: trimmed };
  if (field === 'GSTNo') update.Detail1 = trimmed;

  await registrationRepository.update(registrationId, update);
}

// OCR dates come back as "DD/MM/YYYY" strings (per the Document Verification API's documented
// response shape, e.g. PAN's "dob": "01/01/1990") - JS's Date constructor assumes MM/DD/YYYY, so
// parse explicitly. Returns undefined (skip the write) rather than throwing on an unparseable value.
function parseOcrDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? ''));
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// A failed OCR extraction never fails the upload - the document still saves,
// just flagged unverified (DocStatus = 2) so it can be reviewed manually.
// `addressSlot` is the original docType saveDocument() was called with, before any ocrDocType
// override - lets an address-proof upload's extracted address be routed to the right column
// (PERMANENT_ADDRESS_PROOF/CURRENT_ADDRESS_PROOF), independent of which OCR type actually ran.
async function runOcrAndPersist(registrationId, docType, documentUrl, addressSlot) {
  try {
    const extracted = await ocrProvider.extract({ docType, documentUrl });

    if (docType === DOC_TYPES.PAN && extracted.pan) {
      await registrationRepository.update(registrationId, { PANNo: extracted.pan, Detail2: extracted.pan });
    }

    if (docType === DOC_TYPES.BANK) {
      const bankUpdate = {};
      for (const [ocrKey, dbKey] of Object.entries(BANK_FIELD_MAP)) {
        if (extracted[ocrKey] != null) bankUpdate[dbKey] = extracted[ocrKey];
      }
      if (Object.keys(bankUpdate).length > 0) {
        await registrationRepository.update(registrationId, bankUpdate);
      }
    }

    if (extracted.address && addressSlot === DOC_TYPES.PERMANENT_ADDRESS_PROOF) {
      await registrationRepository.update(registrationId, { AccountAddress: extracted.address });
    } else if (extracted.address && addressSlot === DOC_TYPES.CURRENT_ADDRESS_PROOF) {
      await registrationRepository.update(registrationId, { AccountAddress_PR: extracted.address });
    }

    // Whichever doc type happens to extract these - PAN/Passport for dob, Aadhaar/Voter ID for
    // gender - opportunistically persisted the same way address is above.
    const dob = parseOcrDate(extracted.dob);
    if (dob) {
      await registrationRepository.update(registrationId, { DOB: dob });
    }
    if (extracted.gender) {
      await registrationRepository.update(registrationId, { Gender: extracted.gender });
    }
    if (docType === DOC_TYPES.PASSPORT && extracted.nationality) {
      await registrationRepository.update(registrationId, { Nationality: extracted.nationality });
    }

    // Aadhaar's extracted number/name/dob/gender/address are intentionally not
    // persisted to AppAccounts - only used here to compute `verified`.
    // PROFILE_PHOTO (passport-photo endpoint) has a different response shape - no top-level
    // isValid, instead a nested document.status of VALID/REVIEW/INVALID.
    const verified = docType === DOC_TYPES.PROFILE_PHOTO
      ? extracted.document?.status === 'VALID'
      : Boolean(extracted.isValid);

    return { verified, extracted };
  } catch (err) {
    logger.warn(
      { registrationId, docType, stage: err.details?.stage, details: err.details, err },
      'OCR extraction failed, document saved unverified',
    );
    return { verified: false, extracted: null };
  }
}

async function complete(userId, registrationId) {
  assertOwnRegistration(userId, registrationId);

  const account = await registrationRepository.findByAccountId(registrationId);
  if (!account) throw notFoundError('Registration not found');

  // Only AccountEmail is actually collected by the live Typebot chat flow (via
  // conversationFieldMap.js's unconditional "Provide your email id" question) -
  // the flow has no blocks and no HTTP Request callbacks for first/last name,
  // DOB, gender, or address, so requiring them here would make chat-driven
  // completion permanently impossible.
  const missing = [];
  if (!account.AccountEmail) missing.push('basic-details');

  const docs = await registrationRepository.findDocumentsByAccountId(registrationId);
  const uploadedTypes = new Set(docs.map((doc) => doc.DocumentCaption));
  for (const docType of REQUIRED_DOC_TYPES) {
    if (!uploadedTypes.has(docType)) missing.push(docType.toLowerCase());
  }

  if (missing.length > 0) {
    throw badRequestError(`Registration incomplete: missing ${missing.join(', ')}`, {
      errorCode: 'REGISTRATION_INCOMPLETE',
      details: { missing },
    });
  }

  const updated = account.ApplicationStatus === REGISTERED ? account : await registrationRepository.markCompleted(registrationId);
  return toPublic(updated);
}

function toDocumentPublic(doc, ocrResult) {
  return {
    registrationId: String(doc.AccountId),
    documentType: doc.DocumentCaption,
    documentUrl: doc.DocumentName,
    status: doc.DocStatus,
    updatedAt: doc.ModifedDate,
    ...(ocrResult ? { verified: ocrResult.verified, extracted: ocrResult.extracted } : {}),
  };
}

function toPublic(account) {
  const completed = account.ApplicationStatus === REGISTERED;
  return {
    userId: String(account.AccountId),
    currentStep: completed ? env.REGISTRATION_TOTAL_STEPS : 0,
    completed,
    totalSteps: env.REGISTRATION_TOTAL_STEPS,
    updatedAt: account.ModifedDate,
  };
}

export const registrationService = {
  getIdentityNames,
  getStatus,
  saveDocument,
  saveConversationField,
  complete,
  DOC_TYPES,
};

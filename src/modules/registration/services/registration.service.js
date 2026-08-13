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
  AADHAAR: 'AADHAAR',
  BANK: 'BANK',
  NOC: 'NOC',
  COMPANY_DOC: 'COMPANY_DOC',
  PROFILE_PHOTO: 'PROFILE_PHOTO',
});
// Only these gate /complete - NOC/COMPANY_DOC/PROFILE_PHOTO are conditional/optional in the flow.
const REQUIRED_DOC_TYPES = [DOC_TYPES.PAN, DOC_TYPES.AADHAAR, DOC_TYPES.BANK];
// OCR only runs for these three - NOC/company docs/profile photos are saved as-is.
const OCR_DOC_TYPES = [DOC_TYPES.PAN, DOC_TYPES.AADHAAR, DOC_TYPES.BANK];
// AppAccounts has no PAN/Aadhaar-number columns beyond PANNo, so only PAN is persisted;
// Aadhaar OCR result is used for verification only. Bank OCR maps onto its existing columns.
const BANK_FIELD_MAP = { bankName: 'BankName', accountNumber: 'BankAcNo', ifsc: 'BankIFSCCode', branch: 'BankBranchName', micr: 'MicrCode' };
// Fields conversationFieldMap.js is allowed to write to - keeps an arbitrary
// mapped column name from being trusted blindly, even though the map only
// ever contains these three today.
const CONVERSATION_FIELDS = ['GSTNo', 'AccountAlias', 'AccountEmail'];

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

async function updateStep(userId, { currentStep }) {
  if (currentStep < 0 || currentStep > env.REGISTRATION_TOTAL_STEPS) {
    throw badRequestError(
      `currentStep must be between 0 and ${env.REGISTRATION_TOTAL_STEPS}`,
    );
  }

  const completed = currentStep >= env.REGISTRATION_TOTAL_STEPS;
  let account = await registrationRepository.findByAccountId(userId);
  if (!account) throw notFoundError('User not found');

  if (completed && account.ApplicationStatus !== REGISTERED) {
    account = await registrationRepository.markCompleted(userId);
  }

  return toPublic(account);
}

// The registrationId param must match the authenticated user - the id alone is
// never sufficient to touch another user's registration.
function assertOwnRegistration(userId, registrationId) {
  if (String(registrationId) !== String(userId)) {
    throw forbiddenError('Registration does not belong to the authenticated user');
  }
}

async function start(userId) {
  const account = await registrationRepository.findByAccountId(userId);
  if (!account) throw notFoundError('User not found');

  if (!account.RegistrationDate) {
    await registrationRepository.update(userId, { RegistrationDate: new Date() });
  }

  return { registrationId: String(account.AccountId) };
}

async function saveBasicDetails(userId, registrationId, body) {
  assertOwnRegistration(userId, registrationId);

  const account = await registrationRepository.findByAccountId(registrationId);
  if (!account) throw notFoundError('Registration not found');

  const updated = await registrationRepository.update(registrationId, {
    FirstName: body.firstName,
    LastName: body.lastName,
    AccountName: `${body.firstName} ${body.lastName}`.trim(),
    AccountEmail: body.email,
    DOB: new Date(body.dob),
    Gender: body.gender,
    AccountAddress: body.address,
  });

  return toBasicDetailsPublic(updated);
}

async function saveDocument(userId, registrationId, docType, documentUrl) {
  assertOwnRegistration(userId, registrationId);

  const account = await registrationRepository.findByAccountId(registrationId);
  if (!account) throw notFoundError('Registration not found');

  const ocrResult = OCR_DOC_TYPES.includes(docType)
    ? await runOcrAndPersist(registrationId, docType, documentUrl)
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

  await registrationRepository.update(registrationId, { [field]: trimmed });
}

// A failed OCR extraction never fails the upload - the document still saves,
// just flagged unverified (DocStatus = 2) so it can be reviewed manually.
async function runOcrAndPersist(registrationId, docType, documentUrl) {
  try {
    const extracted = await ocrProvider.extract({ docType, documentUrl });

    if (docType === DOC_TYPES.PAN && extracted.pan) {
      await registrationRepository.update(registrationId, { PANNo: extracted.pan });
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

    // Aadhaar's extracted number/name/dob/gender/address are intentionally not
    // persisted to AppAccounts - only used here to compute `verified`.
    return { verified: Boolean(extracted.isValid), extracted };
  } catch (err) {
    logger.warn({ registrationId, docType, err }, 'OCR extraction failed, document saved unverified');
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
  // completion permanently impossible. FirstName/LastName/DOB/Gender/
  // AccountAddress can still be filled via PATCH .../basic-details for other
  // (non-chat) registration paths, but aren't required to complete.
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

function toBasicDetailsPublic(account) {
  return {
    registrationId: String(account.AccountId),
    firstName: account.FirstName,
    lastName: account.LastName,
    email: account.AccountEmail,
    dob: account.DOB,
    gender: account.Gender,
    address: account.AccountAddress,
    updatedAt: account.ModifedDate,
  };
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
  updateStep,
  start,
  saveBasicDetails,
  saveDocument,
  saveConversationField,
  complete,
  DOC_TYPES,
};

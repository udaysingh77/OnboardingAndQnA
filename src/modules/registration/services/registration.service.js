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
  // the user picked one of these as their address-proof type - never a stored document type on their
  // own, only ever passed as saveDocument()'s ocrDocType override. "Letter from Property Owner"
  // (the 5th address-proof choice) has no matching OCR endpoint anywhere and stays unmapped.
  DRIVING_LICENCE: 'DRIVING_LICENCE',
  VOTER_ID: 'VOTER_ID',
  PASSPORT: 'PASSPORT',
  ELECTRICITY: 'ELECTRICITY',
  // (NRI) Author/Composer path uploads - all save-only, no OCR endpoint exists for any of these
  // (same treatment as NOC/COMPANY_DOC).
  TRC: 'TRC',
  SS_NUMBER: 'SS_NUMBER',
  FORM_41: 'FORM_41',
  TIN: 'TIN',
  SELF_DECLARATION: 'SELF_DECLARATION',
  // (NRI) Owner/Publisher path uploads - also all save-only. The 3 address slots below can still
  // receive an ocrDocType override from their paired type-choice question (see addressProofTypeMap.js),
  // same mechanism as PERMANENT_ADDRESS_PROOF/CURRENT_ADDRESS_PROOF above.
  COMPANY_PHOTO: 'COMPANY_PHOTO',
  PEC: 'PEC',
  ENTITY_INCORPORATION: 'ENTITY_INCORPORATION',
  COMPANY_TRC: 'COMPANY_TRC',
  LETTER: 'LETTER',
  REGISTERED_ADDRESS_PROOF: 'REGISTERED_ADDRESS_PROOF',
  COMM_ADDRESS_PROOF: 'COMM_ADDRESS_PROOF',
  COMM_ADDRESS_PROOF_2: 'COMM_ADDRESS_PROOF_2',
  // Owner/Publisher path. COMPANY_PAN is OCR'd as a PAN (see OCR_TYPE_BY_DOC_TYPE); the rest are
  // save-only - no OCR endpoint exists for any of them. MOA_AOA/BOARD_RESOLUTION/COMPANY_NOC are
  // Corporate-only, PARTNERSHIP_DEED/AUTHORITY_LETTER Partnership-only, TUM Sole-Proprietorship-only.
  COMPANY_PAN: 'COMPANY_PAN',
  GST_CERTIFICATE: 'GST_CERTIFICATE',
  MOA_AOA: 'MOA_AOA',
  BOARD_RESOLUTION: 'BOARD_RESOLUTION',
  COMPANY_NOC: 'COMPANY_NOC',
  PARTNERSHIP_DEED: 'PARTNERSHIP_DEED',
  AUTHORITY_LETTER: 'AUTHORITY_LETTER',
  TUM: 'TUM',
});

// Doc types that are OCR'd as a *different* type than they're stored under. Unlike the address
// proofs - whose type comes from a preceding choice question, stashed per-session - this is static:
// a company PAN is always OCR'd as a PAN (writing PANNo/Detail2), while the row keeps the honest
// COMPANY_PAN caption so a human reviewer can tell the two apart.
// Exported because the conversation engine has to apply the same mapping when it labels the
// OCR-confirmation card - it only knows the stored docType, and looking up COMPANY_PAN in
// OCR_FIELD_LABELS found nothing, so the card listed no fields at all.
export const OCR_TYPE_BY_DOC_TYPE = { COMPANY_PAN: 'PAN' };
// What gates /complete - NOC/COMPANY_DOC/PROFILE_PHOTO/CURRENT_ADDRESS_PROOF are
// conditional/optional in the flow. Each entry is satisfied by *any one* of its types, because the
// same real-world requirement is collected under a different doc type on each role path: an
// individual uploads PAN and PERMANENT_ADDRESS_PROOF, a company uploads COMPANY_PAN and
// REGISTERED_ADDRESS_PROOF. Requiring the individual names outright made completion impossible on
// the three company/NRI paths - complete() threw REGISTRATION_INCOMPLETE forever, so
// ApplicationStatus never reached 1 and the territory fallback below never fired.
// PERMANENT_ADDRESS_PROOF replaces AADHAAR as the individual address-proof step - the live flow
// never asks for Aadhaar specifically anymore. COMM_ADDRESS_PROOF* are deliberately excluded: they
// are the secondary correspondence address, not proof of the primary one.
const REQUIRED_DOC_GROUPS = [
  {
    // Proof of identity / tax registration. An Indian individual gives a PAN, a company its
    // COMPANY_PAN, and an NRI - who often has no Indian PAN at all - a PASSPORT and/or the foreign
    // TIN that stands in for one (observed on a live NRI Author/Composer run: PROFILE_PHOTO,
    // PASSPORT, TRC, BANK, PERMANENT_ADDRESS_PROOF, TIN, SELF_DECLARATION - no PAN anywhere).
    label: 'identity',
    types: [DOC_TYPES.PAN, DOC_TYPES.COMPANY_PAN, DOC_TYPES.PASSPORT, DOC_TYPES.TIN],
  },
  { label: 'bank', types: [DOC_TYPES.BANK] },
  {
    label: 'address-proof',
    types: [DOC_TYPES.PERMANENT_ADDRESS_PROOF, DOC_TYPES.REGISTERED_ADDRESS_PROOF],
  },
];
// OCR runs for these - NOC/company docs/profile photos/address-proof-with-an-unsupported-type are
// saved as-is. PROFILE_PHOTO's passport-photo endpoint was briefly wired in but is not currently
// working - reverted, see AGENTS.md. PASSPORT is likewise temporarily disabled - its OCR endpoint
// currently has known issues on the provider's side - see AGENTS.md.
// Exported so a test can assert every OCR'd type has confirmation labels - see ocrLabels.test.js.
export const OCR_DOC_TYPES = [
  DOC_TYPES.PAN,
  DOC_TYPES.AADHAAR,
  DOC_TYPES.BANK,
  DOC_TYPES.DRIVING_LICENCE,
  DOC_TYPES.VOTER_ID,
  DOC_TYPES.ELECTRICITY,
];
// Doc types whose OCR `name` is trustworthy enough to become AccountName. Address proofs are
// excluded on purpose: an electricity bill or a rent letter routinely carries someone else's name.
const IDENTITY_OCR_DOC_TYPES = [DOC_TYPES.PAN, DOC_TYPES.AADHAAR];
// AppAccounts has no PAN/Aadhaar-number columns beyond PANNo, so only PAN is persisted;
// Aadhaar OCR result is used for verification only. Bank OCR maps onto its existing columns.
const BANK_FIELD_MAP = { bankName: 'BankName', accountNumber: 'BankAcNo', ifsc: 'BankIFSCCode', branch: 'BankBranchName', micr: 'MicrCode' };
// Which AppAccounts column an OCR-extracted `address` goes to, keyed by the upload slot (the
// original docType, before any ocrDocType override). Base column = permanent/registered address,
// `_PR` suffix = current/communication address (user-confirmed mapping, see AGENTS.md).
// COMM_ADDRESS_PROOF is deliberately absent: its choice list is entity-existence documents
// (MOA/Incorporation Certificate/Board Resolution/Trade License/Letter from Bank), not an address.
const ADDRESS_COLUMN_BY_SLOT = {
  [DOC_TYPES.PERMANENT_ADDRESS_PROOF]: 'AccountAddress',
  [DOC_TYPES.CURRENT_ADDRESS_PROOF]: 'AccountAddress_PR',
  [DOC_TYPES.REGISTERED_ADDRESS_PROOF]: 'AccountAddress',
  [DOC_TYPES.COMM_ADDRESS_PROOF_2]: 'AccountAddress_PR',
};
// Fields conversationFieldMap.js is allowed to write to - keeps an arbitrary
// mapped column name from being trusted blindly, even though the map only
// ever contains these three today.
const CONVERSATION_FIELDS = [
  'GSTNo',
  'AccountAlias',
  'AccountEmail',
  'PlaceOfBirth',
  'RollTypeIds',
  'TeritoryAppFor',
  'Nationality',
  'AssociationName_India',
  'DualNationality',
  'AccountAddress',
  'AccountAddress_PR',
  'ChanlDesc',
  'KindAttention1',
  'EntityType',
];

const ocrProvider = createOcrProvider();

// The names a song's credits are checked against, split by how much they're worth as evidence.
//
// `trusted` are names on file *before* the member ever saw a song's credits: AccountName (written
// from their identity document, see runOcrAndPersist) and AccountAlias (the stage name asked during
// registration). `claimed` are names the member supplied at the work-link step - i.e. after we
// showed them the credit list - so a match against one of those is a claim, not a check, and the
// work link is stored unverified. See AGENTS.md.
async function getIdentityNames(userId) {
  const account = await registrationRepository.findByAccountId(userId);
  if (!account) throw notFoundError('User not found');

  const aliases = await registrationRepository.findAliasesByAccountId(userId);

  return {
    accountName: account.AccountName,
    accountAlias: account.AccountAlias,
    trusted: [account.AccountName, account.AccountAlias].filter((name) => name?.trim()),
    claimed: aliases.filter((row) => row.Source === ALIAS_SOURCES.WORK_LINK).map((row) => row.AliasName),
  };
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

// `ocrDocType` lets a caller run OCR under a different type than the one being saved on the row -
// used for PERMANENT_ADDRESS_PROOF/CURRENT_ADDRESS_PROOF uploads, where the DB row stays generic
// but the actual document might be a Driving Licence or Voter ID (see addressProofTypeMap.js).
async function saveDocument(userId, registrationId, docType, documentUrl, ocrDocType) {
  assertOwnRegistration(userId, registrationId);

  const account = await registrationRepository.findByAccountId(registrationId);
  if (!account) throw notFoundError('Registration not found');

  const effectiveOcrType = ocrDocType ?? OCR_TYPE_BY_DOC_TYPE[docType] ?? docType;
  const ocrResult = env.OCR_ENABLED && OCR_DOC_TYPES.includes(effectiveOcrType)
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

  let update;
  if (field === 'DualNationality') {
    // DB column is Int/TinyInt, not text - the chat answer is a Yes/No choice.
    const normalized = trimmed.toLowerCase();
    if (normalized !== 'yes' && normalized !== 'no') return;
    update = { DualNationality: normalized === 'yes' ? 1 : 0 };
  } else if (field === 'AccountEmail') {
    // Stored lowercase so "A@B.com" and "a@b.com" can't become two accounts regardless of the
    // column's collation - the unique index can only enforce what's actually written.
    update = { AccountEmail: normalizeEmail(trimmed) };
  } else {
    update = { [field]: trimmed };
    if (field === 'GSTNo') update.Detail1 = trimmed;
  }

  await registrationRepository.update(registrationId, update);
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

// True only when the email already belongs to a *different* account. The chat's email step calls
// this before sending an OTP (see registrationEngine.js) so a member is told the address is taken
// instead of being walked through a verification that could never be saved. The filtered unique
// index on App_Accounts(AccountEmail) is the actual guarantee; this is for the message.
export const ALIAS_SOURCES = Object.freeze({ FLOW: 'flow', WORK_LINK: 'work-link', STAFF: 'staff' });

// Bounds so a pasted paragraph can't fill the table. 200 is the AliasName column width.
const MAX_ALIASES_PER_TURN = 5;
const MAX_ALIAS_LENGTH = 200;

// Splits a free-text answer into individual names. The work-link step tells members they may give
// more than one, separated by commas.
export function parseAliasList(value) {
  return String(value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= MAX_ALIAS_LENGTH)
    .slice(0, MAX_ALIASES_PER_TURN);
}

// Stores the names a member says they're credited under, so their next link matches without asking
// again. Written to App_Accounts_Alias rather than AccountAlias: a member can have several names,
// and that single column is already the target of the flow's own stage-name question *and* the
// company path's traderName (see conversationFieldMap.js). Duplicates are dropped by the
// (AccountId, AliasName) unique index. Returns how many were newly stored.
async function addAliases(userId, names, source = ALIAS_SOURCES.WORK_LINK) {
  const list = Array.isArray(names) ? names.map((n) => String(n ?? '').trim()).filter(Boolean) : parseAliasList(names);
  const bounded = [...new Set(list)].filter((n) => n.length <= MAX_ALIAS_LENGTH).slice(0, MAX_ALIASES_PER_TURN);
  if (bounded.length === 0) return 0;

  const { count } = await registrationRepository.createAliases(userId, bounded, source);
  return count;
}

async function isEmailTakenByAnotherAccount(userId, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const owner = await registrationRepository.findByAccountEmail(normalized);
  return Boolean(owner) && String(owner.AccountId) !== String(userId);
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

    // The member's name, taken from an identity document. This is the only name in the system with
    // any evidence behind it - everything else is self-declared - so the work-link credit match
    // depends on it (see workMatch.service.js).
    //
    // Written ONLY when AccountName is still empty. That guard is what makes this safe: the field
    // was previously left unpersisted because OCR-formatted text could clobber a real name already
    // on the row. Restricted to identity documents too - an electricity bill's name is often a
    // landlord's or a parent's, which is evidence of nothing.
    if (IDENTITY_OCR_DOC_TYPES.includes(docType) && extracted.name) {
      const account = await registrationRepository.findByAccountId(registrationId);
      if (!account?.AccountName?.trim()) {
        await registrationRepository.update(registrationId, { AccountName: String(extracted.name).trim().slice(0, 100) });
      }
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

    const addressColumn = ADDRESS_COLUMN_BY_SLOT[addressSlot];
    if (extracted.address && addressColumn) {
      await registrationRepository.update(registrationId, { [addressColumn]: extracted.address });
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
    // Aadhaar's extracted number/name/dob/gender/address are intentionally not
    // persisted to AppAccounts - only used here to compute `verified`.
    return { verified: Boolean(extracted.isValid), extracted };
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
  const uploadedTypes = new Set(docs.map((doc) => doc.DocumentName));
  for (const group of REQUIRED_DOC_GROUPS) {
    if (!group.types.some((docType) => uploadedTypes.has(docType))) missing.push(group.label);
  }

  if (missing.length > 0) {
    throw badRequestError(`Registration incomplete: missing ${missing.join(', ')}`, {
      errorCode: 'REGISTRATION_INCOMPLETE',
      details: { missing },
    });
  }

  // Territory defaults to WORLD when the user skipped the flow's territory question (or never
  // reached it) - an actual INDIA/WORLD answer is already persisted by saveConversationField() and
  // wins. Done here rather than on the skip itself: the territory blocks have no Typebot skip
  // option, and registrationEngine.handle() only persists a truthy answer, so there's no skip
  // event to hook. Idempotent - only fires while the column is still empty.
  if (!account.TeritoryAppFor?.trim()) {
    await registrationRepository.update(registrationId, { TeritoryAppFor: 'WORLD' });
  }

  const updated = account.ApplicationStatus === REGISTERED ? account : await registrationRepository.markCompleted(registrationId);
  return toPublic(updated);
}

function toDocumentPublic(doc, ocrResult) {
  return {
    registrationId: String(doc.AccountId),
    // DocumentName holds the type, DocumentCaption the URL (see registration.repository.js) - the
    // response keys below intentionally keep their original, self-describing names.
    documentType: doc.DocumentName,
    documentUrl: doc.DocumentCaption,
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
  isEmailTakenByAnotherAccount,
  addAliases,
  parseAliasList,
  ALIAS_SOURCES,
  complete,
  DOC_TYPES,
};

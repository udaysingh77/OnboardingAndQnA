// ==================================================================
// Maps our own docType (registration.service.js's DOC_TYPES) + registration path to IPRS's real
// Doc_LookUp.DocumentLookupId, so App_Accounts_Doc.DocumentLookupId and DocFileName
// (MRU_<AccountId>_<DocumentLookupId>_N1_<filename>) can be populated the way prod's own rows are.
//
// Built from a live prod Doc_LookUp dump (2026-09-22) cross-referenced against
// documentTypeMap.js's confirmed variableId wiring. Path keys: I/NI/NC map straight from
// AccountRegType; C additionally needs EntityType (C_SP/C_PR/C_CP) - see resolveDocPathKey() in
// registration.service.js.
//
// Our Typebot flow's document set is maintained independently of Doc_LookUp (IPRS controls theirs
// via this DB table, we control ours via Typebot) - the two don't line up 1:1, so this is NOT an
// exhaustive mirror. Every entry below is a confirmed, cross-referenced match; nothing is guessed.
//
// Deliberately unmapped (left out on purpose, not a gap to "fix" later):
//   AADHAAR - no longer collected live (back-compat REST-only key)
//   COMPANY_DOC - no working variableId exists yet (see documentTypeMap.js)
//   DRIVING_LICENCE/VOTER_ID/ELECTRICITY - never a stored docType, only an ocrDocType override
//   ENTITY_INCORPORATION - not confidently distinct from COMM_ADDRESS_PROOF's claim on NC:78
//   COMM_ADDRESS_PROOF_2 (NC) - MUPNC has no distinct second address item
//   Any C-path (C_SP/C_PR/C_CP) registered/communication-address, company-photo, incorporation,
//   or "company documents" upload - not wired to any variableId on those paths today (a real
//   feature gap, not this map's job to bridge)
export const DOC_LOOKUP_ID_BY_PATH = Object.freeze({
  I: {
    PAN: 1,
    BANK: 2,
    PERMANENT_ADDRESS_PROOF: 3,
    CURRENT_ADDRESS_PROOF: 4,
    NOC: 68,
    PROFILE_PHOTO: 102,
  },
  NI: {
    PASSPORT: 30,
    PERMANENT_ADDRESS_PROOF: 31,
    TRC: 32,
    TIN: 33,
    SS_NUMBER: 34,
    BANK: 35,
    FORM_41: 36,
    SELF_DECLARATION: 110,
    NOC: 113,
  },
  // TIN/SS_NUMBER/FORM_41's variableIds confirmed (live builder-API check) to each appear in two
  // different flow groups - genuinely reused across the NI and NC paths, not a guess.
  NC: {
    REGISTERED_ADDRESS_PROOF: 71,
    COMPANY_TRC: 72,
    TIN: 73,
    SS_NUMBER: 74,
    BANK: 75,
    PEC: 76,
    COMPANY_PHOTO: 77,
    COMM_ADDRESS_PROOF: 78,
    FORM_41: 79,
    LETTER: 111,
    NOC: 112,
  },
  C_SP: {
    COMPANY_PAN: 7,
    TUM: 8,
    BANK: 9,
    NOC: 13,
    GST_CERTIFICATE: 14,
  },
  C_PR: {
    COMPANY_PAN: 80,
    BANK: 81,
    NOC: 84,
    GST_CERTIFICATE: 85,
    PARTNERSHIP_DEED: 86,
    AUTHORITY_LETTER: 87,
  },
  // COMPANY_NOC and NOC legitimately share id 95 - MUPC2 has only one NOC row in Doc_LookUp; two
  // different app-side doc slots pointing at the same IPRS lookup id is fine.
  C_CP: {
    COMPANY_PAN: 91,
    BANK: 92,
    NOC: 95,
    GST_CERTIFICATE: 96,
    BOARD_RESOLUTION: 98,
    COMPANY_NOC: 95,
    MOA_AOA: 109,
  },
});

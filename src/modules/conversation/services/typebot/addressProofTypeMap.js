// ==================================================================
// The new Typebot flow replaced the old dedicated Aadhaar upload with a
// generalized "address proof" flow (asked twice: permanent, then
// current-only-if-different): the user first picks a document type from
// a choice input (Passport / Electricity Bill / Driving Licence / Voter
// ID / Letter from Property Owner), then uploads a file into a SEPARATE
// variable (permanent_address_proof / current_address_proof) that
// doesn't itself say which type it is. This map lets registrationEngine.js
// remember the chosen type across that one-turn gap, so the paired file
// upload can route to the right OCR endpoint (or skip OCR entirely for
// the 3 types with no OCR support anywhere).
// ==================================================================

// The two "what type of document is this?" choice-input blocks' variableIds.
export const ADDRESS_PROOF_TYPE_VARIABLE_IDS = {
  vwtm9i19qrzl3dxjzifdw6xnp: 'permanent', // address_proof_type_permanent
  vgbmeklrpc3b4hu8tvmodnt4e: 'current', // address_proof_type_current
};

// 4 of the 5 address-proof choices have a live OCR endpoint (per the "Document Verification API").
// "Letter from Property Owner" has none anywhere (not a government/utility document) and maps to
// null - no OCR, saved as-is (same treatment as NOC).
const OCR_TYPE_BY_ANSWER = {
  'driving licence': 'DRIVING_LICENCE',
  'voter id': 'VOTER_ID',
  passport: 'PASSPORT',
  'electricity bill': 'ELECTRICITY',
};

export function isAddressProofTypeStep(variableId) {
  return variableId in ADDRESS_PROOF_TYPE_VARIABLE_IDS;
}

export function resolveAddressProofOcrType(answerText) {
  return OCR_TYPE_BY_ANSWER[String(answerText ?? '').trim().toLowerCase()] ?? null;
}

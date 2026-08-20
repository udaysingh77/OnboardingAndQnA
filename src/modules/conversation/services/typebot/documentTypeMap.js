// ==================================================================
// Maps a Typebot file-input block's variableId (input.options.variableId
// from a startChat/continueChat response) to one of our registration
// document types, so an uploaded file can be saved via the existing
// registrationService.saveDocument() without Typebot needing its own
// HTTP Request block for documents anymore.
//
// variableIds come from the flow's own "variables" list in Typebot
// Studio (Settings/export) - update this map whenever a file-input
// block's variable is added/renamed there.
// ==================================================================
export const DOCUMENT_TYPE_BY_VARIABLE_ID = {
  vv1cibnnnutoy8v7ozdv6a908: 'PAN', // pan_card
  vxg8lzdsba57yiybss83cv307: 'BANK', // passbook
  vww01qa7jizgywxikfu1yu48x: 'PROFILE_PHOTO', // photo
  vm1o52cwfdgmciftqmrg4g50v: 'NOC', // Noc
  vxcy6e9zfnimssygpdw7v4wen: 'PERMANENT_ADDRESS_PROOF', // permanent_address_proof
  vah9qyjdjmr69ualgksd31lck: 'CURRENT_ADDRESS_PROOF', // current_address_proof
  // company_doc: fill in once that block gets a variableId assigned in Studio - the
  // company-documents branch has no working file-input block yet (see the wiring guide).
  //
  // vyxe6vz0095q0uc39pssv3m6i ("address_proof") -> AADHAAR was the OLD flow's dedicated Aadhaar
  // upload. The current flow no longer has any block using this variableId at all - Aadhaar as a
  // distinct upload is gone, replaced by the generalized PERMANENT_ADDRESS_PROOF/
  // CURRENT_ADDRESS_PROOF flow above. Left out on purpose, not a stale-map bug.
};

export function resolveDocumentType(variableId) {
  return DOCUMENT_TYPE_BY_VARIABLE_ID[variableId] ?? null;
}

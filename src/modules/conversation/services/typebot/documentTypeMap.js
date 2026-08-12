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
  vyxe6vz0095q0uc39pssv3m6i: 'AADHAAR', // address_proof
  vxg8lzdsba57yiybss83cv307: 'BANK', // passbook
  vww01qa7jizgywxikfu1yu48x: 'PROFILE_PHOTO', // photo
  // company_doc -> 'COMPANY_DOC' and noc_doc -> 'NOC': fill in once those
  // blocks get a variableId assigned in Studio (see the wiring guide).
};

export function resolveDocumentType(variableId) {
  return DOCUMENT_TYPE_BY_VARIABLE_ID[variableId] ?? null;
}

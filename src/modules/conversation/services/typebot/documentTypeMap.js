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
  // (NRI) Author/Composer path additions - all save-only (no OCR endpoint exists for any of these
  // doc types), same treatment as NOC. Confirmed via the new "all flow fanished" typebot's builder
  // API export.
  vasdkr52ehegpcpqfw2a8sxkv: 'TRC', // TRC (Tax Residency Certificate)
  vexhl9cvmsjz0jue6g07bk5wi: 'SS_NUMBER', // SS_NumberUpload
  vorkz51qbz707o5dohxapw6pp: 'FORM_41', // Form41_upload
  vxi443tnco09ch2jsud1st6f1: 'TIN', // tin_upload
  vjehiaqwctpzt9gm5eup9qdsc: 'SELF_DECLARATION', // selfDecleration_upload
  // passport_indivisual - a real passport upload for the NRI path; reuses the existing PASSPORT
  // doc type (already OCR-verified elsewhere via address-proof routing) so this upload gets the
  // same DOB/Nationality extraction for free.
  vm6rwxurtxzuzj9kxy6sep77l: 'PASSPORT',
  // (NRI) Owner/Publisher path additions - all save-only. The 3 address ones can still get an OCR
  // type via saveDocument()'s ocrDocType override (from the paired type-choice question), exactly
  // like PERMANENT_ADDRESS_PROOF does - see addressProofTypeMap.js.
  va8b2ohel08wd7k9tdb5d1fil: 'COMPANY_PHOTO', // company_photo
  vhb6zfrwujw3r23uma53v0vaz: 'PEC', // PEC_Upload
  vh5udbr0zwi9bg9pcuixrsrje: 'ENTITY_INCORPORATION', // entity_incorporation_upload
  // trc_upload - a DIFFERENT variable from the individual path's TRC (vasdkr52ehegpcpqfw2a8sxkv).
  vxgkslcbrxivgw9h7eruiz11z: 'COMPANY_TRC',
  vii96glwk7676lpxqxc73die4: 'LETTER', // letter
  vf76jux74enszj7urtazh360g: 'REGISTERED_ADDRESS_PROOF', // registered_address
  // comm_address - despite the name, this upload follows the MOA/Incorporation Certificate/Board
  // Resolution/Trade License/Letter from Bank choice list, i.e. entity-existence proofs, not an
  // address. No address is extracted from it (see registration.service.js's ADDRESS_COLUMN_BY_SLOT).
  vm0vda7dde8bal85jngm7rx6j: 'COMM_ADDRESS_PROOF',
  vbkb2f9qsxyk0idhh0kexr6of: 'COMM_ADDRESS_PROOF_2', // comm_address2 - the real communication-address proof
  // Owner/Publisher path additions. Common to all 3 entity types:
  vywp33tl1jc6f91vy4e8w7hdi: 'COMPANY_PAN', // company_pan - OCR'd as a PAN, see OCR_TYPE_BY_DOC_TYPE
  vfubni9djjiyfp66lpbifgafb: 'GST_CERTIFICATE', // gst_certificate_upload
  // Corporate only:
  vx4x1dop4l9ab95j0mqbweo5y: 'MOA_AOA', // MAA_Upload
  vmrf5q6kj5ezk4qlu1mbgqi5y: 'BOARD_RESOLUTION', // BR_Upload
  vib2v2iok8gdunui4x5ntltp8: 'COMPANY_NOC', // company_noc
  // Partnership only:
  vledsb1byssg6u0jjxov9pls0: 'PARTNERSHIP_DEED', // PartnerD_upload
  vctpzqwuqi1mlnmnfxw4gk4g3: 'AUTHORITY_LETTER', // AuthorityLetter_Upload
  // Sole proprietorship only:
  ves3q2hirlog0qylqxsenitxd: 'TUM', // TUM_Upload
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

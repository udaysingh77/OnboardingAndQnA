// ==================================================================
// Maps a Typebot text/choice-input block's variableId (input.options.
// variableId from a startChat/continueChat response) to an AppAccounts
// column, so a plain-text answer (GST number, alias/stage name, email)
// can be persisted the same way documentTypeMap.js persists uploads.
//
// variableIds come from the flow's own "variables" list in Typebot
// Studio (Settings/export) - update this map whenever one of these
// blocks' variable is added/renamed there.
// ==================================================================
export const ACCOUNT_FIELD_BY_VARIABLE_ID = {
  vqpmuqooo8wn2ktrfx9uf4l1j: 'GSTNo', // GST no
  vixob6tfcj9w3m44slwh3p1kq: 'AccountAlias', // alias / stage name
  virpfcnue17syf7ua2hbuj5d1: 'AccountEmail', // email input
  vfvvwcz6g7ueiw2lhqnwvg9z: 'PlaceOfBirth', // place of birth
  vcf06ka3xjtg0u940pk0qd7os: 'RollTypeIds', // role: lyricist / composer / both
  vufrpq6qr5rpcbewbffajjb73: 'TeritoryAppFor', // territory applied for (INDIA/WORLD)
};

export function resolveConversationField(variableId) {
  return ACCOUNT_FIELD_BY_VARIABLE_ID[variableId] ?? null;
}

// ==================================================================
// Membership application fee, by registration type.
//
// Keyed by AppAccounts.AccountRegType - IPRS's own code for which of the flow's four opening
// paths a member took (I = Individual, NI = NRI Individual, C = Owner/Publisher,
// NC = NRI Owner/Publisher). See memberRoleCodes.js for how the Typebot answer becomes that code.
//
// These amounts match IPRS's own MemberRoleType_LookUp_Fees table exactly (IL/IM/ILIM = 1200,
// ILN/IMN = 2700, CP = 2200, CPN = 3700, read from the live mraai_uat database). They're kept
// here rather than read from that table because our local copy of it is empty - but since the
// keys line up, switching to read it live is a small change if that's ever wanted.
//
// The role question (Lyricist/Composer/Both, stored in RollTypeIds) does NOT change the fee, and
// neither does EntityType - within one registration type every role pays the same.
// ==================================================================
const FEES_BY_REG_TYPE = Object.freeze({
  I: 1200,
  NI: 2700,
  C: 2200,
  NC: 3700,
});

/**
 * Resolves the application fee for a member from their stored registration type.
 * @param {string|null|undefined} regType - AppAccounts.AccountRegType (I/NI/C/NC)
 * @returns {number|null} the fee in rupees, or null if the type isn't recognised (the opening
 *   path question isn't answered yet, or the flow's fork changed and this table needs updating)
 */
export function resolveFee(regType) {
  const key = typeof regType === 'string' ? regType.trim() : '';
  if (!key) return null;
  return FEES_BY_REG_TYPE[key] ?? null;
}

export { FEES_BY_REG_TYPE };

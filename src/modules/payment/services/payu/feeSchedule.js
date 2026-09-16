// ==================================================================
// Membership application fee, by role path.
//
// Keyed by AppAccounts.RollTypeIds exactly as conversationFieldMap.js stores it - verbatim from the
// role-choice question's answer text (registration.service.js's saveConversationField() only
// trims it, no case-folding), so these keys must match that choice input's item labels exactly.
//
// Owner/Publisher's fee is the same across all three entity types (Corporate/Partnership/Sole
// Proprietary) - EntityType plays no part in the fee, only RollTypeIds does.
// ==================================================================
const FEES_BY_ROLL_TYPE = Object.freeze({
  '(Individual) Author / Composer': 1200,
  '(NRI) Author / Composer': 2700,
  'Owner/Publisher': 2200,
  '(NRI) Owner/Publisher': 3700,
});

/**
 * Resolves the application fee for a member from their stored role answer.
 * @param {string|null|undefined} rollTypeIds - AppAccounts.RollTypeIds
 * @returns {number|null} the fee in rupees, or null if the role isn't recognised (not yet
 *   answered, or the flow's role-choice wording changed and this table needs updating)
 */
export function resolveFee(rollTypeIds) {
  const key = typeof rollTypeIds === 'string' ? rollTypeIds.trim() : '';
  if (!key) return null;
  return FEES_BY_ROLL_TYPE[key] ?? null;
}

export { FEES_BY_ROLL_TYPE };

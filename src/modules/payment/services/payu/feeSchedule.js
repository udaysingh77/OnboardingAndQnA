// ==================================================================
// Membership application fee, by role path.
//
// Keyed by AppAccounts.ApplicantPath - the answer to the flow's opening 4-way fork (Group #3:
// "(Individual) Author / Composer" / "(NRI) Author / Composer" / "Owner/Publisher" /
// "(NRI) Owner/Publisher"), verbatim as conversationFieldMap.js stores it (saveConversationField()
// only trims it, no case-folding), so these keys must match that choice input's item labels exactly.
//
// NOT keyed by RollTypeIds - that column holds a different, later question's answer
// ("Lyricist"/"Composer"/"Both", Group #5), which was this table's original (wrong) key: the
// Group #3 fork had no Typebot variable at all until it was fixed the same way Territory was, so
// every real member's fee lookup returned REGISTRATION_INCOMPLETE. See
// scripts/add-applicant-path-column.sql for the full story.
//
// Owner/Publisher's fee is the same across all three entity types (Corporate/Partnership/Sole
// Proprietary) - EntityType plays no part in the fee, only ApplicantPath does.
// ==================================================================
const FEES_BY_ROLL_TYPE = Object.freeze({
  '(Individual) Author / Composer': 1200,
  '(NRI) Author / Composer': 2700,
  'Owner/Publisher': 2200,
  '(NRI) Owner/Publisher': 3700,
});

/**
 * Resolves the application fee for a member from their stored applicant-path answer.
 * @param {string|null|undefined} applicantPath - AppAccounts.ApplicantPath
 * @returns {number|null} the fee in rupees, or null if the path isn't recognised (not yet
 *   answered, or the flow's fork wording changed and this table needs updating)
 */
export function resolveFee(applicantPath) {
  const key = typeof applicantPath === 'string' ? applicantPath.trim() : '';
  if (!key) return null;
  return FEES_BY_ROLL_TYPE[key] ?? null;
}

export { FEES_BY_ROLL_TYPE };

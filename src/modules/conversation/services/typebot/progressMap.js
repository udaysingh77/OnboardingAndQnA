// ==================================================================
// Typebot's Chat API never returns a `progress` field (confirmed live -
// startChat/continueChat responses only ever have sessionId/resultId/
// typebot/messages/input/clientSideActions/logs; Studio's "Enable
// progress bar" toggle only affects Typebot's own embed widget, not the
// API). Since this backend drives the conversation via API relay, not
// the embed, progress has to be computed here instead.
//
// Only the "(Individual) Author / Composer" role path is complete in
// the current flow - the other 3 role choices ((NRI) Author/Composer,
// Owner/Publisher, (NRI) Owner/Publisher) dead-end into informational
// text with zero further edges, so this map only covers the one live
// path (their block ids simply won't be found here, returning null).
//
// Hardcoded from the published flow's graph (fetched via the builder
// API, bot.builder.choira.io/api/v1/typebots/{id}/publishedTypebot -
// see AGENTS.md for the traced edges). stepsUntilDone[blockId] = 1 +
// max(stepsUntilDone of its successor input-blocks), computed once for
// the whole path - it only depends on what's downstream of a block, so
// it's valid regardless of which optional branch (GST, member-of-
// another-society, current-address-differs, has-alias) the user took to
// reach it, and strictly decreases at every turn (percent is guaranteed
// non-decreasing). Update if Studio changes this flow's questions or
// branches, or once the other 3 role paths get built out.
// ==================================================================
const STEPS_UNTIL_DONE = {
  tebp7htyvolml8wokttg66pw: 24, // "Do you want to become an IPRS member?"
  ofaqjfre4b6smht07inyag0w: 23, // role: (Individual) Author/Composer [only this branch is live]
  pdxi4upcgfjmrdhfcut6g7r5: 22, // fraud-caution consent "I Accept"
  ahyzplqvx3ui5juwrrox3ueu: 21, // data-consent "I Accept"
  b7635myaqyeudck8wk20ml1l: 20, // email (variableId email)
  vfvvwcz6g7ueiw2lhqnwvg9z: 19, // place of birth (variableId place_of_birth)
  qvo8thfagkj2mixdoj382da4: 18, // role: lyricist/composer/both (variableId role)
  a5aujns6i7dhbqklnl755gpv: 17, // "Do you have a registered GST?"
  ktd9g9e08s6uz1tddf0imyye: 16, // GST number (variableId gst_no)
  j40owea6u92m53dxgpnwace5: 15, // "Are you a member of another society?"
  ni0xbtx0htpr10x1setrq4u3: 14, // Territory applied for (INDIA/WORLD)
  o5n5chjkhwof7ytyks400haq: 13, // NOC upload (variableId Noc)
  vqwuvk0vnzab8eol51i86j64: 12, // Profile photo upload (variableId photo)
  x1a4lvyxz085pfhyppef6wnc: 11, // PAN upload (variableId pan_card)
  nqyxmnuusz3bq26r0obbmfpl: 10, // Bank passbook upload (variableId passbook)
  rpij8g7ou2lertf1xe46bwnc: 9, // permanent address-proof TYPE choice (variableId address_proof_type_permanent)
  dqphd61tvxp3p2l7jkbyqceh: 8, // permanent address-proof upload (variableId permanent_address_proof)
  i8v9h0dszpnwphwwl2mxf6te: 7, // "Is your current address the same as permanent?"
  tk1kdh0b1j6uzvacoo34rp1i: 6, // current address-proof TYPE choice (variableId address_proof_type_current)
  jepno1g51m3s76v79kmyukj1: 5, // current address-proof upload (variableId current_address_proof)
  qje5cvxfiyeyulko9vb54wqb: 4, // "do you release music under a stage name or alias?"
  abpyq4uj0w5512l0clblw6zx: 3, // alias/stage name text (variableId stageName)
  t7rxqa45lzxn3c20au3xczjd: 2, // spotify link (variableId spotifyUrl)
  p3vjhcefo3ipxjqckl39ww46: 1, // "Pay ₹1200" button (dummy, no payment integration)
};
const TOTAL_STEPS = 24;

export function resolveProgress(blockId) {
  const remaining = STEPS_UNTIL_DONE[blockId];
  if (remaining == null) return null;
  return Math.round(((TOTAL_STEPS - remaining) / TOTAL_STEPS) * 100);
}

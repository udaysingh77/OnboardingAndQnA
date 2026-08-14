// ==================================================================
// Typebot's Chat API never returns a `progress` field (confirmed live -
// startChat/continueChat responses only ever have sessionId/resultId/
// typebot/messages/input/clientSideActions/logs; Studio's "Enable
// progress bar" toggle only affects Typebot's own embed widget, not the
// API). Since this backend drives the conversation via API relay, not
// the embed, progress has to be computed here instead.
//
// The flow is a real branching graph (individual vs company/publisher,
// GST yes/no, alias yes/no, "member of another society" yes/no), not a
// straight line - so "block position N of 19" would be wrong for most
// users. Hardcoded from the current published flow's graph (fetched via
// the builder API, bot.builder.choira.io/api/v1/typebots/{id}/publishedTypebot -
// see AGENTS.md for the traced edges). stepsUntilDone[blockId] = 1 +
// max(stepsUntilDone of its successor input-blocks), computed once for
// the whole DAG - it only depends on what's downstream of a block, so
// it's valid regardless of which branch the user took to reach it, and
// strictly decreases at every turn (percent is guaranteed
// non-decreasing). Update if Studio changes the flow's structure
// (new/removed/reordered questions or branches).
// ==================================================================
const STEPS_UNTIL_DONE = {
  q4x4jbosh8vw29siyh76exkb: 14, // "Do you want to become an IPRS member?"
  ayv0lk7a3d2hp89dbj370wnm: 13, // individual vs company/publisher
  rrxv8h4qbp7y09c8btdxc5h6: 12, // "Do you have a registered GST?"
  ikpodzmab14wrobz8zkwa3aa: 11, // "Do you release music under a stage name or alias?"
  e17jcdxd4vuxsaph718n6d48: 10, // GST number (variableId gst_no)
  gg845w5fitxxduswgsi2yfkf: 10, // alias/stage name (variableId stageName)
  whx1imu5kf45tbnd9nt3jodd: 9, // role (variableId role)
  f2ylardqte64dvw0r6nonfgp: 9, // company documents upload
  sr52zwgonimg315u6zk3jxc8: 8, // "Are you a member of another society?"
  lhg6l9e9hhuxuxgycxnbajzp: 7, // NOC upload
  r996l2k8r3h2o2npan3ktka2: 6, // email (variableId email)
  ksz9hqh7dj2yr93kdiutpfi5: 5, // Aadhaar upload (variableId address_proof)
  f51qeu63n3bjo2tvcjnuf97u: 4, // PAN upload (variableId pan_card)
  s00n6k03o9ssokr2cg1a607o: 3, // passbook/cancelled cheque upload (variableId passbook)
  siv2mj7mk00wkv2xg7q2db7r: 2, // profile photo upload (variableId photo)
  rg1uou2fdror1xzgf9smwt07: 1, // spotify link (variableId spotifyUrl)
};
const TOTAL_STEPS = 14;

export function resolveProgress(blockId) {
  const remaining = STEPS_UNTIL_DONE[blockId];
  if (remaining == null) return null;
  return Math.round(((TOTAL_STEPS - remaining) / TOTAL_STEPS) * 100);
}

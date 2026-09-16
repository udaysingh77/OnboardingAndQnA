// ==================================================================
// The four Typebot blocks that offer the payment button - one per role
// path. Kept in their own dependency-free module so that
// scripts/build-progress-map.mjs can import them without dragging in
// paymentGate.js's env + review-service (and therefore Prisma) imports.
//
// Matched by BLOCK ID, never by the button's label. Every other gate in
// this module recognises its step by `options.variableId`, but these are
// single-item choice inputs with no variable attached, so there is
// nothing else to match on. The label has already been renamed once
// ("Pay"/"payment" -> "Pay Application Fee") and anything keyed to it
// broke silently - see AGENTS.md on the 'electricity bill' bug for the
// same lesson.
//
// If a republish changes these ids this gate goes silently unreachable:
// no pre-payment review, no isPaymentStep flag, no way to pay at all.
// Re-fetch them from the builder API (see AGENTS.md).
// ==================================================================
export const PAYMENT_BLOCK_IDS = new Set([
  'mqd5zfukd99nkczylu206jo1', // Group #68,  item "Pay Application Fee"
  'o6vjstq2do6uuy67wfbzg451', // Group #68,  item "Pay Application Fee"
  'tjbgzghma2th8et9srotmzt5', // Group #147, item "Pay Application Fee"
  'ufpca0wnuwznk2ks7qbv39py', // Group #147, item "Pay Application Fee"
]);

export function isPaymentStep(blockId) {
  return PAYMENT_BLOCK_IDS.has(blockId);
}

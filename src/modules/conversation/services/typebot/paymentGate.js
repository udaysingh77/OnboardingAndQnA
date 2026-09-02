// ==================================================================
// Holds the conversation at the payment button long enough to show the
// member everything on file.
//
// TWO THINGS ARE DIFFERENT HERE, both easy to trip over later:
//
// 1. This gate keys off the **block id**, not a variableId. Every other
//    gate in this module (workLinkGate, emailOtpGate, conversationFieldMap,
//    documentTypeMap) recognises its step by `options.variableId` - but
//    the payment blocks are single-item choice inputs with no variable
//    attached, so there is nothing else to match on. If the flow is
//    re-published and these ids change, this gate goes silently
//    unreachable, the same failure mode as the old `spotifyUrl` id.
//    Re-fetch them from the builder API (see AGENTS.md).
//
// 2. It intercepts Typebot's **reply**, not the member's answer. Every
//    other gate inspects the message coming in; this one inspects the
//    input going back out, because the trigger is "Typebot just offered
//    the payment button".
//
// Four blocks - one per role path. Two are labelled "payment", two "Pay".
// ==================================================================
import { env } from '../../../../config/env.js';

const PAYMENT_BLOCK_IDS = new Set([
  'mqd5zfukd99nkczylu206jo1', // Group #68, item "payment"
  'o6vjstq2do6uuy67wfbzg451', // Group #68, item "payment"
  'tjbgzghma2th8et9srotmzt5', // Group #147, item "Pay"
  'ufpca0wnuwznk2ks7qbv39py', // Group #147, item "Pay"
]);

export function isPaymentStep(blockId) {
  return PAYMENT_BLOCK_IDS.has(blockId);
}

// Synthetic block - not a Typebot block, Studio needs no changes (same pattern as
// WORK_LINK_CONFIRM_INPUT and the OCR/email steps).
export const PAYMENT_REVIEW_INPUT = {
  id: 'payment-review',
  type: 'choice input',
  items: [
    { id: 'payment-review-ok', content: 'Yes, everything is correct' },
    { id: 'payment-review-fix', content: 'Something needs correcting' },
  ],
};

export function confirmsReview(message) {
  const answer = String(message ?? '').trim().toLowerCase();
  return ['yes, everything is correct', 'yes', 'y', 'correct', 'confirm'].includes(answer);
}

// A line with a label renders as "Label: value"; one without renders as a plain bullet, which is
// what lists of documents and songs want - "PAN card: uploaded" reads worse than "- PAN card".
export function describeReview(sections) {
  const body = sections
    .map(({ title, lines }) => {
      const rendered = lines
        .map(({ label, value }) => (label ? `  ${label}: ${value}` : `  - ${value}`))
        .join('\n');
      return `${title}\n${rendered}`;
    })
    .join('\n\n');

  return `Please check your details before payment.\n\n${body}`;
}

// Typebot can't be driven backwards, so we don't pretend the member can edit here - we tell them
// who to write to, and quote the id support will ask for.
export function describeCorrection(registrationId) {
  const contact = env.SUPPORT_CONTACT?.trim();
  const where = contact
    ? `Please write to ${contact} and we'll correct it.`
    : "Our team will get in touch with you to correct it.";

  return `${where}\n\nQuote your registration number: ${registrationId}\n\nYou can continue to payment in the meantime.`;
}

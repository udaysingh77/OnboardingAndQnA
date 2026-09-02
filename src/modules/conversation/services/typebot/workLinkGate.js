// ==================================================================
// Gates the Typebot conversation's "share a link to your work" step so
// the member can add up to MAX_WORK_LINKS links instead of just one.
//
// The published flow has no loop of its own (each path asks for a link
// exactly once, then moves on) and no counter block, so the repetition
// is driven from here: after each link is saved we return a synthetic
// "Add another link?" question - not a real Typebot block, same pattern
// as registrationEngine.js's OCR-confirmation and email-OTP steps - and
// only advance the real conversation once the member declines or the
// cap is reached. Studio needs no changes.
//
// All four link steps (one per role family) share a single variable
// after the flow was unified - see AGENTS.md.
// ==================================================================
import { MAX_WORK_LINKS } from '../../../spotify/services/workLink.service.js';

export const WORK_URL_VARIABLE_ID = 'vdcqjfwmljgel9ola6lpinafa'; // workUrl

// Re-exported so the engine imports its conversational constants from one
// place; the cap itself is owned and enforced by workLink.service.js.
export { MAX_WORK_LINKS };

export function isWorkLinkStep(variableId) {
  return variableId === WORK_URL_VARIABLE_ID;
}

// Synthetic block - the member answers this instead of a Typebot question.
export const WORK_LINK_MORE_INPUT = {
  id: 'work-link-add-another',
  type: 'choice input',
  items: [
    { id: 'work-link-yes', content: 'Yes, add another' },
    { id: 'work-link-no', content: 'No, continue' },
  ],
};

export function wantsAnotherLink(message) {
  const normalized = String(message ?? '').trim().toLowerCase();
  return ['yes, add another', 'yes', 'y', 'add another'].includes(normalized);
}

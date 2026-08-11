// ==================================================================
// Registration engine STUB (Week 1).
// Later milestone: drives the onboarding/QnA conversation flow.
// For now returns a deterministic dummy response so the router wiring
// is testable end-to-end.
// ==================================================================
/**
 * @param {{ userId: string, message: string }} input
 * @returns {Promise<{ reply: string, nextStep?: string }>}
 */
export async function handle(input) {
  return {
    reply: '[RegistrationEngine] Onboarding flow not yet implemented (Week 1).',
  };
}

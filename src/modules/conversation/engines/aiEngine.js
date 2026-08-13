// ==================================================================
// AI engine STUB (Week 1).
// Later milestone: connects the RAG / LLM pipeline (AI chatbot).
// For now returns a deterministic dummy response.
// ==================================================================
/**
 * @param {{ userId: string, message: string }} input
 * @returns {Promise<{ reply: string }>}
 */
export async function handle(input) {
  return {
    reply: 'Your registration is already complete. Thank you!',
  };
}

// ==================================================================
// Typebot session store - maps our userId to the active Typebot
// sessionId + the last-known `input` block (needed to resolve which
// document a file upload belongs to). In-memory (single instance) for
// now; swap for Redis behind the same interface in a later milestone,
// mirrors modules/auth/services/tokenBlacklist.js.
// ==================================================================
export function createTypebotSessionStore() {
  const store = new Map(); // userId -> { sessionId, input }

  /** @param {string} userId */
  function get(userId) {
    return store.get(userId) ?? null;
  }

  /** @param {string} userId @param {{ sessionId: string, input: object|null }} session */
  function set(userId, session) {
    store.set(userId, session);
  }

  /** @param {string} userId */
  function clear(userId) {
    store.delete(userId);
  }

  return { get, set, clear };
}

export const typebotSessionStore = createTypebotSessionStore();

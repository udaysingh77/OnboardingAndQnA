// ==================================================================
// Token blacklist provider (for logout of stateless JWTs).
//   - In-memory set (single instance) in Week 1; swap for Redis in a
//     later milestone. Third-party ready via same interface.
// ==================================================================
export function createTokenBlacklist() {
  const store = new Map(); // jti -> expiresAt (ms)

  /** @param {string} jti @param {number} expiresAtMs */
  function add(jti, expiresAtMs) {
    store.set(jti, expiresAtMs);
    prune();
  }

  /** @param {string} jti @returns {boolean} */
  function has(jti) {
    prune();
    return store.has(jti);
  }

  function prune() {
    const now = Date.now();
    for (const [jti, expiresAt] of store) {
      if (expiresAt <= now) store.delete(jti);
    }
  }

  return { add, has };
}

export const tokenBlacklist = createTokenBlacklist();

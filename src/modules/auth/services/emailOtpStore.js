// ==================================================================
// Email OTP store - in-memory (single instance), same pattern as
// tokenBlacklist.js. IPRS's own database has no OTP-hash/verification
// table for email anywhere (checked against their real mraai_uat DB -
// they don't verify email via OTP at all, this is unique to this app),
// so there's nothing to mirror there. An OTP is short-lived by design
// (EMAIL_OTP_EXPIRY_MINUTES), which fits in-memory state far better
// than a permanent SQL table anyway - a server restart simply clears
// any pending OTP, and the member requests a new one.
// ==================================================================
export function createEmailOtpStore() {
  const store = new Map(); // email -> { otpHash, expiresAt, attempts, verifiedAt }

  /** @param {string} email @param {{otpHash:string, expiresAt:Date, attempts:number, verifiedAt:Date|null}} record */
  function set(email, record) {
    store.set(email, record);
    prune();
  }

  /** @param {string} email @returns {object|undefined} */
  function get(email) {
    prune();
    return store.get(email);
  }

  /** @param {string} email */
  function clear(email) {
    store.delete(email);
  }

  // Entries stay well past their own expiresAt only because a member might still be mid-attempt
  // right at the boundary - prune on a generous margin, not the instant they expire.
  function prune() {
    const now = Date.now();
    const GRACE_MS = 10 * 60 * 1000;
    for (const [email, record] of store) {
      if (record.expiresAt.getTime() + GRACE_MS <= now) store.delete(email);
    }
  }

  return { set, get, clear };
}

export const emailOtpStore = createEmailOtpStore();

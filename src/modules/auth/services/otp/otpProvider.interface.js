// ==================================================================
// OTP provider contract (documentation only - no runtime code).
// Implemented by createMockOtpProvider() (local/testing) and
// createMsg91OtpProvider() (real SMS). Selected via the OTP_PROVIDER
// env var — no changes to controllers/services needed.
// ==================================================================

/**
 * @typedef {Object} OtpProvider
 * @property {(phone: string) => Promise<void>} send
 *   Send an OTP to the given phone.
 * @property {(input: { phone: string, otp: string }) => Promise<boolean>} verify
 *   Verify the OTP provided by the user.
 */

// ==================================================================
// Verify provider contract (documentation only - no runtime code).
// Mirrors ../ocr/ocrProvider.interface.js, but for the government-lookup
// verify endpoints (GSTIN/TAN) rather than document OCR: the input is a
// typed value, not a document image, and a false verdict is a normal
// result to return, not a thrown error - only a transport/service
// failure throws. See httpVerifyProvider.js.
// ==================================================================

/**
 * @typedef {Object} VerifyProvider
 * @property {(input: { docType: 'GSTIN'|'TAN', value: string }) => Promise<{ verified: boolean, message?: string, data?: Object }>} verify
 *   Checks value against the government-lookup service for docType. `verified` is read from the
 *   response's own top-level field - nested fields (e.g. a GSTIN's gstin_checksum_valid/
 *   gstin_status) are NOT authoritative and must not be used to override it.
 */

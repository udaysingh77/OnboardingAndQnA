// ==================================================================
// OCR provider contract (documentation only - no runtime code).
// Implemented by createStubOcrProvider() for now. A later milestone
// adds a real HTTP-based implementation and selects it via
// ocrProvider.factory.js — no changes to controllers/services needed.
// ==================================================================

/**
 * @typedef {Object} OcrProvider
 * @property {(input: { docType: 'PAN'|'AADHAAR'|'BANK', documentUrl: string }) => Promise<Object>} extract
 *   Extract structured fields from the document image at documentUrl.
 */

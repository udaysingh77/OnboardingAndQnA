// ==================================================================
// The GSTIN verify provider (node:test) - no DB, no network, `fetch` is
// monkey-patched for the duration of each test.
//
// The property worth pinning hard: PASS/FAIL IS DECIDED BY THE RESPONSE'S
// TOP-LEVEL `success` FIELD ALONE - a live probe against a syntactically
// wrong GSTIN returned `{ success: true, verified: false, message:
// "Invalid GSTIN", data: null }`, so `verified` and everything under
// `data` (gstin_status, gstin_checksum_valid, ...) are informational
// only and must never be used to reject an answer. Only a genuine
// service/transport failure (network error, non-2xx, success:false)
// blocks the member.
// Run: npm test
// ==================================================================
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpVerifyProvider } from '../src/modules/registration/services/verify/httpVerifyProvider.js';
import { createStubVerifyProvider } from '../src/modules/registration/services/verify/stubVerifyProvider.js';
import { createVerifyProvider } from '../src/modules/registration/services/verify/verifyProvider.factory.js';
import { env } from '../src/config/env.js';

const originalFetch = global.fetch;
after(() => {
  global.fetch = originalFetch;
});

function mockFetch(handler) {
  global.fetch = async (url, options) => handler(url, options);
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('GSTIN: posts {gstin} to /api/verify/gstin', async () => {
  let seenUrl;
  let seenBody;
  mockFetch(async (url, options) => {
    seenUrl = url;
    seenBody = JSON.parse(options.body);
    return jsonResponse(200, { success: true, verified: true, message: 'GSTIN verified successfully', data: { gstin: '08AKWPJ1234H1ZN' } });
  });

  const provider = createHttpVerifyProvider();
  const result = await provider.verify({ docType: 'GSTIN', value: '08AKWPJ1234H1ZN' });

  assert.equal(seenUrl, `${env.OCR_API_BASE_URL}/api/verify/gstin`);
  assert.deepEqual(seenBody, { gstin: '08AKWPJ1234H1ZN' });
  assert.equal(result.verified, true);
  assert.equal(result.message, 'GSTIN verified successfully');
});

test('success:true passes even when the nested verified/status fields disagree', async () => {
  // The exact real-world shape a live probe returned for an "invalid" GSTIN.
  mockFetch(async () => jsonResponse(200, {
    success: true,
    verified: false,
    message: 'Invalid GSTIN',
    data: null,
  }));

  const provider = createHttpVerifyProvider();
  const result = await provider.verify({ docType: 'GSTIN', value: 'ANYTHING' });

  assert.equal(result.verified, true, 'success:true alone is the pass signal, verified:false is ignored');
});

test('a network failure throws VERIFY_REQUEST_FAILED', async () => {
  mockFetch(async () => {
    throw new Error('ECONNREFUSED');
  });

  const provider = createHttpVerifyProvider();
  await assert.rejects(
    provider.verify({ docType: 'GSTIN', value: 'X' }),
    (err) => err.errorCode === 'VERIFY_REQUEST_FAILED',
  );
});

test('a non-2xx response throws VERIFY_REQUEST_FAILED', async () => {
  mockFetch(async () => jsonResponse(500, { success: false, message: 'upstream down' }));

  const provider = createHttpVerifyProvider();
  await assert.rejects(
    provider.verify({ docType: 'GSTIN', value: 'X' }),
    (err) => err.errorCode === 'VERIFY_REQUEST_FAILED',
  );
});

test('a 2xx response with success:false also throws VERIFY_REQUEST_FAILED', async () => {
  // Distinct from the above: a clean HTTP status but the service itself says it couldn't process
  // the request - still a service problem, not "the GSTIN is bad" (that case is success:true).
  mockFetch(async () => jsonResponse(200, { success: false, message: 'could not process request' }));

  const provider = createHttpVerifyProvider();
  await assert.rejects(
    provider.verify({ docType: 'GSTIN', value: 'X' }),
    (err) => err.errorCode === 'VERIFY_REQUEST_FAILED',
  );
});

test('the stub provider always throws VERIFY_NOT_IMPLEMENTED', async () => {
  const provider = createStubVerifyProvider();
  await assert.rejects(
    provider.verify({ docType: 'GSTIN', value: 'X' }),
    (err) => err.errorCode === 'VERIFY_NOT_IMPLEMENTED',
  );
});

test('the factory returns a usable provider for the current OCR_PROVIDER setting', () => {
  // env is frozen at boot (config/env.js), so this can't flip OCR_PROVIDER mid-test the way a real
  // stub-vs-http switch would - it just confirms the factory wires up cleanly for whichever
  // implementation the running config actually selects (default: 'http').
  assert.equal(typeof createVerifyProvider().verify, 'function');
});

test('createHttpVerifyProvider and createStubVerifyProvider are genuinely different implementations', async () => {
  // The switch in verifyProvider.factory.js is only worth having if the two branches actually
  // behave differently - pin that directly, independent of which one OCR_PROVIDER currently picks.
  // fetch is mocked so this stays offline like every other test here (no real call to ocr.choira.io).
  mockFetch(async () => jsonResponse(200, { success: true, verified: true, message: 'ok', data: {} }));
  const httpResult = await createHttpVerifyProvider().verify({ docType: 'GSTIN', value: 'X' });
  assert.equal(httpResult.verified, true, 'http actually calls out and resolves');

  await assert.rejects(
    createStubVerifyProvider().verify({ docType: 'GSTIN', value: 'X' }),
    (err) => err.errorCode === 'VERIFY_NOT_IMPLEMENTED',
  );
});

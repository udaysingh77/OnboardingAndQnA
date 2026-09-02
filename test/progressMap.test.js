// ==================================================================
// The generated progress map and the payment gate that depends on it
// (node:test). No DB, no network.
//
// WHAT THIS PROTECTS: progressMap.js is generated from the live Typebot
// flow by `npm run build:progress-map`. It went badly stale once - it
// still described the previous bot while the live flow had grown to 131
// questions, so resolveProgress() returned null nearly everywhere and
// the progress bar silently died.
//
// The "progress never decreases along an edge" property needs the flow
// graph, so it is asserted by the generator at generation time (see
// assertSane in scripts/build-progress-map.mjs), which fails loudly
// rather than writing a wrong map. What is checked here is the file
// that ships: its shape, and that the payment gate's block ids still
// exist in it.
// Run: npm test
// ==================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProgress } from '../src/modules/conversation/services/typebot/progressMap.js';
import { isPaymentStep } from '../src/modules/conversation/services/typebot/paymentGate.js';

const MAP_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/modules/conversation/services/typebot/progressMap.js',
);

// The map itself isn't exported (resolveProgress is the whole public surface), so the entries are
// read back out of the generated source.
const entries = [...fs.readFileSync(MAP_PATH, 'utf8').matchAll(/^ {2}([A-Za-z0-9]{16,}): {0,3}(\d{1,3}),/gm)]
  .map(([, id, value]) => [id, Number(value)]);

test('the map is populated - an almost-empty map is how it goes stale', () => {
  // The live flow has ~131 questions across four role paths. A map that has collapsed to a handful
  // of entries means it was not regenerated after a Studio republish.
  assert.ok(entries.length > 100, `only ${entries.length} entries`);
});

test('every percentage is an integer in 0-99', () => {
  for (const [id, value] of entries) {
    assert.ok(Number.isInteger(value), `${id} is not an integer`);
    assert.ok(value >= 0 && value <= 99, `${id} = ${value}`);
  }
});

test('nothing in the map claims 100 - the engine forces that only when the session ends', () => {
  // While the payment button is still on screen the member has not finished.
  assert.equal(entries.some(([, value]) => value >= 100), false);
});

test('resolveProgress returns each mapped value', () => {
  for (const [id, value] of entries) assert.equal(resolveProgress(id), value, id);
});

test('an unknown block resolves to null, not a wrong number', () => {
  // A block added in Studio before the map is regenerated must show no progress rather than a
  // misleading one - the caller passes null straight through.
  assert.equal(resolveProgress('a-block-that-does-not-exist'), null);
  assert.equal(resolveProgress(undefined), null);
});

test('the payment gate\'s block ids still exist in the flow', () => {
  // paymentGate.js keys off block ids, not a variableId - payment blocks have no variable attached.
  // If a republish changes those ids the gate goes silently unreachable and the pre-payment review
  // never appears. Regenerating the map is what surfaces that, and this is the assertion that fails.
  const payments = entries.filter(([id]) => isPaymentStep(id));
  assert.equal(payments.length, 4, `expected 4 payment blocks in the map, found ${payments.length}`);
  for (const [id, value] of payments) {
    assert.ok(value < 100, `payment block ${id} should not read as finished (${value})`);
  }
});

test('block ids are unique', () => {
  const ids = entries.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

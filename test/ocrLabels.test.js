// ==================================================================
// Every document type that gets OCR'd must have confirmation labels
// (node:test). No DB, no network.
//
// WHY: the OCR-confirmation card is built from OCR_FIELD_LABELS keyed
// by document type, but a document is not always OCR'd under the type
// it is stored as. An address proof is stored as
// PERMANENT_ADDRESS_PROOF and read as a DRIVING_LICENCE; a COMPANY_PAN
// is stored as COMPANY_PAN and read as a PAN.
//
// When the lookup misses, nothing throws - `?? {}` yields no lines and
// the member is shown "We extracted the following COMPANY_PAN details:"
// followed by a blank, then "Is this correct?". That is exactly what
// happened to COMPANY_PAN: OCR had succeeded, the card just had nothing
// to print. A silent empty card is worse than an error, so this asserts
// the mapping instead of trusting it.
// Run: npm test
// ==================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCR_FIELD_LABELS } from '../src/modules/conversation/engines/registrationEngine.js';
import { OCR_DOC_TYPES, OCR_TYPE_BY_DOC_TYPE } from '../src/modules/registration/services/registration.service.js';

// The same resolution the engine does when labelling the card.
const effectiveType = (docType) => OCR_TYPE_BY_DOC_TYPE[docType] ?? docType;

test('every OCR-capable doc type resolves to a non-empty label set', () => {
  // Types read directly, plus types stored under one name and read as another.
  const reachable = new Set([...OCR_DOC_TYPES, ...Object.keys(OCR_TYPE_BY_DOC_TYPE)]);

  for (const docType of reachable) {
    const labels = OCR_FIELD_LABELS[effectiveType(docType)];
    assert.ok(
      labels && Object.keys(labels).length > 0,
      `${docType} (read as ${effectiveType(docType)}) has no confirmation labels - the card would be blank`,
    );
  }
});

test('COMPANY_PAN is labelled as a PAN', () => {
  // The regression this file was written for.
  assert.equal(effectiveType('COMPANY_PAN'), 'PAN');
  const labels = OCR_FIELD_LABELS[effectiveType('COMPANY_PAN')];
  assert.deepEqual(Object.values(labels), ['Name', 'PAN Number', 'Date of Birth', 'Holder Type']);
});

test('a doc type that is never OCR\'d needs no labels', () => {
  // NOC/PROFILE_PHOTO and friends fall through before the card is ever built.
  assert.equal(OCR_DOC_TYPES.includes('NOC'), false);
  assert.equal(OCR_TYPE_BY_DOC_TYPE.NOC, undefined);
});

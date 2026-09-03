// ==================================================================
// File names sent to Typebot's generateUploadUrl (node:test).
// Pure function - no DB, no network.
//
// WHY: Typebot drops the file name straight into the URL it returns,
// without encoding it, and then rejects that same URL on the next
// answer because a URL with raw spaces fails its own validation.
// Verified live against the flow: "Copy of Choira PAN.jpeg" produced
// ".../blocks/<id>/Copy of Choira PAN.jpeg" and came back
// "Invalid message. Please, try again." three times; "pan.jpeg" went
// straight through. Phone file pickers hand over the original name, so
// this is exactly what real members upload.
//
// The same URL is stored in DocumentCaption and is what ocr.choira.io is
// asked to fetch, so the name is cleaned at the source rather than the
// URL being encoded later.
// Run: npm test
// ==================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFileName } from '../src/modules/conversation/engines/registrationEngine.js';

test('spaces are what actually broke uploads', () => {
  assert.equal(safeFileName('Copy of Choira PAN.jpeg'), 'Copy_of_Choira_PAN.jpeg');
  assert.equal(safeFileName('Copy of Choira PAN.jpeg').includes(' '), false);
});

test('a name that was already safe is left alone', () => {
  // No churn for the common case - the stored URL should stay recognisable.
  assert.equal(safeFileName('pan.jpeg'), 'pan.jpeg');
  assert.equal(safeFileName('bank-statement_2024.pdf'), 'bank-statement_2024.pdf');
});

test('URL-breaking characters are removed, not just spaces', () => {
  // '#' and '?' are worse than a space: they truncate the URL instead of merely invalidating it,
  // so the stored link would point at the wrong object.
  assert.equal(safeFileName('my#file?v=2.pdf'), 'my_file_v_2.pdf');
  for (const ch of ['#', '?', '%', '&', ' ', '/', '\\']) {
    assert.equal(safeFileName(`a${ch}b.jpg`).includes(ch), false, `"${ch}" survived`);
  }
});

test('the extension is preserved', () => {
  assert.match(safeFileName('some scan.JPEG'), /\.JPEG$/);
  assert.match(safeFileName('a b c.pdf'), /\.pdf$/);
  assert.equal(safeFileName('noext'), 'noext');
});

test('runs of junk collapse and edges are trimmed', () => {
  assert.equal(safeFileName('  spaced  name .PNG'), 'spaced_name.PNG');
  assert.equal(safeFileName('...jpg'), 'upload.jpg', 'nothing usable left of the stem');
});

test('a name with no usable characters still yields something', () => {
  // A Devanagari file name is entirely stripped - better a generic name than an empty one, which
  // would make the upload URL end in a slash.
  assert.equal(safeFileName('पैन कार्ड.jpg'), 'upload.jpg');
  assert.equal(safeFileName(''), 'upload');
  assert.equal(safeFileName(null), 'upload');
  assert.equal(safeFileName(undefined), 'upload');
});

test('a very long name is capped', () => {
  const out = safeFileName(`${'a'.repeat(400)}.jpeg`);
  assert.ok(out.length <= 111, `got ${out.length}`);
  assert.match(out, /\.jpeg$/, 'the extension survives the cap');
});

test('a leading dot is a hidden file, not an extension', () => {
  assert.equal(safeFileName('.hidden'), 'hidden');
});

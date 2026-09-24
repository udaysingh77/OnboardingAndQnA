// ==================================================================
// The shipped-dictionary provider, and translating a bubble as one message.
//
// These two together are what lets a member see their own language only:
// the flow stays in English, and the reply is rewritten on the way out.
// ==================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'iprs-tx-'));
const dictPath = join(dir, 'dict.json');
writeFileSync(dictPath, JSON.stringify({
  'Please upload your PAN Card.': { hi: 'कृपया अपना PAN कार्ड अपलोड करें।', mr: 'कृपया तुमचे PAN कार्ड अपलोड करा.', gu: 'કૃપા કરીને તમારું PAN કાર્ડ અપલોડ કરો.' },
  'Upload Address Proof\nPlease upload any one of the following documents as proof of your permanent address:':
    { hi: 'पते का प्रमाण अपलोड करें\nकृपया स्थायी पते का कोई एक दस्तावेज़ अपलोड करें:', mr: 'x', gu: 'y' },
  Passport: { hi: 'पासपोर्ट', mr: 'पासपोर्ट', gu: 'પાસપોર્ટ' },
}), 'utf8');

process.env.TRANSLATION_ENABLED = 'true';
process.env.TRANSLATION_PROVIDER = 'dictionary';
process.env.TRANSLATION_DICTIONARY_PATH = dictPath;
process.env.TRANSLATION_SUPPORTED_LANGUAGES = 'en,hi,mr,gu';

const { lookup, dictionarySize } = await import('../src/modules/translation/dictionary.js');
const { messageText, rebuildMessage } = await import('../src/modules/translation/messageBlocks.js');
const { translateConversationPayload } = await import('../src/modules/translation/translation.service.js');

test('the dictionary is loaded and answers per language', () => {
  assert.equal(dictionarySize(), 3);
  assert.equal(lookup('Passport', 'gu'), 'પાસપોર્ટ');
  assert.equal(lookup('Passport', 'hi'), 'पासपोर्ट');
  assert.equal(lookup('not in the flow', 'hi'), null, 'an unknown phrase stays English rather than being guessed');
});

test('a sentence split across formatting nodes is read as one message', () => {
  const content = { type: 'richText', richText: [
    { type: 'p', children: [{ text: 'Upload Address Proof' }] },
    { type: 'p', children: [
      { text: 'Please upload any one of the following documents as proof of your ' },
      { bold: true, text: 'permanent ' },
      { text: 'address:' },
    ] },
  ] };
  assert.equal(
    messageText(content),
    'Upload Address Proof\nPlease upload any one of the following documents as proof of your permanent address:',
  );
});

test('rebuilding keeps the link and its URL', () => {
  const content = { type: 'richText', richText: [
    { type: 'p', children: [
      { text: 'Self Declaration Letter ' },
      { type: 'a', url: 'https://docs.google.com/document/d/1vJc', children: [{ text: '(Click Here to Download)' }] },
    ] },
  ] };
  const out = rebuildMessage(content, 'स्व-घोषणा पत्र');
  const json = JSON.stringify(out);
  assert.match(json, /स्व-घोषणा पत्र/);
  assert.match(json, /https:\/\/docs\.google\.com\/document\/d\/1vJc/, 'the download link must survive translation');
});

test('only the requested language comes back - never several at once', async () => {
  const payload = () => ({
    messages: [{ id: 'm1', type: 'text', content: { type: 'richText', richText: [
      { type: 'p', children: [{ text: 'Please upload your PAN Card.' }] },
    ] } }],
    input: { id: 'i1', type: 'choice input', items: [{ id: 'c1', content: 'Passport' }] },
  });

  const hi = JSON.stringify(await translateConversationPayload(payload(), 'hi'));
  assert.match(hi, /कृपया अपना PAN कार्ड अपलोड करें।/);
  assert.match(hi, /पासपोर्ट/);
  assert.doesNotMatch(hi, /Please upload your PAN Card/, 'the English must be replaced, not appended');
  assert.doesNotMatch(hi, /પાસપોર્ટ/, 'no other language may appear');

  const gu = JSON.stringify(await translateConversationPayload(payload(), 'gu'));
  assert.match(gu, /પાસપોર્ટ/);
  assert.doesNotMatch(gu, /पासपोर्ट/);

  const en = await translateConversationPayload(payload(), 'en');
  assert.equal(en.messages[0].content.richText[0].children[0].text, 'Please upload your PAN Card.');
});

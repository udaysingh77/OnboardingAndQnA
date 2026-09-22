// ==================================================================
// Cross-document identity-name check (node:test). A second identity document (PAN/AADHAAR/
// PASSPORT) whose OCR-extracted name doesn't match the account's already-established AccountName
// is rejected outright - nothing from it is saved. Reuses workMatchService.matchCredits (the same
// matching already proven for work-link credit matching), so this suite mostly proves the wiring,
// not the matching algorithm itself (see test/workMatch.test.js for that).
//
// Two layers, same convention as verifyGate.test.js/aliasStorage.test.js:
//   1. the engine's block-on-mismatch behaviour - needs SQL Server, skipped when it isn't reachable
//   2. end-to-end through registrationEngine.js's handleUploadCore
//
// env.IDENTITY_NAME_CHECK_ENABLED is read from the ambient .env (frozen at process start, can't be
// monkey-patched here) - tests that need the check ON skip themselves when it's off locally, same
// pattern verifyGate.test.js uses for GST_VERIFY_ENABLED. A dedicated test covers the off state.
// Run: npm test
// ==================================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { registrationService, ocrProvider } from '../src/modules/registration/services/registration.service.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/prisma.js';
import { typebotSessionStore } from '../src/modules/conversation/services/typebot/typebotSessionStore.js';
import { typebotClient } from '../src/modules/conversation/services/typebot/typebotClient.js';
import { handleUpload } from '../src/modules/conversation/engines/registrationEngine.js';

const { DOC_TYPES, saveDocument } = registrationService;

let dbAvailable = false;
const createdAccountIds = [];
const originalExtract = ocrProvider.extract;

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  ocrProvider.extract = originalExtract;
  for (const id of createdAccountIds) {
    await prisma.appAccountsDoc.deleteMany({ where: { AccountId: id } }).catch(() => {});
    await prisma.appAccounts.delete({ where: { AccountId: id } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => {});
});

async function makeAccount(data = {}) {
  const account = await prisma.appAccounts.create({
    data: {
      AccountGroupId: 0,
      AccountMobile: `9300${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`,
      ...data,
    },
  });
  createdAccountIds.push(account.AccountId);
  return account;
}

function stubExtract(name, extras = {}) {
  ocrProvider.extract = async () => ({ isValid: true, name, ...extras });
}

// --- layer 1: saveDocument() blocking behaviour -----------------------------

test('the first identity document always saves and sets AccountName, whatever name it extracts', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  if (!env.OCR_ENABLED) return t.skip('OCR_ENABLED is false locally');
  if (!env.IDENTITY_NAME_CHECK_ENABLED) return t.skip('IDENTITY_NAME_CHECK_ENABLED is false locally');

  const account = await makeAccount();
  const userId = String(account.AccountId);
  stubExtract('Rahul Sharma');

  await saveDocument(userId, userId, DOC_TYPES.PAN, 'https://s3.amazonaws.com/bucket/pan.jpg');

  const saved = await prisma.appAccounts.findUnique({ where: { AccountId: account.AccountId }, select: { AccountName: true } });
  assert.equal(saved.AccountName, 'Rahul Sharma');
});

test('a second identity document with a matching name (dropped middle name) saves normally', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  if (!env.OCR_ENABLED) return t.skip('OCR_ENABLED is false locally');
  if (!env.IDENTITY_NAME_CHECK_ENABLED) return t.skip('IDENTITY_NAME_CHECK_ENABLED is false locally');

  const account = await makeAccount({ AccountName: 'Rahul Sharma' });
  const userId = String(account.AccountId);
  stubExtract('Rahul Kumar Sharma', { isValid: true, dateOfExpiry: '2030-01-01' });

  const result = await saveDocument(userId, userId, DOC_TYPES.PASSPORT, 'https://s3.amazonaws.com/bucket/passport.jpg');
  assert.equal(result.documentType, 'PASSPORT');

  const doc = await prisma.appAccountsDoc.findFirst({ where: { AccountId: account.AccountId, DocumentName: 'PASSPORT' } });
  assert.ok(doc, 'the passport row exists');
});

test('a second identity document with a non-matching name is rejected - nothing saved', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  if (!env.OCR_ENABLED) return t.skip('OCR_ENABLED is false locally');
  if (!env.IDENTITY_NAME_CHECK_ENABLED) return t.skip('IDENTITY_NAME_CHECK_ENABLED is false locally');

  const account = await makeAccount({ AccountName: 'Rahul Sharma', Detail2: null });
  const userId = String(account.AccountId);
  stubExtract('Amit Verma', { pan: 'ABCDE1234F' });

  await assert.rejects(
    () => saveDocument(userId, userId, DOC_TYPES.PAN, 'https://s3.amazonaws.com/bucket/pan.jpg'),
    (err) => {
      assert.equal(err.errorCode, 'IDENTITY_NAME_MISMATCH');
      assert.equal(err.statusCode, 400);
      return true;
    },
  );

  const doc = await prisma.appAccountsDoc.findFirst({ where: { AccountId: account.AccountId, DocumentName: 'PAN' } });
  assert.equal(doc, null, 'no document row was created for the rejected upload');

  const saved = await prisma.appAccounts.findUnique({ where: { AccountId: account.AccountId }, select: { AccountName: true, Detail2: true } });
  assert.equal(saved.AccountName, 'Rahul Sharma', 'the existing name is untouched');
  assert.equal(saved.Detail2, null, 'the mismatched document\'s PAN number was not persisted either');
});

test('with IDENTITY_NAME_CHECK_ENABLED off, a clearly mismatched document saves anyway', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  if (!env.OCR_ENABLED) return t.skip('OCR_ENABLED is false locally');
  if (env.IDENTITY_NAME_CHECK_ENABLED) return t.skip('IDENTITY_NAME_CHECK_ENABLED is true here - see the gated tests above instead');

  const account = await makeAccount({ AccountName: 'Rahul Sharma' });
  const userId = String(account.AccountId);
  stubExtract('Completely Different Person');

  const result = await saveDocument(userId, userId, DOC_TYPES.PASSPORT, 'https://s3.amazonaws.com/bucket/passport.jpg');
  assert.equal(result.documentType, 'PASSPORT', 'saved despite the mismatch - the check is bypassed, not just lenient');
});

// --- layer 2: end-to-end through handleUpload -------------------------------

const PAN_INPUT = { id: 'pan-block', type: 'file input', options: { variableId: 'vv1cibnnnutoy8v7ozdv6a908' } };

test('a mismatch surfaces through handleUpload as a re-ask, session never advances', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  if (!env.OCR_ENABLED) return t.skip('OCR_ENABLED is false locally');
  if (!env.IDENTITY_NAME_CHECK_ENABLED) return t.skip('IDENTITY_NAME_CHECK_ENABLED is false locally');

  const account = await makeAccount({ AccountName: 'Rahul Sharma' });
  const userId = String(account.AccountId);
  typebotSessionStore.set(userId, { sessionId: 'fake-session', input: PAN_INPUT });

  typebotClient.generateUploadUrl = async () => ({
    presignedUrl: 'https://s3.amazonaws.com/bucket',
    formData: {},
    fileUrl: 'https://s3.amazonaws.com/bucket/pan.jpg',
  });
  typebotClient.uploadToPresignedUrl = async () => {};
  stubExtract('Someone Else Entirely');

  const res = await handleUpload({
    userId,
    token: 'test-token',
    file: { originalname: 'pan.jpg', mimetype: 'image/jpeg', size: 1024, buffer: Buffer.from('x') },
  });

  assert.equal(res.input?.id, 'pan-block', 'still parked on the PAN upload question');
  const text = res.messages[0].content.richText[0].children[0].text ?? JSON.stringify(res.messages[0]);
  assert.match(text, /doesn't match/);
});

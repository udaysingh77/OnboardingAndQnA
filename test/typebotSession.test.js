// ==================================================================
// Recovery from an expired Typebot session (node:test).
//
// Typebot drops idle chat sessions. Observed live: a session ran fine
// for 8 turns, went 20m51s without a message, and the next continueChat
// returned 404 "Session not found." Because the sessionId lives in an
// in-memory store that was never cleared on failure, every later message
// resent the same dead id - the member was wedged permanently, curable
// only by restarting the server.
//
// A 20-minute pause is normal behaviour in this flow: it asks 26-34
// questions and several document uploads, and people go and find their
// PAN card.
//
// The error shapes below are the real ones, taken from calling both
// endpoints with a bogus sessionId.
//
// This file monkey-patches the Typebot client singleton. node:test runs
// each file in its own process, so that stays contained here.
// Run: npm test
// ==================================================================
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { appError } from '../src/shared/errors.js';
import { typebotClient, isDeadSessionError } from '../src/modules/conversation/services/typebot/typebotClient.js';
import { typebotSessionStore } from '../src/modules/conversation/services/typebot/typebotSessionStore.js';
import { handle, handleUpload } from '../src/modules/conversation/engines/registrationEngine.js';
import { prisma } from '../src/shared/prisma.js';

// --- the real wire shapes --------------------------------------------------

const deadSessionOnContinue = () =>
  appError('Session not found.', {
    statusCode: 404,
    errorCode: 'TYPEBOT_REQUEST_FAILED',
    details: { defined: false, code: 'NOT_FOUND', status: 404, message: 'Session not found.' },
  });

const deadSessionOnUpload = () =>
  appError("Can't find session", {
    statusCode: 400,
    errorCode: 'TYPEBOT_REQUEST_FAILED',
    details: { defined: false, code: 'BAD_REQUEST', status: 400, message: "Can't find session" },
  });

// A bad TYPEBOT_ID. Same 404 and same NOT_FOUND code as a dead session - only the message differs.
const unknownTypebot = () =>
  appError('Typebot not found', {
    statusCode: 404,
    errorCode: 'TYPEBOT_REQUEST_FAILED',
    details: { defined: false, code: 'NOT_FOUND', status: 404, message: 'Typebot not found' },
  });

// --- classification --------------------------------------------------------

test('both dead-session shapes are recognised', () => {
  assert.equal(isDeadSessionError(deadSessionOnContinue()), true, 'continueChat 404');
  assert.equal(isDeadSessionError(deadSessionOnUpload()), true, 'generateUploadUrl 400');
});

test('a wrong TYPEBOT_ID is NOT treated as a dead session', () => {
  // Critical: swallowing this would silently restart the chat forever against a bot that does not
  // exist, instead of failing loudly on a misconfiguration.
  assert.equal(isDeadSessionError(unknownTypebot()), false);
});

test('unrelated failures are not dead sessions', () => {
  assert.equal(isDeadSessionError(appError('Typebot service unreachable', { errorCode: 'TYPEBOT_REQUEST_FAILED' })), false);
  assert.equal(isDeadSessionError(appError('Something else', { statusCode: 404, errorCode: 'OCR_EXTRACTION_FAILED' })), false);
  assert.equal(isDeadSessionError(appError('Bad request', { statusCode: 400, errorCode: 'TYPEBOT_REQUEST_FAILED' })), false);
  assert.equal(isDeadSessionError(null), false);
  assert.equal(isDeadSessionError(new Error('Session not found.')), false, 'a plain Error is not ours');
});

// --- the restart, driven through the engine --------------------------------

const USER = '999999';
// A variableId no map knows, so no answer is persisted and the test needs no database.
const LIVE_INPUT = { id: 'old-block', type: 'text input', options: { variableId: 'vunmappedxxxxxxxxxxxxxxxx' } };

after(async () => {
  await prisma.appAccountsChatJournal.deleteMany({ where: { AccountId: BigInt(USER) } }).catch(() => {});
  await prisma.$disconnect().catch(() => {});
});
const FRESH_INPUT = { id: 'first-question', type: 'choice input', items: [{ id: 'i1', content: 'Yes' }] };

let calls;

function stubClient({ continueChat }) {
  calls = { startChat: [], continueChat: [], generateUploadUrl: [] };
  typebotClient.continueChat = async (args) => {
    calls.continueChat.push(args);
    return continueChat(args);
  };
  typebotClient.startChat = async (args) => {
    calls.startChat.push(args);
    return {
      sessionId: 'fresh-session',
      messages: [{ id: 'm1', type: 'text', content: { type: 'richText', richText: [{ type: 'p', children: [{ text: 'Welcome back' }] }] } }],
      input: FRESH_INPUT,
    };
  };
}

const texts = (res) =>
  (res.messages ?? []).map((m) => m.content?.richText?.[0]?.children?.[0]?.text ?? '').join(' || ');

beforeEach(async () => {
  typebotSessionStore.clear(USER);
  // The engine journals every accepted answer, so the tests above leave turns behind for USER - and
  // a journal makes an empty start call return the resume offer instead of starting a chat. Clear
  // it so each test here starts from "no registration in progress", which is what they all assume.
  await prisma.appAccountsChatJournal.deleteMany({ where: { AccountId: BigInt(USER) } }).catch(() => {});
});

test('an expired session restarts the chat instead of wedging', async () => {
  stubClient({ continueChat: () => { throw deadSessionOnContinue(); } });
  typebotSessionStore.set(USER, { sessionId: 'dead-session', input: LIVE_INPUT });

  const res = await handle({ userId: USER, token: 't', message: 'my answer' });

  assert.equal(calls.startChat.length, 1, 'a fresh chat was started');
  assert.equal(res.input.id, FRESH_INPUT.id, 'the member gets a real question back');
  assert.match(texts(res), /timed out/i, 'and is told why');
  assert.match(texts(res), /saved/i, 'and that their earlier answers are not lost');
  assert.match(texts(res), /Welcome back/, "Typebot's own first message is kept");

  // The dead id must be gone, replaced by the new one - this is what stops the next message
  // 404ing all over again.
  assert.equal(typebotSessionStore.get(USER).sessionId, 'fresh-session');
});

test('the answer is not replayed into the fresh chat', async () => {
  // It answered a question that no longer exists; feeding it to question 1 would just produce
  // Typebot's "Invalid message".
  stubClient({ continueChat: () => { throw deadSessionOnContinue(); } });
  typebotSessionStore.set(USER, { sessionId: 'dead-session', input: LIVE_INPUT });

  await handle({ userId: USER, token: 't', message: 'my answer' });

  assert.deepEqual(Object.keys(calls.startChat[0]), ['prefilledVariables']);
  assert.equal(JSON.stringify(calls.startChat[0]).includes('my answer'), false);
});

test('only one restart is attempted', async () => {
  stubClient({ continueChat: () => { throw deadSessionOnContinue(); } });
  typebotSessionStore.set(USER, { sessionId: 'dead-session', input: LIVE_INPUT });

  await handle({ userId: USER, token: 't', message: 'hello' });

  assert.equal(calls.continueChat.length, 1);
  assert.equal(calls.startChat.length, 1);
});

test('a non-session Typebot failure still surfaces', async () => {
  const boom = appError('Typebot service unreachable', { errorCode: 'TYPEBOT_REQUEST_FAILED' });
  stubClient({ continueChat: () => { throw boom; } });
  typebotSessionStore.set(USER, { sessionId: 'live-session', input: LIVE_INPUT });

  await assert.rejects(() => handle({ userId: USER, token: 't', message: 'hello' }), /unreachable/);
  assert.equal(calls.startChat.length, 0, 'no restart on an unrelated error');
  // The session is left alone - it was never established to be dead.
  assert.equal(typebotSessionStore.get(USER)?.sessionId, 'live-session');
});

test('a healthy turn is untouched', async () => {
  stubClient({
    continueChat: () => ({
      messages: [{ id: 'm', type: 'text', content: { type: 'richText', richText: [{ type: 'p', children: [{ text: 'Next question' }] }] } }],
      input: { id: 'next-block', type: 'text input', options: {} },
    }),
  });
  typebotSessionStore.set(USER, { sessionId: 'live-session', input: LIVE_INPUT });

  const res = await handle({ userId: USER, token: 't', message: 'hello' });

  assert.equal(calls.startChat.length, 0);
  assert.equal(res.input.id, 'next-block');
  assert.equal(/timed out/i.test(texts(res)), false, 'no spurious notice');
  assert.equal(typebotSessionStore.get(USER).sessionId, 'live-session', 'the session id is kept');
});

// --- the upload path -------------------------------------------------------

test('an expired session during upload clears it and hands back a usable question', async () => {
  stubClient({ continueChat: () => { throw new Error('should not be called'); } });
  typebotClient.generateUploadUrl = async () => { throw deadSessionOnUpload(); };
  typebotSessionStore.set(USER, {
    sessionId: 'dead-session',
    input: { id: 'upload-block', type: 'file input', options: { variableId: 'vsomefileinputxxxxxxxxxxx' } },
  });

  const res = await handleUpload({
    userId: USER,
    token: 't',
    file: { originalname: 'pan.jpg', mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from('x') },
  });

  assert.equal(calls.startChat.length, 1);
  assert.equal(res.input.id, FRESH_INPUT.id, 'not a null input the frontend would read as "ended"');
  assert.equal(res.sessionEnded, false);
  assert.match(texts(res), /timed out/i);
  assert.match(texts(res), /wasn't attached/i, 'the member is told the file did not go through');
  assert.equal(typebotSessionStore.get(USER).sessionId, 'fresh-session');
});

// --- a blank message is a start call, not an answer -------------------------

test('an empty-string message is treated as a start call, not an answer', async () => {
  // Apidog and any client that always sends the field post `{"message": ""}`. The validator allows
  // it, and every "is this a start call?" test compares against undefined - so without normalising,
  // a returning member was sent to question 1 instead of being offered their registration back.
  // Found live against account 386, which had 15 journalled turns waiting.
  stubClient({ continueChat: () => ({ input: LIVE_INPUT, messages: [] }) });
  typebotSessionStore.set(USER, { sessionId: 'live-session', input: LIVE_INPUT });

  await handle({ userId: USER, token: 't', message: '' });

  assert.equal(calls.continueChat.length, 0, 'a blank message is never relayed as an answer');
  assert.equal(calls.startChat.length, 1, 'it starts a chat, exactly as an omitted message does');
});

test('a whitespace-only message is blank too', async () => {
  stubClient({ continueChat: () => ({ input: LIVE_INPUT, messages: [] }) });
  typebotSessionStore.set(USER, { sessionId: 'live-session', input: LIVE_INPUT });

  await handle({ userId: USER, token: 't', message: '   \n ' });

  assert.equal(calls.continueChat.length, 0);
});

test('a blank message alongside a file still sends the file', async () => {
  // `text = message ?? (...)` - `??` keeps an empty string, so an upload arriving with
  // `message: ""` used to relay "" instead of the URL, and Typebot rejected its own upload.
  stubClient({ continueChat: () => ({ input: FRESH_INPUT, messages: [] }) });
  typebotSessionStore.set(USER, { sessionId: 'live-session', input: LIVE_INPUT });

  await handle({ userId: USER, token: 't', message: '', attachedFileUrls: ['https://s3/x.jpeg'] });

  assert.equal(calls.continueChat.length, 1, 'a file IS an answer, so it is relayed');
  assert.equal(calls.continueChat[0].message.text, 'https://s3/x.jpeg', 'the URL, not an empty string');
});

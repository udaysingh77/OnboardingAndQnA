// ==================================================================
// Resuming an abandoned registration (node:test).
//
// The replay logic is pure - typebotClient is stubbed, nothing here
// touches the network. Persistence needs SQL Server and is skipped when
// it isn't reachable.
//
// WHAT THIS FILE DEFENDS: a member who left halfway must come back to
// the SAME question, and must never be replayed into a question they
// never actually answered. Two ways that could happen, both pinned
// below:
//   - a rejected answer gets journalled (Typebot answers a bad input
//     with 200 and the same input repeated, so it looks like progress)
//   - a republished flow no longer asks what the journal recorded, and
//     stored answers get fed to the wrong questions
// Both were verified live before this was built: `startFrom` is silently
// ignored on the public endpoint, and a replayed journal lands on the
// identical block id - file uploads included.
// Run: npm test
// ==================================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/shared/prisma.js';
import { conversationJournalService, REPLAY_STOP, MAX_REPLAY_TURNS } from '../src/modules/conversation/services/conversationJournal.service.js';
import { typebotClient } from '../src/modules/conversation/services/typebot/typebotClient.js';
import { conversationJournalRepository } from '../src/modules/conversation/repositories/conversationJournal.repository.js';

// --- replay (pure, typebotClient stubbed) ----------------------------------

const realContinue = typebotClient.continueChat;

// A fake flow: an ordered list of block ids. Answering block N hands back block N+1, which is
// exactly what Typebot does when it accepts an answer.
function stubFlow(blockIds, { failAt = null } = {}) {
  const sent = [];
  let position = 0;
  typebotClient.continueChat = async ({ message }) => {
    if (failAt !== null && sent.length === failAt) throw new Error('typebot exploded');
    sent.push(message);
    position += 1;
    const next = blockIds[position];
    return next ? { input: { id: next }, messages: [] } : { input: null, messages: [] };
  };
  return { sent, start: () => ({ input: { id: blockIds[0] }, messages: [] }) };
}

const turn = (blockId, answer, attachedFileUrls = null) => ({ turnIndex: 0, blockId, answer, attachedFileUrls });

test('a full journal puts the member back on the question they left', async (t) => {
  const flow = stubFlow(['b1', 'b2', 'b3', 'b4']);
  t.after(() => { typebotClient.continueChat = realContinue; });

  const out = await conversationJournalService.replayJournal({
    sessionId: 's1',
    startResponse: flow.start(),
    turns: [turn('b1', 'Yes'), turn('b2', '(Individual) Author / Composer'), turn('b3', 'I Accept')],
  });

  assert.equal(out.stop, REPLAY_STOP.COMPLETE);
  assert.equal(out.replayed, 3);
  assert.equal(out.response.input.id, 'b4', 'lands on the next unanswered question');
  assert.deepEqual(flow.sent.map((m) => m.text), ['Yes', '(Individual) Author / Composer', 'I Accept']);
});

test('a republished flow stops the replay instead of answering the wrong question', async (t) => {
  // The flow now asks b1 then bX; the journal still says b2. Feeding "I Accept" to bX would put the
  // member on a branch they never chose, with data that looks deliberate.
  const flow = stubFlow(['b1', 'bX', 'bY']);
  t.after(() => { typebotClient.continueChat = realContinue; });

  const out = await conversationJournalService.replayJournal({
    sessionId: 's1',
    startResponse: flow.start(),
    turns: [turn('b1', 'Yes'), turn('b2', 'I Accept'), turn('b3', 'more')],
  });

  assert.equal(out.stop, REPLAY_STOP.DIVERGED);
  assert.equal(out.replayed, 1, 'only the turn that still matched was replayed');
  assert.equal(out.response.input.id, 'bX', 'the member carries on from the divergence point');
  assert.equal(flow.sent.length, 1, 'the stale answer was never sent');
});

test('a journal whose very first turn no longer matches sends nothing at all', async (t) => {
  const flow = stubFlow(['somewhere-else']);
  t.after(() => { typebotClient.continueChat = realContinue; });

  const out = await conversationJournalService.replayJournal({
    sessionId: 's1',
    startResponse: flow.start(),
    turns: [turn('b1', 'Yes')],
  });

  assert.equal(out.stop, REPLAY_STOP.DIVERGED);
  assert.equal(out.replayed, 0);
  assert.equal(flow.sent.length, 0);
});

test('file answers are replayed with their attachments, not just the text', async (t) => {
  // Verified live: a presigned URL minted for the old session is still accepted by a new one, and
  // Typebot's own widget sends the URL in BOTH fields - a text-only replay is rejected.
  const flow = stubFlow(['b1', 'b2']);
  t.after(() => { typebotClient.continueChat = realContinue; });

  const url = 'https://s3.example.com/results/r1/blocks/b1/pan.jpeg';
  await conversationJournalService.replayJournal({
    sessionId: 's1',
    startResponse: flow.start(),
    turns: [turn('b1', url, [url])],
  });

  assert.equal(flow.sent[0].text, url);
  assert.deepEqual(flow.sent[0].attachedFileUrls, [url]);
});

test('a mid-replay Typebot failure keeps the progress made so far', async (t) => {
  const flow = stubFlow(['b1', 'b2', 'b3'], { failAt: 1 });
  t.after(() => { typebotClient.continueChat = realContinue; });

  const out = await conversationJournalService.replayJournal({
    sessionId: 's1',
    startResponse: flow.start(),
    turns: [turn('b1', 'a'), turn('b2', 'b')],
  });

  assert.equal(out.stop, REPLAY_STOP.FAILED);
  assert.equal(out.replayed, 1, 'half a replay still beats dropping them at question 1');
  assert.equal(out.response.input.id, 'b2');
});

test('a flow that ends during replay reports it rather than looping', async (t) => {
  const flow = stubFlow(['b1', 'b2']);
  t.after(() => { typebotClient.continueChat = realContinue; });

  const out = await conversationJournalService.replayJournal({
    sessionId: 's1',
    startResponse: flow.start(),
    turns: [turn('b1', 'a'), turn('b2', 'b'), turn('b3', 'c')],
  });

  assert.equal(out.stop, REPLAY_STOP.ENDED);
  assert.equal(out.response.input, null);
});

test('replay is capped - a corrupt journal cannot hammer Typebot forever', async (t) => {
  const many = Array.from({ length: MAX_REPLAY_TURNS + 10 }, (_, i) => `b${i}`);
  const flow = stubFlow(many);
  t.after(() => { typebotClient.continueChat = realContinue; });

  const out = await conversationJournalService.replayJournal({
    sessionId: 's1',
    startResponse: flow.start(),
    turns: many.map((id) => turn(id, 'x')),
  });

  assert.equal(out.stop, REPLAY_STOP.CAPPED);
  assert.equal(out.replayed, MAX_REPLAY_TURNS);
});

// --- persistence -----------------------------------------------------------

let dbAvailable = false;
const createdAccountIds = [];

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  for (const id of createdAccountIds) {
    await prisma.appAccountsChatJournal.deleteMany({ where: { AccountId: id } }).catch(() => {});
    await prisma.appAccounts.delete({ where: { AccountId: id } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => {});
});

async function makeAccount() {
  const account = await prisma.appAccounts.create({
    data: {
      AccountGroupId: 0,
      AccountMobile: `9300${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`,
    },
  });
  createdAccountIds.push(account.AccountId);
  return String(account.AccountId);
}

test('turns are stored in order and read back ready to replay', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  await conversationJournalService.recordTurn({ userId, blockId: 'b1', variableId: 'v1', answer: 'Yes' });
  // A navigation-only choice: no variableId at all. 38 of the flow's 131 inputs look like this, and
  // they are the reason the existing columns cannot reconstruct the path.
  await conversationJournalService.recordTurn({ userId, blockId: 'b2', variableId: null, answer: 'I Accept' });
  await conversationJournalService.recordTurn({
    userId,
    blockId: 'b3',
    answer: 'https://s3/x.jpeg',
    attachedFileUrls: ['https://s3/x.jpeg'],
  });

  const journal = await conversationJournalService.loadJournal(userId);
  assert.deepEqual(journal.map((entry) => entry.blockId), ['b1', 'b2', 'b3']);
  assert.deepEqual(journal.map((entry) => entry.turnIndex), [0, 1, 2], 'no holes, no duplicates');
  assert.deepEqual(journal[2].attachedFileUrls, ['https://s3/x.jpeg'], 'attachments survive the round trip');
  assert.equal(journal[1].attachedFileUrls, null);
  assert.equal(await conversationJournalService.lastBlockId(userId), 'b3');
});

test('a short replay truncates the rest, so the next resume is not poisoned', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  for (const blockId of ['b1', 'b2', 'b3', 'b4']) {
    await conversationJournalService.recordTurn({ userId, blockId, answer: 'x' });
  }

  // Replay only got two turns in before the flow diverged.
  await conversationJournalService.truncateAfterReplay(userId, 2);

  const journal = await conversationJournalService.loadJournal(userId);
  assert.deepEqual(journal.map((entry) => entry.blockId), ['b1', 'b2']);

  // And the next answer appends cleanly rather than leaving a gap where the stale turns were.
  await conversationJournalService.recordTurn({ userId, blockId: 'bNew', answer: 'y' });
  const after = await conversationJournalService.loadJournal(userId);
  assert.deepEqual(after.map((entry) => entry.turnIndex), [0, 1, 2]);
  assert.equal(after[2].blockId, 'bNew');
});

test('starting over leaves nothing behind to resume into', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  await conversationJournalService.recordTurn({ userId, blockId: 'b1', answer: 'Yes' });
  assert.equal(await conversationJournalService.countTurns(userId), 1);

  await conversationJournalService.clearJournal(userId);
  assert.equal(await conversationJournalService.countTurns(userId), 0);
  assert.equal(await conversationJournalService.lastBlockId(userId), null);
});

test('a member with no journal is a first-time member, not a resume', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  assert.equal(await conversationJournalService.countTurns(userId), 0);
  assert.deepEqual(await conversationJournalService.loadJournal(userId), []);
});

test('a journal write failure never costs the member their turn', async (t) => {
  // Stubbed rather than provoked with a bad id: App_Accounts_ChatJournal has no foreign key on
  // AccountId, so an unknown account inserts perfectly happily and would test nothing.
  const real = conversationJournalRepository.createTurn;
  conversationJournalRepository.createTurn = async () => {
    throw new Error('database is down');
  };
  t.after(() => { conversationJournalRepository.createTurn = real; });

  // Resume is a convenience; the answer the member just gave is not. A journal outage must cost
  // them the ability to resume past this point, never the turn itself.
  const result = await conversationJournalService.recordTurn({ userId: '1', blockId: 'b1', answer: 'x' });
  assert.equal(result, null);
});

test('a turn with no block id is not journalled', async () => {
  // Synthetic inputs (the OCR confirmation, the email OTP step, this feature's own resume prompt)
  // are not Typebot blocks, so there is nothing replayable about them.
  assert.equal(await conversationJournalService.recordTurn({ userId: '1', blockId: null, answer: 'x' }), null);
  assert.equal(await conversationJournalService.recordTurn({ userId: null, blockId: 'b1', answer: 'x' }), null);
});

// ==================================================================
// Alias storage (node:test) - App_Accounts.AccountAlias holds several
// comma-separated names now, position tracking trust in place of a
// Source column (see registration.service.js's getIdentityNames()/
// addAliases()). WHY THIS IS PINNED: the position convention only works
// if addAliases() never disturbs an existing entry's order and never
// lets the joined string overflow the column's own width (NVarChar(200))
// - both of those are exactly the failure modes a table never had to
// worry about.
//
// Two layers, same convention as memberRoleCodes.test.js/emailOtpGate.test.js:
//   1. parseAliasList/splitAliasList - pure, always run
//   2. addAliases/getIdentityNames - needs SQL Server, skipped when it
//      isn't reachable
// Run: npm test
// ==================================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseAliasList, registrationService } from '../src/modules/registration/services/registration.service.js';
import { prisma } from '../src/shared/prisma.js';

const { addAliases, getIdentityNames, splitAliasList } = registrationService;

// --- layer 1: pure splitting -----------------------------------------------

test('parseAliasList trims, drops empties, bounds count and length', () => {
  assert.deepEqual(parseAliasList('Arijit, A.R. Rahman ,  '), ['Arijit', 'A.R. Rahman']);
  assert.deepEqual(parseAliasList(''), []);
  assert.deepEqual(parseAliasList(null), []);
  assert.deepEqual(parseAliasList('a,b,c,d,e,f,g'), ['a', 'b', 'c', 'd', 'e']); // capped at 5 per turn
  assert.deepEqual(parseAliasList('x'.repeat(201)), []); // longer than the column can ever hold
});

test('splitAliasList reads back the whole stored list, no per-turn cap', () => {
  assert.deepEqual(splitAliasList('a, b, c, d, e, f'), ['a', 'b', 'c', 'd', 'e', 'f']); // > 5 is fine here
  assert.deepEqual(splitAliasList(''), []);
  assert.deepEqual(splitAliasList(null), []);
  assert.deepEqual(splitAliasList(undefined), []);
  assert.deepEqual(splitAliasList('  Shaarib Toshi  '), ['Shaarib Toshi']);
});

// --- layer 2: addAliases/getIdentityNames, driven against a real account ---

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

test('a flow-time alias is trusted; a later work-link claim is not', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  // The flow's stage-name question always writes here first (plain overwrite - see
  // conversationFieldMap.js), before any work-link claim runs.
  const account = await makeAccount({ AccountName: 'Uday Singh', AccountAlias: 'DJ Uday' });

  const added = await addAliases(String(account.AccountId), ['Shaarib Toshi']);
  assert.equal(added, 1);

  const { trusted, claimed } = await getIdentityNames(String(account.AccountId));
  assert.deepEqual(trusted, ['Uday Singh', 'DJ Uday']);
  assert.deepEqual(claimed, ['Shaarib Toshi']);

  const saved = await prisma.appAccounts.findUnique({ where: { AccountId: account.AccountId }, select: { AccountAlias: true } });
  assert.equal(saved.AccountAlias, 'DJ Uday, Shaarib Toshi');
});

test('a claimed name is never promoted to trusted on a later call', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const account = await makeAccount({ AccountName: 'Uday Singh', AccountAlias: 'DJ Uday' });

  await addAliases(String(account.AccountId), ['Name One']);
  await addAliases(String(account.AccountId), ['Name Two']);

  const { trusted, claimed } = await getIdentityNames(String(account.AccountId));
  assert.deepEqual(trusted, ['Uday Singh', 'DJ Uday']);
  assert.deepEqual(claimed, ['Name One', 'Name Two']); // both stay claimed, order preserved
});

test('duplicates (case-insensitive) are not re-added', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const account = await makeAccount({ AccountAlias: 'Arijit Singh' });

  const added = await addAliases(String(account.AccountId), ['arijit singh', 'New Name']);
  assert.equal(added, 1, 'only the genuinely new name counts');

  const saved = await prisma.appAccounts.findUnique({ where: { AccountId: account.AccountId }, select: { AccountAlias: true } });
  assert.equal(saved.AccountAlias, 'Arijit Singh, New Name');
});

test('stops adding once the 200-char column would overflow, never truncates a name', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const account = await makeAccount({ AccountAlias: 'X'.repeat(180) });

  const added = await addAliases(String(account.AccountId), ['This name does not fit']);
  assert.equal(added, 0, 'no room left, so nothing is added rather than a truncated name');

  const saved = await prisma.appAccounts.findUnique({ where: { AccountId: account.AccountId }, select: { AccountAlias: true } });
  assert.equal(saved.AccountAlias, 'X'.repeat(180), 'the existing value is untouched');
  assert.ok(saved.AccountAlias.length <= 200);
});

test('an account with no alias at all reports no trusted/claimed names, not an error', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const account = await makeAccount({ AccountName: 'No Alias Yet' });

  const { trusted, claimed } = await getIdentityNames(String(account.AccountId));
  assert.deepEqual(trusted, ['No Alias Yet']);
  assert.deepEqual(claimed, []);
});

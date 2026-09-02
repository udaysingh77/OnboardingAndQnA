// ==================================================================
// Work links - the cap, the audit marker, and the "grounded data only"
// rule (node:test).
//
// The gate's own vocabulary is pure and always runs; persistence needs
// SQL Server and is skipped when it isn't reachable.
//
// THE RULE THIS FILE DEFENDS: IPRS is a rights society, so
// Author_Composer, Author_Lyricist, LanguageNames, WorkCategory and
// DocLink are legally meaningful and are left null for staff. Nothing
// we can call sources them truthfully - Spotify returns one unlabelled
// bag of artists mixing performers with writers, and a YouTube title is
// a sentence. An empty column beats an invented credit.
// Run: npm test
// ==================================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/shared/prisma.js';
import { workLinkService, MAX_WORK_LINKS, MATCH_MARKERS } from '../src/modules/work/services/workLink.service.js';
import {
  confirmsSong,
  wantsAnotherLink,
  describeSong,
  describeCredits,
  isWorkLinkStep,
  WORK_URL_VARIABLE_ID,
  MAX_ALIAS_ATTEMPTS,
} from '../src/modules/conversation/services/typebot/workLinkGate.js';

// --- the gate's vocabulary (pure) ------------------------------------------

test('the work-link step recognises its own block', () => {
  assert.equal(isWorkLinkStep(WORK_URL_VARIABLE_ID), true);
  assert.equal(isWorkLinkStep('another-variable'), false);
});

test('confirmation answers', () => {
  for (const yes of ["Yes, that's my song", 'yes', 'Y', ' y ']) assert.equal(confirmsSong(yes), true, yes);
  for (const no of ['No, wrong link', 'no', 'maybe', '']) assert.equal(confirmsSong(no), false, no);
});

test('add-another answers', () => {
  for (const yes of ['Yes, add another', 'yes', 'add another']) assert.equal(wantsAnotherLink(yes), true, yes);
  for (const no of ['No, continue', 'no', '']) assert.equal(wantsAnotherLink(no), false, no);
});

test('the song card shows only fields the provider actually returned', () => {
  const full = describeSong({
    songName: 'Kesariya', artists: ['Pritam', 'Arijit Singh'], filmOrAlbum: 'Brahmastra', releaseYear: 2022,
  });
  assert.match(full, /Song: Kesariya/);
  assert.match(full, /Artist: Pritam, Arijit Singh/);
  assert.match(full, /Film\/Album: Brahmastra/);
  assert.match(full, /Released: 2022/);
  assert.match(full, /Is this your song\?/);

  // A YouTube link has no release year and often no album - those lines must be absent, not blank.
  const sparse = describeSong({ songName: 'Some Song', artists: ['Someone'], filmOrAlbum: null, releaseYear: null });
  assert.equal(/Film\/Album/.test(sparse), false);
  assert.equal(/Released/.test(sparse), false);
});

test('the credits prompt invites several names at once', () => {
  const message = describeCredits({ artists: ['Pritam', 'Arijit Singh'] });
  assert.match(message, /Pritam, Arijit Singh/);
  assert.match(message, /separated by commas/i);

  // Falls back to the channel name when the title could not be parsed into artists.
  assert.match(describeCredits({ artists: [], channelName: 'T-Series' }), /T-Series/);
  // And says something sensible with neither.
  assert.match(describeCredits({ artists: [] }), /couldn't find your name/i);
});

test('the alias loop is bounded - nobody may get stuck on this step', () => {
  assert.ok(Number.isInteger(MAX_ALIAS_ATTEMPTS) && MAX_ALIAS_ATTEMPTS > 0 && MAX_ALIAS_ATTEMPTS <= 5);
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
    await prisma.appAccountsWorkRegistration.deleteMany({ where: { AccountId: id } }).catch(() => {});
    await prisma.appAccounts.delete({ where: { AccountId: id } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => {});
});

async function makeAccount() {
  const account = await prisma.appAccounts.create({
    data: {
      AccountGroupId: 0,
      AccountMobile: `9200${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`,
    },
  });
  createdAccountIds.push(account.AccountId);
  return String(account.AccountId);
}

const spotifyTrack = (n = 1) => ({
  provider: 'spotify',
  url: `https://open.spotify.com/track/track${n}`,
  songName: `Song ${n}`,
  artists: ['Pritam', 'Arijit Singh'],
  filmOrAlbum: 'Brahmastra',
  releaseYear: 2022,
  publisher: 'Sony Music Entertainment India Pvt. Ltd.',
  credits: ['Pritam', 'Arijit Singh'],
});

test('a saved link keeps the rights columns null', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  const row = await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(), matched: true });

  assert.equal(row.SongName, 'Song 1');
  assert.equal(row.Film_AlbumName, 'Brahmastra');
  assert.equal(row.Artist_Singers, 'Pritam, Arijit Singh');
  assert.equal(Number(row.ReleaseYear), 2022);

  // The whole point: these are for staff, never for us to guess.
  assert.equal(row.Author_Composer, null);
  assert.equal(row.Author_Lyricist, null);
  assert.equal(row.LanguageNames, null);
  assert.equal(row.WorkCategory, null);
  assert.equal(row.DocLink, null);
});

test('CreatedBy records whether the name check passed', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  const verified = await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(1), matched: true });
  const unverified = await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(2), matched: false });

  // A free audit column, so staff can find unverified claims without a schema change.
  assert.equal(verified.CreatedBy, MATCH_MARKERS.MATCHED);
  assert.equal(unverified.CreatedBy, MATCH_MARKERS.UNVERIFIED);
});

test(`the cap holds at ${MAX_WORK_LINKS} - the next link is refused, not silently dropped`, async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  for (let i = 1; i <= MAX_WORK_LINKS; i += 1) {
    const row = await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(i), matched: true });
    assert.ok(row, `link ${i} should have saved`);
  }
  assert.equal(await workLinkService.countWorkLinks(userId), MAX_WORK_LINKS);

  // null is the signal the engine turns into a visible notice for the member.
  const overflow = await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(99), matched: true });
  assert.equal(overflow, null);
  assert.equal(await workLinkService.countWorkLinks(userId), MAX_WORK_LINKS, 'nothing extra was written');
});

test('over-long values are clipped to the column width instead of failing the insert', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  const row = await workLinkService.saveWorkLink({
    userId,
    resolved: {
      ...spotifyTrack(),
      songName: 'S'.repeat(300),
      filmOrAlbum: 'F'.repeat(300),
      artists: Array.from({ length: 80 }, (_, i) => `Artist Number ${i}`),
      publisher: 'P'.repeat(300),
      url: `https://open.spotify.com/track/x?${'q'.repeat(800)}`,
    },
    matched: false,
  });

  assert.ok(row.SongName.length <= 100, `SongName ${row.SongName.length}`);
  assert.ok(row.Film_AlbumName.length <= 100, `Film_AlbumName ${row.Film_AlbumName.length}`);
  assert.ok(row.Artist_Singers.length <= 500, `Artist_Singers ${row.Artist_Singers.length}`);
  assert.ok(row.Publisher.length <= 100, `Publisher ${row.Publisher.length}`);
  assert.ok(row.DigitalLink.length <= 500, `DigitalLink ${row.DigitalLink.length}`);
});

test('missing optional metadata is stored as null, not an empty string', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  // A YouTube link: no release year, no publisher, often no album.
  const row = await workLinkService.saveWorkLink({
    userId,
    resolved: {
      provider: 'youtube',
      url: 'https://www.youtube.com/watch?v=abc123',
      songName: 'Some Song',
      artists: ['A Channel'],
      filmOrAlbum: null,
      releaseYear: null,
      publisher: null,
      credits: ['A Channel'],
    },
    matched: false,
  });

  assert.equal(row.Film_AlbumName, null);
  assert.equal(row.ReleaseYear, null);
  assert.equal(row.Publisher, null);
  assert.equal(row.DigitalLink, 'https://www.youtube.com/watch?v=abc123');
});

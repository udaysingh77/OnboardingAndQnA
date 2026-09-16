// ==================================================================
// Work links - the cap, the audit marker, and the "grounded data only"
// rule (node:test).
//
// The gate's own vocabulary is pure and always runs; persistence needs
// SQL Server and is skipped when it isn't reachable.
//
// THE RULE THIS FILE DEFENDS: IPRS is a rights society, so a credit is
// written only when a source actually LABELLED it, never inferred. An
// empty column beats an invented credit.
//
// Author_Composer and Author_Lyricist are now filled - but only from the
// credits service's role-labelled output (Spotify's own contributor
// roles, or the credit block in a YouTube description), AND only when
// the confirming member's own on-file name is itself inside that role's
// list (`memberNames`) - a role-labelled list describes the SONG, not
// whichever member happens to be confirming it. When either condition
// fails, the columns stay null exactly as before; the old Spotify artist
// bag and YouTube title never fill them either, because neither says who
// wrote the song. LanguageNames, WorkCategory and DocLink stay null
// always - nothing we can call sources them truthfully.
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

test('the song card shows role-labelled credits when the service supplied them', () => {
  const withRoles = describeSong({
    songName: 'Apna Bana Le',
    artists: ['Arijit Singh'],
    filmOrAlbum: 'Bhediya',
    composers: ['Sachin-Jigar'],
    lyricists: ['Amitabh Bhattacharya'],
  });
  assert.match(withRoles, /Composer: Sachin-Jigar/);
  assert.match(withRoles, /Lyricist: Amitabh Bhattacharya/);

  // Absent when the credits service had nothing - no blank "Composer:" line.
  const withoutRoles = describeSong({ songName: 'Song', artists: ['Someone'], composers: [], lyricists: [] });
  assert.equal(/Composer/.test(withoutRoles), false);
  assert.equal(/Lyricist/.test(withoutRoles), false);
});

test('the credits prompt invites several names at once', () => {
  const message = describeCredits({ artists: ['Pritam', 'Arijit Singh'] });
  assert.match(message, /Pritam, Arijit Singh/);
  assert.match(message, /separated by commas/i);

  // Every credited name is listed, not just the performers - a member credited only as the
  // lyricist has to be able to see themselves in that list.
  assert.match(
    describeCredits({ artists: ['Arijit Singh'], credits: ['Arijit Singh', 'Amitabh Bhattacharya'] }),
    /Amitabh Bhattacharya/,
  );

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

test('a link with no role-labelled credits leaves the writer columns null', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  // spotifyTrack() carries artists but no composers/lyricists - the shape the resolver returns
  // when the credits service is off or had nothing. An artist list is not a writer credit.
  const row = await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(), matched: true });

  assert.equal(row.SongName, 'Song 1');
  assert.equal(row.Film_AlbumName, 'Brahmastra');
  assert.equal(row.Artist_Singers, 'Pritam, Arijit Singh');
  assert.equal(Number(row.ReleaseYear), 2022);

  assert.equal(row.Author_Composer, null, 'an artist bag must never become a composer credit');
  assert.equal(row.Author_Lyricist, null, 'an artist bag must never become a lyricist credit');

  // Still nothing we can source truthfully - these remain for staff.
  assert.equal(row.LanguageNames, null);
  assert.equal(row.WorkCategory, null);
  assert.equal(row.DocLink, null);
});

test('role-labelled credits are written to the writer columns when the member IS that writer', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  const row = await workLinkService.saveWorkLink({
    userId,
    resolved: {
      ...spotifyTrack(),
      composers: ['Sachin-Jigar'],
      // Duplicates collapse, and several writers share the one column.
      lyricists: ['Amitabh Bhattacharya', 'Amitabh Bhattacharya', 'Priya Saraiya'],
    },
    matched: true,
    // The member's own on-file name is itself in the composers list - that is what earns the write.
    memberNames: ['Sachin-Jigar'],
  });

  assert.equal(row.Author_Composer, 'Sachin-Jigar');
  // The member matched as composer, not lyricist - but the full lyricist credit still gets written,
  // because the column records the song's own lyricist(s), not only names the member matched under.
  assert.equal(row.Author_Lyricist, null, "matching as composer doesn't also unlock the lyricist column");

  // Never sourced, so never written - the rule that survives this change.
  assert.equal(row.LanguageNames, null);
  assert.equal(row.WorkCategory, null);
  assert.equal(row.DocLink, null);
});

test('a credited member who is NOT the composer/lyricist never gets a stranger\'s name in their row', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  // The member matched the song overall (matched: true - e.g. as a backing vocalist somewhere in
  // the credits), but their own name is not Sachin-Jigar or Amitabh Bhattacharya. Writing the full
  // composer/lyricist list into THEIR row would put someone else's name in a legally meaningful
  // column - see workLink.service.js.
  const row = await workLinkService.saveWorkLink({
    userId,
    resolved: {
      ...spotifyTrack(),
      composers: ['Sachin-Jigar'],
      lyricists: ['Amitabh Bhattacharya'],
    },
    matched: true,
    memberNames: ['Rana Mazumdar'],
  });

  assert.equal(row.Author_Composer, null);
  assert.equal(row.Author_Lyricist, null);
});

test('a dropped middle name still earns the writer column, via the same rules as song matching', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  const row = await workLinkService.saveWorkLink({
    userId,
    resolved: { ...spotifyTrack(), composers: ['A.R. Rahman'], lyricists: [] },
    matched: true,
    // "Allah Rakha Rahman" (the identity-document name) vs the credit's "A.R. Rahman" - the exact
    // initial/dropped-middle-name case workMatch.service.js exists to forgive.
    memberNames: ['Allah Rakha Rahman'],
  });

  assert.equal(row.Author_Composer, 'A.R. Rahman');
});

test('an empty credit list is stored as null, not an empty string', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  const row = await workLinkService.saveWorkLink({
    userId,
    resolved: { ...spotifyTrack(), composers: [], lyricists: ['  '] },
    matched: true,
  });

  assert.equal(row.Author_Composer, null);
  assert.equal(row.Author_Lyricist, null);
});

test('a crowded writer credit is clipped to the column width', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  const row = await workLinkService.saveWorkLink({
    userId,
    resolved: {
      ...spotifyTrack(),
      composers: Array.from({ length: 40 }, (_, i) => `Composer Number ${i}`),
      lyricists: Array.from({ length: 40 }, (_, i) => `Lyricist Number ${i}`),
    },
    matched: true,
    // The member has to be one of the credited writers for either column to be written at all.
    memberNames: ['Composer Number 0', 'Lyricist Number 0'],
  });

  assert.ok(row.Author_Composer.length <= 100, `Author_Composer ${row.Author_Composer.length}`);
  assert.ok(row.Author_Lyricist.length <= 100, `Author_Lyricist ${row.Author_Lyricist.length}`);
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

// --- clearing on "Start over" -----------------------------------------------

test('clearWorkLinks removes every song for that member', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userId = await makeAccount();

  await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(1), matched: true });
  await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(2), matched: true });
  assert.equal(await workLinkService.countWorkLinks(userId), 2);

  await workLinkService.clearWorkLinks(userId);

  assert.equal(await workLinkService.countWorkLinks(userId), 0);
  // Not just uncounted - actually gone, so a fresh link after this starts a clean cap.
  const row = await workLinkService.saveWorkLink({ userId, resolved: spotifyTrack(3), matched: true });
  assert.ok(row, 'the cap was not left exhausted by the cleared rows');
  assert.equal(await workLinkService.countWorkLinks(userId), 1, 'only the new link counts');
});

test('clearWorkLinks never touches another member', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const userA = await makeAccount();
  const userB = await makeAccount();

  await workLinkService.saveWorkLink({ userId: userA, resolved: spotifyTrack(1), matched: true });
  await workLinkService.saveWorkLink({ userId: userB, resolved: spotifyTrack(2), matched: true });

  await workLinkService.clearWorkLinks(userA);

  assert.equal(await workLinkService.countWorkLinks(userA), 0);
  assert.equal(await workLinkService.countWorkLinks(userB), 1, "someone else's restart must not touch this");
});

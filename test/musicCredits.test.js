// ==================================================================
// The credits service client (node:test). Pure - global.fetch is
// mocked, nothing here touches the network or the DB.
//
// The payloads below are trimmed copies of real responses from
// spotify.choira.in, including its two awkward habits: "N/A" as the null
// sentinel on the Spotify path, and `credits.song` arriving as [] rather
// than a string when a video has no credit block.
//
// WHAT THIS FILE DEFENDS: fetchCredits() must return null - never throw,
// never a half-filled object - for every failure, because the caller
// falls back to the Spotify Web API / oEmbed pair and a member must
// never be blocked on the work-link step by a metadata outage.
// Run: npm test
// ==================================================================
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCredits, hasUsableCredits } from '../src/modules/work/services/musicCredits.service.js';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockJson(status, body) {
  global.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  });
}

// --- Spotify ---------------------------------------------------------------

const SPOTIFY_OK = {
  platform: 'spotify',
  song_name: 'Ve Haaniyaan',
  artist: 'Danny|Avvy Sra|Sagar',
  source: 'Dreamiyata Entertainment Pvt Ltd',
  sources: ['Dreamiyata Entertainment Pvt Ltd'],
  contributors: [
    { name: 'Danny', role: 'Main Artist', role_group: 'Artist' },
    { name: 'Avvy Sra', role: 'Main Artist', role_group: 'Artist' },
    { name: 'Sagar', role: 'Main Artist', role_group: 'Artist' },
    { name: 'Sagar', role: 'Composer', role_group: 'Composition & Lyrics' },
    { name: 'Sagar', role: 'Lyricist', role_group: 'Composition & Lyrics' },
    { name: 'Avvy Sra', role: 'Producer', role_group: 'Production & Engineering' },
  ],
};

test('Spotify contributors are split by role, not lumped together', async () => {
  mockJson(200, SPOTIFY_OK);
  const credits = await fetchCredits('https://open.spotify.com/track/2C6CJGFLbisteRuY6Plb7b');

  assert.equal(credits.platform, 'spotify');
  assert.equal(credits.songName, 'Ve Haaniyaan');
  assert.deepEqual(credits.artists, ['Danny', 'Avvy Sra', 'Sagar']);

  // The point of the whole change: one person, three roles, correctly separated.
  assert.deepEqual(credits.composers, ['Sagar']);
  assert.deepEqual(credits.lyricists, ['Sagar']);
  assert.deepEqual(credits.producers, ['Avvy Sra']);

  assert.equal(credits.publisher, 'Dreamiyata Entertainment Pvt Ltd');
  // Credits carry no album or release date - the resolver gets those from the Web API.
  assert.equal(credits.filmOrAlbum, null);

  // Deduplicated across roles, so the matcher sees each person once.
  assert.deepEqual(credits.allCredits, ['Danny', 'Avvy Sra', 'Sagar']);
});

test('an unknown Spotify track answers 200 with "N/A" - that is not a song', async () => {
  // Verified live: a bad id does NOT 404, it returns this. Treating "N/A" as a name would store
  // the literal string as the member's song.
  mockJson(200, {
    song_name: 'N/A',
    artist: 'N/A',
    source: 'N/A',
    contributors: [],
    sources: [],
    raw: { data: { trackUnion: { __typename: 'NotFound' } } },
  });

  assert.equal(await fetchCredits('https://open.spotify.com/track/0000000000000000000000'), null);
});

// --- YouTube ---------------------------------------------------------------

const YOUTUBE_OK = {
  platform: 'youtube',
  video_id: 'ElZfdU54Cp8',
  title: 'Apna Bana Le',
  channel: 'Zee Music Company',
  song_name: 'Apna Bana Le',
  credits: {
    song: 'Apna Bana Le',
    album_or_movie: 'Bhediya',
    singers: ['Arijit Singh', 'Sachin-Jigar'],
    composers: ['Sachin-Jigar'],
    lyricists: ['Amitabh Bhattacharya'],
    producers: ['Dinesh Vijan'],
    musicians: ['Himonshu Parikh'],
    engineers: ['Eric Pillai'],
    others: ['Niren Bhatt'],
  },
  description: 'Song: Apna Bana Le\nSingers: Arijit Singh & Sachin-Jigar\nLyrics: Amitabh Bhattacharya',
};

test('YouTube credits come from the description, with the album and the full text', async () => {
  mockJson(200, YOUTUBE_OK);
  const credits = await fetchCredits('https://www.youtube.com/watch?v=ElZfdU54Cp8');

  assert.equal(credits.platform, 'youtube');
  assert.equal(credits.songName, 'Apna Bana Le');
  assert.deepEqual(credits.artists, ['Arijit Singh', 'Sachin-Jigar']);
  assert.deepEqual(credits.composers, ['Sachin-Jigar']);
  assert.deepEqual(credits.lyricists, ['Amitabh Bhattacharya']);
  assert.equal(credits.filmOrAlbum, 'Bhediya');
  assert.equal(credits.channelName, 'Zee Music Company');

  // creditText is the description, not the title - the matcher searches it under the two-token rule.
  assert.match(credits.creditText, /Amitabh Bhattacharya/);

  // Everyone credited, including musicians/engineers/others, so an obscure credit still matches.
  for (const name of ['Arijit Singh', 'Himonshu Parikh', 'Eric Pillai', 'Niren Bhatt']) {
    assert.ok(credits.allCredits.includes(name), `${name} should be matchable`);
  }
});

test('a non-music video is rejected even though it answers 200', async () => {
  // A TED talk, verified live: empty credit lists, `song` as [] not a string, and `song_name`
  // echoing the video's own title. Only the absence of credited people separates it from a song.
  mockJson(200, {
    platform: 'youtube',
    video_id: '8jPQjjsBbIc',
    title: "How to stay calm when you know you'll be stressed | TED",
    channel: 'TED',
    song_name: "How to stay calm when you know you'll be stressed | TED",
    credits: {
      song: [],
      album_or_movie: [],
      singers: [],
      composers: [],
      lyricists: [],
      producers: [],
      musicians: [],
      engineers: [],
      others: ['Daniel Levitin'],
    },
    description: 'Visit http://TED.com to get our entire library of TED Talks',
  });

  assert.equal(await fetchCredits('https://www.youtube.com/watch?v=8jPQjjsBbIc'), null);
});

// --- degradation -----------------------------------------------------------

test('every failure returns null rather than throwing', async () => {
  // 422 is the service's "not a Spotify or YouTube link".
  mockJson(422, { detail: "Could not detect Spotify or YouTube from 'https://example.com/nope'" });
  assert.equal(await fetchCredits('https://example.com/nope'), null);

  mockJson(500, { detail: 'boom' });
  assert.equal(await fetchCredits('https://open.spotify.com/track/x'), null);

  // Unreachable host / timeout.
  global.fetch = async () => {
    throw new Error('ECONNREFUSED');
  };
  assert.equal(await fetchCredits('https://open.spotify.com/track/x'), null);

  // A 200 that isn't JSON.
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      throw new Error('not json');
    },
  });
  assert.equal(await fetchCredits('https://open.spotify.com/track/x'), null);
});

test('usability is judged on credited people, not on a song name', () => {
  assert.equal(hasUsableCredits(null), false);
  assert.equal(hasUsableCredits({ songName: 'N/A', artists: [], composers: [], lyricists: [] }), false);
  // A title alone is not a credit - that is what let the TED talk through.
  assert.equal(hasUsableCredits({ songName: 'Some Lecture', artists: [], composers: [], lyricists: [] }), false);
  // A writer-only credit is enough: the member may be the lyricist and nothing else.
  assert.equal(hasUsableCredits({ songName: null, artists: [], composers: [], lyricists: ['X'] }), true);
});

test('the request goes to the resolve endpoint with the link encoded', async () => {
  let seen;
  global.fetch = async (url) => {
    seen = url;
    return { ok: true, status: 200, async json() { return SPOTIFY_OK; } };
  };

  await fetchCredits('https://open.spotify.com/track/2C6CJGFLbisteRuY6Plb7b');
  assert.match(seen, /\/resolve\?url=/);
  assert.match(seen, /https%3A%2F%2Fopen\.spotify\.com/, 'the link must be URL-encoded');
});

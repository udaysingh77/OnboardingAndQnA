// ==================================================================
// The credits service client (node:test). Pure - global.fetch is
// mocked, nothing here touches the network or the DB.
//
// The payloads below are trimmed copies of real responses from
// spotify.choira.in, including its two awkward habits: "N/A" as the null
// sentinel on the Spotify path, and `credits.song` arriving as [] rather
// than a string when a video has no credit block.
//
// WHAT THIS FILE DEFENDS: both fetchers must return null - never throw,
// never a half-filled object - for every failure, because the caller
// falls back to the Spotify Web API / oEmbed pair and a member must
// never be blocked on the work-link step by a metadata outage.
// Run: npm test
// ==================================================================
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchSpotifyCredits,
  fetchYoutubeCredits,
  hasUsableCredits,
} from '../src/modules/work/services/musicCredits.service.js';

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
  const credits = await fetchSpotifyCredits('https://open.spotify.com/track/2C6CJGFLbisteRuY6Plb7b');

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

  assert.equal(await fetchSpotifyCredits('https://open.spotify.com/track/0000000000000000000000'), null);
});

// --- YouTube: raw InnerTube, parsed here -----------------------------------

// The shape /youtube/raw returns for a song: a YouTube Music browse page. Trimmed, but the two
// renderers and the real description text are exactly as the live service returns them.
function musicPage(description) {
  return {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              content: {
                sectionListRenderer: {
                  contents: [
                    {
                      musicResponsiveHeaderRenderer: {
                        title: { runs: [{ text: 'Apna Bana Le' }] },
                        straplineTextOne: { runs: [{ text: 'Zee Music Company' }] },
                        subtitle: { runs: [{ text: '626M views • Nov 7, 2022' }] },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
        secondaryContents: {
          sectionListRenderer: {
            contents: [
              { musicDescriptionShelfRenderer: { description: { runs: [{ text: description }] } } },
            ],
          },
        },
      },
    },
  };
}

const REAL_DESCRIPTION = [
  'Presenting the soulful romantic track ‘Apna Bana Le’ from Bhediya.',
  '',
  'Song: Apna Bana Le',
  'Movie: Bhediya',
  'Singers: Arijit Singh & Sachin-Jigar',
  'Music: Sachin-Jigar',
  'Lyrics: Amitabh Bhattacharya',
  'Backing Vocals: Rana Mazumdar, Rishikesh Kamerkar & Pratiksha Kale',
  'Mix & Mastered by: Eric Pillai at FSOB Studios',
  'Directed by: Amar Kaushik',
  'Produced by: Dinesh Vijan',
  'Written by: Niren Bhatt',
  'To Stream & Download Full Song:',
  'Spotify - https://open.spotify.com/track/xyz',
].join('\n');

test('the credit block is read by label, from the description', async () => {
  mockJson(200, musicPage(REAL_DESCRIPTION));
  const credits = await fetchYoutubeCredits('https://www.youtube.com/watch?v=ElZfdU54Cp8');

  // The music header's title is the clean song name, not the marketing string in the video title.
  assert.equal(credits.songName, 'Apna Bana Le');
  assert.equal(credits.filmOrAlbum, 'Bhediya');
  assert.deepEqual(credits.artists, ['Arijit Singh', 'Sachin-Jigar']);
  assert.deepEqual(credits.composers, ['Sachin-Jigar']);
  assert.deepEqual(credits.lyricists, ['Amitabh Bhattacharya']);

  // The header's date line is the only release year YouTube gives us - oEmbed carried none.
  assert.equal(credits.releaseYear, 2022);
});

test('a film credit never becomes a song credit', () => {
  // The rule that matters most here. "Written by: Niren Bhatt" is the screenwriter, sitting right
  // next to "Directed by" - writing it to Author_Lyricist would put a wrong name in the register.
  // Amitabh Bhattacharya, named by "Lyrics:", is the lyricist.
  return (async () => {
    mockJson(200, musicPage(REAL_DESCRIPTION));
    const credits = await fetchYoutubeCredits('https://www.youtube.com/watch?v=ElZfdU54Cp8');

    assert.deepEqual(credits.lyricists, ['Amitabh Bhattacharya']);
    assert.equal(credits.lyricists.includes('Niren Bhatt'), false, 'the screenwriter is not a lyricist');
    assert.equal(credits.composers.includes('Amar Kaushik'), false, 'the director is not a composer');

    // But every labelled name stays matchable - that only decides whether the member is asked for
    // an alias, and a member may well be the film's writer.
    assert.ok(credits.allCredits.includes('Niren Bhatt'));
    assert.ok(credits.allCredits.includes('Rana Mazumdar'), 'backing vocalists are matchable too');
  })();
});

test('a studio suffix is stripped and URL lines are not credits', async () => {
  mockJson(200, musicPage(REAL_DESCRIPTION));
  const credits = await fetchYoutubeCredits('https://www.youtube.com/watch?v=ElZfdU54Cp8');

  // "Mix & Mastered by: Eric Pillai at FSOB Studios" - the studio must not become a person.
  assert.ok(credits.allCredits.includes('Eric Pillai'));
  assert.equal(
    credits.allCredits.some((n) => /FSOB/i.test(n)),
    false,
    'a studio name is not a person',
  );
  // "Spotify - https://..." is a link line, not a credit.
  assert.equal(credits.allCredits.some((n) => /^Spotify$/i.test(n)), false);
});

test('a watch page yields no credits - but that is not a verdict on the video', async () => {
  // A TED talk answers with an ordinary watch page. So does a real song that isn't on YouTube
  // Music (verified live with "Chaleya"), which is exactly why null here means "no credits from
  // this source" and the resolver falls back to the title path instead of rejecting the link.
  mockJson(200, {
    responseContext: {},
    contents: { twoColumnWatchNextResults: { results: { results: { contents: [] } } } },
    playerOverlays: {},
  });

  assert.equal(await fetchYoutubeCredits('https://www.youtube.com/watch?v=8jPQjjsBbIc'), null);
});

test('a music page with no credit block still identifies the song from its header', async () => {
  mockJson(200, musicPage(''));
  const credits = await fetchYoutubeCredits('https://www.youtube.com/watch?v=ElZfdU54Cp8');

  assert.equal(credits.songName, 'Apna Bana Le');
  // The header artist carries the claim when the description lists nobody.
  assert.deepEqual(credits.artists, ['Zee Music Company']);
  assert.deepEqual(credits.composers, []);
  assert.deepEqual(credits.lyricists, []);
});

// --- degradation -----------------------------------------------------------

test('every failure returns null rather than throwing', async () => {
  // 422 is the service's "not a Spotify or YouTube link".
  mockJson(422, { detail: "Could not detect Spotify or YouTube from 'https://example.com/nope'" });
  assert.equal(await fetchSpotifyCredits('https://example.com/nope'), null);
  assert.equal(await fetchYoutubeCredits('https://example.com/nope'), null);

  mockJson(500, { detail: 'boom' });
  assert.equal(await fetchSpotifyCredits('https://open.spotify.com/track/x'), null);
  assert.equal(await fetchYoutubeCredits('https://www.youtube.com/watch?v=x'), null);

  // Unreachable host / timeout.
  global.fetch = async () => {
    throw new Error('ECONNREFUSED');
  };
  assert.equal(await fetchSpotifyCredits('https://open.spotify.com/track/x'), null);
  assert.equal(await fetchYoutubeCredits('https://www.youtube.com/watch?v=x'), null);

  // A 200 that isn't JSON.
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      throw new Error('not json');
    },
  });
  assert.equal(await fetchSpotifyCredits('https://open.spotify.com/track/x'), null);
});

test('usability is judged on credited people, not on a song name', () => {
  assert.equal(hasUsableCredits(null), false);
  assert.equal(hasUsableCredits({ songName: 'N/A', artists: [], composers: [], lyricists: [] }), false);
  // A title alone is not a credit - that is what let the TED talk through.
  assert.equal(hasUsableCredits({ songName: 'Some Lecture', artists: [], composers: [], lyricists: [] }), false);
  // A writer-only credit is enough: the member may be the lyricist and nothing else.
  assert.equal(hasUsableCredits({ songName: null, artists: [], composers: [], lyricists: ['X'] }), true);
});

test('each platform goes to its own endpoint, with the link encoded', async () => {
  const seen = [];
  global.fetch = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, async json() { return SPOTIFY_OK; } };
  };

  await fetchSpotifyCredits('https://open.spotify.com/track/2C6CJGFLbisteRuY6Plb7b');
  assert.match(seen[0], /\/credits\?track=/);
  assert.match(seen[0], /https%3A%2F%2Fopen\.spotify\.com/, 'the link must be URL-encoded');

  await fetchYoutubeCredits('https://www.youtube.com/watch?v=ElZfdU54Cp8');
  assert.match(seen[1], /\/youtube\/raw\?url=/);
  assert.match(seen[1], /https%3A%2F%2Fwww\.youtube\.com/);
});

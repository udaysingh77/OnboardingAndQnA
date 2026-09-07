// ==================================================================
// Role-labelled song credits, from the in-house credits service
// (MUSIC_CREDITS_API_BASE_URL, default https://spotify.choira.in).
//
// WHY THIS EXISTS: it is the first source this app has that says what a
// credited person actually *did*. The Spotify Web API returns one
// unlabelled bag of artists that mixes performers with writers, and a
// YouTube title is a sentence - which is why Author_Composer and
// Author_Lyricist were historically left null. This service answers with
// roles, so those columns can now be filled with grounded data:
//
//   Spotify  - `contributors[]`, each with a role ("Composer",
//              "Lyricist", "Producer", "Main Artist") and a role_group.
//              Read from Spotify's own credits, server-side.
//   YouTube  - the video *description* (the label's own credit block),
//              structured into singers/composers/lyricists/producers.
//              Note this is the description, not the title - a real
//              credit list rather than a guess at one.
//
// One endpoint serves both: GET /resolve?url=<any Spotify or YouTube
// link>, which auto-detects the platform.
//
// NEVER THROWS. Every failure path returns null and the caller falls
// back to the Spotify Web API / oEmbed + Gemini pair, exactly as the
// Gemini parser already degrades. A member must never be blocked on this
// step because a metadata service is down.
//
// Two response quirks this normalises, both verified live:
//   - "N/A" is the service's null sentinel on the Spotify path (an
//     unknown track id answers 200 with song_name "N/A", not a 404).
//   - `credits.song` / `credits.album_or_movie` come back as [] rather
//     than a string when the video has no credit block.
// ==================================================================
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export const CREDIT_PLATFORMS = Object.freeze({ SPOTIFY: 'spotify', YOUTUBE: 'youtube' });

// The service writes "N/A" where it has no value, so a plain truthiness check would store the
// literal string as a song name.
function text(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return null;
  return trimmed;
}

function names(value) {
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(text).filter(Boolean))];
}

// Roles are free text from the platform, so classify by substring rather than an exact set.
function hasRole(role, ...needles) {
  const lowered = String(role ?? '').toLowerCase();
  return needles.some((needle) => lowered.includes(needle));
}

function normalizeSpotify(payload) {
  const contributors = Array.isArray(payload?.contributors) ? payload.contributors : [];

  const withRole = (...needles) =>
    names(
      contributors
        .filter((entry) => hasRole(entry?.role, ...needles) || hasRole(entry?.role_group, ...needles))
        .map((entry) => entry?.name),
    );

  // "Composition & Lyrics" is the role_group covering both, so composer/lyricist are separated on
  // the role itself and only fall back to the group when the role is unhelpful.
  const composers = names(contributors.filter((e) => hasRole(e?.role, 'composer', 'music')).map((e) => e?.name));
  const lyricists = names(contributors.filter((e) => hasRole(e?.role, 'lyric', 'writer')).map((e) => e?.name));

  const artists = withRole('artist');
  const producers = withRole('producer');

  return {
    platform: CREDIT_PLATFORMS.SPOTIFY,
    songName: text(payload?.song_name),
    // `artist` is the pipe-joined summary; prefer the structured contributors and fall back to it.
    artists: artists.length ? artists : names(String(payload?.artist ?? '').split('|')),
    composers,
    lyricists,
    producers,
    // The label. Spotify's credits carry no album name or release date, so those stay null here and
    // the resolver fills them from the Spotify Web API instead.
    publisher: text(payload?.source) ?? names(payload?.sources)[0] ?? null,
    filmOrAlbum: null,
    creditText: null,
    channelName: null,
    allCredits: names(contributors.map((entry) => entry?.name)),
  };
}

function normalizeYoutube(payload) {
  const credits = payload?.credits ?? {};
  const singers = names(credits.singers);
  const composers = names(credits.composers);
  const lyricists = names(credits.lyricists);
  const producers = names(credits.producers);

  return {
    platform: CREDIT_PLATFORMS.YOUTUBE,
    songName: text(credits.song) ?? text(payload?.song_name) ?? text(payload?.title),
    artists: singers,
    composers,
    lyricists,
    producers,
    publisher: null,
    filmOrAlbum: text(credits.album_or_movie),
    // The full description - free text the credit matcher searches under its stricter rules.
    creditText: text(payload?.description) ?? text(payload?.title),
    channelName: text(payload?.channel),
    allCredits: names([
      ...singers,
      ...composers,
      ...lyricists,
      ...producers,
      ...names(credits.musicians),
      ...names(credits.engineers),
      ...names(credits.others),
      payload?.channel,
    ]),
  };
}

// True when the service actually found a song, as opposed to answering 200 about a TED talk or an
// unknown track id. The caller uses this to decide whether to fall back rather than store blanks.
//
// The test is deliberately CREDITED PEOPLE, not a song name: both empty cases still return a
// name - an unknown Spotify id answers with "N/A", and a non-music video echoes its own title as
// `song_name`. Only a real credit list separates a song from a lecture.
export function hasUsableCredits(normalized) {
  if (!normalized) return false;
  return Boolean(normalized.artists.length || normalized.composers.length || normalized.lyricists.length);
}

export function isMusicCreditsEnabled() {
  return env.MUSIC_CREDITS_ENABLED && Boolean(env.MUSIC_CREDITS_API_BASE_URL);
}

// Returns the normalized shape above, or null when the service is off, unreachable, or has
// nothing for this link. Never throws.
export async function fetchCredits(url) {
  if (!isMusicCreditsEnabled()) return null;

  const endpoint = `${env.MUSIC_CREDITS_API_BASE_URL.replace(/\/+$/, '')}/resolve?url=${encodeURIComponent(url)}`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(env.MUSIC_CREDITS_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn({ err, url }, 'Credits service unreachable, falling back to platform APIs');
    return null;
  }

  if (!response.ok) {
    // 422 is the service's "not a Spotify or YouTube link" - expected for junk input, not an outage.
    logger.warn({ status: response.status, url }, 'Credits service returned no credits');
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!payload) return null;

  // The Spotify path omits `platform` on /credits/{id}; infer from the shape when it's missing.
  const platform = payload.platform ?? (payload.video_id ? CREDIT_PLATFORMS.YOUTUBE : CREDIT_PLATFORMS.SPOTIFY);
  const normalized =
    platform === CREDIT_PLATFORMS.YOUTUBE ? normalizeYoutube(payload) : normalizeSpotify(payload);

  return hasUsableCredits(normalized) ? normalized : null;
}

export const musicCreditsService = { fetchCredits, hasUsableCredits, isMusicCreditsEnabled, CREDIT_PLATFORMS };

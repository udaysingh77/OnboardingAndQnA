// ==================================================================
// Turns a pasted work link into one provider-agnostic shape, so the
// conversation engine and the persistence layer never branch on where
// the song came from.
//
//   { provider, url, songName, artists[], filmOrAlbum, releaseYear,
//     publisher, credits[], isMusicVideo }
//
// `credits` is what the member's name is matched against - for Spotify
// the credited artists, for YouTube the channel name plus whatever names
// the title itself contains (many artists upload as "Artist - Song", and
// many songs live on a label's channel rather than the artist's own).
//
// GROUNDED DATA ONLY: every field above is either read from an API
// response or copied out of the video title. Composer, lyricist,
// language and work category are deliberately absent - nothing here can
// source them truthfully, and IPRS is a rights society, so those columns
// are left for staff rather than filled with a guess. See AGENTS.md.
// ==================================================================
import { spotifyService } from '../../spotify/services/spotify.service.js';
import { fetchYoutubeVideo, isYoutubeUrl } from './youtube.service.js';
import { parseVideoTitle } from './gemini.service.js';

export const PROVIDERS = Object.freeze({ SPOTIFY: 'spotify', YOUTUBE: 'youtube' });

function isSpotifyTrackUrl(value) {
  const cleaned = String(value ?? '').trim();
  if (/^spotify:track:[A-Za-z0-9]{22}$/i.test(cleaned)) return true;
  try {
    const url = new URL(cleaned);
    return (
      url.hostname.toLowerCase() === 'open.spotify.com' &&
      /^\/track\/[A-Za-z0-9]{22}$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function detectProvider(value) {
  if (isSpotifyTrackUrl(value)) return PROVIDERS.SPOTIFY;
  if (isYoutubeUrl(value)) return PROVIDERS.YOUTUBE;
  return null;
}

// The "℗ 2017 School Boy/Interscope Records" strings Spotify returns. Prefer the P line (the
// sound-recording copyright, i.e. the label) and strip the symbol+year prefix.
function toPublisher(copyrights) {
  if (!Array.isArray(copyrights) || copyrights.length === 0) return null;
  const preferred = copyrights.find((entry) => entry?.type === 'P') ?? copyrights[0];
  const text = typeof preferred?.text === 'string' ? preferred.text.trim() : '';
  if (!text) return null;
  return text.replace(/^[©℗(C)(P)\s]*\d{4}\s*/i, '').trim() || text;
}

async function resolveSpotify(url) {
  const track = await spotifyService.getTrackMetadata(url);
  const artists = track.artists.map((artist) => artist.name).filter(Boolean);
  const year = /^(\d{4})/.exec(track.album?.release_date ?? '')?.[1];

  return {
    provider: PROVIDERS.SPOTIFY,
    url: track.external_urls?.spotify ?? url,
    songName: track.name ?? null,
    artists,
    filmOrAlbum: track.album?.name ?? null,
    releaseYear: year ? Number(year) : null,
    publisher: toPublisher(track.album?.copyrights),
    credits: artists,
    creditText: null, // Spotify's credits are already names; there's no free text to search
    isMusicVideo: true, // a Spotify track is a song by definition
  };
}

async function resolveYoutube(url) {
  const video = await fetchYoutubeVideo(url);
  const parsed = await parseVideoTitle({ title: video.title, channelName: video.channelName });

  // With Gemini unconfigured or failing, the raw title is still a usable answer - the member sees
  // exactly what YouTube calls the video and can confirm or reject it. Only the split is lost.
  const artists = parsed?.artists?.length ? parsed.artists : [video.channelName].filter(Boolean);

  return {
    provider: PROVIDERS.YOUTUBE,
    url: video.url,
    songName: parsed?.songName ?? video.title,
    artists,
    filmOrAlbum: parsed?.filmOrAlbum ?? null,
    // oEmbed carries no publish date, and Gemini is not allowed to supply one.
    releaseYear: null,
    publisher: null,
    // Name-like strings only. The raw title used to live in here too, which is what let a bare
    // "Singh" match: a sentence in a name list forces the matcher into substring mode. It now
    // travels separately as creditText and is searched under stricter rules - see
    // workMatch.service.js.
    credits: [...new Set([...artists, video.channelName].filter(Boolean))],
    // Free text. An artist whose name sits in the title but not where Gemini read a credit still
    // matches, but only with a full two-token name.
    creditText: video.title,
    isMusicVideo: parsed ? parsed.isMusicVideo : true,
    channelName: video.channelName,
    thumbnailUrl: video.thumbnailUrl,
  };
}

// Returns null when the link is neither a Spotify track nor a YouTube video. Throws whatever the
// provider throws when the link *looks* right but can't be fetched (deleted video, bad track id).
export async function resolveWorkLink(url) {
  switch (detectProvider(url)) {
    case PROVIDERS.SPOTIFY:
      return resolveSpotify(url);
    case PROVIDERS.YOUTUBE:
      return resolveYoutube(url);
    default:
      return null;
  }
}

export const workLinkResolver = { detectProvider, resolveWorkLink, PROVIDERS };

import { badRequestError, appError } from '../../../shared/errors.js';
import { spotifyService } from './spotify.service.js';
import { spotifyRepository } from '../repositories/spotify.repository.js';

// `actualName` and `stageName` are provided by the request payload; no hardcoded defaults.

function safeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildArtistSingers(artists) {
  if (!Array.isArray(artists)) return null;

  const names = artists
    .map((artist) => safeString(artist.name))
    .filter(Boolean);

  if (names.length === 0) return null;

  const joined = names.join(', ');
  if (joined.length <= 500) return joined;

  const truncated = joined.slice(0, 500).replace(/,?[^,]*$/, '').trim();
  return truncated.length > 0 ? truncated : null;
}

function parseReleaseYear(releaseDate) {
  if (typeof releaseDate !== 'string') return null;
  const match = releaseDate.match(/^(\d{4})/);
  if (!match) return null;
  return BigInt(match[1]);
}

function buildWorkRegistrationData(track, user) {
  return {
    AccountId: user?.id ? BigInt(user.id) : null,
    SongName: safeString(track.name),
    Film_AlbumName: safeString(track.album?.name),
    LanguageNames: null,
    WorkCategory: null,
    Artist_Singers: buildArtistSingers(track.artists),
    Author_Composer: null,
    Publisher: null,
    Author_Lyricist: null,
    DigitalLink: safeString(track.external_urls?.spotify),
    DocLink: null,
    ReleaseYear: parseReleaseYear(track.album?.release_date),
    CreatedBy: null,
    ModifedBy: null,
  };
}

function normalizeName(value) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u2010-\u2015–—―]/g, '-')
    .replace(/[.,]/g, '')
    .toLowerCase();
}

function getMatchedArtists(artists, normalizedTarget) {
  return artists.filter((artist) => normalizeName(artist.name) === normalizedTarget);
}

function extractRoles(artist) {
  if (Array.isArray(artist.roles) && artist.roles.length > 0) {
    return [...new Set(artist.roles.filter((role) => typeof role === 'string'))];
  }
  return [];
}

function buildMatchResult(matchedArtists, matchedAgainst) {
  if (matchedArtists.length === 0) return null;

  const roles = Array.from(
    new Set(matchedArtists.flatMap((artist) => extractRoles(artist))),
  );

  return {
    status: true,
    matchedCredit: {
      name: matchedArtists[0].name,
      matchedAgainst,
      roles,
    },
  };
}

export async function matchSpotifyClaim(reference, user, actualName, stageName) {
  if (!reference || typeof reference !== 'string') {
    throw badRequestError('Spotify track URL is required', { errorCode: 'MISSING_SPOTIFY_URL' });
  }

  const track = await spotifyService.getTrackMetadata(reference);
  if (!track || !Array.isArray(track.artists)) {
    throw badRequestError('Spotify track metadata does not contain artist information', {
      errorCode: 'SPOTIFY_ARTIST_DATA_MISSING',
    });
  }

  const normalizedActualName = normalizeName(actualName);
  const normalizedStageName = normalizeName(stageName);

  const actualMatches = getMatchedArtists(track.artists, normalizedActualName);
  const stageMatches = getMatchedArtists(track.artists, normalizedStageName);

  const matchResult = actualMatches.length
    ? buildMatchResult(actualMatches, 'actualName')
    : stageMatches.length
    ? buildMatchResult(stageMatches, 'stageName')
    : { status: false, matchedCredit: null };

  const workRegistrationData = buildWorkRegistrationData(track, user);
  let workRegistration;

  try {
    workRegistration = await spotifyRepository.createWorkRegistration(workRegistrationData);
  } catch (err) {
    throw appError('Failed to save work registration', {
      errorCode: 'WORK_REGISTRATION_SAVE_FAILED',
      cause: err,
    });
  }

  return {
    ...matchResult,
    track: {
      id: track.id,
      name: track.name,
      spotify_url: track.external_urls?.spotify ?? null,
      artists: track.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        external_urls: artist.external_urls,
      })),
      album: {
        id: track.album?.id,
        name: track.album?.name,
        external_urls: track.album?.external_urls,
      },
    },
    workRegistration: {
      WorkNotificationId: workRegistration.WorkNotificationId?.toString?.() ?? null,
    },
  };
}

export const spotifyClaimService = { matchSpotifyClaim };

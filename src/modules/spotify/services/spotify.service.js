import { badRequestError, unauthorizedError, notFoundError, appError } from '../../../shared/errors.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const TOKEN_BUFFER_SECONDS = 60;

let cachedToken = null;

function parseSpotifyReference(value) {
  if (typeof value !== 'string') {
    throw badRequestError('Invalid Spotify track URL or URI', { errorCode: 'INVALID_SPOTIFY_REFERENCE' });
  }

  const cleaned = value.trim();
  const uriMatch = cleaned.match(/^spotify:track:([A-Za-z0-9]{22})$/i);
  if (uriMatch) {
    return { type: 'track', id: uriMatch[1] };
  }

  try {
    const url = new URL(cleaned);
    if (url.hostname.toLowerCase() === 'open.spotify.com') {
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments[0] === 'track' && /^[A-Za-z0-9]{22}$/.test(segments[1])) {
        return { type: 'track', id: segments[1] };
      }
    }
  } catch {
    // fall through to invalid reference error
  }

  throw badRequestError('Invalid Spotify track URL or URI', { errorCode: 'INVALID_SPOTIFY_REFERENCE' });
}

function getSpotifyEndpoint(type, id) {
  if (type !== 'track') {
    throw badRequestError('Unsupported Spotify resource type, only track is allowed', {
      errorCode: 'UNSUPPORTED_SPOTIFY_TYPE',
      details: { type },
    });
  }

  return `${SPOTIFY_API_BASE}/tracks/${id}`;
}

function normalizeAlbum(payload) {
  return {
    type: 'album',
    id: payload.id,
    name: payload.name,
    artists: payload.artists.map((artist) => ({ id: artist.id, name: artist.name })),
    release_date: payload.release_date,
    total_tracks: payload.total_tracks,
    images: payload.images,
    external_url: payload.external_urls?.spotify ?? null,
  };
}

function normalizeArtist(payload) {
  return {
    type: 'artist',
    id: payload.id,
    name: payload.name,
    genres: payload.genres,
    followers: payload.followers?.total ?? null,
    popularity: payload.popularity,
    images: payload.images,
    external_url: payload.external_urls?.spotify ?? null,
  };
}

function normalizePlaylist(payload) {
  return {
    type: 'playlist',
    id: payload.id,
    name: payload.name,
    description: payload.description,
    owner: {
      id: payload.owner?.id ?? null,
      display_name: payload.owner?.display_name ?? null,
    },
    tracks: {
      total: payload.tracks?.total ?? null,
    },
    images: payload.images,
    external_url: payload.external_urls?.spotify ?? null,
  };
}

async function fetchSpotifyToken() {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    throw appError('Spotify client credentials are not configured', {
      errorCode: 'SPOTIFY_CREDENTIALS_MISSING',
      statusCode: 500,
    });
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_BUFFER_SECONDS * 1000) {
    return cachedToken.accessToken;
  }

  const credentials = `${encodeURIComponent(env.SPOTIFY_CLIENT_ID)}:${encodeURIComponent(env.SPOTIFY_CLIENT_SECRET)}`;
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const body = await safeParseJson(response);
    const message = body?.error_description || 'Spotify authentication failed';
    logger.warn({ status: response.status, body }, 'Spotify token request failed');
    if (response.status === 401) throw unauthorizedError('Spotify authentication failed', { errorCode: 'SPOTIFY_AUTH_FAILED' });
    throw appError(message, { statusCode: response.status, errorCode: 'SPOTIFY_AUTH_ERROR' });
  }

  const payload = await response.json();
  if (!payload.access_token || !payload.expires_in) {
    throw appError('Invalid Spotify token response', {
      errorCode: 'SPOTIFY_TOKEN_INVALID',
      statusCode: 502,
    });
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in * 1000),
  };

  return cachedToken.accessToken;
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchSpotifyResource(url) {
  const accessToken = await fetchSpotifyToken();

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await safeParseJson(response);
    logger.warn({ status: response.status, body, url }, 'Spotify metadata request failed');
    if (response.status === 401) throw unauthorizedError('Spotify token invalid or expired', { errorCode: 'SPOTIFY_TOKEN_INVALID' });
    if (response.status === 403) throw appError('Spotify access forbidden', { statusCode: 403, errorCode: 'SPOTIFY_FORBIDDEN' });
    if (response.status === 404) throw notFoundError('Spotify resource not found', { errorCode: 'SPOTIFY_RESOURCE_NOT_FOUND' });
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw appError('Spotify rate limit exceeded', {
        statusCode: 429,
        errorCode: 'SPOTIFY_RATE_LIMIT',
        details: retryAfter ? { retryAfter } : undefined,
      });
    }
    throw appError('Spotify API error', {
      statusCode: response.status,
      errorCode: 'SPOTIFY_API_ERROR',
      details: body,
    });
  }

  return response.json();
}

async function fetchArtistResource(artistId) {
  const url = `${SPOTIFY_API_BASE}/artists/${artistId}`;
  return fetchSpotifyResource(url);
}

async function enrichArtist(artist) {
  if (!artist?.id) {
    return {
      id: artist.id,
      name: artist.name,
      type: artist.type,
      uri: artist.uri,
      href: artist.href,
      external_urls: artist.external_urls ?? null,
      genres: artist.genres ?? [],
      popularity: artist.popularity ?? null,
      followers: artist.followers ?? null,
      images: artist.images ?? [],
      roles: Array.isArray(artist.roles) ? artist.roles : [],
    };
  }

  const hasArtistDetails = Array.isArray(artist.genres) && Array.isArray(artist.images) && typeof artist.popularity === 'number';
  if (hasArtistDetails) {
    return {
      id: artist.id,
      name: artist.name,
      type: artist.type,
      uri: artist.uri,
      href: artist.href,
      external_urls: artist.external_urls ?? null,
      genres: artist.genres ?? [],
      popularity: artist.popularity ?? null,
      followers: artist.followers?.total ?? null,
      images: artist.images ?? [],
      roles: Array.isArray(artist.roles) ? artist.roles : [],
    };
  }

  const details = await fetchArtistResource(artist.id);
  return {
    id: details.id,
    name: details.name,
    type: details.type,
    uri: details.uri,
    href: details.href,
    external_urls: details.external_urls ?? artist.external_urls ?? null,
    genres: details.genres ?? [],
    popularity: details.popularity ?? null,
    followers: details.followers?.total ?? null,
    images: details.images ?? [],
    roles: Array.isArray(artist.roles) ? artist.roles : [],
  };
}

async function normalizeTrack(payload) {
  const artists = await Promise.all(payload.artists.map((artist) => enrichArtist(artist)));

  return {
    type: payload.type,
    id: payload.id,
    uri: payload.uri,
    href: payload.href,
    name: payload.name,
    duration_ms: payload.duration_ms,
    explicit: payload.explicit,
    popularity: payload.popularity,
    track_number: payload.track_number,
    disc_number: payload.disc_number,
    preview_url: payload.preview_url,
    external_urls: payload.external_urls ?? null,
    external_ids: payload.external_ids ?? null,
    isrc: payload.external_ids?.isrc ?? null,
    artists,
    album: {
      id: payload.album.id,
      name: payload.album.name,
      album_type: payload.album.album_type,
      total_tracks: payload.album.total_tracks,
      release_date: payload.album.release_date,
      release_date_precision: payload.album.release_date_precision,
      artists: payload.album.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        type: artist.type,
        uri: artist.uri,
        href: artist.href,
        external_urls: artist.external_urls ?? null,
      })),
      images: payload.album.images,
      external_urls: payload.album.external_urls ?? null,
      external_ids: payload.album.external_ids ?? null,
      copyrights: payload.album.copyrights ?? null,
    },
  };
}

function normalizeResource(type, payload) {
  switch (type) {
    case 'track':
      return normalizeTrack(payload);
    case 'album':
      return normalizeAlbum(payload);
    case 'artist':
      return normalizeArtist(payload);
    case 'playlist':
      return normalizePlaylist(payload);
    default:
      throw badRequestError('Unsupported Spotify resource type', {
        errorCode: 'UNSUPPORTED_SPOTIFY_TYPE',
      });
  }
}

async function getTrackMetadata(reference) {
  const { type, id } = parseSpotifyReference(reference);
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) {
    throw badRequestError('Invalid Spotify resource id', {
      errorCode: 'INVALID_SPOTIFY_ID',
    });
  }

  const endpoint = getSpotifyEndpoint(type, id);
  const payload = await fetchSpotifyResource(endpoint);
  return normalizeTrack(payload);
}

export const spotifyService = {
  getTrackMetadata,
  getMetadata: getTrackMetadata,
  _resetCache: () => {
    cachedToken = null;
  },
};

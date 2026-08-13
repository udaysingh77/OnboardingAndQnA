import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { spotifyService } from '../src/modules/spotify/services/spotify.service.js';
import { spotifyRepository } from '../src/modules/spotify/repositories/spotify.repository.js';
import { signAccessToken } from '../src/utils/token.js';

let server;
let baseUrl;
let originalFetch;

// /spotify/metadata now requires authentication - this route doesn't touch the DB itself,
// so any well-formed token (matching JWT_SECRET/JWT_ISSUER) is enough to pass the middleware.
const authHeader = `Bearer ${signAccessToken({ sub: '999999', phone: '+919999999999', registrationStatus: 'started' })}`;

function createResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    async json() {
      return body;
    },
  };
}

function useSpotifyMock(mockFn) {
  global.fetch = async (url, options) => {
    if (typeof url === 'string' && url.startsWith(baseUrl)) {
      return originalFetch(url, options);
    }
    return mockFn(url, options);
  };
}

before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  originalFetch = global.fetch;
});

after(async () => {
  if (server) server.close();
  global.fetch = originalFetch;
});

test('POST /spotify/metadata returns normalized track metadata', async () => {
  useSpotifyMock(async (url) => {
    if (typeof url === 'string' && url.includes('/api/token')) {
      return createResponse(200, {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    if (typeof url === 'string' && url.includes('/tracks/1234567890123456789012')) {
      return createResponse(200, {
        id: '1234567890123456789012',
        name: 'Example Song',
        artists: [{ id: 'artist1', name: 'Artist Name', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
        album: {
          id: 'album1',
          name: 'Example Album',
          artists: [{ id: 'artist1', name: 'Artist Name', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
          images: [{ url: 'https://example.com/image.jpg' }],
          external_urls: { spotify: 'https://open.spotify.com/album/album1' },
        },
        duration_ms: 180000,
        explicit: false,
        preview_url: null,
        external_urls: { spotify: 'https://open.spotify.com/track/1234567890123456789012' },
      });
    }

    if (typeof url === 'string' && url.includes('/artists/artist1')) {
      return createResponse(200, {
        id: 'artist1',
        name: 'Artist Name',
        type: 'artist',
        uri: 'spotify:artist:artist1',
        href: 'https://api.spotify.com/v1/artists/artist1',
        external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
        genres: ['pop'],
        popularity: 50,
        followers: { total: 1000 },
        images: [],
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  spotifyService._resetCache();
  let createdWorkRegistrationData = null;
  const createSpy = spotifyRepository.createWorkRegistration;
  spotifyRepository.createWorkRegistration = async (data) => {
    createdWorkRegistrationData = data;
    return { WorkNotificationId: 123n };
  };

  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/1234567890123456789012', actualName: 'Artist Name', stageName: 'Stage Name' }),
  });
  const body = await res.json();

  spotifyRepository.createWorkRegistration = createSpy;

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.track.id, '1234567890123456789012');
  assert.equal(body.data.track.name, 'Example Song');
  assert.deepEqual(body.data.track.artists, [{ id: 'artist1', name: 'Artist Name', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }]);
  assert.equal(body.data.track.album.id, 'album1');
  assert.equal(body.data.track.spotify_url, 'https://open.spotify.com/track/1234567890123456789012');
  assert.deepEqual(body.data.workRegistration, { WorkNotificationId: '123' });
  assert.equal(createdWorkRegistrationData.SongName, 'Example Song');
  assert.equal(createdWorkRegistrationData.Film_AlbumName, 'Example Album');
  assert.equal(createdWorkRegistrationData.Artist_Singers, 'Artist Name');
  assert.equal(createdWorkRegistrationData.DigitalLink, 'https://open.spotify.com/track/1234567890123456789012');
  assert.equal(createdWorkRegistrationData.ReleaseYear,  null);
});

test('POST /spotify/metadata matches stage name claim exactly', async () => {
  useSpotifyMock(async (url) => {
    if (typeof url === 'string' && url.includes('/api/token')) {
      return createResponse(200, {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    if (typeof url === 'string' && url.includes('/tracks/1234567890123456789012')) {
      return createResponse(200, {
        id: '1234567890123456789012',
        name: 'Claimed Song',
        artists: [{ id: 'artist1', name: 'Sachin', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
        album: {
          id: 'album1',
          name: 'Claimed Album',
          artists: [{ id: 'artist1', name: 'Sachin', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
          images: [{ url: 'https://example.com/image.jpg' }],
          external_urls: { spotify: 'https://open.spotify.com/album/album1' },
        },
        duration_ms: 180000,
        explicit: false,
        preview_url: null,
        external_urls: { spotify: 'https://open.spotify.com/track/1234567890123456789012' },
      });
    }

    if (typeof url === 'string' && url.includes('/artists/artist1')) {
      return createResponse(200, {
        id: 'artist1',
        name: 'Sachin',
        type: 'artist',
        uri: 'spotify:artist:artist1',
        href: 'https://api.spotify.com/v1/artists/artist1',
        external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
        genres: ['pop'],
        popularity: 50,
        followers: { total: 1000 },
        images: [],
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  spotifyService._resetCache();
  let createdWorkRegistrationData = null;
  const createSpy = spotifyRepository.createWorkRegistration;
  spotifyRepository.createWorkRegistration = async (data) => {
    createdWorkRegistrationData = data;
    return { WorkNotificationId: 321n };
  };

  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/1234567890123456789012', actualName: 'NoMatch', stageName: 'Sachin' }),
  });
  const body = await res.json();

  spotifyRepository.createWorkRegistration = createSpy;

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, true);
  assert.equal(body.data.matchedCredit.matchedAgainst, 'stageName');
  assert.equal(body.data.matchedCredit.name, 'Sachin');
  assert.equal(body.data.track.name, 'Claimed Song');
  assert.deepEqual(body.data.workRegistration, { WorkNotificationId: '321' });
  assert.equal(createdWorkRegistrationData.SongName, 'Claimed Song');
  assert.equal(createdWorkRegistrationData.Film_AlbumName, 'Claimed Album');
  assert.equal(createdWorkRegistrationData.Artist_Singers, 'Sachin');
  assert.equal(createdWorkRegistrationData.DigitalLink, 'https://open.spotify.com/track/1234567890123456789012');
  assert.equal(createdWorkRegistrationData.ReleaseYear, null);
});

test('missing body.url returns 422 validation error', async () => {
  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ actualName: 'A', stageName: 'B' }),
  });
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('missing actualName returns 422 validation error', async () => {
  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/1234567890123456789012', stageName: 'B' }),
  });
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('missing stageName returns 422 validation error', async () => {
  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/1234567890123456789012', actualName: 'A' }),
  });
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('invalid Spotify URL returns 422 validation error', async () => {
  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/album/album123', actualName: 'A', stageName: 'B' }),
  });
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('Spotify createWorkRegistration failure returns 500', async () => {
  useSpotifyMock(async (url) => {
    if (typeof url === 'string' && url.includes('/api/token')) {
      return createResponse(200, {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    if (typeof url === 'string' && url.includes('/tracks/abcde12345abcde12345ab')) {
      return createResponse(200, {
        id: 'abcde12345abcde12345ab',
        name: 'Example Song',
        artists: [{ id: 'artist1', name: 'Artist Name' }],
        album: {
          id: 'album1',
          name: 'Example Album',
          artists: [{ id: 'artist1', name: 'Artist Name', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
          images: [{ url: 'https://example.com/image.jpg' }],
        },
        duration_ms: 180000,
        explicit: false,
        preview_url: null,
        external_urls: { spotify: 'https://open.spotify.com/track/abcde12345abcde12345ab' },
      });
    }

    if (typeof url === 'string' && url.includes('/artists/artist1')) {
      return createResponse(200, {
        id: 'artist1',
        name: 'Artist Name',
        type: 'artist',
        uri: 'spotify:artist:artist1',
        href: 'https://api.spotify.com/v1/artists/artist1',
        external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
        genres: ['pop'],
        popularity: 50,
        followers: { total: 1000 },
        images: [],
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  spotifyService._resetCache();
  const createSpy = spotifyRepository.createWorkRegistration;
  spotifyRepository.createWorkRegistration = async () => {
    throw new Error('DB failure');
  };

  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/abcde12345abcde12345ab', actualName: 'Artist Name', stageName: 'Stage Name' }),
  });
  const body = await res.json();

  spotifyRepository.createWorkRegistration = createSpy;

  assert.equal(res.status, 500);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'WORK_REGISTRATION_SAVE_FAILED');
});

test('POST /spotify/metadata maps release year from album.release_date', async () => {
  useSpotifyMock(async (url) => {
    if (typeof url === 'string' && url.includes('/api/token')) {
      return createResponse(200, {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    if (typeof url === 'string' && url.includes('/tracks/1234567890123456789012')) {
      return createResponse(200, {
        id: '1234567890123456789012',
        name: 'Year Song',
        artists: [{ id: 'artist1', name: 'Year Artist', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
        album: {
          id: 'album1',
          name: 'Year Album',
          artists: [{ id: 'artist1', name: 'Year Artist', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
          release_date: '2014-01-01',
          images: [{ url: 'https://example.com/image.jpg' }],
          external_urls: { spotify: 'https://open.spotify.com/album/album1' },
        },
        duration_ms: 180000,
        explicit: false,
        preview_url: null,
        external_urls: { spotify: 'https://open.spotify.com/track/1234567890123456789012' },
      });
    }

    if (typeof url === 'string' && url.includes('/artists/artist1')) {
      return createResponse(200, {
        id: 'artist1',
        name: 'Year Artist',
        type: 'artist',
        uri: 'spotify:artist:artist1',
        href: 'https://api.spotify.com/v1/artists/artist1',
        external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
        genres: ['pop'],
        popularity: 50,
        followers: { total: 1000 },
        images: [],
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  spotifyService._resetCache();
  let createdWorkRegistrationData = null;
  const createSpy = spotifyRepository.createWorkRegistration;
  spotifyRepository.createWorkRegistration = async (data) => {
    createdWorkRegistrationData = data;
    return { WorkNotificationId: 456n };
  };

  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/1234567890123456789012', actualName: 'Year Artist', stageName: 'Year Stage' }),
  });
  const body = await res.json();
  spotifyRepository.createWorkRegistration = createSpy;

  assert.equal(res.status, 200);
  assert.deepEqual(body.data.workRegistration, { WorkNotificationId: '456' });
  assert.equal(createdWorkRegistrationData.ReleaseYear, 2014n);
});

test('Spotify authentication failure returns 401', async () => {
  useSpotifyMock(async (url) => {
    if (typeof url === 'string' && url.includes('/api/token')) {
      return createResponse(401, { error_description: 'Invalid client' });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });

  spotifyService._resetCache();
  const res = await fetch(`${baseUrl}/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/abcde12345abcde12345ab', actualName: 'A', stageName: 'B' }),
  });
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'SPOTIFY_AUTH_FAILED');
});

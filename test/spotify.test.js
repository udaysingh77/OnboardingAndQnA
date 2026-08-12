import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { spotifyService } from '../src/modules/spotify/services/spotify.service.js';

let server;
let baseUrl;
let originalFetch;

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

test('POST /api/spotify/metadata returns normalized track metadata', async () => {
  useSpotifyMock(async (url) => {
    if (typeof url === 'string' && url.includes('/api/token')) {
      return createResponse(200, {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    if (typeof url === 'string' && url.includes('/tracks/track123')) {
      return createResponse(200, {
        id: 'track123',
        name: 'Example Song',
        artists: [{ id: 'artist1', name: 'Artist Name' }],
        album: {
          id: 'album1',
          name: 'Example Album',
          images: [{ url: 'https://example.com/image.jpg' }],
        },
        duration_ms: 180000,
        explicit: false,
        preview_url: null,
        external_urls: { spotify: 'https://open.spotify.com/track/track123' },
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  spotifyService._resetCache();
  const res = await fetch(`${baseUrl}/api/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/track123' }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.id, 'track123');
  assert.equal(body.data.name, 'Example Song');
  assert.deepEqual(body.data.artists, [{ id: 'artist1', name: 'Artist Name' }]);
  assert.equal(body.data.album.id, 'album1');
  assert.equal(body.data.spotify_url, 'https://open.spotify.com/track/track123');
});

test('missing body.url returns 422 validation error', async () => {
  const res = await fetch(`${baseUrl}/api/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('invalid Spotify URL returns 422 validation error', async () => {
  const res = await fetch(`${baseUrl}/api/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://open.spotify.com/album/album123' }),
  });
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('Spotify authentication failure returns 401', async () => {
  useSpotifyMock(async (url) => {
    if (typeof url === 'string' && url.includes('/api/token')) {
      return createResponse(401, { error_description: 'Invalid client' });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });

  spotifyService._resetCache();
  const res = await fetch(`${baseUrl}/api/spotify/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://open.spotify.com/track/track123' }),
  });
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'UNAUTHORIZED');
});

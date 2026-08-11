// ==================================================================
// Smoke tests - health + auth round-trip (node:test).
// DB-dependent tests are skipped automatically when SQL Server is unreachable.
// Run: npm test
// ==================================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';

let server;
let baseUrl;
let dbAvailable = false;

before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  await prisma.$disconnect().catch(() => {});
  server.close();
});

test('GET /health returns structured report (db up when reachable)', async () => {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data.uptime >= 0);
  assert.ok(body.data.timestamp);
  assert.ok(['up', 'down'].includes(body.data.db));
});

test('unknown route returns 404 JSON', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('invalid body is rejected with 422', async () => {
  const res = await fetch(`${baseUrl}/auth/send-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: 'abc' }),
  });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('auth round-trip: send-otp -> verify-otp -> protected endpoint', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  if ((process.env.OTP_PROVIDER ?? 'mock') !== 'mock') {
    return t.skip('OTP round-trip only works with the mock provider (real OTP is sent via SMS)');
  }
  const phone = `+1555${Date.now().toString().slice(-7)}`;

  const sent = await fetch(`${baseUrl}/auth/send-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  assert.equal(sent.status, 200);
  const sentBody = await sent.json();
  assert.ok(sentBody.data.otp, 'mock provider should echo the OTP');

  const verified = await fetch(`${baseUrl}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phone,
      otp: sentBody.data.otp,
    }),
  });
  assert.equal(verified.status, 200);
  const verifiedBody = await verified.json();
  assert.ok(verifiedBody.data.token);
  assert.equal(verifiedBody.data.user.phone, phone);

  const reg = await fetch(`${baseUrl}/registration/status`, {
    headers: { authorization: `Bearer ${verifiedBody.data.token}` },
  });
  assert.equal(reg.status, 200);
  const regBody = await reg.json();
  assert.equal(regBody.data.completed, false);

  const conversation = await fetch(`${baseUrl}/conversation/message`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${verifiedBody.data.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message: 'hello' }),
  });
  assert.equal(conversation.status, 200);
  const convBody = await conversation.json();
  assert.equal(convBody.data.engine, 'REGISTRATION');

  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { authorization: `Bearer ${verifiedBody.data.token}` },
  });
  assert.equal(logout.status, 200);
});
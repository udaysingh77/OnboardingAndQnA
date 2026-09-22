// ==================================================================
// AccountType default (node:test) - every new App_Accounts row created via OTP verify now gets
// AccountType = 'C' (a hardcoded default requested for all users, distinct from AccountRegType,
// which is set later during registration to I/NI/C/NC).
// Uses createAuthService's DI hook to inject a stub OTP provider - no real OTP send needed.
// Run: npm test
// ==================================================================
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../src/modules/auth/services/auth.service.js';
import { prisma } from '../src/shared/prisma.js';

let dbAvailable = false;
const createdAccountIds = [];

const stubOtpProvider = { send: async () => {}, verify: async () => true };
const authService = createAuthService({ otpProvider: stubOtpProvider });

after(async () => {
  for (const id of createdAccountIds) {
    await prisma.appAccounts.delete({ where: { AccountId: id } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => {});
});

test('verifyOtp() on a brand-new phone creates the account with AccountType = "C"', async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  if (!dbAvailable) return t.skip('SQL Server is not reachable');

  const phone = `9200${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`;
  const { user } = await authService.verifyOtp({ phone, otp: '0000' });
  createdAccountIds.push(BigInt(user.id));

  const saved = await prisma.appAccounts.findUnique({ where: { AccountId: BigInt(user.id) }, select: { AccountType: true } });
  assert.equal(saved.AccountType, 'C');
});

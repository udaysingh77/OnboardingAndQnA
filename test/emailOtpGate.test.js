// ==================================================================
// The email-verification step (node:test).
//
// Two layers:
//   1. the gate's own vocabulary and messages - pure, always run
//   2. the engine's change-email escape - needs SQL Server, skipped
//      when it isn't reachable (same convention as smoke.test.js)
//
// The escape exists because a mistyped address used to be an
// unrecoverable dead end: no code ever arrived, every OTP guess failed,
// and `resend` mailed the same wrong address again. The only way out
// was to abandon the whole registration.
//
// This file monkey-patches the mail and Typebot singletons. node:test
// runs each file in its own process, so that stays contained here.
// Run: npm test
// ==================================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  isResendKeyword,
  isChangeEmailKeyword,
  isValidEmail,
  isEmailStep,
  EMAIL_VARIABLE_ID,
  MAX_EMAIL_CHANGES,
  describeOtpSent,
  describeOtpProblem,
  describeChangeLimitReached,
} from '../src/modules/conversation/services/emailOtpGate.js';
import { prisma } from '../src/shared/prisma.js';
import { typebotSessionStore } from '../src/modules/conversation/services/typebot/typebotSessionStore.js';
import { typebotClient } from '../src/modules/conversation/services/typebot/typebotClient.js';
import { emailOtpService } from '../src/modules/auth/services/emailOtp.service.js';
import { handle } from '../src/modules/conversation/engines/registrationEngine.js';

// --- layer 1: the gate's vocabulary ---------------------------------------

test('the OTP step recognises its own block', () => {
  assert.equal(isEmailStep(EMAIL_VARIABLE_ID), true);
  assert.equal(isEmailStep('some-other-block'), false);
});

test('resend keywords are recognised, ordinary input is not', () => {
  for (const word of ['resend', 'Resend', '  RESEND OTP  ', 'new otp', 'send again']) {
    assert.equal(isResendKeyword(word), true, word);
  }
  for (const word of ['1234', 'resend it please', '', undefined]) {
    assert.equal(isResendKeyword(word), false, String(word));
  }
});

test('change keywords are recognised and do not collide with resend', () => {
  for (const word of ['change', 'Change Email', '  wrong email ', 'different email']) {
    assert.equal(isChangeEmailKeyword(word), true, word);
    assert.equal(isResendKeyword(word), false, word);
  }
  // An OTP must never be read as a keyword.
  assert.equal(isChangeEmailKeyword('1234'), false);
});

test('email format check', () => {
  assert.equal(isValidEmail('a@b.co'), true);
  for (const bad of ['a@b', 'no-at-sign.com', 'two @spaces.com', '', null]) {
    assert.equal(isValidEmail(bad), false, String(bad));
  }
});

test('both escapes are offered up front, not only after a failure', () => {
  const sent = describeOtpSent('member@example.com');
  assert.match(sent, /member@example\.com/);
  assert.match(sent, /resend/i);
  assert.match(sent, /change/i);

  const problem = describeOtpProblem('Invalid OTP.');
  assert.match(problem, /Invalid OTP\./);
  assert.match(problem, /resend/i);
  assert.match(problem, /change/i);
});

test('the cap message names the limit and points somewhere', () => {
  const message = describeChangeLimitReached();
  assert.match(message, new RegExp(String(MAX_EMAIL_CHANGES)));
  // Either a configured support contact or the neutral fallback - never a dangling empty contact.
  assert.ok(/write to \S+/.test(message) || /get in touch/.test(message), message);
  // A late code must still be usable after the cap.
  assert.match(message, /enter it here/i);
});

test('the cap is a real bound, not disabled', () => {
  assert.ok(Number.isInteger(MAX_EMAIL_CHANGES) && MAX_EMAIL_CHANGES > 0 && MAX_EMAIL_CHANGES <= 5);
});

// --- layer 2: the escape, driven through the engine ------------------------

let dbAvailable = false;
const mailedTo = [];
const CORRECT_OTP = '1234';
const EMAIL_INPUT = { id: 'email-block', type: 'text input', options: { variableId: EMAIL_VARIABLE_ID } };
const createdAccountIds = [];

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }

  // Nothing leaves the machine: no mail, no Typebot call.
  emailOtpService.sendEmailOtp = async ({ email }) => {
    mailedTo.push(email);
    return { message: 'ok' };
  };
  emailOtpService.verifyEmailOtp = async ({ otp }) => {
    if (otp !== CORRECT_OTP) {
      throw Object.assign(new Error('Invalid OTP. 4 attempts left.'), { statusCode: 400 });
    }
    return { message: 'verified' };
  };
  typebotClient.continueChat = async () => ({
    messages: [],
    input: { id: 'next-block', type: 'text input', options: {} },
  });
});

after(async () => {
  for (const id of createdAccountIds) {
    await prisma.appAccounts.delete({ where: { AccountId: id } }).catch(() => {});
  }
  await prisma.$disconnect().catch(() => {});
});

// A throwaway account parked on the email question.
async function startAtEmailStep() {
  const account = await prisma.appAccounts.create({
    data: {
      AccountGroupId: 0,
      AccountMobile: `9100${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`,
    },
  });
  createdAccountIds.push(account.AccountId);
  const userId = String(account.AccountId);
  typebotSessionStore.set(userId, { sessionId: 'fake-session', input: EMAIL_INPUT });
  return { account, userId };
}

const say = (userId, message) => handle({ userId, token: 'test-token', message });

test('a typo is recoverable: change -> new address -> the corrected email is saved', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const { account, userId } = await startAtEmailStep();
  mailedTo.length = 0;

  let res = await say(userId, 'wrogn@example.invalid');
  assert.equal(res.input?.id, 'email-otp-verification', 'the OTP step should be reached');
  assert.equal(mailedTo[0], 'wrogn@example.invalid', 'the first code goes to the typo');

  res = await say(userId, 'change');
  assert.equal(res.input?.id, 'email-block', 'the real Typebot email block comes back');

  mailedTo.length = 0;
  res = await say(userId, 'right@example.invalid');
  assert.equal(mailedTo[0], 'right@example.invalid', 'a fresh code goes to the NEW address');
  assert.equal(res.input?.id, 'email-otp-verification');

  res = await say(userId, CORRECT_OTP);
  assert.equal(res.input?.id, 'next-block', 'the conversation advances');

  const saved = await prisma.appAccounts.findUnique({
    where: { AccountId: account.AccountId },
    select: { AccountEmail: true },
  });
  assert.equal(saved.AccountEmail, 'right@example.invalid', 'the corrected address, not the typo');
});

test('the change counter survives the session writes in between', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  // typebotSessionStore.set() replaces the whole session object, so `emailChanges` has to be
  // carried forward by hand at every write on this path. Miss one and the cap silently resets.
  // A resend and a failed OTP are both such writes.
  const { userId } = await startAtEmailStep();

  await say(userId, 'one@example.invalid');
  await say(userId, 'change'); // 1
  await say(userId, 'two@example.invalid');
  await say(userId, 'resend');
  await say(userId, '9999'); // a wrong OTP
  await say(userId, 'change'); // 2
  await say(userId, 'three@example.invalid');

  assert.equal(typebotSessionStore.get(userId)?.emailChanges, 2, 'counted 2, not reset to 1');
});

test('the cap holds, and a late code is still usable afterwards', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const { userId } = await startAtEmailStep();
  await say(userId, 'first@example.invalid');

  for (let i = 1; i <= MAX_EMAIL_CHANGES; i += 1) {
    await say(userId, 'change');
    await say(userId, `attempt${i}@example.invalid`);
  }
  assert.equal(typebotSessionStore.get(userId)?.emailChanges, MAX_EMAIL_CHANGES);

  mailedTo.length = 0;
  const refused = await say(userId, 'change');
  assert.equal(refused.input?.id, 'email-otp-verification', 'still on the OTP field, not advanced');
  assert.equal(mailedTo.length, 0, 'no further mail is sent once the cap is reached');

  const after = await say(userId, CORRECT_OTP);
  assert.equal(after.input?.id, 'next-block', 'the OTP still works after the cap');
});

test('a correct address on the first try still verifies in one pass', async (t) => {
  if (!dbAvailable) return t.skip('SQL Server is not reachable');
  const { userId } = await startAtEmailStep();
  mailedTo.length = 0;

  await say(userId, 'fine@example.invalid');
  const res = await say(userId, CORRECT_OTP);

  assert.equal(res.input?.id, 'next-block');
  assert.equal(mailedTo.length, 1, 'exactly one code was sent');
  assert.equal(typebotSessionStore.get(userId)?.emailChanges ?? 0, 0, 'no change was counted');
});

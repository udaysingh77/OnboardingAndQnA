import { strict as assert } from 'assert';
import test from 'node:test';
import { createEmailOtpService } from '../src/modules/auth/services/emailOtp.service.js';

function makeFakeDb() {
  let idCounter = 1;
  const rows = [];

  return {
    emailVerificationOtp: {
      async findFirst({ where, orderBy }) {
        const email = where.email;
        // find latest matching
        const candidates = rows.filter((r) => r.email === email && (where.verifiedAt === null ? r.verifiedAt === null : true));
        if (!candidates.length) return null;
        candidates.sort((a, b) => b.createdAt - a.createdAt);
        return { ...candidates[0] };
      },
      async updateMany({ where, data }) {
        const email = where.email;
        for (const r of rows) {
          if (r.email === email && r.verifiedAt === null && r.expiresAt > new Date()) {
            if (data.expiresAt) r.expiresAt = data.expiresAt;
          }
        }
        return { count: 1 };
      },
      async create({ data }) {
        const rec = {
          id: idCounter++,
          email: data.email,
          otpHash: data.otpHash,
          expiresAt: data.expiresAt,
          attempts: data.attempts ?? 0,
          verifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(rec);
        return { ...rec };
      },
      async findUnique({ where }) {
        return rows.find((r) => r.id === where.id) ?? null;
      },
      async update({ where, data }) {
        const rec = rows.find((r) => r.id === where.id);
        if (!rec) throw new Error('not found');
        if (data.attempts && data.attempts.increment) rec.attempts += data.attempts.increment;
        if (data.expiresAt) rec.expiresAt = data.expiresAt;
        if (data.verifiedAt) rec.verifiedAt = data.verifiedAt;
        rec.updatedAt = new Date();
        return { ...rec };
      },
    },
  };
}

const cfg = {
  EMAIL_OTP_LENGTH: 4,
  EMAIL_OTP_EXPIRY_MINUTES: 2,
  EMAIL_OTP_MAX_ATTEMPTS: 3,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS: 1,
};

test('Send OTP and verify successfully', async () => {
  const fakeDb = makeFakeDb();
  let sent = null;
  const mailer = async ({ to, subject, text }) => {
    sent = { to, subject, text };
    return { messageId: 'ok' };
  };

  const svc = createEmailOtpService({ db: fakeDb, mailer, cfg });
  await svc.sendEmailOtp({ email: 'u@example.com' });
  assert.equal(sent.to, 'u@example.com');
  // extract otp from text
  const m = sent.text.match(/OTP is:\s*(\d{4})/i) || sent.text.match(/(\d{4})/);
  assert.ok(m, 'OTP present in email text');
  const otp = m[1];

  const res = await svc.verifyEmailOtp({ email: 'u@example.com', otp });
  assert.equal(res.message, 'Email verified successfully');
});

test('Resend cooldown prevents immediate resend', async () => {
  const fakeDb = makeFakeDb();
  let sendCount = 0;
  const mailer = async () => { sendCount++; return { messageId: 'ok' }; };
  const svc = createEmailOtpService({ db: fakeDb, mailer, cfg });

  await svc.sendEmailOtp({ email: 'a@example.com' });
  let thrown = false;
  try {
    await svc.sendEmailOtp({ email: 'a@example.com' });
  } catch (err) {
    thrown = true;
  }
  assert.equal(thrown, true);
  assert.equal(sendCount, 1);
});

test('Cooldown message tells the member how long to wait', async () => {
  // The message is shown verbatim in the chat (the conversation engine passes err.message into
  // describeOtpProblem), so "please wait" with no number leaves them retrying blind.
  const svc = createEmailOtpService({
    db: makeFakeDb(),
    mailer: async () => ({ messageId: 'ok' }),
    cfg: { ...cfg, EMAIL_OTP_RESEND_COOLDOWN_SECONDS: 60 },
  });

  await svc.sendEmailOtp({ email: 'wait@example.com' });
  await assert.rejects(
    () => svc.sendEmailOtp({ email: 'wait@example.com' }),
    (err) => {
      assert.match(err.message, /Please wait \d+ seconds? before requesting another OTP\./, err.message);
      const seconds = err.details?.retryAfterSeconds;
      assert.ok(seconds >= 1 && seconds <= 60, `retryAfterSeconds = ${seconds}`);
      assert.match(err.message, new RegExp(`wait ${seconds} second`));
      return true;
    },
  );
});

test('Cooldown message says "1 second", not "1 seconds"', async () => {
  const svc = createEmailOtpService({
    db: makeFakeDb(),
    mailer: async () => ({ messageId: 'ok' }),
    cfg: { ...cfg, EMAIL_OTP_RESEND_COOLDOWN_SECONDS: 1 },
  });

  await svc.sendEmailOtp({ email: 'one@example.com' });
  await assert.rejects(
    () => svc.sendEmailOtp({ email: 'one@example.com' }),
    (err) => {
      assert.match(err.message, /Please wait 1 second before/);
      return true;
    },
  );
});

test('Max attempts locks OTP after failures', async () => {
  const fakeDb = makeFakeDb();
  let sent = null;
  const mailer = async ({ text }) => { sent = text; return { messageId: 'ok' }; };
  const svc = createEmailOtpService({ db: fakeDb, mailer, cfg });

  await svc.sendEmailOtp({ email: 'b@example.com' });
  const m = sent.match(/(\d{4})/);
  const correct = m[1];
  const wrong = '0000' === correct ? '0001' : '0000';

  let errCount = 0;
  await (async () => {
    for (let i = 0; i < cfg.EMAIL_OTP_MAX_ATTEMPTS; i++) {
      try {
        await svc.verifyEmailOtp({ email: 'b@example.com', otp: wrong });
      } catch (err) {
        errCount++;
      }
    }
  })();

  assert.equal(errCount, cfg.EMAIL_OTP_MAX_ATTEMPTS);

  // Now even correct OTP should fail
  let ok = true;
  try {
    await svc.verifyEmailOtp({ email: 'b@example.com', otp: correct });
    ok = false;
  } catch (err) {
    ok = true;
  }
  assert.equal(ok, true);
});

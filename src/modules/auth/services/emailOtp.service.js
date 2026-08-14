import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { badRequestError, appError } from '../../../shared/errors.js';
import { prisma } from '../../../shared/prisma.js';
import { env } from '../../../config/env.js';
import { sendEmail } from '../../../utils/email.js';
import { buildEmailVerificationTemplate } from '../email-templates/emailVerification.template.js';
import { logger } from '../../../utils/logger.js';

export function createEmailOtpService({ db = prisma, mailer = sendEmail, cfg = env, log = logger } = {}) {
  const length = cfg.EMAIL_OTP_LENGTH;
  const expiryMinutes = cfg.EMAIL_OTP_EXPIRY_MINUTES;
  const maxAttempts = cfg.EMAIL_OTP_MAX_ATTEMPTS;
  const resendCooldownSeconds = cfg.EMAIL_OTP_RESEND_COOLDOWN_SECONDS;

  async function generateOtpString() {
    const max = 10 ** length;
    const n = crypto.randomInt(0, max);
    return String(n).padStart(length, '0');
  }

  async function sendEmailOtp({ email }) {
    if (!email) throw badRequestError('Email is required');

    const now = new Date();

    const active = await db.emailVerificationOtp.findFirst({
      where: {
        email,
        verifiedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (active) {
      const sinceMs = now.getTime() - active.createdAt.getTime();
      if (sinceMs < resendCooldownSeconds * 1000) {
        throw badRequestError('Please wait before requesting another OTP.');
      }
    }

    const otp = await generateOtpString();
    const tpl = buildEmailVerificationTemplate({ otp, expiryMinutes, companyName: 'IPRS' });

    // Try to send email first; if sending fails, do not persist OTP
    try {
      await mailer({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
    } catch (err) {
      log.error({ err, email }, 'SMTP send failed');
      throw appError('Failed to send OTP email');
    }

    // Invalidate any previous active OTPs
    await db.emailVerificationOtp.updateMany({
      where: { email, verifiedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });

    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await db.emailVerificationOtp.create({
      data: { email, otpHash, expiresAt, attempts: 0 },
    });

    return { message: 'OTP sent successfully' };
  }

  async function verifyEmailOtp({ email, otp }) {
    if (!email) throw badRequestError('Email is required');
    if (!otp) throw badRequestError('OTP is required');

    const now = new Date();

    const record = await db.emailVerificationOtp.findFirst({
      where: { email, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw badRequestError('OTP not found. Please request a new OTP.');

    if (record.expiresAt <= now) {
      // invalidate
      await db.emailVerificationOtp.updateMany({ where: { id: record.id }, data: { expiresAt: now } });
      throw badRequestError('OTP has expired. Please request a new OTP.');
    }

    if (record.attempts >= maxAttempts) {
      await db.emailVerificationOtp.updateMany({ where: { id: record.id }, data: { expiresAt: now } });
      throw badRequestError('Maximum OTP verification attempts exceeded. Please request a new OTP.');
    }

    const ok = await bcrypt.compare(otp, record.otpHash);
    if (!ok) {
      await db.emailVerificationOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      const updated = await db.emailVerificationOtp.findUnique({ where: { id: record.id } });
      if (updated.attempts >= maxAttempts) {
        await db.emailVerificationOtp.update({ where: { id: record.id }, data: { expiresAt: now } });
        throw badRequestError('Maximum OTP verification attempts exceeded. Please request a new OTP.');
      }
      throw badRequestError('Invalid OTP');
    }

    // mark verified
    await db.emailVerificationOtp.update({ where: { id: record.id }, data: { verifiedAt: now } });

    return { message: 'Email verified successfully' };
  }

  return { sendEmailOtp, verifyEmailOtp };
}

export const emailOtpService = createEmailOtpService();

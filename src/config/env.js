// ==================================================================
// IPRS Platform Backend - Week 1 (Onboarding & Platform Foundation)
// Environment configuration loader (validated with Zod)
// ==================================================================
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('iprs'),

  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  OTP_PROVIDER: z.enum(['mock', 'sms']).default('mock'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MOCK_VALUE: z.coerce.string().optional(),
  MSG91_AUT_KEY: z.string().optional(),
  MSG91_TEMP_ID: z.string().optional(),
  MSG91_OTP_LENGTH: z.coerce.number().int().positive().default(4),
  MSG91_OTP_EXPIRY: z.coerce.number().int().positive().default(10),

  /* Email OTP configuration */
  EMAIL_OTP_LENGTH: z.coerce.number().int().positive().default(4),
  EMAIL_OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(2),
  EMAIL_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),

  /* SMTP (Nodemailer) */
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // z.coerce.boolean() would treat the string "false" as truthy - compare explicitly.
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  // Dev-only: skips the real Spotify match check in the conversation gate, always lets the
  // spotify-link step advance. z.coerce.boolean() would treat "false" as truthy - same fix as
  // TYPEBOT_PREVIEW_MODE below.
  SPOTIFY_VERIFICATION_BYPASS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  DEFAULT_REGISTRATION_STATUS: z.string().default('started'),
  REGISTRATION_TOTAL_STEPS: z.coerce.number().int().positive().default(10),

  OCR_PROVIDER: z.enum(['http', 'stub']).default('http'),
  OCR_API_BASE_URL: z.string().default('https://ocr.choira.io'),
  OCR_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  // Blanket kill-switch for OCR across every doc type (independent of OCR_DOC_TYPES in
  // registration.service.js) - flip to false when ocr.choira.io itself is flaky so chat-flow
  // testing can proceed past uploads without getting stuck in the "please re-upload" retry loop.
  // z.coerce.boolean() would treat the string "false" as truthy - same fix as TYPEBOT_PREVIEW_MODE.
  OCR_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  TYPEBOT_API_BASE_URL: z.string().default('https://typebot.io'),
  // The bot's internal id (preview mode) or publicId (once published) - see TYPEBOT_PREVIEW_MODE.
  TYPEBOT_ID: z.string().optional(),
  // z.coerce.boolean() would treat the string "false" as truthy - compare explicitly instead.
  TYPEBOT_PREVIEW_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  TYPEBOT_API_TOKEN: z.string().optional(),
  TYPEBOT_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('âŒ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});

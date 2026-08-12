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

  DEFAULT_REGISTRATION_STATUS: z.string().default('started'),
  REGISTRATION_TOTAL_STEPS: z.coerce.number().int().positive().default(10),

  OCR_PROVIDER: z.enum(['http', 'stub']).default('http'),
  OCR_API_BASE_URL: z.string().default('https://ocr.choira.io'),
  OCR_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

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

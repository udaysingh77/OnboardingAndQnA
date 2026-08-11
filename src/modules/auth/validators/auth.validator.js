// ==================================================================
// Auth request validators (Zod).
// ==================================================================
import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Must be a valid phone number (9-14 digits, optional +)');

export const sendOtpSchema = z.object({
  body: z.object({
    phone: phoneSchema,
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    otp: z.string().regex(/^\d{4,6}$/, 'OTP must be 4-6 digits'),
  }),
});

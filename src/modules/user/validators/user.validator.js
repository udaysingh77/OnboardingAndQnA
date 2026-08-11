// ==================================================================
// User request validators (Zod).
// ==================================================================
import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Must be a valid phone number (9-14 digits, optional +)');

export const createUserSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(128).optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid user id') }),
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(128).optional(),
    registrationStatus: z
      .enum(['started', 'in_progress', 'completed'])
      .optional(),
  }),
});

export const getUserParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid user id') }),
});

export const userExistsQuerySchema = z.object({
  query: z.object({ phone: phoneSchema }),
});

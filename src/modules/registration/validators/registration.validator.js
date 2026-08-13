// ==================================================================
// Registration request validators (Zod).
// ==================================================================
import { z } from 'zod';

export const updateRegistrationSchema = z.object({
  body: z.object({
    currentStep: z.number().int().min(0, 'currentStep must be a non-negative integer'),
  }),
});

// No body validators needed for GET /status (uses authenticated user).

// ==================================================================
// Typebot-facing registration endpoints.
// ==================================================================

// The registration id is the stringified App_Accounts.AccountId (bigint).
const registrationIdParam = z.object({
  registrationId: z.string().regex(/^\d+$/, 'registrationId must be a numeric account id'),
});

export const registrationIdParamsSchema = z.object({
  params: registrationIdParam,
});

export const basicDetailsSchema = z.object({
  params: registrationIdParam,
  body: z
    .object({
      firstName: z.string().min(1).max(30, 'firstName must be at most 30 characters'),
      lastName: z.string().min(1).max(45, 'lastName must be at most 45 characters'),
      email: z.string().email('Must be a valid email').max(100),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dob must be in YYYY-MM-DD format'),
      gender: z.enum(['Male', 'Female', 'Other']),
      address: z.string().min(1).max(255, 'address must be at most 255 characters'),
    })
    // mobile is the OTP-verified identity and cannot be changed here - reject unknown fields.
    .strict(),
});

const documentTypeEnum = z.enum(['PAN', 'AADHAAR', 'BANK', 'NOC', 'COMPANY_DOC', 'PROFILE_PHOTO']);

export const documentUploadSchema = z.object({
  params: registrationIdParam.extend({ documentType: documentTypeEnum }),
  body: z
    .object({
      documentUrl: z.string().url('documentUrl must be a valid URL'),
    })
    .strict(),
});

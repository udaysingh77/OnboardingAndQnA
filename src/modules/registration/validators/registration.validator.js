// ==================================================================
// Registration request validators (Zod).
// ==================================================================
import { z } from 'zod';

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

const documentTypeEnum = z.enum([
  'PAN',
  'AADHAAR',
  'BANK',
  'NOC',
  'COMPANY_DOC',
  'PROFILE_PHOTO',
  'PERMANENT_ADDRESS_PROOF',
  'CURRENT_ADDRESS_PROOF',
  'DRIVING_LICENCE',
  'VOTER_ID',
]);

export const documentUploadSchema = z.object({
  params: registrationIdParam.extend({ documentType: documentTypeEnum }),
  body: z
    .object({
      documentUrl: z.string().url('documentUrl must be a valid URL'),
    })
    .strict(),
});

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

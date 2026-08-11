// ==================================================================
// Conversation request validators (Zod).
// ==================================================================
import { z } from 'zod';

export const sendMessageSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1, 'message must not be empty').max(4000),
  }),
});

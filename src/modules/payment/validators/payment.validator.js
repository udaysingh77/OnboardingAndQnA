// ==================================================================
// Payment request validators (Zod).
// Schemas must be shaped as { body?, query?, params? } for validate.js.
// ==================================================================
import { z } from 'zod';

// No `amount` field - the fee is always resolved server-side from the member's role
// (see payment.service.js's initiatePayment() / feeSchedule.js), never taken from the caller.
export const initiatePaymentSchema = z.object({
  body: z
    .object({
      productInfo: z.string().max(255).optional(),
    })
    .optional(),
});

export const verifyStatusSchema = z.object({
  body: z.object({
    txnId: z.string().min(1, 'txnId is required'),
  }),
});

export const txnParamSchema = z.object({
  params: z.object({
    txnId: z.string().min(1, 'txnId is required'),
  }),
});

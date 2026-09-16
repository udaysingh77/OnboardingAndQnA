// ==================================================================
// Payment routes.
// ==================================================================
import { Router } from 'express';
import { validate } from '../../../shared/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import * as paymentController from '../controllers/payment.controller.js';
import {
  initiatePaymentSchema,
  verifyStatusSchema,
  txnParamSchema,
} from '../validators/payment.validator.js';

const router = Router();

// PayU webhook / redirect callback from PayU (public endpoint)
router.post('/callback', paymentController.handleCallback);

// Protected endpoints for authenticated members
router.post('/initiate', authenticate, validate(initiatePaymentSchema), paymentController.initiate);
router.post('/verify', authenticate, validate(verifyStatusSchema), paymentController.verifyStatus);
router.get('/history', authenticate, paymentController.getHistory);
router.get('/status/:txnId', authenticate, validate(txnParamSchema), paymentController.getStatus);

export default router;

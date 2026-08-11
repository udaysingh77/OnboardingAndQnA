// ==================================================================
// Conversation routes.
// ==================================================================
import { Router } from 'express';
import { validate } from '../../../shared/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import * as conversationController from '../controllers/conversation.controller.js';
import { sendMessageSchema } from '../validators/conversation.validator.js';

const router = Router();

router.post('/message', authenticate, validate(sendMessageSchema), conversationController.sendMessage);

export default router;

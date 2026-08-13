// ==================================================================
// Conversation routes.
// ==================================================================
import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../../shared/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import { env } from '../../../config/env.js';
import * as conversationController from '../controllers/conversation.controller.js';
import { sendMessageSchema } from '../validators/conversation.validator.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
});

const router = Router();

router.post('/message', authenticate, validate(sendMessageSchema), conversationController.sendMessage);
router.post('/upload', authenticate, upload.single('file'), conversationController.uploadDocument);

export default router;

// ==================================================================
// Registration routes.
// ==================================================================
import { Router } from 'express';
import { validate } from '../../../shared/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import * as registrationController from '../controllers/registration.controller.js';
import {
  documentUploadSchema,
  registrationIdParamsSchema,
} from '../validators/registration.validator.js';

const router = Router();

router.use(authenticate);

router.get('/status', registrationController.getStatus);

// Typebot-facing, section-based registration flow.
router.post('/:registrationId/documents/:documentType', validate(documentUploadSchema), registrationController.uploadDocument);
router.post('/:registrationId/complete', validate(registrationIdParamsSchema), registrationController.complete);

export default router;

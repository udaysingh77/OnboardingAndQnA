// ==================================================================
// Registration routes.
// ==================================================================
import { Router } from 'express';
import { validate } from '../../../shared/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import * as registrationController from '../controllers/registration.controller.js';
import {
  updateRegistrationSchema,
  basicDetailsSchema,
  documentUploadSchema,
  registrationIdParamsSchema,
} from '../validators/registration.validator.js';

const router = Router();

router.use(authenticate);

router.get('/status', registrationController.getStatus);
router.put('/status', validate(updateRegistrationSchema), registrationController.updateStatus);

// Typebot-facing, section-based registration flow.
router.post('/start', registrationController.start);
router.patch('/:registrationId/basic-details', validate(basicDetailsSchema), registrationController.saveBasicDetails);
router.post('/:registrationId/documents/:documentType', validate(documentUploadSchema), registrationController.uploadDocument);
router.post('/:registrationId/complete', validate(registrationIdParamsSchema), registrationController.complete);

export default router;

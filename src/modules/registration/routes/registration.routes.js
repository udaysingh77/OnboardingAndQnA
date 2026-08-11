// ==================================================================
// Registration routes.
// ==================================================================
import { Router } from 'express';
import { validate } from '../../../shared/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import * as registrationController from '../controllers/registration.controller.js';
import { updateRegistrationSchema } from '../validators/registration.validator.js';

const router = Router();

router.use(authenticate);

router.get('/status', registrationController.getStatus);
router.put('/status', validate(updateRegistrationSchema), registrationController.updateStatus);

export default router;

// ==================================================================
// User routes.
// ==================================================================
import { Router } from 'express';
import { validate } from '../../../shared/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import * as userController from '../controllers/user.controller.js';
import {
  createUserSchema,
  updateUserSchema,
  getUserParamsSchema,
  userExistsQuerySchema,
} from '../validators/user.validator.js';

const router = Router();

router.post('/', validate(createUserSchema), userController.createUser);
router.get('/exists', validate(userExistsQuerySchema), userController.checkUserExists);
router.get('/:id', authenticate, validate(getUserParamsSchema), userController.getUser);
router.put('/:id', authenticate, validate(updateUserSchema), userController.updateUser);

export default router;

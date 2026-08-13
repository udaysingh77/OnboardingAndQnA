import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { validate } from '../../../shared/validate.js';
import * as spotifyController from '../controllers/spotify.controller.js';
import { spotifyMetadataBodySchema } from '../validators/spotify.validator.js';

const router = Router();

router.post('/metadata', authenticate, validate(spotifyMetadataBodySchema), spotifyController.getMetadata);

export default router;

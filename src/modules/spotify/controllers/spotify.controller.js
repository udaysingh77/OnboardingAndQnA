import { ok } from '../../../shared/response.js';
import { spotifyService } from '../services/spotify.service.js';

export const getMetadata = async (req, res, next) => {
  try {
    const data = await spotifyService.getMetadata(req.body.url);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

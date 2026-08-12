import { ok } from '../../../shared/response.js';
import { spotifyClaimService } from '../services/spotify.claim.service.js';

export const getMetadata = async (req, res, next) => {
  try {
    const data = await spotifyClaimService.matchSpotifyClaim(req.body.url, req.user);
    return ok(res, { data });
  } catch (err) {
    return next(err);
  }
};

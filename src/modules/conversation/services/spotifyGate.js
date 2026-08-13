// ==================================================================
// Gates the Typebot conversation's "Enter your spotify link" step:
// verifies the claimed track's artist credits against the account's
// AccountName/AccountAlias before letting the conversation advance
// past that step. Mirrors conversationFieldMap.js's variableId-based
// recognition, but this step needs a block/allow decision rather than
// a simple persist.
// ==================================================================
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { registrationService } from '../../registration/services/registration.service.js';
import { spotifyClaimService } from '../../spotify/services/spotify.claim.service.js';

// The "Enter your spotify link" url-input block's variableId in the
// current Typebot flow - update if that block's variable is re-created
// in Studio (see conversationFieldMap.js for the same precedent).
export const SPOTIFY_URL_VARIABLE_ID = 'vg4dgww6onbrxfk3yjjg45rhi';

export function isSpotifyUrlStep(variableId) {
  return variableId === SPOTIFY_URL_VARIABLE_ID;
}

// Returns true only if the track's credited artists include the account's
// name or alias. Any failure (invalid URL, Spotify API error, no account
// names on file) is treated as "not verified" - the conversation blocks
// and asks again rather than crashing or silently letting it through.
export async function verifySpotifyClaim(userId, url) {
  if (env.SPOTIFY_VERIFICATION_BYPASS) {
    logger.warn({ userId }, 'SPOTIFY_VERIFICATION_BYPASS is on - skipping real Spotify match check');
    return true;
  }

  const { accountName, accountAlias } = await registrationService.getIdentityNames(userId);
  const result = await spotifyClaimService.matchSpotifyClaim(url, { id: userId }, accountName, accountAlias);
  return result.status === true;
}

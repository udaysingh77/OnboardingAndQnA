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

// The work-link url-input block's variableId. The flow was unified so all four
// role paths share one `workUrl` variable - this used to be `spotifyUrl`
// (vg4dgww6onbrxfk3yjjg45rhi), which no block uses any more, so leaving it
// would have made this gate silently unreachable (the same failure mode as the
// earlier `teritory` id change - see AGENTS.md). Update if re-created in Studio.
export const SPOTIFY_URL_VARIABLE_ID = 'vdcqjfwmljgel9ola6lpinafa';

export function isSpotifyUrlStep(variableId) {
  return variableId === SPOTIFY_URL_VARIABLE_ID;
}

// That same step now accepts YouTube links too, and a YouTube URL can never
// pass a Spotify artist-credit check - so only claim-verify what is actually a
// Spotify link, and let everything else through to be saved as-is.
function isSpotifyUrl(url) {
  return /(^|\/\/|\.)spotify\.com\//i.test(String(url ?? '').trim());
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

  if (!isSpotifyUrl(url)) return true;

  const { accountName, accountAlias } = await registrationService.getIdentityNames(userId);
  const result = await spotifyClaimService.matchSpotifyClaim(url, { id: userId }, accountName, accountAlias);
  return result.status === true;
}

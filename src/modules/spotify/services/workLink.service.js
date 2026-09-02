// ==================================================================
// Work links - the songs a member claims as their own, collected as
// URLs (Spotify/YouTube) during the Typebot conversation and stored
// one row per link in App_Accounts_WorkRegistration.
//
// Only AccountId + DigitalLink are written here. The metadata columns
// (SongName/Artist_Singers/ReleaseYear/...) stay null: they can only be
// filled from Spotify's API, which currently refuses this app's
// requests ("Active premium subscription required for the owner of the
// app" - see AGENTS.md). spotify.claim.service.js still fills them on
// the claim path for when that access is restored.
// ==================================================================
import { spotifyRepository } from '../repositories/spotify.repository.js';

// How many links one member may add. Enforced here rather than only in the
// conversation gate so it holds even if the member re-enters the link step in a
// restarted conversation - the flow can ask again, but the cap still bites.
export const MAX_WORK_LINKS = 5;

// Returns the created row, or null when the member is already at the cap.
async function saveWorkLink({ userId, url }) {
  const existing = await countWorkLinks(userId);
  if (existing >= MAX_WORK_LINKS) return null;

  return spotifyRepository.createWorkRegistration({
    AccountId: BigInt(userId),
    DigitalLink: url,
  });
}

async function countWorkLinks(userId) {
  return spotifyRepository.countWorkRegistrationsByAccountId(userId);
}

export const workLinkService = { saveWorkLink, countWorkLinks, MAX_WORK_LINKS };

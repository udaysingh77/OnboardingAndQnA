// ==================================================================
// Spotify module repository. Work-registration rows moved to
// modules/work/repositories/work.repository.js - that table now holds
// links from YouTube too, so it is no longer Spotify's to own.
// This stays as the module's data-access seam for the claim path.
// ==================================================================
import { workRepository } from '../../work/repositories/work.repository.js';

export const spotifyRepository = {
  // Used by spotify.claim.service.js's REST path (POST /spotify/metadata). The chat flow goes
  // through workLink.service.js instead.
  createWorkRegistration: workRepository.createWorkRegistration,
};

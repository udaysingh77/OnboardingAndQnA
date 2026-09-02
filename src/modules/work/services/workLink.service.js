// ==================================================================
// Work links - the songs a member claims as their own, collected during
// the Typebot conversation and stored one row per link in
// App_Accounts_WorkRegistration.
//
// Moved here from modules/spotify: links now arrive from Spotify *or*
// YouTube, so this is no longer Spotify's business.
//
// Only grounded metadata is written. Author_Composer, Author_Lyricist,
// LanguageNames, WorkCategory and DocLink stay null on purpose - nothing
// we call can source them truthfully, and for a rights society an empty
// column is safer than an invented credit. Staff fill those in.
// ==================================================================
import { workRepository } from '../repositories/work.repository.js';

// How many links one member may add. Enforced here rather than only in the conversation gate so it
// holds even if the member re-enters the link step in a restarted conversation - the flow can ask
// again, but the cap still bites.
export const MAX_WORK_LINKS = 5;

// Written to CreatedBy so staff can find claims the name check couldn't confirm, without needing a
// schema change - the column is a free audit field and was previously always null.
export const MATCH_MARKERS = Object.freeze({
  MATCHED: 'chat:name-matched',
  UNVERIFIED: 'chat:name-unverified',
});

// SQL Server column widths - a value that overflows fails the whole insert, so clip here.
const LIMITS = { SongName: 100, Film_AlbumName: 100, Artist_Singers: 500, Publisher: 100, DigitalLink: 500 };

function clip(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}

// `resolved` is workLinkResolver's provider-agnostic shape. Returns the created row, or null when
// the member is already at the cap.
async function saveWorkLink({ userId, resolved, matched }) {
  const existing = await countWorkLinks(userId);
  if (existing >= MAX_WORK_LINKS) return null;

  const artists = Array.isArray(resolved?.artists) ? resolved.artists.filter(Boolean) : [];

  return workRepository.createWorkRegistration({
    AccountId: BigInt(userId),
    SongName: clip(resolved?.songName, LIMITS.SongName),
    Film_AlbumName: clip(resolved?.filmOrAlbum, LIMITS.Film_AlbumName),
    Artist_Singers: clip(artists.join(', '), LIMITS.Artist_Singers),
    Publisher: clip(resolved?.publisher, LIMITS.Publisher),
    DigitalLink: clip(resolved?.url, LIMITS.DigitalLink),
    ReleaseYear: Number.isInteger(resolved?.releaseYear) ? BigInt(resolved.releaseYear) : null,
    CreatedBy: matched ? MATCH_MARKERS.MATCHED : MATCH_MARKERS.UNVERIFIED,
  });
}

async function countWorkLinks(userId) {
  return workRepository.countByAccountId(userId);
}

export const workLinkService = { saveWorkLink, countWorkLinks, MAX_WORK_LINKS, MATCH_MARKERS };

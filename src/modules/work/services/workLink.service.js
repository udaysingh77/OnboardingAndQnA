// ==================================================================
// Work links - the songs a member claims as their own, collected during
// the Typebot conversation and stored one row per link in
// App_Accounts_WorkRegistration.
//
// Moved here from modules/spotify: links now arrive from Spotify *or*
// YouTube, so this is no longer Spotify's business.
//
// Only grounded metadata is written.
//
// Author_Composer and Author_Lyricist ARE now filled, from the
// role-labelled credits the credits service returns (Spotify's own
// contributor roles, or the credit block in a YouTube description) - see
// musicCredits.service.js. But a role-labelled credit list describes the
// SONG, not this member - "the composer is Sachin-Jigar" is true whether
// the confirming member is Sachin-Jigar or a backing vocalist three names
// down the same credit block. Writing it unconditionally would put a
// stranger's name in a column meant to record THIS member's own role.
// So each column is only filled when the member's own on-file name is
// itself inside that specific role's list - reusing the exact matching
// rules from workMatch.service.js so a dropped middle name or an initial
// is still recognised. Everyone else's row leaves the column null, same
// as when the credits service had nothing at all.
//
// LanguageNames, WorkCategory and DocLink still stay null on purpose -
// nothing we call can source them truthfully, and for a rights society
// an empty column is safer than an invented credit. Staff fill those in.
// ==================================================================
import { workRepository } from '../repositories/work.repository.js';
import { matchCredits } from './workMatch.service.js';

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
const LIMITS = {
  SongName: 100,
  Film_AlbumName: 100,
  Artist_Singers: 500,
  Publisher: 100,
  DigitalLink: 500,
  Author_Composer: 100,
  Author_Lyricist: 100,
};

function clip(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}

// `resolved` is workLinkResolver's provider-agnostic shape. `memberNames` is every name already
// tried against this song's credits (trusted + claimed, or the alias just given) - it decides
// whether the writer columns below get filled, not just whether the row is saved at all.
// Returns the created row, or null when the member is already at the cap.
async function saveWorkLink({ userId, resolved, matched, memberNames = [] }) {
  const existing = await countWorkLinks(userId);
  if (existing >= MAX_WORK_LINKS) return null;

  const artists = Array.isArray(resolved?.artists) ? resolved.artists.filter(Boolean) : [];

  return workRepository.createWorkRegistration({
    AccountId: BigInt(userId),
    SongName: clip(resolved?.songName, LIMITS.SongName),
    Film_AlbumName: clip(resolved?.filmOrAlbum, LIMITS.Film_AlbumName),
    Artist_Singers: clip(artists.join(', '), LIMITS.Artist_Singers),
    Publisher: clip(resolved?.publisher, LIMITS.Publisher),
    Author_Composer: writerCredit(resolved?.composers, memberNames, LIMITS.Author_Composer),
    Author_Lyricist: writerCredit(resolved?.lyricists, memberNames, LIMITS.Author_Lyricist),
    DigitalLink: clip(resolved?.url, LIMITS.DigitalLink),
    ReleaseYear: Number.isInteger(resolved?.releaseYear) ? BigInt(resolved.releaseYear) : null,
    CreatedBy: matched ? MATCH_MARKERS.MATCHED : MATCH_MARKERS.UNVERIFIED,
  });
}

// Only fills a writer column when the member's own on-file name is ITSELF inside that specific
// role's list - reuses matchCredits()'s name comparison (dropped middle name, initial, one-letter
// typo) rather than a second, looser rule. A member merely present elsewhere in the song's credits
// (a backing vocalist, say) must not have a stranger's name written into their own writer column.
function writerCredit(list, memberNames, limit) {
  if (!memberNames?.length) return null;
  const { matched } = matchCredits({ credits: list }, memberNames);
  return matched ? clip(joinNames(list), limit) : null;
}

// Several people share one 100-character column, so join them and let clip() take the overflow.
// Returns null for an empty list, keeping "we had no credits" distinct from an empty string.
function joinNames(value) {
  if (!Array.isArray(value)) return null;
  const list = [...new Set(value.filter((name) => typeof name === 'string' && name.trim()))];
  return list.length ? list.map((name) => name.trim()).join(', ') : null;
}

async function countWorkLinks(userId) {
  return workRepository.countByAccountId(userId);
}

export const workLinkService = { saveWorkLink, countWorkLinks, MAX_WORK_LINKS, MATCH_MARKERS };

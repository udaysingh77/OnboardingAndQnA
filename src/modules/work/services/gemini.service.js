// ==================================================================
// Gemini, used strictly as a *parser* for YouTube video titles.
//
// A YouTube title carries the song, the film/album and the credits all
// mashed into one string - "Kesariya - Brahmastra | Arijit Singh |
// Pritam | Amitabh B" - and no API splits that. Gemini does, reliably.
//
// TWO RULES, both deliberate:
//
// 1. It is sent TEXT, never the video. Passing the YouTube URL as
//    fileData makes Gemini ingest the video: ~13s and up to 100k tokens.
//    Passing just the oEmbed title + channel costs ~2.8s and ~150 tokens
//    and produces the same split.
// 2. It is asked only to SPLIT the string it was given, never what it
//    knows about the song. IPRS is a rights society - an invented
//    composer or publisher in the register is worse than an empty field.
//    That's why the prompt forbids outside knowledge and why
//    Author_Composer/Author_Lyricist/Publisher are not asked for at all.
//
// Optional by design: with GEMINI_API_KEY blank this returns null and the
// caller falls back to the raw oEmbed title. The chat step must never
// break because Gemini is unavailable.
// ==================================================================
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const PROMPT = [
  'You are given ONLY a YouTube video title and channel name.',
  'Split them into the fields below.',
  'Copy text that is present in the input; use null when a field is not present.',
  'Never add knowledge from outside the input - do not recall the song, guess a release year,',
  'or name people the input does not name.',
  'Set isMusicVideo to false when the input is not a song (a lecture, vlog, trailer, podcast).',
  'Return JSON: {"isMusicVideo": boolean, "songName": string|null,',
  '"artists": string[], "filmOrAlbum": string|null}',
].join(' ');

export function isGeminiConfigured() {
  return Boolean(env.GEMINI_API_KEY);
}

// Returns { isMusicVideo, songName, artists[], filmOrAlbum } or null when Gemini is
// unconfigured or the call fails - never throws, the caller degrades instead.
export async function parseVideoTitle({ title, channelName }) {
  if (!isGeminiConfigured()) return null;

  const body = {
    contents: [{ parts: [{ text: `${PROMPT}\n\nTITLE: ${title}\nCHANNEL: ${channelName ?? ''}` }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  };

  try {
    const response = await fetch(
      `${API_BASE}/${env.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(env.GEMINI_REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Gemini title parse failed, falling back to the raw title');
      return null;
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      isMusicVideo: parsed.isMusicVideo !== false,
      songName: nonEmpty(parsed.songName),
      artists: Array.isArray(parsed.artists) ? parsed.artists.map(nonEmpty).filter(Boolean) : [],
      filmOrAlbum: nonEmpty(parsed.filmOrAlbum),
    };
  } catch (err) {
    logger.warn({ err }, 'Gemini title parse errored, falling back to the raw title');
    return null;
  }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export const geminiService = { isGeminiConfigured, parseVideoTitle };

// ==================================================================
// Translations that ship with the project, rather than being fetched.
//
// The flow's wording is fixed and repeats for every member, so its Hindi,
// Marathi and Gujarati are written once into a JSON file and looked up here.
// That makes translation instant, free and identical every time - and it works
// with no API credential at all, which the hosted options do not.
//
// A string that is not in the file is left in English rather than guessed at.
// Reviewed wording matters here: this flow states fees, legal warnings and
// document requirements to people joining a rights society.
//
// The file is read once and kept in memory; it is a deployment artefact, so a
// change to it means a restart, the same as any other config.
// ==================================================================
import { readFileSync } from 'node:fs';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let entries = null;

function load() {
  if (entries) return entries;

  const path = env.TRANSLATION_DICTIONARY_PATH;
  if (!path) {
    entries = new Map();
    return entries;
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    entries = new Map(Object.entries(raw).map(([english, langs]) => [english.trim(), langs]));
    logger.info({ path, phrases: entries.size }, 'Loaded flow translation dictionary');
  } catch (err) {
    // Missing or malformed: every member simply gets English.
    logger.warn({ path, err: err.message }, 'Could not load translation dictionary, answering in English');
    entries = new Map();
  }

  return entries;
}

export function isDictionaryConfigured() {
  return load().size > 0;
}

export function dictionarySize() {
  return load().size;
}

/** The stored translation for one string, or null when it is not in the file. */
export function lookup(text, language) {
  const hit = load().get(String(text).trim());
  const value = hit?.[language];
  return typeof value === 'string' && value.trim() ? value : null;
}

// Translated label -> the English the flow knows, per language. A member taps a
// button reading "हाँ, मैं सदस्य बनना चाहता/चाहती हूँ" and that is what the browser
// sends back; Typebot only recognises its own English, and answers anything else
// with "Invalid message. Please, try again." So the answer is turned back before
// it reaches the flow.
let reverse = null;

function loadReverse() {
  if (reverse) return reverse;

  reverse = new Map();
  for (const [english, langs] of load().entries()) {
    for (const [language, translated] of Object.entries(langs ?? {})) {
      if (typeof translated !== 'string' || !translated.trim()) continue;
      const key = `${language}\u0000${translated.trim()}`;
      // First writer wins: two English phrases can share a translation, and
      // silently remapping to the later one would answer the wrong question.
      if (!reverse.has(key)) reverse.set(key, english);
    }
  }

  return reverse;
}

/**
 * The English the flow expects for something a member sent, or null when this is
 * not a known label - free text (a name, an address) must pass through untouched.
 */
export function lookupSource(text, language) {
  if (typeof text !== 'string' || !text.trim()) return null;
  return loadReverse().get(`${language}\u0000${text.trim()}`) ?? null;
}

/** Provider shape: same length, same order; untranslated items come back unchanged. */
export async function dictionaryTranslate(texts, language) {
  return texts.map((text) => lookup(text, language) ?? text);
}

export const dictionaryProvider = {
  translate: dictionaryTranslate,
  isConfigured: isDictionaryConfigured,
};

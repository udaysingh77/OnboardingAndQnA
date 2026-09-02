// ==================================================================
// Person-name normalisation, shared by everything that compares a
// member's name against a name that came from an external service
// (Spotify artist credits, a YouTube channel or video title).
//
// Comparison is exact *after* normalising - close enough that
// "A.R. Rahman" matches "AR Rahman" and a curly apostrophe matches a
// straight one, strict enough that "AR Rehman" does not match.
// ==================================================================

export function normalizeName(value) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFKC')
    .replace(/[‘’‚‛′‵]/g, "'")
    .replace(/[‐-―–—―]/g, '-')
    // A full stop becomes a SPACE, not nothing. Deleting it collapsed "A.R." into the single token
    // "ar", which then never lined up with "Allah Rakha" - initials have to survive as separate
    // tokens for the first/last comparison in workMatch.service.js to work.
    .replace(/\./g, ' ')
    .replace(/,/g, '')
    // Whitespace is collapsed last, so the spaces introduced above are folded in too.
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// True when `candidate` is one of `names` once both sides are normalised.
export function matchesAnyName(candidate, names) {
  const target = normalizeName(candidate);
  if (!target) return false;
  return names.some((name) => normalizeName(name) === target);
}

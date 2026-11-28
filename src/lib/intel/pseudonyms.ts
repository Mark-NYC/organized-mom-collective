/**
 * Household-scoped pseudonyms (docs/intelligence/STAGE_B_REPORT.md → Pseudonymous identifiers).
 *
 * The engine recognizes recurring people, event series, places and members by stable tokens (P3, S12, L2, M1) issued
 * by the database (intel_private.pseudonym: a keyed hash with the household's secret salt; no name is stored). Text
 * that may ever reach an AI provider is rewritten with those tokens, so "Johan's birthday" becomes "P2's birthday":
 * the model can still learn that P2's birthday usually means a text, without ever seeing who P2 is.
 */

/** The person a title is about, from a possessive ("Johan's birthday", "Grandma Rose’s visit"), normalized. */
export function personKey(title: string): string | null {
  const m = title.match(/^\s*([A-Z][\p{L}'’.-]*(?:\s+[A-Z][\p{L}'’.-]*){0,2})['’]s?\s/u) ?? title.match(/^\s*([A-Z][\p{L}.-]+(?:\s+[A-Z][\p{L}.-]+){0,2})['’]\s/u);
  if (!m) return null;
  const key = m[1].replace(/['’]s?$/u, '').trim().toLowerCase().replace(/\s+/g, ' ');
  return key.length >= 2 ? key : null;
}

export interface TokenMap { [normalizedName: string]: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace every known name (household members and recognized people) with its token. Longer names first, whole words
 * only, case-insensitive; possessives keep their 's. Unknown capitalized words are left alone (they're usually
 * event words: "Soccer", "Thanksgiving"); minimize() still strips contact details.
 */
export function pseudonymize(text: string, tokens: TokenMap): string {
  let out = text;
  for (const name of Object.keys(tokens).sort((a, b) => b.length - a.length)) {
    if (!name) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}])${escape(name)}(?![\\p{L}])`, 'giu'), tokens[name]);
  }
  return out;
}

/** Back from tokens to names, only ever on the household's own device or server (never for a provider). */
export function depseudonymize(text: string, tokens: TokenMap): string {
  const back = Object.fromEntries(Object.entries(tokens).map(([n, t]) => [t, n]));
  return text.replace(/\b[MPSLC][0-9]{1,5}\b/g, (t) => (back[t] ? back[t].replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : t));
}

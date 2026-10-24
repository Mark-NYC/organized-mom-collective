/**
 * Input → WorksheetData: trim, cap lengths, keep only characters the embedded fonts can draw, format the date.
 * Pure and deterministic; safe to run on a server for mailed fulfillment.
 */
import { LIMITS } from './content.ts';
import type { WorksheetData, WorksheetInput } from './types.ts';

/** Characters in the fonts' Latin subset (Basic Latin, Latin-1 and common punctuation). */
const DRAWABLE = /[ -~ -ÿ–—‘’“”…•]/;

/** Keep what the fonts can draw; "Łucja" → "Lucja", emoji and symbols dropped. */
export function drawable(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    if (ch === '\n') out += ch;
    else if (DRAWABLE.test(ch)) out += ch;
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (base && [...base].every((c) => DRAWABLE.test(c))) out += base;
      else if (ch === 'ł' || ch === 'Ł') out += ch === 'ł' ? 'l' : 'L';
      else if (/\s/.test(ch)) out += ' ';
    }
  }
  return out;
}

/** One cleaned line (or, with `lines`, up to four lines). Empty → null. */
export function clean(value: string | undefined, max: number, lines = false): string | null {
  if (!value) return null;
  let text = drawable(value)
    .replace(/\r\n?/g, '\n')
    .replace(/'/g, '’')
    .replace(/[ \t ]+/g, ' ');
  text = lines
    ? text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4).join('\n')
    : text.replace(/\n/g, ' ').trim();
  const chars = [...text];
  if (chars.length > max) {
    // Over the limit (only possible server-side; the form stops typing): end on a whole word.
    const cut = chars.slice(0, max).join('');
    text = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:.]+$/, '')}…`;
  }
  return text.trim() || null;
}

/** "goering" → "The Goering Family"; "The Goering Family", "Goering Crew" and longer phrases stay as typed. */
export function familyTitle(value: string | undefined): string | null {
  const name = clean(value, LIMITS.familyName);
  if (!name) return null;
  if (/\b(family|famil|household|house|home|crew|team|clan|bunch|gang)\b/i.test(name) || /^the\s/i.test(name)) return name;
  if (name.split(' ').length > 3) return name;
  return `The ${name.charAt(0).toUpperCase()}${name.slice(1)} Family`;
}

/** "2026-11-14" → "Saturday, November 14". Anything else → null. */
export function checkInDate(value: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '');
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (date.getUTCMonth() !== +m[2] - 1) return null;
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function normalize(input: WorksheetInput): WorksheetData {
  const owner = clean(input.owner, LIMITS.owner);
  return {
    familyName: familyTitle(input.familyName),
    owner: owner ? owner.charAt(0).toUpperCase() + owner.slice(1) : null,
    job: clean(input.job, LIMITS.job),
    when: clean(input.when, LIMITS.when),
    done: clean(input.done, LIMITS.done, true),
    adultOwner: clean(input.adultOwner, 28),
    adultJob: clean(input.adultJob, 90),
    adultWhen: clean(input.adultWhen, 80),
    existing: clean(input.existing, 130),
    secondChild: clean(input.secondChild, 28),
    secondJob: clean(input.secondJob, 90),
    secondWhen: clean(input.secondWhen, 80),
    secondDone: clean(input.secondDone, 260, true),
    checkIn: checkInDate(input.checkIn),
  };
}

/**
 * "When it happens", shared by the months whose rows show a time OR a trigger in one box (August's routine charts,
 * May's summer rhythm): the kinds, the clock helpers and the plain checks on a trigger she types. One timing model for
 * the Club; each month decides its own defaults. Pure functions only.
 *
 * A time says when something is expected; a trigger names the familiar event that starts it ("After lunch", "When we
 * get home"), so nobody has to be reminded. A row shows one of them, never both.
 */
import { CUE_LIMIT, tidyCue } from './marks-text';

/** What a row's right-hand box shows. */
export type SlotKind = 'time' | 'trigger';

export const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const hhmm = (m: number) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
export const clock = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : t;
};
/** '7:30 AM' → ['7:30', 'AM'] for a time box. */
export const clockParts = (t: string): [string, string] => { const c = clock(t); const i = c.lastIndexOf(' '); return i > 0 ? [c.slice(0, i), c.slice(i + 1)] : [c, '']; };

/** Triggers are short: a few words naming the event. Same limit as the Club's habit cues. */
export const TRIGGER_LIMIT = CUE_LIMIT;
export const tidyTrigger = tidyCue;

/** Triggers that say nothing: there's no event in them. */
export const VAGUE_TRIGGER = /^(when|once)\s+(i[’']?m|i am|we[’']?re|we are)\s+ready$|^(now|later|soon|then|next|when it[’']?s time)$/i;
/** A deadline or condition, not a starting event: "Before screen time", "By 5:00", "No screens until…", "If …". */
export const CONDITION_TRIGGER = /^(before|by|until|no\b.*\buntil|if|only if|unless)\b/i;

const STOP = new Set(['when', 'after', 'before', 'i', 'im', 'i’m', "i'm", 'my', 'the', 'a', 'an', 'and', 'to', 'on', 'of', 'is', 'are', 'it', 'get', 'got', 'getting', 'go', 'do', '&', 'for', 'at', 'in', 'up', 'out', 'with', 'all', 'done', 'finished', 'ready']);
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');
export const triggerWords = (t: string) => t.toLowerCase().replace(/[’']/g, '').split(/[^a-z]+/).filter((w) => w && !STOP.has(w)).map(stem).filter((w) => w.length > 1);
/** Two phrases share a meaningful word ("After lunch" and "Lunch & Reset"). */
export const overlaps = (a: string, b: string) => { const x = new Set(triggerWords(b)); return triggerWords(a).some((w) => x.has(w)); };

/**
 * V19 attention management (docs/ios/V19_ATTENTION.md): where each insight goes, when, and whether it earns the
 * family's attention at all. Pure functions over the engine's insights; nothing here reads the screen.
 *
 * Three destinations:
 *   today       deserves attention before the next Family Meeting (changes, imminent conflicts, time-sensitive prep)
 *   meeting     worth talking about together, not worth an interruption (friction, ownership, seasons, intentions)
 *   remembered  improves later suggestions without asking anything now (too early, independent, over budget)
 *
 * Every insight passes the same gates (relevant, not handled, reliable, consequence, timing, actionable for this
 * viewer, not better discussed together, not already seen, not a duplicate, relief > load). If nothing passes, Today
 * shows no card: a quiet day is a good outcome, and the budget is never something to fill.
 */
import { addDays, daysBetween } from '../calendar/recurrence';
import type { Insight } from '../v18/engine';
import type { Part } from '../v16/model';
import type { CalendarEvent } from '../calendar/recurrence';

export type Destination = 'today' | 'meeting' | 'remembered';

/** One card component, ten states. The category only chooses the eyebrow; the card looks the same. */
export type Category = 'heads-up' | 'changed' | 'loose-end' | 'looking-ahead' | 'helping' | 'noticed' | 'opportunity' | 'celebrating' | 'further-ahead';
export const EYEBROW: Record<Category, string> = {
  'heads-up': 'A little heads-up', changed: 'Changed since your meeting', 'loose-end': 'One loose end', 'looking-ahead': 'Looking ahead',
  helping: 'Helping each other', noticed: 'Something we’ve noticed', opportunity: 'A good opportunity', celebrating: 'Worth celebrating',
  'further-ahead': 'Looking a little further ahead',
};

/** What the family told us. A plain Dismiss is only "not now, for these facts". */
export interface Feedback {
  key: string;
  fingerprint: string;
  /** A recommendation pattern ("need:party:gift", "friction:p-backpacks"), for "Don't suggest this again". */
  pattern: string;
  kind: 'dismissed' | 'handled' | 'not-relevant' | 'later' | 'never' | 'accepted' | 'topic';
  on: string;
  /** 'later': hidden until this date. */
  until?: string;
}

/** "Something changed?": a circumstance someone reported for one day. */
export interface Report { date: string; kind: 'sick' | 'behind' | 'work-late' | 'lighter' | 'other'; memberId?: string; note?: string; by: string }

/** When a standing part was really done: late or moved (completion history, for recurring friction). */
export interface HistoryEntry { partId: string; date: string; late?: boolean; moved?: boolean }

/** What an option does when the family chooses it. Nothing runs until they tap "Update our plan". */
export type Effect =
  | { type: 'edit'; partId: string; patch: Partial<Pick<Part, 'title' | 'cue' | 'ownerId' | 'weekday' | 'offsetDays'>> }
  | { type: 'note' }
  | { type: 'editor'; partId: string }
  | { type: 'move-cleaning'; zoneDay: number; to: number }
  | { type: 'propose'; part: Part }
  | { type: 'add-event'; event: CalendarEvent }
  | { type: 'topic' }
  | { type: 'later'; until: string };

export interface ResolutionOption { id: string; label: string; detail?: string; effect: Effect }

/** One affected thing, isolated, with its question, the facts and grounded options. */
export interface Affected {
  id: string;
  kind: 'ride' | 'dinner' | 'cleaning' | 'part' | 'backup' | 'intention' | 'simplify';
  partId?: string;
  /** A cleaning zone (1–4) when the affected thing is this week's cleaning session. */
  zoneDay?: number;
  question: string;
  facts: string[];
  current?: { ownerId: string | null; title: string; detail?: string };
  options: ResolutionOption[];
}

export interface SmartInsight extends Insight {
  category: Category;
  destination: Destination;
  /** Waiting would create a real problem (today or tomorrow, or a change that breaks a plan). */
  urgent: boolean;
  /** First and last day acting on it is useful. */
  earliestUseful: string;
  latestUseful: string;
  /** Can the person looking do something useful about it? */
  actionable: boolean;
  /** How much attention it earns (0–1). */
  worth: number;
  pattern: string;
  affected: Affected[];
  /** Things that are fine, said briefly for reassurance ("Sofia’s soccer bag is already packed ✓"). */
  reassurance: string[];
  /** Grounded in this adult's private calendar: never shown to anyone else. */
  privateTo?: string;
  /** Why it went where it went (internal; tests and the doc's trace). */
  routeWhy: string;
  meetingKind?: 'development' | 'routine' | 'season' | 'intention' | 'prep' | 'loop' | 'topic';
  actionLabel: string;
  /** Which sheet resolves it. */
  flow: 'resolve' | 'needs' | 'part' | 'week' | 'topic';
  /** Part row the insight belongs to when it isn't about an activity (backup), for its quiet line. */
  partLink?: string;
}

// ------------------------------------------------------------------ preparation windows

/**
 * How far ahead acting on a need becomes USEFUL (days before its due date). Not a reminder window: packing a bag is
 * useful the evening before, a gift a few days ahead, childcare a couple of weeks ahead.
 */
export const WINDOW: Record<string, number> = { lunch: 0, gear: 0, outfit: 1, card: 2, ride: 2, pickup: 1, rsvp: 3, gift: 4, childcare: 14 };

/** The family's own habits move the window: "already handled" twice → later; accepting help twice → earlier. */
export function windowFor(need: string, feedback: Feedback[], assistance: 'fewer' | 'standard' | 'more' = 'standard'): number {
  const base = WINDOW[need] ?? 1;
  const mine = feedback.filter((f) => f.pattern.endsWith(`:${need}`));
  const handled = mine.filter((f) => f.kind === 'handled').length;
  const accepted = mine.filter((f) => f.kind === 'accepted').length;
  let w = base;
  if (handled >= 2 || assistance === 'fewer') w = 0;
  else if (accepted >= 2 || assistance === 'more') w = base + 2;
  return w;
}

/** The family handles this kind of need on its own: no proactive suggestions unless it's due today and unplanned. */
export const independentAt = (need: string, feedback: Feedback[]) => feedback.filter((f) => f.pattern.endsWith(`:${need}`) && f.kind === 'handled').length >= 2;

// ------------------------------------------------------------------ gates and routing

export interface RouteInput { today: string; viewer: string; meetingDate: string | null; feedback: Feedback[]; shown: Record<string, Shown> }
export interface Shown { on: string; urgent: boolean; fp: string }

export type Gate = 'private' | 'handled' | 'postponed' | 'never' | 'not-relevant' | 'talked' | 'topic' | 'dismissed' | 'expired' | 'unreliable' | 'too-early' | 'meeting' | 'not-actionable' | 'seen' | 'budget' | 'below-threshold' | 'meeting-budget';

export interface Routed { insight: SmartInsight; gate?: Gate }

/** Card threshold for anything not urgent. */
export const THRESHOLD = 0.55;

export const worthOf = (i: Pick<Insight, 'urgency' | 'consequence' | 'confidence' | 'relevance'>) =>
  0.35 * i.urgency + 0.25 * i.consequence + 0.2 * i.confidence + 0.2 * i.relevance;

/** Feedback gates, in order. Calendar changes are never pattern-suppressed: new facts always count. */
export function feedbackGate(i: SmartInsight, r: RouteInput, talked: Record<string, string>): Gate | null {
  if (i.privateTo && i.privateTo !== r.viewer) return 'private';
  if (i.expiresOn < r.today) return 'expired';
  const fb = r.feedback.filter((f) => f.key === i.key);
  if (fb.some((f) => f.kind === 'handled')) return 'handled';
  if (talked[i.key]) return 'talked';
  if (fb.some((f) => f.kind === 'later' && (f.until ?? '') > r.today && f.fingerprint === i.fingerprint)) return 'postponed';
  if (i.category !== 'changed' && r.feedback.some((f) => f.kind === 'never' && f.pattern === i.pattern)) return 'never';
  if (i.category !== 'changed' && r.feedback.some((f) => f.kind === 'not-relevant' && f.pattern === i.pattern && daysBetween(f.on, r.today) < 60)) return 'not-relevant';
  return null;
}

/** Where it should go if it passes the feedback gates. */
export function destinationFor(i: SmartInsight, r: RouteInput): { destination: Destination; why: string } {
  if (i.destination === 'remembered') return { destination: 'remembered', why: i.routeWhy };
  if (i.confidence < 0.6) return { destination: i.confidence >= 0.45 ? 'meeting' : 'remembered', why: 'Not reliable enough to interrupt anyone.' };
  if (i.meetingKind && i.destination === 'meeting') return { destination: 'meeting', why: i.routeWhy };
  if (r.today < i.earliestUseful) {
    if (r.meetingDate && r.meetingDate <= i.latestUseful) return { destination: 'meeting', why: `Useful from ${i.earliestUseful}; the meeting on ${r.meetingDate} comes first.` };
    return { destination: 'remembered', why: `Too early: useful from ${i.earliestUseful}.` };
  }
  // In its window. If the meeting still comes in time and nothing breaks by waiting, it can wait for the meeting.
  if (!i.urgent && r.meetingDate && r.meetingDate < i.latestUseful && daysBetween(r.today, i.latestUseful) >= 3) {
    return { destination: 'meeting', why: `The meeting on ${r.meetingDate} comes before ${i.latestUseful}, so it can wait.` };
  }
  return { destination: 'today', why: i.urgent ? 'Waiting would create a problem.' : 'In its useful window, before the next meeting.' };
}

/**
 * The attention budget: at most one card; at most one NEW non-urgent card per household per day (a dismissed one
 * counts, so dismissing never reveals another low-priority card); an unchanged, unresolved non-urgent insight is
 * shown as a card once, then stays as a quiet line. Urgent items are never held back by a number.
 */
export function pickCard(candidates: SmartInsight[], r: RouteInput, dismissedToday: boolean): { card: SmartInsight | null; held: Map<string, Gate> } {
  const held = new Map<string, Gate>();
  // Urgent first; then what involves the person looking (personal relevance); then worth.
  const sorted = [...candidates].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.relevance - a.relevance || b.worth - a.worth || a.key.localeCompare(b.key));
  const nonUrgentShownToday = Object.entries(r.shown).some(([, v]) => v.on === r.today && !v.urgent);
  for (const i of sorted) {
    if (!i.actionable && !i.urgent) { held.set(i.key, 'not-actionable'); continue; }
    if (i.urgent) return { card: i, held };
    if (i.worth < THRESHOLD) { held.set(i.key, 'below-threshold'); continue; }
    const seen = r.shown[i.key];
    if (seen && seen.on < r.today && seen.fp === i.fingerprint) { held.set(i.key, 'seen'); continue; }
    if (seen?.on === r.today) return { card: i, held };
    if (nonUrgentShownToday || dismissedToday) { held.set(i.key, 'budget'); continue; }
    return { card: i, held };
  }
  return { card: null, held };
}

/** Meeting agenda: what the family chose to bring up first, then prepared items; one ownership and one routine idea at most. */
export function agendaOf(items: SmartInsight[], chosen: Set<string>): { agenda: SmartInsight[]; over: SmartInsight[] } {
  const order = ['topic', 'prep', 'loop', 'season', 'intention', 'development', 'routine'];
  const sorted = [...items].sort((a, b) => Number(chosen.has(b.key)) - Number(chosen.has(a.key)) || order.indexOf(a.meetingKind ?? 'topic') - order.indexOf(b.meetingKind ?? 'topic') || b.worth - a.worth);
  const agenda: SmartInsight[] = [];
  const over: SmartInsight[] = [];
  const caps: Record<string, number> = { development: 1, routine: 1 };
  const used: Record<string, number> = {};
  for (const i of sorted) {
    const k = i.meetingKind ?? 'topic';
    if (!chosen.has(i.key) && caps[k] !== undefined && (used[k] ?? 0) >= caps[k]) { over.push(i); continue; }
    used[k] = (used[k] ?? 0) + 1;
    agenda.push(i);
  }
  return { agenda, over };
}

export const laterUntil = (today: string, i: Pick<SmartInsight, 'earliestUseful' | 'latestUseful'>) =>
  i.earliestUseful > today ? i.earliestUseful : addDays(today, 1) <= i.latestUseful ? addDays(today, 1) : i.latestUseful;

/**
 * V18 · the optional interpretation step (the only place a language model could ever be involved).
 *
 * Deterministic first: playbooks.classify() handles almost every title. The interpreter is asked only when the rules
 * are unsure (confidence < ASK_BELOW), once per event fingerprint, and its answer is cached with the household's
 * insight state, never re-asked per Today open.
 *
 * Privacy and safety contract (enforced here, not by convention):
 *   - minimize(): the model sees the title, the notes with names and contact details stripped, the day part, and the
 *     number and age bands of attendees. Never names, birthdates, the household, other events or any history.
 *   - Notes are untrusted. They are passed as quoted data; nothing in them can add a need id, a person, a time or an
 *     action. validateInterpretation() accepts only known kinds and known need ids, and drops everything else.
 *   - The interpreter never writes anything. It returns a candidate kind and candidate needs; the engine turns
 *     those into at most one possibility the family can accept or ignore.
 *
 * This repository has NO model provider today (audit in docs/ios/V18_TODAY_INTELLIGENCE.md). The preview ships a
 * SIMULATED interpreter: a fixed answer for the demo's party, labeled simulated everywhere it appears. A production
 * interpreter would be a Supabase Edge Function holding the provider key server-side; it is not built.
 */
import { ALL_NEED_IDS, PLAYBOOKS, type EventKind } from './playbooks';

export const ASK_BELOW = 0.75;

/** What may leave the device. */
export interface InterpreterInput {
  title: string;
  /** Notes with names, emails, phone numbers and URLs replaced. Max 280 chars. */
  notes: string;
  dayPart: 'morning' | 'afternoon' | 'evening' | 'all-day';
  attendees: { adults: number; children: number; childAgeBands: ('under-5' | '5-8' | '9-12' | 'teen')[] };
}

export interface Interpretation {
  kind: EventKind;
  needs: string[];
  confidence: number;
  source: 'simulated' | 'model';
}

export interface EventInterpreter {
  readonly name: string;
  readonly simulated: boolean;
  interpret(input: InterpreterInput): Promise<unknown>;
}

const KINDS = Object.keys(PLAYBOOKS) as EventKind[];

/** Strip what an interpreter doesn't need. Names come from the household so they're removed even in notes. */
export function minimize(e: { title: string; notes?: string | null; start_time?: string | null }, attendees: { kind: 'adult' | 'child'; age?: number }[], names: string[]): InterpreterInput {
  let notes = (e.notes ?? '').slice(0, 600)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
    .replace(/https?:\/\/\S+/g, '[link]');
  for (const name of names) if (name) notes = notes.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '[name]');
  const h = e.start_time ? Number(e.start_time.slice(0, 2)) : null;
  const band = (a?: number) => (a === undefined ? '5-8' : a < 5 ? 'under-5' : a <= 8 ? '5-8' : a <= 12 ? '9-12' : 'teen') as InterpreterInput['attendees']['childAgeBands'][number];
  const kids = attendees.filter((a) => a.kind === 'child');
  return {
    title: e.title.slice(0, 80),
    notes: notes.slice(0, 280),
    dayPart: h === null ? 'all-day' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening',
    attendees: { adults: attendees.length - kids.length, children: kids.length, childAgeBands: [...new Set(kids.map((k) => band(k.age)))] },
  };
}

/** Accept only the shape we asked for. Anything else (instructions in notes, invented people or needs) is dropped. */
export function validateInterpretation(raw: unknown, source: Interpretation['source']): Interpretation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !KINDS.includes(r.kind as EventKind)) return null;
  const kind = r.kind as EventKind;
  const allowed = new Set(PLAYBOOKS[kind].map((x) => x.id));
  const needs = Array.isArray(r.needs) ? [...new Set(r.needs.filter((x): x is string => typeof x === 'string' && ALL_NEED_IDS.includes(x) && allowed.has(x)))] : [];
  const c = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.max(0, Math.min(1, r.confidence)) : 0;
  return { kind, needs, confidence: c, source };
}

/** A stable identity for "this event as it is now": a changed title, notes or time asks again. */
export function eventFingerprint(e: { title: string; notes?: string | null; start_time?: string | null; end_time?: string | null }, date: string): string {
  const s = `${e.title}|${e.notes ?? ''}|${date}|${e.start_time ?? ''}|${e.end_time ?? ''}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `ev:${(h >>> 0).toString(36)}`;
}

/**
 * SIMULATED, for the preview only. Recognizes the demo party's wording; returns nothing for anything else. It
 * honours `available` so the preview can show the deterministic fallback when "the model" is down.
 */
export function simulatedInterpreter(available: () => boolean): EventInterpreter {
  return {
    name: 'Simulated interpreter (preview fixture)',
    simulated: true,
    async interpret(input) {
      await new Promise((r) => setTimeout(r, 120));
      if (!available()) throw new Error('interpreter unavailable');
      if (/turning \d|birthday|cake/i.test(input.notes) || /birthday/i.test(input.title)) {
        return { kind: 'birthday-party', needs: ['rsvp', 'gift', 'card', 'ride'], confidence: 0.86 };
      }
      return { kind: 'other', needs: [], confidence: 0.2 };
    },
  };
}

/**
 * Cost notes (also in the doc): one call is ~700 input + ~250 output tokens. It runs only for events the rules can't
 * classify, once per fingerprint. A typical household sees 2–8 such events a month.
 */
export const TOKENS_PER_CALL = { input: 700, output: 250 } as const;

/**
 * V18 · H. Capture readiness. Architecture only: there is no capture UI in V18.
 *
 * A future capture (a school newsletter, an invitation, a screenshot, a voice note) becomes CANDIDATES the family
 * reviews, never events or responsibilities directly. Every source is untrusted content: it is parsed into this
 * shape, validated, and anything outside it is dropped. Text inside a capture can never become an instruction.
 */
import { ALL_NEED_IDS, PLAYBOOKS, type EventKind } from './playbooks';

export type CaptureSource = 'newsletter' | 'invitation' | 'screenshot' | 'voice' | 'email';

export interface CaptureCandidate {
  kind: 'event' | 'need' | 'date-change';
  title: string;
  /** 'YYYY-MM-DD' when the source states one; never guessed. */
  date?: string;
  startTime?: string;
  eventKind?: EventKind;
  needs?: string[];
  /** The exact words this came from, for the family to check. */
  quote: string;
  confidence: number;
}

export interface CaptureResult {
  source: CaptureSource;
  receivedOn: string;
  candidates: CaptureCandidate[];
  /** Everything the parser couldn't place. Shown as "We couldn't read this part", never acted on. */
  unplaced: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The only gate between a parser (rules or a model) and the family's review list. */
export function validateCapture(raw: unknown, source: CaptureSource, receivedOn: string): CaptureResult {
  const out: CaptureResult = { source, receivedOn, candidates: [], unplaced: [] };
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { candidates?: unknown }).candidates) ? (raw as { candidates: unknown[] }).candidates : [];
  for (const c of list.slice(0, 20)) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    const kind = r.kind === 'event' || r.kind === 'need' || r.kind === 'date-change' ? r.kind : null;
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, 80) : '';
    const quote = typeof r.quote === 'string' ? r.quote.slice(0, 200) : '';
    if (!kind || !title || !quote) { if (quote) out.unplaced.push(quote); continue; }
    const eventKind = typeof r.eventKind === 'string' && r.eventKind in PLAYBOOKS ? (r.eventKind as EventKind) : undefined;
    out.candidates.push({
      kind, title, quote,
      date: typeof r.date === 'string' && DATE.test(r.date) ? r.date : undefined,
      startTime: typeof r.startTime === 'string' && TIME.test(r.startTime) ? r.startTime : undefined,
      eventKind,
      needs: Array.isArray(r.needs) ? r.needs.filter((x): x is string => typeof x === 'string' && ALL_NEED_IDS.includes(x)) : undefined,
      confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0,
    });
  }
  return out;
}

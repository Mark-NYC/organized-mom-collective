/**
 * Household memory: how much a belief is trusted, and when it's reconsidered (docs/intelligence/STAGE_B_REPORT.md).
 *
 * Precedence: confirmed (the family said so) > observed (enough evidence) > tentative (some evidence) > retired.
 *   - Confirmed memory never decays. It lasts until the family changes it, forgets it, or its own expiry passes.
 *     Contradicting behavior never weakens it; it can only raise a question for the Family Meeting.
 *   - Inferred memory is recurrence-aware: each cadence has its own minimum evidence and review window
 *     (cadence.ts). Contradicting evidence lowers confidence; a run of it retires the belief or moves its anchor.
 *   - Absence is never evidence of neglect: a pattern that stops being seen is reconsidered (retired after its review
 *     window), never turned into "they forgot".
 */
import { MIN_EVIDENCE, REVIEW_DAYS, addDays, daysBetween, type Cadence } from './cadence';

export type MemoryCategory = 'event-meaning' | 'occasion' | 'routine' | 'responsibility' | 'collaboration' | 'timing' | 'preference' | 'temporary' | 'pattern';
export type MemoryStatus = 'confirmed' | 'observed' | 'tentative' | 'temporary' | 'retired' | 'forgotten';
export type MemorySource = 'family' | 'rules' | 'stats' | 'model';

export interface MemoryRecord {
  id?: string;
  category: MemoryCategory;
  subject_key: string;
  member_id: string | null;
  visible_to: string | null;
  content: Record<string, unknown>;
  status: MemoryStatus;
  source: MemorySource;
  cadence: Cadence | null;
  confidence: number;
  support: number;
  contradict: number;
  first_seen: string | null;
  last_seen: string | null;
  review_after: string | null;
  expires_at?: string | null;
  forgotten_at?: string | null;
}

export interface EvidenceRef { signal_id?: number; ref?: string; polarity: 1 | -1; at: string; weight?: number }
export interface MemoryUpsert extends Omit<MemoryRecord, 'id' | 'forgotten_at'> { evidence: EvidenceRef[] }

/** The identity the database enforces (one belief per subject, scope and visibility). */
export const identity = (m: Pick<MemoryRecord, 'category' | 'subject_key' | 'member_id' | 'visible_to'>) =>
  `${m.category}|${m.subject_key}|${m.member_id ?? '-'}|${m.visible_to ?? '-'}`;

/** Keys are pseudonymous and normalized: the same rule as household_memory.subject_key. */
export const KEY = /^[a-z0-9:_@.-]{1,120}$/;
export const keyOf = (...parts: (string | number | null | undefined)[]) =>
  parts.filter((p) => p != null && p !== '').join(':').toLowerCase().replace(/[^a-z0-9:_@.-]+/g, '-').slice(0, 120);

/**
 * Confidence from evidence (a Beta posterior mean), times how regular the pattern is, times how fresh it is for its
 * cadence: full within its review window, fading to zero over a second window.
 */
export function confidenceOf(a: { support: number; contradict: number; regularity: number; last: string; now: string; cadence: Cadence }): number {
  const posterior = (a.support + 1) / (a.support + a.contradict + 2);
  const review = REVIEW_DAYS[a.cadence];
  const gap = daysBetween(a.last, a.now);
  const fresh = gap <= review ? 1 : Math.max(0, 1 - (gap - review) / review);
  return Math.round(posterior * Math.max(0, Math.min(1, a.regularity)) * fresh * 100) / 100;
}

/** observed / tentative / retired for an inferred belief. */
export function statusOf(a: { cadence: Cadence; support: number; cycles: number; confidence: number; last: string; now: string; recentContradictions: number; was?: MemoryStatus }): MemoryStatus {
  const gap = daysBetween(a.last, a.now);
  if (gap > REVIEW_DAYS[a.cadence]) return 'retired'; // not seen for its whole review window: reconsidered, not assumed
  if (a.recentContradictions >= 3 && a.confidence < 0.5) return a.was === 'observed' ? 'retired' : 'tentative';
  const enough = a.cadence !== 'irregular' && a.support >= MIN_EVIDENCE[a.cadence].support && a.cycles >= MIN_EVIDENCE[a.cadence].cycles;
  if (enough && a.confidence >= 0.6) return 'observed';
  if (a.confidence < 0.3 && a.was === 'observed') return 'retired';
  return 'tentative';
}

export const reviewAfter = (last: string, cadence: Cadence) => addDays(last, REVIEW_DAYS[cadence]);

/** Is a confirmed memory still in force? (Until changed or expired.) */
export const inForce = (m: Pick<MemoryRecord, 'status' | 'expires_at'>, now: string) =>
  m.status === 'confirmed' && (!m.expires_at || m.expires_at.slice(0, 10) > now);

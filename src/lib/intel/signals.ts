/**
 * Household Intelligence Engine · the behavioral log's vocabulary (docs/intelligence/STAGE_B_REPORT.md).
 *
 * Mirrors household_signals (supabase/migrations/20261216000000_household_intelligence_engine.sql): a closed list of
 * kinds, opaque subject ids, short enum values. Never free text, names, locations or anything a family wrote. The
 * database enforces the same rules; this file lets the app and the engine build valid signals and read them back.
 */

/** Product moments: once per person per day (app_open once per hour band). The pilot funnel reads these. */
export const PRODUCT_KINDS = ['app_open', 'onboarding_started', 'onboarding_completed', 'cleaning_checked', 'plan_added', 'agreement_made',
  'meeting_started', 'meeting_completed', 'club_preview_viewed', 'feedback_sent'] as const;

/** Learning signals: only while the household's learning is on. */
export const LEARNING_KINDS = ['rec_presented', 'rec_response', 'request_asked', 'request_answered', 'agreement_saved', 'agreement_changed',
  'agreement_removed', 'task_done', 'task_undone', 'meeting_decision', 'intent_chosen', 'priority_chosen', 'development_decided', 'report_made',
  'memory_confirmed', 'memory_corrected', 'memory_forgotten', 'event_occurred', 'event_changed', 'handoff_covered'] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];
export type LearningKind = (typeof LEARNING_KINDS)[number];
export type SignalKind = ProductKind | LearningKind;

export const SUBJECT_KINDS = ['agreement', 'series', 'event', 'task', 'request', 'recommendation', 'memory', 'meeting', 'cleaning', 'priority',
  'intent', 'development', 'category', 'person', 'need', 'pattern'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

const REF = /^[A-Za-z0-9:_@.-]{1,96}$/;
const VALUE = /^[a-z0-9-]{1,32}$/;

/** What the app sends (household_signal_log). The server adds who, which household, and when it arrived. */
export interface SignalInput {
  kind: SignalKind;
  subject_kind?: SubjectKind;
  subject_ref?: string;
  value?: string;
  member_id?: string;
  /** From a personal (private) calendar: only this adult's own intelligence may use it. */
  private?: boolean;
  at?: string;
  local_day: string;
  local_hour: number;
  local_dow: number;
  platform?: 'web' | 'ios';
}

/** A stored signal, as the engine reads it (service role). */
export interface Signal {
  id?: number;
  household_id: string | null;
  user_id: string | null;
  member_id: string | null;
  kind: SignalKind;
  subject_kind: SubjectKind | null;
  subject_ref: string | null;
  value: string | null;
  visible_to: string | null;
  at: string;
  local_day: string;
  local_hour: number;
  local_dow: number;
  synthetic?: boolean;
}

export const isProduct = (k: string): k is ProductKind => (PRODUCT_KINDS as readonly string[]).includes(k);
export const isLearning = (k: string): k is LearningKind => (LEARNING_KINDS as readonly string[]).includes(k);

/** The device's local day, hour and weekday for a moment (what the log stores, so patterns follow the family's clock). */
export function localStamp(d: Date = new Date()): Pick<SignalInput, 'local_day' | 'local_hour' | 'local_dow' | 'at'> {
  const p = (n: number) => String(n).padStart(2, '0');
  return { at: d.toISOString(), local_day: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, local_hour: d.getHours(), local_dow: d.getDay() };
}

/** A signal the database would accept, or null (the same rules, checked before sending). */
export function validSignal(s: SignalInput): SignalInput | null {
  if (!isProduct(s.kind) && !isLearning(s.kind)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.local_day) || !(s.local_hour >= 0 && s.local_hour <= 23) || !(s.local_dow >= 0 && s.local_dow <= 6)) return null;
  if (isProduct(s.kind)) return { kind: s.kind, local_day: s.local_day, local_hour: s.local_hour, local_dow: s.local_dow, at: s.at, platform: s.platform };
  if ((s.subject_kind == null) !== (s.subject_ref == null)) return null;
  if (s.subject_kind && !(SUBJECT_KINDS as readonly string[]).includes(s.subject_kind)) return null;
  if (s.subject_ref != null && !REF.test(s.subject_ref)) return null;
  if (s.value != null && !VALUE.test(s.value)) return null;
  return s;
}

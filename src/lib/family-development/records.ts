/**
 * Family development records: what the family DECIDED about one child and one canonical skill, kept independently
 * of the skills library, monthly content and generated suggestions.
 *
 * Storage: public.household_development + household_development_events
 * (supabase/migrations/20261207000000_family_development_records.sql). The database enforces the same rules as
 * `applyDecision` below; this copy lets the meeting show the result at once and lets tests pin the contract.
 *
 * Rules (docs/product/RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md):
 *   - Every change is one explicit family decision. Nothing advances on age, time, check-ins or reported success.
 *   - `advance` moves exactly one stage. Launch comes only from the family (advance from Watch, or starting a record
 *     at Launch for something the child already owns).
 *   - A paused or dismissed suggestion that was never started has no stage: nothing is inferred.
 *   - Skill performance, habit consistency and ownership are different answers (`CheckSignal`), never collapsed into
 *     a stage.
 *
 * Agreement lifecycle (the database does this in the same transaction as the decision; `agreementEffect` below):
 *   start, resume, restore → the child's agreement is on the family's lists (created, or an existing one linked)
 *   advance, step-back, stay, check-in → unchanged (practicing, or theirs: still an agreement)
 *   modify → its words follow · pause, dismiss → removed from the lists (a tombstone, never a hard delete)
 */
import { MAWL_STAGES, type DevelopmentStatus, type MawlStage } from './framework';
import type { AgreementRow } from '../agreements/store';

export const DEVELOPMENT_DECISIONS = [
  'start', 'modify', 'advance', 'step-back', 'stay', 'check-in', 'pause', 'resume', 'dismiss', 'restore',
] as const;
export type DevelopmentDecision = (typeof DEVELOPMENT_DECISIONS)[number];

/** Which kind of progress a check-in asks about. */
export type CheckSignal = 'performance' | 'consistency' | 'ownership';
export type CheckValue = 'strong' | 'partial' | 'not-yet';

export interface DevelopmentCheck {
  signal: CheckSignal;
  value: CheckValue;
  /** The family practiced in a new circumstance (a Watch variation) since last time. */
  variation?: boolean;
}

export interface DevelopmentEvent {
  decision: DevelopmentDecision;
  fromStage: MawlStage | null;
  toStage: MawlStage | null;
  fromStatus: DevelopmentStatus | null;
  toStatus: DevelopmentStatus;
  signal?: CheckSignal;
  value?: CheckValue;
  variationPracticed: boolean;
  note?: string;
  agreementChange?: AgreementChange;
  decidedAt: string;
}

export type AgreementChange = 'created' | 'linked' | 'updated' | 'removed';

export interface DevelopmentRecord {
  id: string;
  memberId: string;
  skillId: string;
  /** The family's words (defaults to the library title). */
  title: string;
  /** Null only for a suggestion paused or dismissed before it was ever started. */
  stage: MawlStage | null;
  status: DevelopmentStatus;
  cue?: string;
  finishLine?: string;
  note?: string;
  lastSignal?: CheckSignal;
  lastValue?: CheckValue;
  /** 'YYYY-MM-DD'. */
  lastCheckInOn?: string;
  variationsPracticed: number;
  /** club_responsibilities.category its agreement is filed under. */
  category: string;
  /** The family agreement that goes with it. */
  agreementId?: string;
  /** Whether that agreement is on the family's lists right now (someone may have removed it elsewhere). */
  agreementLive: boolean;
  libraryVersion: number;
  revision: number;
  createdAt?: string;
  /** Most recent first is NOT guaranteed: oldest → newest, at most the last 12. */
  history: DevelopmentEvent[];
}

export interface DecisionInput {
  decision: DevelopmentDecision;
  /** Required for start; for resume when the record never had a stage. */
  stage?: MawlStage;
  title?: string;
  cue?: string;
  finish?: string;
  note?: string;
  check?: DevelopmentCheck;
  /** club_responsibilities.category for the agreement (start, resume, restore). */
  category?: string;
  /** Made on the phone for start, resume and restore, and kept for retries, so a repeat never makes a second one. */
  agreementId?: string;
}

export class DecisionError extends Error {}

const stageIndex = (s: MawlStage | null) => (s ? MAWL_STAGES.indexOf(s) : -1);
const statusFor = (stage: MawlStage) => (stage === 'launch' ? 'launched' : 'active') as DevelopmentStatus;

/**
 * The next state after one family decision, exactly as household_development_decide computes it. Throws
 * DecisionError for a decision the database would refuse ('invalid').
 */
export function applyDecision(
  current: Pick<DevelopmentRecord, 'stage' | 'status'> | null,
  input: DecisionInput,
): Pick<DevelopmentRecord, 'stage' | 'status'> {
  const d = input.decision;
  if (d === 'check-in' && !input.check) throw new DecisionError('a check-in needs an answer');
  if (input.check && !['check-in', 'stay', 'advance', 'step-back'].includes(d)) throw new DecisionError('check only with a check-in');
  if (!current) {
    if (d === 'start') {
      if (!input.stage) throw new DecisionError('the family chooses the starting stage');
      return { stage: input.stage, status: statusFor(input.stage) };
    }
    if (d === 'pause') return { stage: input.stage ?? null, status: 'paused' };
    if (d === 'dismiss') return { stage: input.stage ?? null, status: 'dismissed' };
    throw new DecisionError(`${d} needs an existing record`);
  }
  const i = stageIndex(current.stage);
  switch (d) {
    case 'start': throw new DecisionError('exists');
    case 'advance':
      if (current.status !== 'active' || i < 0 || i >= MAWL_STAGES.length - 1) throw new DecisionError('cannot advance');
      return { stage: MAWL_STAGES[i + 1], status: statusFor(MAWL_STAGES[i + 1]) };
    case 'step-back':
      if (!['active', 'launched'].includes(current.status) || i <= 0) throw new DecisionError('cannot step back');
      return { stage: MAWL_STAGES[i - 1], status: 'active' };
    case 'stay':
    case 'check-in':
      if (!['active', 'launched'].includes(current.status)) throw new DecisionError('not active');
      return { ...current };
    case 'pause':
      if (current.status === 'paused') throw new DecisionError('already paused');
      return { stage: current.stage, status: 'paused' };
    case 'dismiss':
      if (current.status === 'dismissed') throw new DecisionError('already dismissed');
      return { stage: current.stage, status: 'dismissed' };
    case 'resume': {
      if (!['paused', 'dismissed'].includes(current.status)) throw new DecisionError('not paused');
      const stage = current.stage ?? input.stage ?? null;
      if (!stage) throw new DecisionError('the family chooses the stage when reopening');
      return { stage, status: statusFor(stage) };
    }
    case 'restore':
      if (!['active', 'launched'].includes(current.status)) throw new DecisionError('not active');
      return { ...current };
    case 'modify':
      return { ...current };
  }
}

/** What a decision does to the family agreement (household_development_decide does the same, atomically). */
export function agreementEffect(decision: DevelopmentDecision, next: Pick<DevelopmentRecord, 'status'>): 'ensure' | 'keep' | 'update-words' | 'remove' {
  if (decision === 'pause' || decision === 'dismiss') return 'remove';
  if (decision === 'modify') return 'update-words';
  if (decision === 'start') return next.status === 'active' || next.status === 'launched' ? 'ensure' : 'keep';
  if (decision === 'resume' || decision === 'restore') return 'ensure';
  return 'keep';
}

/** Decisions that send a phone-made agreement id. */
export const NEEDS_AGREEMENT_ID: readonly DevelopmentDecision[] = ['start', 'resume', 'restore'];

/** The decisions the meeting may offer for a record, given its state. */
export function availableDecisions(r: Pick<DevelopmentRecord, 'stage' | 'status'> & { agreementLive?: boolean }): DevelopmentDecision[] {
  const i = stageIndex(r.stage);
  if (r.status === 'paused' || r.status === 'dismissed') return ['resume', 'modify'];
  if (r.agreementLive === false) return ['restore', 'pause'];
  const out: DevelopmentDecision[] = ['stay'];
  if (r.status === 'active' && i >= 0 && i < MAWL_STAGES.length - 1) out.push('advance');
  if (i > 0) out.push('step-back');
  out.push('pause', 'modify');
  if (r.status === 'active') out.push('dismiss');
  return out;
}

// ------------------------------------------------------------------ the database's shape

export interface DbDevelopmentRecord {
  id: string; member_id: string; skill_id: string; title: string; stage: MawlStage | null; status: DevelopmentStatus;
  cue: string | null; finish_line: string | null; note: string | null; last_signal: CheckSignal | null;
  last_value: CheckValue | null; last_check_in_on: string | null; variations_practiced: number;
  category?: string | null; agreement_id?: string | null; agreement_live?: boolean;
  library_version: number; revision: number; created_at?: string; updated_at?: string;
  /** Returned by a decision: the agreement as phones sync it, when the decision changed it. */
  agreement?: DbAgreement;
  /** Another adult's record was returned instead of creating a second one. */
  adopted?: boolean;
  history?: {
    decision: DevelopmentDecision; from_stage: MawlStage | null; to_stage: MawlStage | null;
    from_status: DevelopmentStatus | null; to_status: DevelopmentStatus; signal: CheckSignal | null;
    value: CheckValue | null; variation_practiced: boolean; note: string | null; decided_at: string;
    agreement_change?: AgreementChange | null;
  }[];
}

/** household_agreement_json: the same row the agreements sync uses. */
export type DbAgreement = AgreementRow;

export const recordFromDb = (r: DbDevelopmentRecord): DevelopmentRecord => ({
  id: r.id, memberId: r.member_id, skillId: r.skill_id, title: r.title, stage: r.stage, status: r.status,
  ...(r.cue ? { cue: r.cue } : {}), ...(r.finish_line ? { finishLine: r.finish_line } : {}), ...(r.note ? { note: r.note } : {}),
  ...(r.last_signal && r.last_value ? { lastSignal: r.last_signal, lastValue: r.last_value } : {}),
  ...(r.last_check_in_on ? { lastCheckInOn: r.last_check_in_on.slice(0, 10) } : {}),
  variationsPracticed: r.variations_practiced ?? 0, category: r.category ?? 'other',
  ...(r.agreement_id ? { agreementId: r.agreement_id } : {}),
  // Older payloads (no flag) are read as live, so nothing is shown as removed without the server saying so.
  agreementLive: r.agreement_live ?? Boolean(r.agreement_id),
  libraryVersion: r.library_version, revision: r.revision,
  ...(r.created_at ? { createdAt: r.created_at } : {}),
  history: (r.history ?? []).map((e) => ({
    decision: e.decision, fromStage: e.from_stage, toStage: e.to_stage, fromStatus: e.from_status, toStatus: e.to_status,
    ...(e.signal ? { signal: e.signal } : {}), ...(e.value ? { value: e.value } : {}),
    variationPracticed: Boolean(e.variation_practiced), ...(e.note ? { note: e.note } : {}),
    ...(e.agreement_change ? { agreementChange: e.agreement_change } : {}), decidedAt: e.decided_at,
  })),
});

/** What household_development_decide receives. Only fields the decision may change are sent. */
export function decisionToDb(
  record: { id: string; memberId: string; skillId: string; title: string } | DevelopmentRecord,
  input: DecisionInput,
  libraryVersion: number,
  isNew: boolean,
): Record<string, unknown> {
  const p: Record<string, unknown> = { id: record.id, decision: input.decision, library_version: libraryVersion };
  if (isNew) Object.assign(p, { member_id: record.memberId, skill_id: record.skillId, title: (input.title ?? record.title).trim() });
  if (input.stage) p.stage = input.stage;
  if (input.decision === 'modify' && input.title !== undefined) p.title = input.title.trim();
  if ((isNew || input.decision === 'modify' || input.decision === 'resume') && input.cue !== undefined) p.cue = input.cue.trim();
  if ((isNew || input.decision === 'modify' || input.decision === 'resume') && input.finish !== undefined) p.finish = input.finish.trim();
  if (input.note !== undefined) p.note = input.note.trim();
  if (input.check) p.check = { signal: input.check.signal, value: input.check.value, variation: Boolean(input.check.variation) };
  if (input.category && (isNew || ['resume', 'restore', 'modify'].includes(input.decision))) p.category = input.category;
  if (input.agreementId && NEEDS_AGREEMENT_ID.includes(input.decision)) p.agreement_id = input.agreementId;
  return p;
}

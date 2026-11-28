/**
 * Continuous learning from the behavioral log (docs/intelligence/STAGE_B_REPORT.md → Learning).
 *
 * learn(signals, memories, now) → the memory rows to apply (intel_private.memory_apply). Pure and deterministic, so
 * the engine, the Household Intelligence Lab and the tests all get the same answer from the same history.
 *
 * Not limited to fixed categories: every learning signal is grouped by what it's about (kind × subject × visibility)
 * and EVERY group is tested for recurrence. A pattern nobody anticipated (say, the family always adds a plan on the
 * last Sunday of the month) becomes a tentative, then observed, belief if the evidence holds, with no code written for
 * it. Quality and privacy gates apply to all of them:
 *   - evidence: the cadence's minimum days and cycles, regularity ≥ 0.6, confidence ≥ 0.6 to be "observed"
 *   - privacy: signals from a personal calendar only ever produce memory visible to that same adult; nothing private
 *     is pooled with household signals; per-adult timing is visible only to that adult
 *   - no self-reinforcement: the engine's own outputs (rec_presented, memory_*) are never learned from
 *   - observed ≠ agreed: who actually did something is recorded apart from the family's agreement, and is never
 *     turned into an assignment
 *   - absence is not neglect: missing days never become negative evidence; only behavior that contradicts the
 *     pattern (it happened, but differently) does
 * Confirmed memories are not recomputed (the family's word stands); forgotten ones only return from evidence after
 * they were forgotten; statistical beliefs that are no longer recomputed retire after their review date.
 */
import { REVIEW_DAYS, addDays, daysBetween, detectCadence, fitsAnchor, meetsEvidence, type Cadence, type CadenceResult } from './cadence';
import { confidenceOf, identity, keyOf, reviewAfter, statusOf, type EvidenceRef, type MemoryCategory, type MemoryRecord, type MemoryUpsert } from './memory';
import type { Signal, SignalKind } from './signals';

/** Signals the engine never learns from (its own outputs, or moments with no subject). */
const NOT_LEARNED: SignalKind[] = ['rec_presented', 'memory_confirmed', 'memory_corrected', 'memory_forgotten'];
const CATEGORY_FOR: Partial<Record<SignalKind, MemoryCategory>> = {
  task_done: 'routine', handoff_covered: 'collaboration', event_occurred: 'occasion', intent_chosen: 'preference', request_asked: 'collaboration',
  priority_chosen: 'pattern', report_made: 'pattern', agreement_changed: 'responsibility',
};
const PERIOD: Record<Cadence, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 31, seasonal: 92, annual: 366, irregular: 30 };

export interface LearnInput {
  now: string;
  signals: Signal[];
  memories: MemoryRecord[];
  /** The family's agreements: who they AGREED owns what (agreement id → owner member ids). */
  agreements?: Record<string, string[]>;
  /** Adult member ids (for load balance across adults). */
  adults?: string[];
}

const evidence = (s: Signal, polarity: 1 | -1): EvidenceRef => ({ ...(s.id ? { signal_id: s.id } : { ref: keyOf(s.kind, s.subject_ref, s.local_day) }), polarity, at: s.at });

export function learn(inp: LearnInput): MemoryUpsert[] {
  const { now } = inp;
  const existing = new Map(inp.memories.map((m) => [identity(m), m]));
  const out: MemoryUpsert[] = [];
  const emit = (u: MemoryUpsert) => {
    const prev = existing.get(identity(u));
    if (prev?.status === 'confirmed') return; // the family's word stands; the database records the counts
    out.push(u);
  };
  const forgottenAt = (id: string) => existing.get(id)?.status === 'forgotten' ? existing.get(id)!.forgotten_at ?? null : null;

  // ------------------------------------------------------------ 1. recurrence of anything (discovery)
  const groups = new Map<string, Signal[]>();
  for (const s of inp.signals) {
    if (!s.subject_ref || NOT_LEARNED.includes(s.kind) || s.kind.startsWith('app_') || s.kind === 'rec_response' || s.kind === 'intent_chosen') continue; // choices: section 4
    const g = `${s.kind}|${s.subject_kind}|${s.subject_ref}|${s.visible_to ?? '-'}`;
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(s);
  }
  for (const [g, list] of groups) {
    const [kind, sk, ref, vis] = g.split('|') as [SignalKind, string, string, string];
    const category: MemoryCategory = CATEGORY_FOR[kind] ?? 'pattern';
    const subject_key = keyOf(kind.replace(/_/g, '-'), sk, ref);
    const visible_to = vis === '-' ? null : vis;
    const id = identity({ category, subject_key, member_id: null, visible_to });
    const since = forgottenAt(id);
    const usable = list.filter((s) => !since || s.at > since).sort((a, b) => a.local_day.localeCompare(b.local_day));
    if (usable.length < 2) continue;
    const u = recurrence(usable, now, existing.get(id));
    if (!u) continue;
    emit({ category, subject_key, member_id: null, visible_to, source: 'stats', ...u });
  }

  // ------------------------------------------------------------ 2. who actually does it (observed, never assigned)
  const byOwner = new Map<string, Signal[]>();
  for (const s of inp.signals) {
    if (s.kind !== 'task_done' || !s.subject_ref || !s.member_id || s.visible_to) continue;
    if (daysBetween(s.local_day, now) > 56) continue;
    (byOwner.get(s.subject_ref) ?? byOwner.set(s.subject_ref, []).get(s.subject_ref)!).push(s);
  }
  for (const [ref, list] of byOwner) {
    if (list.length < 4) continue;
    const counts = new Map<string, number>();
    for (const s of list) counts.set(s.member_id!, (counts.get(s.member_id!) ?? 0) + 1);
    const [who, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
    const share = n / list.length;
    const agreed = inp.agreements?.[ref] ?? null;
    const subject_key = keyOf('owner', ref);
    const last = list.map((s) => s.local_day).sort().pop()!;
    const weeks = new Set(list.map((s) => Math.floor(daysBetween('2000-01-03', s.local_day) / 7))).size;
    const others = list.length - n;
    const confidence = Math.round(((n + 1) / (list.length + 2)) * 100) / 100;
    const status = share >= 0.7 && weeks >= 3 && confidence >= 0.6 ? 'observed' : 'tentative';
    // One belief per chore (member_id null): who does it is content, so a new doer replaces the old belief instead of
    // leaving a stale one beside it.
    emit({ category: 'collaboration', subject_key, member_id: null, visible_to: null, source: 'stats', cadence: 'weekly',
      content: { observed_owner: who, share: Math.round(share * 100) / 100, agreed_owners: agreed, differs_from_agreement: agreed ? !agreed.includes(who) : null },
      status, confidence, support: n, contradict: others, first_seen: list.map((s) => s.local_day).sort()[0], last_seen: last,
      review_after: reviewAfter(last, 'weekly'), evidence: list.slice(-10).map((s) => evidence(s, s.member_id === who ? 1 : -1)) });
  }
  // Load across adults: one adult doing most of the household's recorded work for four weeks → a meeting question.
  if (inp.adults && inp.adults.length > 1) {
    const recent = inp.signals.filter((s) => s.kind === 'task_done' && s.member_id && inp.adults!.includes(s.member_id) && !s.visible_to && daysBetween(s.local_day, now) <= 28);
    if (recent.length >= 8) {
      const counts = new Map<string, number>();
      for (const s of recent) counts.set(s.member_id!, (counts.get(s.member_id!) ?? 0) + 1);
      const [who, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
      const share = n / recent.length;
      if (share >= 0.75) {
        const last = recent.map((s) => s.local_day).sort().pop()!;
        emit({ category: 'collaboration', subject_key: 'load:adults', member_id: null, visible_to: null, source: 'stats', cadence: 'weekly',
          content: { carries_most: who, share: Math.round(share * 100) / 100, suggest: 'meeting-question' },
          status: 'observed', confidence: Math.round(share * 100) / 100, support: n, contradict: recent.length - n,
          first_seen: recent.map((s) => s.local_day).sort()[0], last_seen: last, review_after: reviewAfter(last, 'weekly'), evidence: [] });
      }
    }
  }

  // ------------------------------------------------------------ 3. when each adult uses the app (theirs alone)
  const opens = new Map<string, Signal[]>();
  for (const s of inp.signals) if (s.kind === 'app_open' && s.user_id && daysBetween(s.local_day, now) <= 28) (opens.get(s.user_id) ?? opens.set(s.user_id, []).get(s.user_id)!).push(s);
  for (const [uid, list] of opens) {
    if (list.length < 8) continue;
    const band = usageBand(list.map((s) => s.local_hour));
    const last = list.map((s) => s.local_day).sort().pop()!;
    emit({ category: 'timing', subject_key: 'opens', member_id: null, visible_to: uid, source: 'stats', cadence: 'daily',
      content: { from_hour: band.from, to_hour: band.to, share: band.share }, status: band.share >= 0.7 ? 'observed' : 'tentative',
      confidence: band.share, support: list.length, contradict: 0, first_seen: list.map((s) => s.local_day).sort()[0], last_seen: last,
      review_after: addDays(last, 28), evidence: [] });
  }

  // ------------------------------------------------------------ 4. preferences from what the family chose and said
  const choices = new Map<string, Signal[]>();
  for (const s of inp.signals) {
    if (!s.subject_ref || !s.value) continue;
    if (s.kind !== 'intent_chosen' && s.kind !== 'rec_response') continue;
    const g = `${s.kind}|${s.subject_ref}|${s.visible_to ?? '-'}`;
    (choices.get(g) ?? choices.set(g, []).get(g)!).push(s);
  }
  for (const [g, list0] of choices) {
    const [kind, ref, vis] = g.split('|');
    const visible_to = vis === '-' ? null : vis;
    const subject_key = keyOf(kind === 'intent_chosen' ? 'choice' : 'response', ref);
    const id = identity({ category: 'preference', subject_key, member_id: null, visible_to });
    const since = forgottenAt(id);
    const list = list0.filter((s) => !since || s.at > since).sort((a, b) => a.at.localeCompare(b.at));
    if (!list.length) continue;
    const counts = new Map<string, number>();
    for (const s of list) counts.set(s.value!, (counts.get(s.value!) ?? 0) + 1);
    const [value, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
    // Dismissals mean different things: only "already handled" (twice) and "not relevant" teach a preference; a plain
    // dismiss, "later" or a one-off teaches nothing lasting.
    if (kind === 'rec_response' && !['already-handled', 'not-relevant', 'never'].includes(value)) continue;
    const minN = kind === 'rec_response' && value === 'already-handled' ? 2 : kind === 'rec_response' ? 1 : 2;
    const lastSame = list.filter((s) => s.value === value).pop()!;
    const after = list.filter((s) => s.at > lastSame.at && s.value !== value).length; // the latest choices that differ
    const confidence = Math.round(((n + 1) / (list.length + 2)) * 100) / 100;
    const status = n >= minN && confidence >= 0.6 && after < 2 ? 'observed' : after >= 2 ? 'retired' : 'tentative';
    emit({ category: 'preference', subject_key, member_id: null, visible_to, source: 'stats', cadence: null,
      content: kind === 'intent_chosen' ? { choice: value } : { response: value },
      status, confidence, support: n, contradict: list.length - n, first_seen: list[0].local_day, last_seen: list[list.length - 1].local_day,
      review_after: addDays(list[list.length - 1].local_day, kind === 'intent_chosen' ? 400 : 180),
      evidence: list.slice(-10).map((s) => evidence(s, s.value === value ? 1 : -1)) });
  }

  // ------------------------------------------------------------ 5. beliefs no longer recomputed are reconsidered
  // A statistical belief whose evidence has aged out (or stopped) is never left standing: once past its review date it
  // is retired. (Family-confirmed memory is untouched; it lasts until the family changes it.)
  const touched = new Set(out.map(identity));
  for (const m of inp.memories) {
    if (m.source !== 'stats' || (m.status !== 'observed' && m.status !== 'tentative') || touched.has(identity(m))) continue;
    if (!m.review_after || m.review_after.slice(0, 10) >= now) continue;
    out.push({ ...m, status: 'retired', confidence: Math.min(m.confidence, 0.2), evidence: [] });
  }
  return out;
}

/**
 * A recurring pattern from one subject's history: the established anchor, or a NEW anchor when recent behavior has
 * consistently moved (the routine changed), with the old one kept as `previous_anchor`.
 */
function recurrence(list: Signal[], now: string, prev: MemoryRecord | undefined): Omit<MemoryUpsert, 'category' | 'subject_key' | 'member_id' | 'visible_to' | 'source'> | null {
  const days = list.map((s) => s.local_day);
  const overall = detectCadence(days);
  let pick: CadenceResult = overall;
  // Recent behavior over about four cycles of the overall (or previous) cadence.
  const cad = overall.cadence !== 'irregular' ? overall.cadence : (prev?.cadence ?? 'irregular');
  if (cad !== 'irregular') {
    const recentDays = days.filter((d) => daysBetween(d, now) <= PERIOD[cad] * 4 + 2);
    const recent = detectCadence(recentDays);
    if (meetsEvidence(recent) && recent.cadence === cad && (overall.cadence === 'irregular' || recent.anchor !== overall.anchor)) pick = { ...recent, support: recent.support };
    // What happened since the established pattern last held? A routine that moved shows up here even when the new day
    // was skipped once or twice lately.
    else if (overall.cadence !== 'irregular') {
      const lastFit = days.filter((d) => fitsAnchor(overall, d)).pop();
      const tail = lastFit ? days.filter((d) => d > lastFit) : [];
      const since = detectCadence(tail);
      if (meetsEvidence(since) && since.anchor !== overall.anchor && since.regularity >= 0.6) pick = since;
    }
  }
  if (pick.cadence === 'irregular') {
    // An earlier belief that no longer holds weakens (and retires once unseen past its window).
    if (!prev || prev.status === 'retired' || prev.status === 'forgotten' || !prev.cadence || prev.cadence === 'irregular') return null;
    const last = days[days.length - 1];
    const contradict = days.filter((d) => !fitsAnchor({ cadence: prev.cadence!, anchor: String(prev.content.anchor ?? '') }, d) && (!prev.last_seen || d > prev.last_seen)).length;
    const confidence = Math.max(0, Math.round((prev.confidence - 0.15 * contradict) * 100) / 100);
    return { cadence: prev.cadence, content: prev.content, status: confidence < 0.3 ? 'retired' : 'tentative', confidence, support: prev.support,
      contradict: prev.contradict + contradict, first_seen: prev.first_seen, last_seen: last, review_after: reviewAfter(last, prev.cadence), evidence: [] };
  }
  const anchor = { cadence: pick.cadence, anchor: pick.anchor };
  const window = REVIEW_DAYS[pick.cadence] * 2;
  const fitting = list.filter((s) => fitsAnchor(anchor, s.local_day));
  const contra = list.filter((s) => !fitsAnchor(anchor, s.local_day) && daysBetween(s.local_day, now) <= window);
  const recentContra = contra.filter((s) => daysBetween(s.local_day, now) <= PERIOD[pick.cadence] * 4 + 2).length;
  const last = fitting.length ? fitting[fitting.length - 1].local_day : days[days.length - 1];
  const support = fitting.length;
  const confidence = confidenceOf({ support, contradict: contra.length, regularity: pick.regularity, last, now, cadence: pick.cadence });
  const cycles = pick.cycles;
  const status = statusOf({ cadence: pick.cadence, support, cycles, confidence, last, now, recentContradictions: recentContra, was: prev?.status });
  const previous = prev?.content?.anchor != null && String(prev.content.anchor) !== String(pick.anchor) && prev.cadence === pick.cadence ? prev.content.anchor : (prev?.content?.previous_anchor ?? null);
  return {
    cadence: pick.cadence, content: { anchor: pick.anchor, regularity: Math.round(pick.regularity * 100) / 100, next: pick.next, ...(previous != null ? { previous_anchor: previous } : {}) },
    status, confidence, support, contradict: contra.length, first_seen: days[0], last_seen: last, review_after: reviewAfter(last, pick.cadence),
    evidence: [...fitting.slice(-8).map((s) => evidence(s, 1)), ...contra.slice(-4).map((s) => evidence(s, -1))],
  };
}

/** The narrowest band of hours (wrapping midnight) holding at least 70% of opens; its share. */
export function usageBand(hours: number[]): { from: number; to: number; share: number } {
  const h = new Array(24).fill(0);
  for (const x of hours) h[x]++;
  const total = hours.length;
  for (let width = 1; width <= 24; width++) {
    let best = { from: 0, n: -1 };
    for (let from = 0; from < 24; from++) {
      let n = 0;
      for (let i = 0; i < width; i++) n += h[(from + i) % 24];
      if (n > best.n) best = { from, n };
    }
    if (best.n / total >= 0.7) return { from: best.from, to: (best.from + width) % 24, share: Math.round((best.n / total) * 100) / 100 };
  }
  return { from: 0, to: 0, share: 1 };
}

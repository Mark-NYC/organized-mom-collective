/**
 * The Household Intelligence Lab's core (docs/intelligence/STAGE_B_REPORT.md → Lab): replay a household's history day
 * by day, apply the family's own actions (confirm, forget, settings), run the real learner on a schedule, and keep the
 * memory exactly as the database would (intel_private.memory_apply's rules, mirrored here and kept in step by tests).
 *
 * Synthetic or exported histories only. Nothing here talks to a network or an AI provider.
 */
import { addDays } from './cadence';
import { learn } from './learn';
import { identity, type MemoryRecord, type MemoryUpsert } from './memory';
import { isLearning, type Signal } from './signals';
import type { Expectation, FamilyAction, SyntheticHousehold } from './synthetic';

export interface LabSnapshot { day: string; counts: Record<string, number>; applied: number; skipped: number }
export interface LabResult { memories: MemoryRecord[]; recorded: Signal[]; dropped: number; timeline: LabSnapshot[] }

interface Settings { learning: boolean; personal: Set<string> }

/** memory_apply, mirrored: learning gate, personal-calendar consent, confirmed precedence, forgotten needs 2 new evidence. */
export function applyRows(mem: Map<string, MemoryRecord>, rows: MemoryUpsert[], st: Settings): { applied: number; skipped: number } {
  let applied = 0, skipped = 0;
  if (!st.learning) return { applied, skipped: rows.length };
  for (const r of rows) {
    if (r.visible_to && !st.personal.has(r.visible_to)) { skipped++; continue; }
    if (!['observed', 'tentative', 'temporary', 'retired'].includes(r.status) || !['rules', 'stats', 'model'].includes(r.source)) { skipped++; continue; }
    const id = identity(r);
    const cur = mem.get(id);
    if (cur?.status === 'forgotten') {
      const fresh = r.evidence.filter((e) => e.polarity === 1 && cur.forgotten_at && e.at > cur.forgotten_at).length;
      if (fresh < 2) { skipped++; continue; }
    }
    if (cur?.status === 'confirmed') {
      mem.set(id, { ...cur, support: Math.max(cur.support, r.support), contradict: r.contradict, last_seen: [cur.last_seen, r.last_seen].filter(Boolean).sort().pop() ?? null });
    } else {
      const { evidence: _e, ...row } = r;
      mem.set(id, { ...row, first_seen: cur?.first_seen ?? r.first_seen, forgotten_at: null });
    }
    applied++;
  }
  return { applied, skipped };
}

/** Would household_signal_log keep this signal under these settings? */
const keeps = (s: Signal, st: Settings) => !isLearning(s.kind) || (st.learning && (!s.visible_to || st.personal.has(s.visible_to)));

export function runLab(h: SyntheticHousehold, opts: { stepDays?: number; until?: string } = {}): LabResult {
  const step = opts.stepDays ?? 7;
  const until = opts.until ?? h.end;
  const st: Settings = { learning: true, personal: new Set(h.adults.map((a) => a.user).filter((u): u is string => !!u)) };
  const mem = new Map<string, MemoryRecord>();
  const recorded: Signal[] = [];
  const timeline: LabSnapshot[] = [];
  let dropped = 0, si = 0;
  const byDay = [...h.signals].sort((a, b) => a.local_day.localeCompare(b.local_day) || a.at.localeCompare(b.at));
  const acts = [...h.actions].sort((a, b) => a.day.localeCompare(b.day));
  let ai = 0;
  const firstDay = byDay[0]?.local_day && byDay[0].local_day < h.start ? byDay[0].local_day : h.start;
  for (let day = firstDay, k = 0; day <= until; day = addDays(day, 1), k++) {
    while (ai < acts.length && acts[ai].day <= day) act(acts[ai++], mem, st, recorded);
    while (si < byDay.length && byDay[si].local_day <= day) { const s = byDay[si++]; if (keeps(s, st)) recorded.push(s); else dropped++; }
    if (day >= h.start && (k % step === 0 || day === until)) {
      const rows = learn({ now: day, signals: recorded, memories: [...mem.values()], agreements: h.agreements, adults: h.adults.length > 1 ? h.adults.map((a) => a.id) : undefined });
      const res = applyRows(mem, rows, st);
      const counts: Record<string, number> = {};
      for (const m of mem.values()) counts[m.status] = (counts[m.status] ?? 0) + 1;
      timeline.push({ day, counts, ...res });
    }
  }
  return { memories: [...mem.values()], recorded, dropped, timeline };
}

function act(a: FamilyAction, mem: Map<string, MemoryRecord>, st: Settings, recorded: Signal[]) {
  switch (a.type) {
    case 'confirm': {
      const id = identity({ category: a.category as MemoryRecord['category'], subject_key: a.subject_key, member_id: null, visible_to: null });
      const cur = mem.get(id);
      mem.set(id, { ...(cur ?? { member_id: null, visible_to: null, support: 0, contradict: 0, first_seen: a.day, last_seen: a.day, review_after: null, confidence: 1 }),
        category: a.category as MemoryRecord['category'], subject_key: a.subject_key, content: a.content, status: 'confirmed', source: 'family',
        cadence: (a.cadence ?? null) as MemoryRecord['cadence'], confidence: 1, forgotten_at: null });
      break;
    }
    case 'forget': {
      for (const [id, m] of mem) if (m.category === a.category && m.subject_key === a.subject_key && (a.visible_to === undefined || m.visible_to === a.visible_to))
        mem.set(id, { ...m, status: 'forgotten', content: {}, forgotten_at: `${a.day}T23:59:59Z` });
      if (![...mem.values()].some((m) => m.subject_key === a.subject_key)) // forgetting before it was learned still blocks it
        mem.set(identity({ category: a.category as MemoryRecord['category'], subject_key: a.subject_key, member_id: null, visible_to: a.visible_to ?? null }),
          { category: a.category as MemoryRecord['category'], subject_key: a.subject_key, member_id: null, visible_to: a.visible_to ?? null, content: {}, status: 'forgotten', source: 'family',
            cadence: null, confidence: 0, support: 0, contradict: 0, first_seen: null, last_seen: null, review_after: null, forgotten_at: `${a.day}T23:59:59Z` });
      break;
    }
    case 'learning': st.learning = a.enabled; break;
    case 'personal-calendars': {
      if (a.enabled) { st.personal.add(a.user); break; }
      st.personal.delete(a.user);
      for (const [id, m] of mem) if (m.visible_to === a.user) mem.delete(id);
      for (let i = recorded.length - 1; i >= 0; i--) if (recorded[i].visible_to === a.user) recorded.splice(i, 1);
      break;
    }
  }
}

export interface Verdict { household: string; scenario: string; expectation: Expectation; pass: boolean; got: string }

/** Score a finished Lab run against the scenarios' ground truth. */
export function evaluate(h: SyntheticHousehold, memories: MemoryRecord[]): Verdict[] {
  const out: Verdict[] = [];
  for (const sc of h.scenarios) for (const e of sc.expect) {
    const m = memories.find((x) => x.category === e.category && x.subject_key === e.subject_key && (e.visible_to === undefined || (x.visible_to ?? null) === e.visible_to)
      && (e.member_id === undefined || (x.member_id ?? null) === e.member_id));
    const status = m ? m.status : 'absent';
    let pass = e.status.includes(status as never) || (e.status.includes('absent') && (status === 'retired' || status === 'forgotten'));
    if (pass && m && e.cadence && m.status !== 'confirmed' && m.cadence !== e.cadence) pass = false;
    if (pass && m && e.anchor != null && String(m.content.anchor) !== e.anchor) pass = false;
    if (pass && m && e.content) for (const [k, v] of Object.entries(e.content)) if (JSON.stringify(m.content[k]) !== JSON.stringify(v)) pass = false;
    out.push({ household: h.id, scenario: sc.kind, expectation: e, pass,
      got: m ? `${m.status} ${m.cadence ?? ''} ${JSON.stringify(m.content)} conf=${m.confidence}` : 'absent' });
  }
  return out;
}

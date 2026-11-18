/**
 * "How did it go?" at the start of Let's Talk: the follow-through on what the family agreed, from its second week
 * (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §7). The rules are the Club's existing ones (src/lib/club/family-plan.ts):
 * three answers (On my own · Needs reminders · Struggling), an optional "what gets in the way" after struggling mapped
 * to one habit lever (BARRIER_PRINCIPLE) and one small adjustment, success celebrated with no new work added.
 * "We're done with this" is the agreement's existing remove (Who does what), not a fourth answer here.
 *
 * Stored per agreement by household_agreement_check_in / read by household_follow_through
 * (supabase/migrations/20261204000000_agreement_follow_through.sql), either adult of the household. Until that
 * migration is applied the read fails and this renders nothing: the meeting works exactly as before.
 * Check-ins need a connection (they're a moment in the meeting, not a background edit).
 */
import { useCallback, useEffect, useState } from 'react';
import { accountRpc, getSession } from '../../lib/account';
import { isDemo } from '../../lib/calendar/client';
import type { FamilyProfile } from '../../lib/club/family-profile';
import type { Household } from '../../lib/club/profile';
import { BARRIER_PRINCIPLE, nextStep, weeklyCheckInDue, type CheckInAnswer, type CheckInBarrier } from '../../lib/club/family-plan';
import { Avatar } from '../app/ui';
import type { MarkerColor } from '../../data/club/family-colors';

export interface FollowThroughRow { id: string; revision: number; progress: 'practicing' | 'improving' | 'independent' | 'struggling' | null; checked_on: string | null; barrier: CheckInBarrier | null }

const ANSWERS: { id: Exclude<CheckInAnswer, 'moved-on'>; label: string }[] = [
  { id: 'on-own', label: 'On my own' },
  { id: 'reminders', label: 'Needs reminders' },
  { id: 'struggling', label: 'Struggling' },
];
const BARRIERS: { id: CheckInBarrier; label: string }[] = [
  { id: 'forgets', label: 'Forgets' },
  { id: 'too-hard', label: 'Too hard yet' },
  { id: 'not-set-up', label: 'Things aren’t set up' },
  { id: 'not-interested', label: 'Not interested' },
  { id: 'schedule', label: 'The schedule gets in the way' },
  { id: 'other', label: 'Something else' },
];
/** One small adjustment per habit lever (the January guide's wording where it already says it). */
const ADJUSTMENT: Record<string, string> = {
  trigger: 'Tie it to something that already happens every day.',
  simplicity: 'Start with one step of it instead of the whole thing.',
  environment: 'Set up what it needs where it happens, so it’s ready before it’s needed.',
  ownership: 'Let them choose how to do it, from two ways that fit their age.',
  stacking: 'Move it right after something that happens every day, at a time that works.',
  consistency: 'Keep the same time and place for a week before changing anything else.',
};

/** The household's follow-through, or null while unavailable (signed out, sample family, migration not applied). */
export function useFollowThrough() {
  const [rows, setRows] = useState<FollowThroughRow[] | null>(null);
  const load = useCallback(async () => {
    if (isDemo() || !(await getSession())) return setRows(null);
    try { setRows(await accountRpc<FollowThroughRow[]>('household_follow_through')); } catch { setRows(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { rows, reload: load, setRows };
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function FollowThrough({ household, profile, colors }: { household: Household | null; profile: FamilyProfile | null; colors: Record<string, MarkerColor> }) {
  const ft = useFollowThrough();
  const [open, setOpen] = useState<Record<string, { answer?: CheckInAnswer; saved?: boolean; error?: string }>>({});
  if (!ft.rows || !household || !profile) return null;
  const today = iso(new Date());
  const byId = new Map(ft.rows.map((r) => [r.id, r]));
  const people = new Map(household.members.map((m) => [m.id, m.firstName]));
  const agreements = profile.responsibilities.filter((r) => r.status === 'confirmed' && r.id && r.agreement && byId.has(r.id));
  const due = agreements.filter((r) => {
    const f = byId.get(r.id!)!;
    const since = (r.agreement!.agreedAt ?? '').slice(0, 10);
    return Boolean(since) && (open[r.id!] || weeklyCheckInDue({ since, progress: f.progress ?? 'practicing', ...(f.checked_on ? { lastCheckedOn: f.checked_on } : {}) }, today));
  }).slice(0, 4);
  const owned = agreements.filter((r) => byId.get(r.id!)!.progress === 'independent' && !open[r.id!]);
  if (!due.length && !owned.length) return null;

  const answer = async (id: string, a: Exclude<CheckInAnswer, 'moved-on'>, barrier: CheckInBarrier | null = null) => {
    const f = byId.get(id)!;
    try {
      const row = await accountRpc<FollowThroughRow>('household_agreement_check_in', { p_id: id, p_answer: a, p_barrier: barrier, p_base: f.revision });
      ft.setRows((rows) => rows?.map((r) => (r.id === id ? row : r)) ?? null);
      setOpen((o) => ({ ...o, [id]: { answer: a, saved: true } }));
    } catch (e) {
      const conflict = e instanceof Error && /conflict/.test(e.message);
      if (conflict) void ft.reload();
      setOpen((o) => ({ ...o, [id]: { answer: a, error: conflict ? 'The other grown-up just answered this one. Here’s theirs.' : 'Couldn’t save that. Check-ins need a connection.' } }));
    }
  };

  return (
    <div className="space-y-3" data-follow-through>
      {due.length > 0 && <p className="of-eyebrow">How did it go?</p>}
      {due.map((r) => {
        const id = r.id!;
        const names = r.ownerIds.map((o) => people.get(o) ?? '').filter(Boolean);
        const st = open[id];
        const step = st?.answer && st.answer !== 'moved-on' ? nextStep({ answer: st.answer, ...(byId.get(id)?.barrier ? { barrier: byId.get(id)!.barrier! } : {}) }) : null;
        return (
          <div key={id} className="rounded-[9px] border border-[var(--of-rule)] px-3 py-3" data-check-in={r.agreement!.text}>
            <div className="flex items-center gap-2.5">
              {r.ownerIds.slice(0, 2).map((o) => <Avatar key={o} name={people.get(o) ?? '?'} color={colors[o]} size="sm" />)}
              <p className="min-w-0 text-[0.92rem]"><strong>{names.join(' & ')}</strong> · {r.agreement!.text}</p>
            </div>
            {!st?.saved ? (
              <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={`How did it go for ${names.join(' and ')}?`}>
                {ANSWERS.map((a) => <button key={a.id} type="button" className="min-h-[44px] rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.82rem] font-semibold" onClick={() => void answer(id, a.id)} data-check-in-answer={a.id}>{a.label}</button>)}
              </div>
            ) : st.answer === 'on-own' ? (
              <p className="mt-2 text-[0.9rem] text-[var(--of-sage-ink)]" role="status" data-check-in-result="celebrate">{names.join(' & ')} {names.length > 1 ? 'own' : 'owns'} it now. Say so out loud. Nothing new gets added for it.</p>
            ) : st.answer === 'reminders' ? (
              <p className="mt-2 text-[0.9rem]" role="status" data-check-in-result="continue">Keep practicing. A little less reminding each week is progress.</p>
            ) : (
              <div className="mt-2" data-check-in-result="adjust">
                <p className="text-[0.9rem]">What gets in the way? <span className="text-warm-soft">Optional</span></p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BARRIERS.map((b) => <button key={b.id} type="button" aria-pressed={byId.get(id)?.barrier === b.id} className={`min-h-[44px] rounded-[8px] border px-3 text-[0.82rem] ${byId.get(id)?.barrier === b.id ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`} onClick={() => void answer(id, 'struggling', b.id)} data-check-in-barrier={b.id}>{b.label}</button>)}
                </div>
                {step?.kind === 'adjust' && step.principle && <p className="mt-3 rounded-[9px] bg-[var(--of-surface)] px-3 py-2 text-[0.9rem]" data-check-in-adjustment>Try this week: {ADJUSTMENT[step.principle] ?? ADJUSTMENT[BARRIER_PRINCIPLE.other]}</p>}
              </div>
            )}
            {st?.error && <p role="alert" className="mt-2 text-sm">{st.error}</p>}
          </div>
        );
      })}
      {owned.length > 0 && (
        <p className="text-[0.88rem] text-warm-soft" data-follow-through-owned>On their own now: {owned.slice(0, 4).map((r) => `${r.ownerIds.map((o) => people.get(o)).filter(Boolean).join(' & ')} (${r.agreement!.text})`).join(' · ')}</p>
      )}
    </div>
  );
}

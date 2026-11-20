/**
 * Club personalization inside the weekly Family Meeting: what each child is learning, one next step each
 * (docs/product/FAMILY_DEVELOPMENT_ENGINE.md). Three small pieces, one per meeting part, all reading one plan that
 * WeeklyMeeting keeps for the whole meeting (src/lib/family-development/meeting-plan.ts), so answering a question
 * never reshuffles the rest of the meeting:
 *
 *   Let's Talk       DevelopmentCheckIns   "How's it going?" for a skill the family is already working on.
 *   Everyone's Part  DevelopmentNextSteps  stage coaching and the family's choice (stay, next step, easier, pause),
 *                                          or one new skill to agree on (We agreed · Not now · Not for us).
 *   Let's Practice   DevelopmentPractice   one thing to show or do together right now.
 *
 * Nothing is saved without a tap, and "Saved" is shown only after the database answered: the record and the family
 * agreement are one transaction there. A failed save says so and the same button retries safely (same ids). The
 * agreement the database returns goes straight onto this phone's lists (onAgreement). Nothing advances on its own.
 * Club families only (WeeklyMeeting checks club_me; the database checks again on every write).
 */
import { useEffect, useRef, useState } from 'react';
import { MAWL_STAGES, type MawlStage } from '../../lib/family-development/framework';
import { HAND_OVER_LABEL, LAUNCH_CONFIRMATION, MAWL_LABEL, WATCH_DISTINCTION, advanceLabel, stepBackLabel } from '../../lib/family-development/language';
import type { CheckInStep, DevelopmentPlan, SuggestStep } from '../../lib/family-development/engine';
import { responsibilityCategoryOf } from '../../lib/family-development/engine';
import type { CheckValue, DbAgreement, DecisionInput, DevelopmentDecision, DevelopmentRecord } from '../../lib/family-development/records';
import type { DecideError, DecideResult } from '../../lib/family-development/client';
import { newRecordId } from '../../lib/family-development/client';
import type { MarkerColor } from '../../data/club/family-colors';
import { Avatar } from '../app/ui';

/** MAWL in a parent's words: the approved terms, one source (src/lib/family-development/language.ts). */
export const STAGE_LABEL = MAWL_LABEL;
/** Where a child starts with a new skill: the same four terms, Model first. */
const START_STAGES: { stage: MawlStage; label: string }[] = MAWL_STAGES.map((stage) => ({ stage, label: MAWL_LABEL[stage] }));
export const ERROR_TEXT: Record<DecideError, string> = {
  conflict: 'The other grown-up just changed this. Here’s the latest.',
  club_required: 'This part of the meeting is for Family Meeting Club members.',
  offline: 'Not saved: we couldn’t reach your family’s account. Check the connection and tap again.',
  invalid: 'That change couldn’t be saved.',
  exists: 'Your family already decided on this one. Here’s the latest.',
  signed_out: 'Not saved: sign in again to save your family’s decisions.',
  too_many: 'Not saved: your family has a lot of agreements already. Remove one in Who does what first.',
};

export interface CoachProps {
  plan: DevelopmentPlan;
  /** Live records by id (the plan holds the copy from when the meeting opened). */
  live: Map<string, DevelopmentRecord>;
  decide: (target: DevelopmentRecord | { id: string; memberId: string; skillId: string; title: string }, input: DecisionInput) => Promise<DecideResult>;
  colors: Record<string, MarkerColor>;
  /** The agreement the database saved or removed with a decision: onto this phone's lists at once. */
  onAgreement?: (row: DbAgreement) => void;
  /** A write was refused for lack of Club access: the meeting drops the paid layer. */
  onAccessLost?: () => void;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Saving state for one card: one request at a time, and focus moves to the result for screen readers. */
function useSave(onAccessLost?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const result = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (done || error) result.current?.focus(); }, [done, error]);
  const run = async (f: () => Promise<DecideResult>, ok: (r: Extract<DecideResult, { ok: true }>) => string) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await f();
      if (r.ok) setDone(ok(r));
      else {
        setError(ERROR_TEXT[r.error]);
        if (r.error === 'club_required') onAccessLost?.();
      }
    } finally { setBusy(false); }
  };
  return { busy, error, done, result, run };
}

function Result({ s }: { s: ReturnType<typeof useSave> }) {
  if (s.done) return <p ref={s.result} tabIndex={-1} role="status" className="mt-3 text-sm text-[var(--of-sage-ink)] outline-none" data-development-saved>{s.done}</p>;
  if (s.error) return <p ref={s.result} tabIndex={-1} role="alert" className="mt-2 text-sm outline-none" data-development-error>{s.error}</p>;
  return null;
}

// ------------------------------------------------------------------ Let's Talk

function CheckInCard({ step, firstName, color, live, decide, onAccessLost }: { step: CheckInStep; firstName: string; color?: MarkerColor } & Pick<CoachProps, 'live' | 'decide' | 'onAccessLost'>) {
  const id = step.record.id;
  const [variation, setVariation] = useState(false);
  const s = useSave(onAccessLost);
  const answer = (value: CheckValue) => s.run(
    () => decide(live.get(id) ?? step.record, { decision: 'check-in', check: { signal: step.question.signal, value, variation } }),
    () => 'Noted. More on this in Everyone’s Part.',
  );
  return (
    <div className="rounded-[9px] border border-[var(--of-rule)] px-3 py-3" data-development-check-in={step.record.skillId}>
      <div className="flex items-center gap-2.5">
        <Avatar name={firstName} color={color} size="sm" />
        <p className="min-w-0 text-[0.92rem]"><strong>{firstName}</strong> · {step.record.title} <span className="text-warm-soft">· {STAGE_LABEL[step.record.stage!]}</span></p>
      </div>
      <p className="mt-2 text-[0.95rem]" id={`dq-${id}`}>{step.question.text}</p>
      {!s.done && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-labelledby={`dq-${id}`} aria-busy={s.busy}>
            {step.question.answers.map((a) => (
              <button key={a.value} type="button" disabled={s.busy} className="min-h-[44px] rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.82rem] font-semibold disabled:opacity-60" onClick={() => void answer(a.value)} data-development-answer={a.value}>{a.label}</button>
            ))}
          </div>
          {step.record.stage === 'watch' && (
            <label className="mt-2 flex min-h-[44px] items-center gap-2 text-[0.85rem] text-warm-soft">
              <input type="checkbox" className="size-5" checked={variation} onChange={(e) => setVariation(e.target.checked)} data-development-variation />
              We tried it on a different kind of day
            </label>
          )}
        </>
      )}
      <Result s={s} />
    </div>
  );
}

export function DevelopmentCheckIns({ plan, live, decide, colors, onAccessLost }: CoachProps) {
  const steps = plan.people.filter((p) => p.step?.kind === 'check-in' && !(p.step as CheckInStep).agreementRemoved);
  if (!steps.length) return null;
  return (
    <div className="space-y-3" data-development-check-ins>
      <p className="of-eyebrow">What we’re working on</p>
      {steps.map((p) => <CheckInCard key={(p.step as CheckInStep).record.id} step={p.step as CheckInStep} firstName={p.firstName} color={colors[p.memberId]} live={live} decide={decide} onAccessLost={onAccessLost} />)}
    </div>
  );
}

// ------------------------------------------------------------------ Everyone's Part

function CheckInNext({ step, firstName, live, decide, onAgreement, onAccessLost }: { step: CheckInStep; firstName: string } & Pick<CoachProps, 'live' | 'decide' | 'onAgreement' | 'onAccessLost'>) {
  const rec = live.get(step.record.id) ?? step.record;
  const s = useSave(onAccessLost);
  const [editing, setEditing] = useState(false);
  const [cue, setCue] = useState(rec.cue ?? '');
  const [finish, setFinish] = useState(rec.finishLine ?? step.skill?.finishLine ?? '');
  // Kept for retries: tapping "Put it back" again after a failure never makes a second agreement.
  const [agreementId] = useState(newRecordId);
  const act = (decision: DevelopmentDecision, extra: Partial<DecisionInput> = {}) => s.run(
    () => decide(live.get(rec.id) ?? rec, { decision, ...extra }),
    (r) => {
      if (r.agreement) onAgreement?.(r.agreement);
      setEditing(false);
      const stage = r.record.stage ? `“${STAGE_LABEL[r.record.stage]}”` : '';
      switch (decision) {
        // Only after the database confirmed it: the confirmation is the family's Launch decision, saved.
        case 'advance': return r.record.status === 'launched' ? LAUNCH_CONFIRMATION : `Saved. Now: ${stage}.`;
        case 'step-back': return `Saved. Back to ${stage}.`;
        case 'pause': return 'Paused. It’s off everyone’s list until you bring it back.';
        case 'dismiss': return 'Set aside. It’s off the list, and we won’t suggest it again.';
        case 'modify': return 'Saved your words, here and on the list.';
        case 'restore': return 'Back on the list.';
        default: return 'Staying here this week.';
      }
    },
  );
  const stage = rec.stage!;
  if (step.agreementRemoved && rec.agreementLive === false) {
    return (
      <div data-development-next={rec.skillId} data-development-removed>
        <p className="text-[0.95rem]"><strong>{rec.title}</strong></p>
        <p className="mt-1 text-[0.9rem]">{step.why[0]}</p>
        {!s.done && (
          <div className="mt-3 flex flex-wrap gap-2" aria-busy={s.busy}>
            <button type="button" disabled={s.busy} className="of-btn !min-h-[44px]" onClick={() => void act('restore', { agreementId, category: rec.category })} data-development-decision="restore">Put it back on the list</button>
            <button type="button" disabled={s.busy} className="of-btn of-btn--soft !min-h-[44px]" onClick={() => void act('pause')} data-development-decision="pause">Pause it here too</button>
          </div>
        )}
        <Result s={s} />
      </div>
    );
  }
  const offers = step.decisions.filter((d) => d === 'stay' || d === 'step-back' || d === 'pause' || (d === 'advance' && rec.status === 'active'));
  return (
    <div data-development-next={rec.skillId}>
      <p className="text-[0.95rem]"><strong>{rec.title}</strong> <span className="text-warm-soft">· {STAGE_LABEL[stage]}</span></p>
      <p className="mt-1 text-[0.9rem] leading-relaxed">{step.coaching}</p>
      {step.watchVariation && <p className="mt-2 rounded-[9px] bg-[var(--of-surface)] px-3 py-2 text-[0.9rem]" data-development-variation-suggestion>Try a different kind of day: {step.watchVariation}</p>}
      {stage === 'watch' && <p className="mt-2 text-[0.85rem] text-warm-soft" data-development-watch-distinction>{WATCH_DISTINCTION}</p>}
      {step.hint && <p className="mt-2 text-[0.85rem] text-warm-soft" data-development-hint>{step.hint}</p>}
      {step.safety && <p className="mt-2 text-[0.8rem] text-warm-soft">{step.safety}</p>}
      {!s.done && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`What's next for ${firstName}: ${rec.title}`} aria-busy={s.busy}>
          {offers.map((d) => (
            <button key={d} type="button" disabled={s.busy} className={`of-btn ${d === 'stay' ? '' : 'of-btn--soft'} !min-h-[44px]`} onClick={() => void act(d)} data-development-decision={d}
              {...(d === 'advance' && stage === 'watch' ? { 'aria-label': `${HAND_OVER_LABEL} to ${firstName}: ${rec.title}` } : {})}>
              {d === 'stay' ? 'Stay here' : d === 'advance' ? advanceLabel(stage) : d === 'step-back' ? stepBackLabel(stage) : 'Pause for now'}
            </button>
          ))}
          <button type="button" className="min-h-[44px] px-1 text-left text-[0.88rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => setEditing((e) => !e)} aria-expanded={editing} data-development-edit>Change the cue or finish line</button>
        </div>
      )}
      {editing && !s.done && (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void act('modify', { cue, finish }); }}>
          <label className="block text-[0.8rem] text-warm-soft">When it happens
            <input value={cue} maxLength={80} onChange={(e) => setCue(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] text-warm-ink" />
          </label>
          <label className="block text-[0.8rem] text-warm-soft">What finished looks like
            <input value={finish} maxLength={160} onChange={(e) => setFinish(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] text-warm-ink" />
          </label>
          <button type="submit" disabled={s.busy} className="of-btn of-btn--soft">Save our words</button>
        </form>
      )}
      <Result s={s} />
    </div>
  );
}

function SuggestNext({ step, memberId, firstName, decide, onAgreement, onAccessLost }: { step: SuggestStep; memberId: string; firstName: string } & Pick<CoachProps, 'decide' | 'onAgreement' | 'onAccessLost'>) {
  const [cue, setCue] = useState(step.cueOptions[0] ?? '');
  const [finish, setFinish] = useState(step.finishLine);
  const [stage, setStage] = useState<MawlStage>('model');
  // Made once and kept: a retry after a failure or a lost answer sends the same ids, so nothing is saved twice.
  const [ids] = useState(() => ({ record: newRecordId(), agreement: newRecordId() }));
  const s = useSave(onAccessLost);
  const target = { id: ids.record, memberId, skillId: step.skill.id, title: step.skill.title };
  const choose = (decision: 'start' | 'pause' | 'dismiss') => s.run(
    () => decide(target, decision === 'start'
      ? { decision, stage, cue, finish, category: responsibilityCategoryOf(step.skill), agreementId: ids.agreement }
      : { decision, category: responsibilityCategoryOf(step.skill) }),
    (r) => {
      if (r.agreement) onAgreement?.(r.agreement);
      if (decision !== 'start') return decision === 'pause' ? 'Not now. We won’t bring it up again until you do.' : 'Not for us. We won’t suggest it again.';
      const live = r.agreement && !r.agreement.deleted;
      if (r.adopted) return `Already agreed: the other grown-up saved “${r.record.title}” for ${firstName}. It’s on the list.`;
      return live ? `Saved: agreed by our family. It’s on ${firstName}’s list. Starting with “${STAGE_LABEL[r.record.stage!]}”.` : 'Saved here. It isn’t on the list yet: check Who does what.';
    },
  );
  return (
    <div data-development-suggest={step.skill.id}>
      <p className="of-eyebrow">One idea{step.generic ? ' to start with' : ''}</p>
      <p className="mt-1 font-semibold">{step.skill.title}</p>
      <ul className="mt-1 space-y-0.5 text-[0.85rem] text-warm-soft" data-development-why>{step.why.slice(0, 2).map((w) => <li key={w}>{w}</li>)}</ul>
      {step.safety && <p className="mt-2 text-[0.8rem] text-warm-soft">{step.safety}</p>}
      {!s.done && (
        <>
          <p className="mt-2 text-[0.9rem]" data-development-summary><span className="text-warm-soft">When:</span> {cue.trim() || 'you choose'} · <span className="text-warm-soft">Finished:</span> {finish.trim() || 'you choose'} · <span className="text-warm-soft">{START_STAGES.find((x) => x.stage === stage)!.label}</span></p>
          <details className="mt-1" data-development-adjust>
            <summary className="min-h-[44px] cursor-pointer py-2.5 text-[0.88rem] font-semibold underline underline-offset-4">Adjust before agreeing</summary>
            <p className="mt-1 text-[0.8rem] text-warm-soft" id={`cue-${ids.record}`}>When it happens (tie it to something that already happens)</p>
            <div className="mt-1 flex flex-wrap gap-2" role="group" aria-labelledby={`cue-${ids.record}`}>
              {step.cueOptions.map((c) => (
                <button key={c} type="button" aria-pressed={cue === c} onClick={() => setCue(c)} className={`min-h-[44px] rounded-[8px] border px-3 text-left text-[0.85rem] ${cue === c ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`} data-development-cue>{c}</button>
              ))}
            </div>
            <label className="mt-2 block text-[0.8rem] text-warm-soft">Or in your words
              <input value={cue} maxLength={80} onChange={(e) => setCue(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] text-warm-ink" data-development-cue-input />
            </label>
            <label className="mt-3 block text-[0.8rem] text-warm-soft">What finished looks like
              <input value={finish} maxLength={160} onChange={(e) => setFinish(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] text-warm-ink" data-development-finish />
            </label>
            <p className="mt-3 text-[0.8rem] text-warm-soft">Where is {firstName} with this?</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Where is ${firstName} with this?`}>
              {START_STAGES.map((x) => (
                <button key={x.stage} type="button" role="radio" aria-checked={stage === x.stage} onClick={() => setStage(x.stage)} className={`min-h-[44px] rounded-[8px] border px-3 text-left text-[0.85rem] ${stage === x.stage ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`} data-development-stage={x.stage}>{x.label}</button>
              ))}
            </div>
          </details>
          <div className="mt-3 flex flex-wrap gap-2" aria-busy={s.busy}>
            <button type="button" className="of-btn !min-h-[44px]" disabled={!finish.trim() || s.busy} onClick={() => void choose('start')} aria-label={`We agreed: ${firstName}, ${step.skill.title}`} data-development-agree>{s.busy ? 'Saving…' : s.error ? 'Try again: we agreed' : 'We agreed'}</button>
            <button type="button" disabled={s.busy} className="of-btn of-btn--soft !min-h-[44px]" onClick={() => void choose('pause')} data-development-not-now>Not now</button>
            <button type="button" disabled={s.busy} className="of-btn of-btn--soft !min-h-[44px]" onClick={() => void choose('dismiss')} data-development-dismiss>Not for us</button>
          </div>
        </>
      )}
      <Result s={s} />
    </div>
  );
}

export function DevelopmentNextSteps({ plan, live, decide, colors, onAgreement, onAccessLost }: CoachProps) {
  const people = plan.people.filter((p) => p.step);
  if (!people.length) return null;
  return (
    <div className="mb-5 space-y-3" data-development-next-steps>
      <p className="of-eyebrow">One next step each</p>
      {people.map((p) => (
        <div key={p.memberId} className="rounded-[9px] border border-[var(--of-rule)] px-3 py-3" data-development-person={p.firstName}>
          <div className="mb-2 flex items-center gap-2.5">
            <Avatar name={p.firstName} color={colors[p.memberId]} size="sm" />
            <span className="font-semibold">{p.firstName}{p.age !== null ? <span className="font-normal text-warm-soft"> · {p.age}</span> : null}</span>
          </div>
          {p.step!.kind === 'check-in'
            ? <CheckInNext step={p.step as CheckInStep} firstName={p.firstName} live={live} decide={decide} onAgreement={onAgreement} onAccessLost={onAccessLost} />
            : <SuggestNext step={p.step as SuggestStep} memberId={p.memberId} firstName={p.firstName} decide={decide} onAgreement={onAgreement} onAccessLost={onAccessLost} />}
        </div>
      ))}
      <p className="text-[0.8rem] text-warm-soft">You decide every step. Nothing moves forward on its own.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Let's Practice

export function DevelopmentPractice({ plan, live }: Pick<CoachProps, 'plan' | 'live'>) {
  const now = plan.people.flatMap((p) => {
    const s = p.step;
    if (!s) return [];
    if (s.kind === 'suggest') return [{ who: p.firstName, title: s.skill.title, text: s.coaching }];
    const r = live.get(s.record.id) ?? s.record;
    if (r.status !== 'active' || r.agreementLive === false || (r.stage !== 'model' && r.stage !== 'assist')) return [];
    return [{ who: p.firstName, title: r.title, text: s.coaching }];
  }).slice(0, 2);
  if (!now.length) return null;
  return (
    <div className="mt-4 rounded-[9px] bg-[var(--of-surface)] p-3" data-development-practice>
      <p className="of-eyebrow">Practice it now</p>
      <ul className="mt-2 space-y-2 text-[0.92rem]">
        {now.map((x) => <li key={x.who + x.title}><strong>{x.who}</strong> · {lower(x.title)}: {x.text}</li>)}
      </ul>
    </div>
  );
}

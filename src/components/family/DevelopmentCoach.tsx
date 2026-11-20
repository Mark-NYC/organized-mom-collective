/**
 * Club personalization inside the weekly Family Meeting: what each child is learning, one next step each
 * (docs/product/FAMILY_DEVELOPMENT_ENGINE.md). Three small pieces, one per meeting part, all reading one plan that
 * WeeklyMeeting keeps for the whole meeting (src/lib/family-development/meeting-plan.ts), so answering a question
 * never reshuffles the rest of the meeting:
 *
 *   Let's Talk       DevelopmentCheckIns   "How's it going?" for a skill the family is already working on.
 *   Everyone's Part  DevelopmentNextSteps  per child: who is learning what, how to help, and ONE obvious action.
 *                                          Active: Keep practicing; stage changes behind "Change how we're
 *                                          practicing" (only valid moves); Edit routine and Pause as text actions.
 *                                          New skill: Add to our plan; Customize (stage, cue, finish line,
 *                                          safety, Don't suggest again); Not now.
 *   Let's Practice   DevelopmentPractice   one thing to show or do together right now.
 *
 * Nothing is saved without a tap, and "Saved" is shown only after the database answered: the record and the family
 * agreement are one transaction there. A failed save says so and the same button retries safely (same ids). The
 * agreement the database returns goes straight onto this phone's lists (onAgreement). Nothing advances on its own.
 * Club families only (WeeklyMeeting checks club_me; the database checks again on every write).
 */
import { useEffect, useRef, useState } from 'react';
import { MAWL_STAGES, type MawlStage } from '../../lib/family-development/framework';
import {
  HAND_OVER_LABEL, LAUNCH_CONFIRMATION, MAWL_LABEL, STAGE_SHORT, WATCH_DISTINCTION, advanceLabel, coachLine, keepLabel, practiceBackLabel,
  suggestCoachLine,
} from '../../lib/family-development/language';
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

/**
 * Saving state for one card: one request at a time (repeated taps do nothing), the tapped action shows "Saving…",
 * and focus moves to the result so screen readers hear it.
 */
function useSave(onAccessLost?: () => void) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const result = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (done || error) result.current?.focus(); }, [done, error]);
  const busy = pending !== null;
  const run = async (key: string, f: () => Promise<DecideResult>, ok: (r: Extract<DecideResult, { ok: true }>) => string) => {
    if (busy) return;
    setPending(key); setError('');
    try {
      const r = await f();
      if (r.ok) setDone(ok(r));
      else {
        setError(ERROR_TEXT[r.error]);
        if (r.error === 'club_required') onAccessLost?.();
      }
    } finally { setPending(null); }
  };
  return { busy, pending, error, done, result, run };
}

function Result({ s }: { s: ReturnType<typeof useSave> }) {
  if (s.done) return <p ref={s.result} tabIndex={-1} role="status" className="mt-2 text-[0.92rem] text-[var(--of-sage-ink)] outline-none" data-development-saved>{s.done}</p>;
  if (s.error) return <p ref={s.result} tabIndex={-1} role="alert" className="mt-2 text-[0.92rem] outline-none" data-development-error>{s.error}</p>;
  return null;
}

/** The small, consistent stage indicator. */
function StagePill({ stage }: { stage: MawlStage }) {
  return <span className="inline-flex items-center rounded-full bg-[var(--of-surface)] px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--of-sage-ink)]" title={MAWL_LABEL[stage]} data-development-stage-pill={stage}>{STAGE_SHORT[stage]}</span>;
}

/** Sentence-case buttons, in the app's colors: one primary per card; everything else quieter. */
const PRIMARY = 'of-btn !min-h-[44px] !px-4 !text-[0.92rem] !normal-case !tracking-normal';
const SECONDARY = 'of-btn of-btn--soft !min-h-[44px] !px-4 !text-[0.92rem] !normal-case !tracking-normal';
const TEXT_ACTION = 'inline-flex min-h-[44px] items-center px-1 text-[0.88rem] text-warm-soft underline underline-offset-4 hover:text-warm-ink disabled:opacity-60';
const DISCLOSURE = 'flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[0.92rem] font-semibold text-warm-ink [&::-webkit-details-marker]:hidden';
const Chevron = () => <span aria-hidden="true" className="inline-flex size-4 items-center justify-center leading-none text-warm-soft transition-transform group-open:rotate-90">›</span>;

// ------------------------------------------------------------------ Let's Talk

function CheckInCard({ step, firstName, color, live, decide, onAccessLost }: { step: CheckInStep; firstName: string; color?: MarkerColor } & Pick<CoachProps, 'live' | 'decide' | 'onAccessLost'>) {
  const id = step.record.id;
  const [variation, setVariation] = useState(false);
  const s = useSave(onAccessLost);
  const answer = (value: CheckValue) => s.run(value,
    () => decide(live.get(id) ?? step.record, { decision: 'check-in', check: { signal: step.question.signal, value, variation } }),
    () => 'Noted. More on this in Everyone’s Part.',
  );
  return (
    <div className="border-t border-[var(--of-rule)] pt-3" data-development-check-in={step.record.skillId}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Avatar name={firstName} color={color} size="sm" />
        <p className="min-w-0 text-[0.95rem]"><strong>{firstName}</strong> · {step.record.title}</p>
        <StagePill stage={step.record.stage!} />
      </div>
      <p className="mt-2 text-[0.95rem]" id={`dq-${id}`}>{step.question.text}</p>
      {!s.done && (
        <>
          <div className="mt-2.5 grid grid-cols-3 gap-2" role="group" aria-labelledby={`dq-${id}`} aria-busy={s.busy}>
            {step.question.answers.map((a) => (
              <button key={a.value} type="button" disabled={s.busy} className="min-h-[44px] rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.88rem] font-semibold disabled:opacity-60" onClick={() => void answer(a.value)} data-development-answer={a.value}>{s.pending === a.value ? 'Saving…' : a.label}</button>
            ))}
          </div>
          {step.record.stage === 'watch' && (
            <label className="mt-1 flex min-h-[44px] items-center gap-2 text-[0.88rem] text-warm-soft">
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

/**
 * An active responsibility: what they're learning, how to help, one obvious next action (keep practicing), the stage
 * changes behind "Change how we're practicing" (only the moves valid for this stage), and two quiet text actions.
 */
function CheckInNext({ step, firstName, live, decide, onAgreement, onAccessLost }: { step: CheckInStep; firstName: string } & Pick<CoachProps, 'live' | 'decide' | 'onAgreement' | 'onAccessLost'>) {
  const rec = live.get(step.record.id) ?? step.record;
  const s = useSave(onAccessLost);
  const [editing, setEditing] = useState(false);
  const [cue, setCue] = useState(rec.cue ?? '');
  const [finish, setFinish] = useState(rec.finishLine ?? step.skill?.finishLine ?? '');
  // Kept for retries: tapping "Put it back" again after a failure never makes a second agreement.
  const [agreementId] = useState(newRecordId);
  const act = (decision: DevelopmentDecision, extra: Partial<DecisionInput> = {}) => s.run(decision,
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
        default: return rec.stage === 'launch' ? 'Noted. It stays theirs.' : 'Noted. Keep practicing this week.';
      }
    },
  );
  const stage = rec.stage!;
  const label = (key: string, text: string) => (s.pending === key ? 'Saving…' : text);
  if (step.agreementRemoved && rec.agreementLive === false) {
    return (
      <div data-development-next={rec.skillId} data-development-removed>
        <p className="font-semibold">{rec.title}</p>
        <p className="mt-1 text-[0.92rem] text-warm-soft">{step.why[0]}</p>
        {!s.done && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" aria-busy={s.busy}>
            <button type="button" disabled={s.busy} className={PRIMARY} onClick={() => void act('restore', { agreementId, category: rec.category })} data-development-decision="restore">{label('restore', 'Put it back on the list')}</button>
            <button type="button" disabled={s.busy} className={TEXT_ACTION} onClick={() => void act('pause')} data-development-decision="pause">{label('pause', 'Pause it here too')}</button>
          </div>
        )}
        <Result s={s} />
      </div>
    );
  }
  const canAdvance = step.decisions.includes('advance') && rec.status === 'active';
  const canBack = step.decisions.includes('step-back');
  const back = practiceBackLabel(stage);
  const prev = MAWL_STAGES[MAWL_STAGES.indexOf(stage) - 1];
  return (
    <div data-development-next={rec.skillId}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-semibold">{rec.title}</p>
        <StagePill stage={stage} />
      </div>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed">{coachLine(stage, firstName)}</p>
      {step.watchVariation && <p className="mt-1.5 text-[0.9rem] text-warm-soft" data-development-variation-suggestion>This week, try a different kind of day: {lower(step.watchVariation)}</p>}
      {step.safety && <p className="mt-1.5 text-[0.85rem] text-warm-soft">{step.safety}</p>}
      {!s.done && (
        <>
          <div className="mt-3" aria-busy={s.busy}>
            <button type="button" disabled={s.busy} className={PRIMARY} onClick={() => void act('stay')} data-development-decision="stay">{label('stay', keepLabel(stage))}</button>
          </div>
          {(canAdvance || canBack) && (
            <details className="group mt-1" data-development-change>
              <summary className={DISCLOSURE}><Chevron />Change how we’re practicing</summary>
              <div className="space-y-3 pb-1 pt-1">
                {canBack && back && prev && (
                  <div>
                    <button type="button" disabled={s.busy} className={SECONDARY} onClick={() => void act('step-back')} data-development-decision="step-back" aria-describedby={`back-${rec.id}`}>{label('step-back', back)}</button>
                    <p id={`back-${rec.id}`} className="mt-1 text-[0.85rem] text-warm-soft">Back to “{MAWL_LABEL[prev]}”.</p>
                  </div>
                )}
                {canAdvance && (
                  <div>
                    {stage === 'watch' && <p className="mb-1.5 text-[0.85rem] text-warm-soft" data-development-watch-distinction>{WATCH_DISTINCTION}</p>}
                    <button type="button" disabled={s.busy} className={SECONDARY} onClick={() => void act('advance')} data-development-decision="advance"
                      {...(stage === 'watch' ? { 'aria-label': `${HAND_OVER_LABEL} to ${firstName}: ${rec.title}` } : {})}>{label('advance', advanceLabel(stage)!)}</button>
                  </div>
                )}
              </div>
            </details>
          )}
          <div className="flex flex-wrap gap-x-4" aria-busy={s.busy}>
            <button type="button" className={TEXT_ACTION} onClick={() => setEditing((e) => !e)} aria-expanded={editing} data-development-edit>Edit routine</button>
            <button type="button" disabled={s.busy} className={TEXT_ACTION} onClick={() => void act('pause')} data-development-decision="pause">{label('pause', 'Pause this responsibility')}</button>
          </div>
          {editing && (
            <form className="mt-1 space-y-2" onSubmit={(e) => { e.preventDefault(); void act('modify', { cue, finish }); }} data-development-edit-form>
              <label className="block text-[0.85rem] text-warm-soft">When it happens
                <input value={cue} maxLength={80} onChange={(e) => setCue(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[1rem] text-warm-ink" />
              </label>
              <label className="block text-[0.85rem] text-warm-soft">What finished looks like
                <input value={finish} maxLength={160} onChange={(e) => setFinish(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[1rem] text-warm-ink" />
              </label>
              <button type="submit" disabled={s.busy} className={SECONDARY}>{label('modify', 'Save routine')}</button>
            </form>
          )}
        </>
      )}
      <Result s={s} />
    </div>
  );
}

/**
 * A suggested new skill: what it is, how to start, when it happens, one obvious action (Add to our plan, which saves
 * the record and the family agreement together), Customize for the rest, Not now. "Don't suggest again" is inside.
 */
function SuggestNext({ step, memberId, firstName, decide, onAgreement, onAccessLost }: { step: SuggestStep; memberId: string; firstName: string } & Pick<CoachProps, 'decide' | 'onAgreement' | 'onAccessLost'>) {
  const [cue, setCue] = useState(step.cueOptions[0] ?? '');
  const [finish, setFinish] = useState(step.finishLine);
  const [stage, setStage] = useState<MawlStage>('model');
  // Made once and kept: a retry after a failure or a lost answer sends the same ids, so nothing is saved twice.
  const [ids] = useState(() => ({ record: newRecordId(), agreement: newRecordId() }));
  const s = useSave(onAccessLost);
  const target = { id: ids.record, memberId, skillId: step.skill.id, title: step.skill.title };
  const choose = (decision: 'start' | 'pause' | 'dismiss') => s.run(decision,
    () => decide(target, decision === 'start'
      ? { decision, stage, cue, finish, category: responsibilityCategoryOf(step.skill), agreementId: ids.agreement }
      : { decision, category: responsibilityCategoryOf(step.skill) }),
    (r) => {
      if (r.agreement) onAgreement?.(r.agreement);
      if (decision !== 'start') return decision === 'pause' ? 'Not now. We won’t bring it up again until you do.' : 'Got it. We won’t suggest it again.';
      const live = r.agreement && !r.agreement.deleted;
      if (r.adopted) return `Already in your plan: the other grown-up added “${r.record.title}” for ${firstName}.`;
      if (!live) return 'Saved here. It isn’t on the list yet: check Who does what.';
      return r.record.status === 'launched'
        ? `Added to our plan: agreed by our family. It’s on ${firstName}’s list as their responsibility.`
        : `Added to our plan: agreed by our family. It’s on ${firstName}’s list.`;
    },
  );
  const label = (key: string, text: string) => (s.pending === key ? 'Saving…' : text);
  return (
    <div data-development-suggest={step.skill.id}>
      <p className="text-[0.8rem] font-semibold text-[var(--of-sage-ink)]">Suggested next skill</p>
      <p className="mt-0.5 font-semibold">{step.skill.title}</p>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed">{stage === 'model' ? suggestCoachLine(firstName) : coachLine(stage, firstName)}</p>
      <p className="mt-1.5 text-[0.92rem]" data-development-summary><span className="text-warm-soft">When:</span> {cue.trim() || 'you choose'}</p>
      {!s.done && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" aria-busy={s.busy}>
            <button type="button" className={PRIMARY} disabled={!finish.trim() || s.busy} onClick={() => void choose('start')} aria-label={`Add to our plan: ${firstName}, ${step.skill.title}`} data-development-agree>{label('start', s.error ? 'Try again: add to our plan' : 'Add to our plan')}</button>
            <button type="button" disabled={s.busy} className={TEXT_ACTION} onClick={() => void choose('pause')} data-development-not-now>{label('pause', 'Not now')}</button>
          </div>
          <details className="group mt-1" data-development-adjust>
            <summary className={DISCLOSURE}><Chevron />Customize</summary>
            <div className="space-y-3 pb-1 pt-1">
              {step.why[0] && <p className="text-[0.85rem] text-warm-soft" data-development-why>{step.why[0]}</p>}
              <fieldset>
                <legend className="text-[0.85rem] text-warm-soft">Where is {firstName} with this?</legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Where is ${firstName} with this?`}>
                  {START_STAGES.map((x) => (
                    <button key={x.stage} type="button" role="radio" aria-checked={stage === x.stage} onClick={() => setStage(x.stage)} className={`min-h-[44px] rounded-[8px] border px-3 text-left text-[0.9rem] ${stage === x.stage ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`} data-development-stage={x.stage}>{x.label}</button>
                  ))}
                </div>
              </fieldset>
              <div>
                <p className="text-[0.85rem] text-warm-soft" id={`cue-${ids.record}`}>When it happens: tie it to something that already happens</p>
                <div className="mt-1 flex flex-wrap gap-2" role="group" aria-labelledby={`cue-${ids.record}`}>
                  {step.cueOptions.map((c) => (
                    <button key={c} type="button" aria-pressed={cue === c} onClick={() => setCue(c)} className={`min-h-[44px] rounded-[8px] border px-3 text-left text-[0.9rem] ${cue === c ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`} data-development-cue>{c}</button>
                  ))}
                </div>
                <label className="mt-2 block text-[0.85rem] text-warm-soft">Or in your words
                  <input value={cue} maxLength={80} onChange={(e) => setCue(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[1rem] text-warm-ink" data-development-cue-input />
                </label>
              </div>
              <label className="block text-[0.85rem] text-warm-soft">What finished looks like
                <input value={finish} maxLength={160} onChange={(e) => setFinish(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[1rem] text-warm-ink" data-development-finish />
              </label>
              {step.safety && <p className="text-[0.85rem] text-warm-soft" data-development-safety>{step.safety}</p>}
              <button type="button" disabled={s.busy} className={TEXT_ACTION} onClick={() => void choose('dismiss')} data-development-dismiss>{label('dismiss', 'Don’t suggest again')}</button>
            </div>
          </details>
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
    <div className="mb-5" data-development-next-steps>
      <p className="of-eyebrow">One next step each</p>
      <ul className="mt-1">
        {people.map((p) => (
          <li key={p.memberId} className="border-b border-[var(--of-rule)] py-4 last:border-b-0" data-development-person={p.firstName}>
            <div className="mb-1.5 flex items-center gap-2.5">
              <Avatar name={p.firstName} color={colors[p.memberId]} size="sm" />
              <span className="font-semibold">{p.firstName}{p.age !== null ? <span className="font-normal text-warm-soft"> · {p.age}</span> : null}</span>
            </div>
            {p.step!.kind === 'check-in'
              ? <CheckInNext step={p.step as CheckInStep} firstName={p.firstName} live={live} decide={decide} onAgreement={onAgreement} onAccessLost={onAccessLost} />
              : <SuggestNext step={p.step as SuggestStep} memberId={p.memberId} firstName={p.firstName} decide={decide} onAgreement={onAgreement} onAccessLost={onAccessLost} />}
          </li>
        ))}
      </ul>
      <p className="text-[0.85rem] text-warm-soft">You decide every step. Nothing moves forward on its own.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Let's Practice

export function DevelopmentPractice({ plan, live }: Pick<CoachProps, 'plan' | 'live'>) {
  const now = plan.people.flatMap((p) => {
    const s = p.step;
    if (!s) return [];
    if (s.kind === 'suggest') return [{ who: p.firstName, title: s.skill.title, text: suggestCoachLine(p.firstName) }];
    const r = live.get(s.record.id) ?? s.record;
    if (r.status !== 'active' || r.agreementLive === false || (r.stage !== 'model' && r.stage !== 'assist')) return [];
    return [{ who: p.firstName, title: r.title, text: coachLine(r.stage, p.firstName) }];
  }).slice(0, 2);
  if (!now.length) return null;
  return (
    <div className="mt-4 rounded-[9px] bg-[var(--of-surface)] p-3" data-development-practice>
      <p className="of-eyebrow">Practice it now</p>
      <ul className="mt-2 space-y-2 text-[0.92rem]">
        {now.map((x) => <li key={x.who + x.title}><strong>{x.who}</strong> · {x.title}. {x.text}</li>)}
      </ul>
    </div>
  );
}

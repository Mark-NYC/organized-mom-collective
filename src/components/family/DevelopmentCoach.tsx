/**
 * Club personalization inside the weekly Family Meeting: what each child is learning, one next step each
 * (docs/product/FAMILY_DEVELOPMENT_ENGINE.md). Three small pieces, one per meeting part, all reading one plan that
 * WeeklyMeeting computes once when the meeting opens (src/lib/family-development/engine.ts), so answering a question
 * never reshuffles the rest of the meeting:
 *
 *   Let's Talk       DevelopmentCheckIns   "How's it going?" for a skill the family is already working on.
 *   Everyone's Part  DevelopmentNextSteps  stage coaching and the family's choice (stay, next step, easier, pause),
 *                                          or one new skill to agree on (We agreed · Not now · Not for us).
 *   Let's Practice   DevelopmentPractice   one thing to show or do together right now.
 *
 * Nothing is saved without a tap. Nothing advances on its own. Club families only (WeeklyMeeting checks club_me;
 * the database checks again on every write). Renders nothing when the records can't be read.
 */
import { useState } from 'react';
import type { MawlStage } from '../../lib/family-development/framework';
import type { CheckInStep, DevelopmentPlan, SuggestStep } from '../../lib/family-development/engine';
import { responsibilityCategoryOf, skillAgreementSource } from '../../lib/family-development/engine';
import type { CheckValue, DecisionInput, DevelopmentDecision, DevelopmentRecord } from '../../lib/family-development/records';
import type { DecideResult } from '../../lib/family-development/client';
import { newRecordId } from '../../lib/family-development/client';
import type { AgreementDraft } from '../../lib/family-meeting-client';
import type { MarkerColor } from '../../data/club/family-colors';
import { Avatar } from '../app/ui';

/** MAWL in a parent's words. */
export const STAGE_LABEL: Record<MawlStage, string> = {
  model: 'Showing how',
  assist: 'Doing it together',
  watch: 'Practicing, you nearby',
  launch: 'Theirs now',
};
const ADVANCE_LABEL: Record<MawlStage, string> = {
  model: 'Start doing it together',
  assist: 'Let them try, you watch',
  watch: 'It’s theirs now',
  launch: '',
};
const START_STAGES: { stage: MawlStage; label: string }[] = [
  { stage: 'model', label: 'We’ll show them first' },
  { stage: 'assist', label: 'We already do it together' },
  { stage: 'watch', label: 'They do it, we watch' },
  { stage: 'launch', label: 'It’s already theirs' },
];
const ERROR_TEXT: Record<Exclude<DecideResult, { ok: true }>['error'], string> = {
  conflict: 'The other grown-up just changed this. Here’s the latest.',
  club_required: 'This part of the meeting is for Family Meeting Club members.',
  offline: 'Couldn’t save that. This needs a connection.',
  invalid: 'That change couldn’t be saved.',
  exists: 'This one is already saved for your family. Here’s the latest.',
};

export interface CoachProps {
  plan: DevelopmentPlan;
  /** Live records by id (the plan holds the copy from when the meeting opened). */
  live: Map<string, DevelopmentRecord>;
  decide: (target: DevelopmentRecord | { id: string; memberId: string; skillId: string; title: string }, input: DecisionInput) => Promise<DecideResult>;
  colors: Record<string, MarkerColor>;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ------------------------------------------------------------------ Let's Talk

export function DevelopmentCheckIns({ plan, live, decide, colors }: CoachProps) {
  const steps = plan.people.filter((p) => p.step?.kind === 'check-in');
  const [state, setState] = useState<Record<string, { value?: CheckValue; variation?: boolean; saved?: boolean; error?: string }>>({});
  if (!steps.length) return null;
  const answer = async (step: CheckInStep, value: CheckValue) => {
    const id = step.record.id;
    const variation = Boolean(state[id]?.variation);
    const r = await decide(live.get(id) ?? step.record, { decision: 'check-in', check: { signal: step.question.signal, value, variation } });
    setState((s) => ({ ...s, [id]: r.ok ? { value, variation, saved: true } : { ...s[id], error: ERROR_TEXT[r.error] } }));
  };
  return (
    <div className="space-y-3" data-development-check-ins>
      <p className="of-eyebrow">What we’re working on</p>
      {steps.map((p) => {
        const step = p.step as CheckInStep;
        const id = step.record.id;
        const st = state[id];
        return (
          <div key={id} className="rounded-[9px] border border-[var(--of-rule)] px-3 py-3" data-development-check-in={step.record.skillId}>
            <div className="flex items-center gap-2.5">
              <Avatar name={p.firstName} color={colors[p.memberId]} size="sm" />
              <p className="min-w-0 text-[0.92rem]"><strong>{p.firstName}</strong> · {step.record.title} <span className="text-warm-soft">· {STAGE_LABEL[step.record.stage!]}</span></p>
            </div>
            <p className="mt-2 text-[0.95rem]">{step.question.text}</p>
            {!st?.saved ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={step.question.text}>
                  {step.question.answers.map((a) => (
                    <button key={a.value} type="button" className="min-h-[44px] rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.82rem] font-semibold" onClick={() => void answer(step, a.value)} data-development-answer={a.value}>{a.label}</button>
                  ))}
                </div>
                {step.record.stage === 'watch' && (
                  <label className="mt-2 flex min-h-[44px] items-center gap-2 text-[0.85rem] text-warm-soft">
                    <input type="checkbox" checked={Boolean(st?.variation)} onChange={(e) => setState((s) => ({ ...s, [id]: { ...s[id], variation: e.target.checked } }))} data-development-variation />
                    We tried it on a different kind of day
                  </label>
                )}
              </>
            ) : (
              <p className="mt-2 text-[0.9rem] text-[var(--of-sage-ink)]" role="status" data-development-answered>Noted. More on this in Everyone’s Part.</p>
            )}
            {st?.error && <p role="alert" className="mt-2 text-sm">{st.error}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Everyone's Part

function CheckInNext({ step, firstName, live, decide }: { step: CheckInStep; firstName: string } & Pick<CoachProps, 'live' | 'decide'>) {
  const rec = live.get(step.record.id) ?? step.record;
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [cue, setCue] = useState(rec.cue ?? '');
  const [finish, setFinish] = useState(rec.finishLine ?? step.skill?.finishLine ?? '');
  const act = async (decision: DevelopmentDecision, extra: Partial<DecisionInput> = {}) => {
    setError('');
    const r = await decide(live.get(rec.id) ?? rec, { decision, ...extra });
    if (!r.ok) return setError(ERROR_TEXT[r.error]);
    setEditing(false);
    setDone(decision === 'advance' ? `Saved: ${STAGE_LABEL[r.record.stage!].toLowerCase()}.` : decision === 'step-back' ? `Saved: back to ${STAGE_LABEL[r.record.stage!].toLowerCase()}.` : decision === 'pause' ? 'Paused. It won’t come up until you bring it back.' : decision === 'dismiss' ? 'Set aside. We won’t suggest it again.' : decision === 'modify' ? 'Saved your words.' : 'Staying here this week.');
  };
  const stage = rec.stage!;
  const offers = step.decisions.filter((d) => d !== 'modify' && d !== 'dismiss' && (rec.status === 'active' || d !== 'advance'));
  return (
    <div data-development-next={rec.skillId}>
      <p className="text-[0.95rem]"><strong>{rec.title}</strong> <span className="text-warm-soft">· {STAGE_LABEL[stage]}</span></p>
      <p className="mt-1 text-[0.9rem] leading-relaxed">{step.coaching}</p>
      {step.watchVariation && <p className="mt-2 rounded-[9px] bg-[var(--of-surface)] px-3 py-2 text-[0.9rem]" data-development-variation-suggestion>Try a different kind of day: {step.watchVariation}</p>}
      {step.hint && <p className="mt-2 text-[0.85rem] text-warm-soft" data-development-hint>{step.hint}</p>}
      {step.safety && <p className="mt-2 text-[0.8rem] text-warm-soft">{step.safety}</p>}
      {done ? (
        <p role="status" className="mt-3 text-sm text-[var(--of-sage-ink)]" data-development-saved>{done}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`What's next for ${firstName}: ${rec.title}`}>
          {offers.map((d) => (
            <button key={d} type="button" className={`of-btn ${d === 'stay' ? '' : 'of-btn--soft'} !min-h-[44px]`} onClick={() => void act(d)} data-development-decision={d}>
              {d === 'stay' ? 'Stay here' : d === 'advance' ? ADVANCE_LABEL[stage] : d === 'step-back' ? 'Make it easier' : 'Pause for now'}
            </button>
          ))}
          <button type="button" className="of-tile-action !mt-0 min-h-[44px]" onClick={() => setEditing((e) => !e)} aria-expanded={editing} data-development-edit>Change the cue or finish line</button>
        </div>
      )}
      {editing && !done && (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void act('modify', { cue, finish }); }}>
          <label className="block text-[0.8rem] text-warm-soft">When it happens
            <input value={cue} maxLength={80} onChange={(e) => setCue(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] text-warm-ink" />
          </label>
          <label className="block text-[0.8rem] text-warm-soft">What finished looks like
            <input value={finish} maxLength={160} onChange={(e) => setFinish(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] text-warm-ink" />
          </label>
          <button type="submit" className="of-btn of-btn--soft">Save our words</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </div>
  );
}

function SuggestNext({ step, memberId, firstName, decide, onAgree }: { step: SuggestStep; memberId: string; firstName: string; onAgree: (d: AgreementDraft) => Promise<void> } & Pick<CoachProps, 'decide'>) {
  const [cue, setCue] = useState(step.cueOptions[0] ?? '');
  const [finish, setFinish] = useState(step.finishLine);
  const [stage, setStage] = useState<MawlStage>('model');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [id] = useState(newRecordId);
  const target = { id, memberId, skillId: step.skill.id, title: step.skill.title };
  const choose = async (decision: 'start' | 'pause' | 'dismiss') => {
    setError('');
    const r = await decide(target, decision === 'start' ? { decision, stage, cue, finish } : { decision });
    if (!r.ok) return setError(ERROR_TEXT[r.error]);
    if (decision === 'start') {
      // The agreement is the existing one ("We agreed", club_responsibilities); the record holds only the stage.
      await onAgree({ category: responsibilityCategoryOf(step.skill), text: step.skill.title, ownerIds: [memberId], ...(finish.trim() ? { finished: finish } : {}), ...(cue.trim() ? { when: cue } : {}), source: skillAgreementSource(step.skill.id) }).catch(() => undefined);
    }
    setDone(decision === 'start' ? `Saved: agreed by our family. ${STAGE_LABEL[stage]}.` : decision === 'pause' ? 'Not now. We won’t bring it up again until you do.' : 'Not for us. We won’t suggest it again.');
  };
  return (
    <div data-development-suggest={step.skill.id}>
      <p className="of-eyebrow">One idea{step.generic ? ' to start with' : ''}</p>
      <p className="mt-1 font-semibold">{step.skill.title}</p>
      <ul className="mt-1 space-y-0.5 text-[0.85rem] text-warm-soft" data-development-why>{step.why.slice(0, 2).map((w) => <li key={w}>{w}</li>)}</ul>
      {step.safety && <p className="mt-2 text-[0.8rem] text-warm-soft">{step.safety}</p>}
      {done ? (
        <p role="status" className="mt-3 text-sm text-[var(--of-sage-ink)]" data-development-saved>{done}</p>
      ) : (
        <>
          <p className="mt-3 text-[0.8rem] text-warm-soft">When it happens (tie it to something that already happens)</p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="When it happens">
            {step.cueOptions.map((c) => (
              <button key={c} type="button" aria-pressed={cue === c} onClick={() => setCue(c)} className={`min-h-[44px] rounded-[8px] border px-3 text-[0.85rem] ${cue === c ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`} data-development-cue>{c}</button>
            ))}
          </div>
          <input value={cue} maxLength={80} onChange={(e) => setCue(e.target.value)} aria-label="Or in your words" placeholder="Or in your words" className="mt-2 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem]" />
          <label className="mt-3 block text-[0.8rem] text-warm-soft">What finished looks like
            <input value={finish} maxLength={160} onChange={(e) => setFinish(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] text-warm-ink" data-development-finish />
          </label>
          <details className="mt-3">
            <summary className="cursor-pointer text-[0.85rem]">Where is {firstName} with this? <span className="text-warm-soft">{START_STAGES.find((s) => s.stage === stage)!.label}</span></summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Where is ${firstName} with this?`}>
              {START_STAGES.map((s) => (
                <button key={s.stage} type="button" role="radio" aria-checked={stage === s.stage} onClick={() => setStage(s.stage)} className={`min-h-[44px] rounded-[8px] border px-3 text-left text-[0.85rem] ${stage === s.stage ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`} data-development-stage={s.stage}>{s.label}</button>
              ))}
            </div>
          </details>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="of-btn !min-h-[44px]" disabled={!finish.trim()} onClick={() => void choose('start')} aria-label={`We agreed: ${firstName}, ${step.skill.title}`} data-development-agree>We agreed</button>
            <button type="button" className="of-btn of-btn--soft !min-h-[44px]" onClick={() => void choose('pause')} data-development-not-now>Not now</button>
            <button type="button" className="of-btn of-btn--soft !min-h-[44px]" onClick={() => void choose('dismiss')} data-development-dismiss>Not for us</button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </div>
  );
}

export function DevelopmentNextSteps({ plan, live, decide, colors, onAgree }: CoachProps & { onAgree: (d: AgreementDraft) => Promise<void> }) {
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
            ? <CheckInNext step={p.step as CheckInStep} firstName={p.firstName} live={live} decide={decide} />
            : <SuggestNext step={p.step as SuggestStep} memberId={p.memberId} firstName={p.firstName} decide={decide} onAgree={onAgree} />}
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
    if (r.status !== 'active' || (r.stage !== 'model' && r.stage !== 'assist')) return [];
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

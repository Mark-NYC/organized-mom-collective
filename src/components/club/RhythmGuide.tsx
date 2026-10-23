/**
 * November's Family Rhythm & Ownership Guide: a short guided conversation on the kit page. One question at a time,
 * only the ones her answers lead to (src/data/rhythm-guide.ts), then one plan she can edit, print or copy. Answers and
 * the plan save in the kit's `next-step` document, so leaving for September's bonus and coming back loses nothing.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { KitConfig } from '../../data/club/types';
import {
  back, buildPlan, coachingFor, currentScreen, defineFor, emptyGuide, HARD_COACHING, HARD_OPTIONS, JOB_OPTIONS, jobFor, leadCandidates,
  LEADER_OPTIONS, OBSTACLE_OPTIONS, PLACE_OPTIONS, planKey, planText, readGuide, START_OPTIONS, TIME_OPTIONS, type GuideState, type Plan,
} from '../../data/rhythm-guide';
import { defaultToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { printDocument } from '../../lib/club/print';
import { planMembers, type Household } from '../../lib/club/profile';
import { ConflictError, type ClubStore, type KitDocuments } from '../../lib/club/store';
import { clubNav } from '../../lib/club/nav';
import NextStepSheet from './print/NextStepSheet';
import PrintFrame from './PrintFrame';
import { PreviewOnlyNote } from './ChartEditor';

const DOC = 'next-step';
const link = 'min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4';
const field = 'mt-1 block w-full rounded-[4px] border border-warm-rule bg-white px-3 py-2.5 text-[1rem] leading-snug text-warm-ink focus:border-warm-ink focus:outline-none';

export default function RhythmGuide({ kit, household, store, docs, readOnly, bonusHref }: {
  kit: KitConfig;
  household: Household;
  store: ClubStore;
  docs: KitDocuments;
  readOnly: boolean;
  /** September's kit, when she can open it (null: not yet). */
  bonusHref: string | null;
}) {
  const coach = kit.coach!;
  const people = useMemo(() => planMembers(household, kit.month), [household, kit.month]);
  const saved = docs.documents[DOC];
  const [s, setS] = useState<GuideState>(() => readGuide(saved?.edits, people.map((p) => p.id)));
  const [revision, setRevision] = useState(saved?.revision ?? 0);
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'conflict' | 'error'>('idle');
  const [open, setOpen] = useState(() => s.start !== null);
  const [preview, setPreview] = useState(false);
  const palette = (household.preferences.palette as ToolPaletteId | undefined) ?? defaultToolPalette;
  const screen = currentScreen(s);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const update = (patch: Partial<GuideState>) => {
    setS((x) => ({ ...x, ...patch }));
    if (!readOnly) setStatus('pending');
  };
  useEffect(() => {
    if (status !== 'pending' || readOnly) return;
    const t = setTimeout(() => {
      store.saveDocument(kit.slug, DOC, { edits: s as unknown as Record<string, unknown>, palette, engineVersion: kit.engineVersion, profileVersion: household.profileVersion }, revision)
        .then((rev) => { setRevision(rev); setStatus('saved'); })
        .catch((e) => setStatus(e instanceof ConflictError ? 'conflict' : 'error'));
    }, 500);
    return () => clearTimeout(t);
  }, [s, status]);

  // The plan, made once she reaches it, and again only if an answer behind it changed (her edits are kept otherwise).
  useEffect(() => {
    if (screen !== 'plan') return;
    const key = planKey(s);
    if (s.plan && s.planFor === key) return;
    const plan = buildPlan(s, people, kit.items, household.preferences);
    if (plan) update({ plan, planFor: key });
  }, [screen, s.planFor]);

  // Each new question takes focus, so a screen reader hears it and a phone scrolls to it.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (open) heading.current?.focus();
  }, [screen, open]);

  const restart = () => update(emptyGuide());
  const body = !open ? null : (
    <div className="mt-6 bg-white p-5 ring-1 ring-warm-rule sm:p-7" data-guide-screen={screen}>
      <Screen s={s} screen={screen} update={update} people={people} kit={kit} household={household} bonusHref={bonusHref} heading={heading} readOnly={readOnly} preview={preview} setPreview={setPreview} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-warm-rule pt-4">
        {screen !== 'start' ? (
          <button type="button" className={link} onClick={() => update(back(s))} disabled={readOnly}>← Back</button>
        ) : <span />}
        <p className="text-[0.85rem] text-warm-soft" role="status">
          {status === 'pending' ? 'Saving…' : status === 'conflict' ? 'Changed on another device. Reload to see it.' : status === 'error' ? 'Couldn’t save. Check your connection.' : s.start ? 'Your answers save as you go.' : ''}
        </p>
        {s.start !== null && screen !== 'start' && (
          <button type="button" className="min-h-11 text-[0.85rem] text-warm-soft underline underline-offset-4" onClick={restart} disabled={readOnly}>Start over</button>
        )}
      </div>
    </div>
  );

  return (
    <section aria-labelledby="club-guide" className="mt-8">
      {/* Screen-only parts carry .club-screen; the plan's printout sits outside them so it can print. */}
      <div className="club-screen">
        <h2 id="club-guide" className="font-serif text-[1.6rem] leading-tight text-warm-ink">{coach.title}</h2>
        <p className="mt-2 max-w-xl leading-relaxed text-warm-soft">{coach.intro}</p>
        {!open && (
          <button type="button" className="btn-primary mt-5 w-full sm:w-auto" onClick={() => setOpen(true)}>{coach.cta}</button>
        )}
        {body}
      </div>
      {s.plan && screen === 'plan' && (
        <PrintFrame open={preview} orientation="portrait">
          <NextStepSheet doc={DOC} plan={s.plan} familyName={household.displayName ?? 'Our family'} month={kit.month} palette={palette} preview={preview} />
        </PrintFrame>
      )}
    </section>
  );
}

/** A tappable answer: big, plain, one per line. */
function Choice({ on, children, onClick, disabled }: { on: boolean; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      className={`block min-h-12 w-full rounded-[6px] px-4 py-3 text-left text-[1rem] leading-snug ring-1 transition-colors ${on ? 'bg-sage-wash text-warm-ink ring-sage' : 'bg-cream text-warm-ink ring-warm-rule hover:ring-warm-ink'}`}>
      {children}
    </button>
  );
}

function Question({ heading, children, refEl }: { heading: string; children?: ReactNode; refEl: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <>
      <h3 ref={refEl} tabIndex={-1} className="font-serif text-[1.4rem] leading-snug text-warm-ink outline-none">{heading}</h3>
      {children && <div className="mt-2 leading-relaxed text-warm-soft">{children}</div>}
    </>
  );
}

/** "Something else" / "Another time": her own words, then Continue. */
function OwnWords({ labelText, value, onChange, onDone, rows, disabled }: { labelText: string; value: string; onChange: (v: string) => void; onDone: () => void; rows?: number; disabled?: boolean }) {
  return (
    <div className="mt-3">
      <label className="block">
        <span className="text-[0.88rem] font-semibold text-warm-ink">{labelText}</span>
        {rows ? (
          <textarea rows={rows} maxLength={140} className={field} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input type="text" maxLength={60} className={field} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        )}
      </label>
      <button type="button" className="btn-primary mt-3" disabled={!value.trim() || disabled} onClick={onDone}>Continue</button>
    </div>
  );
}

function Screen({ s, screen, update, people, kit, household, bonusHref, heading, readOnly, preview, setPreview }: {
  s: GuideState;
  screen: ReturnType<typeof currentScreen>;
  update: (p: Partial<GuideState>) => void;
  people: ReturnType<typeof planMembers>;
  kit: KitConfig;
  household: Household;
  bonusHref: string | null;
  heading: React.RefObject<HTMLHeadingElement | null>;
  readOnly: boolean;
  preview: boolean;
  setPreview: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const [starting, setStarting] = useState(false);
  const [fix, setFix] = useState(0);
  useEffect(() => { setDraft(''); setFix(0); }, [screen]);
  const list = (children: ReactNode) => <div className="mt-4 space-y-2.5">{children}</div>;
  const bonus = kit.bonus;

  switch (screen) {
    case 'start':
      return (
        <>
          <Question refEl={heading} heading="How has your family’s weekly planning been going?">There’s no wrong answer. Pick the one that sounds most like this month.</Question>
          {list(START_OPTIONS.map((o) => <Choice key={o.id} on={s.start === o.id} disabled={readOnly} onClick={() => update({ start: o.id })}>{o.label}</Choice>))}
        </>
      );

    case 'welcome':
      return (
        <>
          <Question refEl={heading} heading="Welcome to the Club!">
            You’re joining at a great time. We’re including our September family planning kit for you, too, so you have everything you need to get started.
          </Question>
          {bonus && (
            <div className="mt-5 bg-cream p-5 ring-1 ring-warm-rule" data-guide-bonus>
              <p className="label text-warm-soft">A gift with your membership</p>
              <h4 className="mt-1 font-serif text-[1.25rem] leading-tight text-warm-ink">{bonus.title}</h4>
              <p className="mt-2 leading-relaxed text-warm-soft">It includes a simple guide for gathering your family around the calendar and making the week’s plan together. {bonus.blurb}</p>
              {bonusHref ? (
                <a className="btn-primary mt-4 inline-block w-full text-center sm:w-auto" href={bonusHref}>{bonus.cta}</a>
              ) : (
                <p className="mt-3 text-[0.92rem] text-warm-soft">It opens here as soon as it’s ready for your account.</p>
              )}
              <p className="mt-3 text-[0.88rem] text-warm-soft">No catching up needed: open it whenever it’s useful. Your answers here wait for you.</p>
            </div>
          )}
          {!starting ? (
            <button type="button" className="btn-secondary mt-5 w-full sm:w-auto" disabled={readOnly} onClick={() => setStarting(true)}>Start November’s Guide</button>
          ) : (
            <>
              <p className="mt-6 font-semibold text-warm-ink">Where would you like to start?</p>
              {list(<>
                <Choice on={s.newStart === 'meeting'} disabled={readOnly} onClick={() => update({ newStart: 'meeting' })}>Plan our first family meeting</Choice>
                <Choice on={s.newStart === 'handoff'} disabled={readOnly} onClick={() => update({ newStart: 'handoff' })}>Hand off one whole job</Choice>
              </>)}
            </>
          )}
        </>
      );

    case 'leader':
      return (
        <>
          <Question refEl={heading} heading="That’s worth celebrating. Who’s usually carrying the planning?" />
          {list(LEADER_OPTIONS.map((o) => <Choice key={o.id} on={s.leader === o.id} disabled={readOnly} onClick={() => update({ leader: o.id })}>{o.label}</Choice>))}
        </>
      );

    case 'offer':
      return (
        <>
          <Question refEl={heading} heading="That sounds like it’s working. Keep it.">
            You don’t need to change who leads. If you’d like a next step, you could hand off one whole job to someone at home.
          </Question>
          {list(<>
            <Choice on={s.offer === 'handoff'} disabled={readOnly} onClick={() => update({ offer: 'handoff' })}>Let’s plan one handoff</Choice>
            <Choice on={s.offer === 'later'} disabled={readOnly} onClick={() => update({ offer: 'later' })}>Not right now</Choice>
          </>)}
        </>
      );

    case 'later':
      return (
        <Question refEl={heading} heading="Keep doing what works.">
          Your family has a rhythm that’s working, and that’s the hard part. When you’re ready to share a bigger job, come back and choose “Let’s plan one handoff.”
        </Question>
      );

    case 'lead': {
      const candidates = leadCandidates(people);
      return (
        <>
          <Question refEl={heading} heading="Share the meeting leadership">
            Ask someone else to lead the next meeting. They ask the questions, help update the calendar, invite everyone to share and help spot what needs preparing. You take part without running it.
          </Question>
          <p className="mt-5 font-semibold text-warm-ink">Who could lead the next meeting?</p>
          {candidates.length > 0 && list(candidates.map((p) => (
            <Choice key={p.id} on={s.leadId === p.id} disabled={readOnly} onClick={() => update({ leadId: p.id, leadName: '' })}>
              {p.firstName}{p.age !== null ? <span className="text-warm-soft">, {p.age}</span> : null}
            </Choice>
          )))}
          <OwnWords labelText={candidates.length ? 'Someone else' : 'Their first name'} value={draft} onChange={setDraft} disabled={readOnly}
            onDone={() => update({ leadId: null, leadName: draft.trim().slice(0, 30) })} />
        </>
      );
    }

    case 'obstacle':
      return (
        <>
          <Question refEl={heading} heading="What made it hard to keep going?">That happens in every family. Pick the main one.</Question>
          {list(OBSTACLE_OPTIONS.map((o) => <Choice key={o.id} on={s.obstacle === o.id} disabled={readOnly} onClick={() => update({ obstacle: o.id, obstacleOther: o.id === 'other' ? s.obstacleOther : '' })}>{o.label}</Choice>))}
          {s.obstacle === 'other' && (
            <OwnWords labelText="What got in the way? A few words is plenty." rows={2} value={draft || s.obstacleOther} onChange={setDraft} disabled={readOnly}
              onDone={() => update({ obstacleOther: (draft || s.obstacleOther).trim().slice(0, 140) })} />
          )}
        </>
      );

    case 'adjust': {
      const c = coachingFor(s.obstacle!, s.obstacleOther, people);
      const named = c.matched ? OBSTACLE_OPTIONS.find((o) => o.id === c.matched)?.label.replace(/\.$/, '').toLowerCase() : null;
      return (
        <>
          <Question refEl={heading} heading={c.title}>
            {named && <span className="mb-2 block text-[0.92rem]">It sounds like this might be about this: {named}</span>}
            {c.why}
          </Question>
          {c.fixes.length > 1 ? (
            <fieldset className="mt-5">
              <legend className="font-semibold text-warm-ink">Choose one adjustment to try</legend>
              <div className="mt-3 space-y-2.5">
                {c.fixes.map((f, i) => (
                  <label key={f} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-[6px] px-4 py-3 ring-1 ${fix === i ? 'bg-sage-wash ring-sage' : 'bg-cream ring-warm-rule'}`}>
                    <input type="radio" name="guide-fix" className="mt-1 h-5 w-5 shrink-0 accent-[#7f9274]" checked={fix === i} onChange={() => setFix(i)} />
                    <span className="text-[1rem] leading-snug text-warm-ink">{f}{i === 0 && <span className="ml-1 text-[0.85rem] text-warm-soft">(our suggestion)</span>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="mt-5 font-semibold text-warm-ink">{c.fixes[0]}</p>
          )}
          {c.roles && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-warm-ink">{c.roles.map((r) => <li key={r}>{r}</li>)}</ul>
          )}
          <button type="button" className="btn-primary mt-5" disabled={readOnly} onClick={() => update({ fix })}>Continue</button>
        </>
      );
    }

    case 'time': {
      const q = s.start === 'off-track' ? 'When will you try it?' : s.leader === 'mom' ? 'When is your next family meeting?' : 'When could your family gather for 5 to 15 minutes?';
      const meeting = s.start === 'not-started' || s.newStart === 'meeting';
      return (
        <>
          <Question refEl={heading} heading={q}>
            {s.start === 'not-started' && <span className="mb-2 block">That’s okay. You don’t need to catch up. Start with one short family meeting.</span>}
            {meeting ? 'Pick a time you’re usually together anyway.' : 'Any day works. Pick the one most likely to happen.'}
          </Question>
          {meeting && bonusHref && (
            <p className="mt-3 text-[0.95rem] text-warm-ink">
              September’s meeting guide walks you through it: <a className={link} href={bonusHref}>open the September kit</a>.
            </p>
          )}
          {list(TIME_OPTIONS.map((o) => <Choice key={o.id} on={s.time === o.id} disabled={readOnly} onClick={() => update({ time: o.id })}>{o.label}</Choice>))}
          {s.time === 'other' && (
            <OwnWords labelText="When works for your family?" value={draft || s.timeOther} onChange={setDraft} disabled={readOnly}
              onDone={() => update({ timeOther: (draft || s.timeOther).trim().slice(0, 60) })} />
          )}
        </>
      );
    }

    case 'place':
      return (
        <>
          <Question refEl={heading} heading="Where will you keep the meeting guide?">Somewhere everyone walks past is the best reminder.</Question>
          {list(PLACE_OPTIONS.map((o) => <Choice key={o.id} on={s.place === o.id} disabled={readOnly} onClick={() => update({ place: o.id })}>{o.label}</Choice>))}
          {s.place === 'other' && (
            <OwnWords labelText="Where?" value={draft || s.placeOther} onChange={setDraft} disabled={readOnly}
              onDone={() => update({ placeOther: (draft || s.placeOther).trim().slice(0, 60) })} />
          )}
        </>
      );

    case 'job':
      return (
        <>
          <p className="label text-warm-soft">Hand Off One Whole Job</p>
          <Question refEl={heading} heading="What’s one thing you’re ready to stop managing alone?">One job, start to finish. Not a list.</Question>
          {list(JOB_OPTIONS.map((o) => <Choice key={o.id} on={s.job === o.id} disabled={readOnly} onClick={() => update({ job: o.id })}>{o.label}</Choice>))}
          {s.job === 'other' && (
            <OwnWords labelText="Which responsibility?" value={draft || s.jobOther} onChange={setDraft} disabled={readOnly}
              onDone={() => update({ jobOther: (draft || s.jobOther).trim().slice(0, 60) })} />
          )}
        </>
      );

    case 'owner': {
      const others = people.filter((p) => !p.isAccountHolder);
      return (
        <>
          <Question refEl={heading} heading="Who could begin to own it?">Pick the person it would suit, not just the oldest. We’ll suggest the version that fits their age.</Question>
          {others.length > 0 && list(others.map((p) => {
            const item = jobFor(s.job, p, kit.items, household.preferences);
            return (
              <Choice key={p.id} on={s.ownerId === p.id} disabled={readOnly} onClick={() => update({ ownerId: p.id, ownerName: '' })}>
                <span className="font-semibold">{p.firstName}</span>{p.age !== null ? <span className="text-warm-soft">, {p.age}</span> : null}
                {s.job !== 'other' && (
                  <span className="mt-0.5 block text-[0.88rem] text-warm-soft">{item ? `Suits their age: ${item.title}` : 'A smaller part of it, to start'}</span>
                )}
              </Choice>
            );
          }))}
          <OwnWords labelText={others.length ? 'Someone else' : 'Their first name'} value={draft} onChange={setDraft} disabled={readOnly}
            onDone={() => update({ ownerId: null, ownerName: draft.trim().slice(0, 30) })} />
        </>
      );
    }

    case 'hard':
      return (
        <>
          <Question refEl={heading} heading="What’s the hardest part about letting someone else own this?">Be honest. Everyone has one.</Question>
          {list(HARD_OPTIONS.map((o) => <Choice key={o.id} on={s.hard === o.id} disabled={readOnly} onClick={() => update({ hard: o.id })}>{o.label}</Choice>))}
        </>
      );

    case 'define':
      return <Define s={s} update={update} people={people} kit={kit} household={household} heading={heading} readOnly={readOnly} />;

    case 'plan':
      return s.plan ? <PlanView s={s} plan={s.plan} update={update} kit={kit} household={household} heading={heading} readOnly={readOnly} preview={preview} setPreview={setPreview} /> : <p className="text-warm-soft">Making your plan…</p>;
  }
}

function Define({ s, update, people, kit, household, heading, readOnly }: {
  s: GuideState; update: (p: Partial<GuideState>) => void; people: ReturnType<typeof planMembers>; kit: KitConfig; household: Household;
  heading: React.RefObject<HTMLHeadingElement | null>; readOnly: boolean;
}) {
  const [d, setD] = useState(() => defineFor(s, people, kit.items, household.preferences));
  const coach = HARD_COACHING[s.hard ?? 'other'];
  return (
    <>
      <div className="bg-cream p-4 ring-1 ring-warm-rule" data-guide-coaching>
        <p className="font-semibold text-warm-ink">{coach.title}</p>
        <p className="mt-1 leading-relaxed text-warm-soft">{coach.body}</p>
      </div>
      <div className="mt-6">
        <Question refEl={heading} heading="Now say exactly what they own">Three short lines. Change any of them.</Question>
      </div>
      <label className="mt-4 block">
        <span className="text-[0.88rem] font-semibold text-warm-ink">Responsibility: what do they own?</span>
        <input type="text" maxLength={160} className={field} value={d.statement} disabled={readOnly} onChange={(e) => setD({ ...d, statement: e.target.value })} />
      </label>
      <label className="mt-4 block">
        <span className="text-[0.88rem] font-semibold text-warm-ink">When: what starts it?</span>
        <input type="text" maxLength={100} className={field} value={d.when} placeholder="e.g. Every school night, after dinner" disabled={readOnly} onChange={(e) => setD({ ...d, when: e.target.value })} />
      </label>
      <label className="mt-4 block">
        <span className="text-[0.88rem] font-semibold text-warm-ink">Done looks like: how will everyone know it’s finished?</span>
        <textarea rows={2} maxLength={160} className={field} value={d.done} placeholder="e.g. Bag packed, water bottle filled, by the door" disabled={readOnly} onChange={(e) => setD({ ...d, done: e.target.value })} />
      </label>
      <button type="button" className="btn-primary mt-5" disabled={readOnly || !d.statement.trim()} onClick={() => update({ define: { statement: d.statement.trim(), when: d.when.trim(), done: d.done.trim() } })}>
        Make our handoff plan
      </button>
    </>
  );
}

function PlanView({ s, plan, update, kit, household, heading, readOnly, preview, setPreview }: {
  s: GuideState; plan: Plan; update: (p: Partial<GuideState>) => void; kit: KitConfig; household: Household;
  heading: React.RefObject<HTMLHeadingElement | null>; readOnly: boolean; preview: boolean; setPreview: (v: boolean) => void;
}) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');
  const familyName = household.displayName ?? 'Our family';
  const set = (patch: Partial<Plan>) => update({ plan: { ...plan, ...patch }, planFor: s.planFor });
  const setHandoff = (patch: Partial<NonNullable<Plan['handoff']>>) => set({ handoff: { ...plan.handoff!, ...patch }, ...(patch.statement !== undefined ? { step: patch.statement } : {}), ...(patch.when !== undefined ? { when: patch.when } : {}) });
  const text = planText(plan, familyName);
  const copyText = () => {
    navigator.clipboard?.writeText(text).then(() => setCopy('copied'), () => setCopy('manual')) ?? setCopy('manual');
  };
  const input = (labelText: string, value: string, onChange: (v: string) => void, max: number, rows?: number) => (
    <label className="mt-4 block">
      <span className="text-[0.85rem] font-semibold text-warm-ink">{labelText}</span>
      {rows ? (
        <textarea rows={rows} maxLength={max} className={field} value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" maxLength={max} className={field} value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
  return (
    <div data-guide-plan={plan.kind}>
      <p className="label text-warm-soft">Your plan</p>
      <h3 ref={heading} tabIndex={-1} className="mt-1 font-serif text-[1.6rem] leading-tight text-warm-ink outline-none">{plan.title}</h3>
      <p className="mt-2 text-[1.05rem] font-semibold text-warm-ink">{plan.goal}</p>
      {plan.obstacle && <p className="mt-1 text-[0.95rem] text-warm-soft">What got in the way: {plan.obstacle}</p>}
      {plan.why && <p className="mt-2 leading-relaxed text-warm-soft">{plan.why}</p>}
      <p className="mt-3 text-[0.92rem] text-warm-soft">Change anything so it sounds like your family. It saves as you type.</p>

      {plan.handoff ? (
        <>
          {input('I own', plan.handoff.statement, (v) => setHandoff({ statement: v }), 160)}
          {input('When', plan.handoff.when, (v) => setHandoff({ when: v }), 100)}
          {input('Done looks like', plan.handoff.done, (v) => setHandoff({ done: v }), 160, 2)}
          <ol className="mt-5 space-y-2">
            {plan.handoff.stages.map((st) => (
              <li key={st.word} className="grid grid-cols-[8.5rem_1fr] gap-3 text-[0.98rem] leading-snug">
                <strong className="text-warm-ink">{st.word}</strong><span className="text-warm-soft">{st.text}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          {input('Our next step', plan.step, (v) => set({ step: v }), 200, 2)}
          {plan.roles.length > 0 && input('Who does what (one per line)', plan.roles.join('\n'), (v) => set({ roles: v.split('\n').slice(0, 8) }), 900, Math.min(plan.roles.length + 1, 7))}
          {input('When we’ll try it', plan.when, (v) => set({ when: v }), 100)}
        </>
      )}
      {input('Who’s involved', plan.who, (v) => set({ who: v }), 160)}
      {input('Our reminder', plan.cue, (v) => set({ cue: v }), 160)}
      {input('Check-in question', plan.checkIn, (v) => set({ checkIn: v }), 160)}

      <div className="mt-6 border-t border-warm-rule pt-5">
        <h4 className="label text-warm-soft">Print or copy your plan</h4>
        {kit.mailer.calendarNote && <p className="mt-2 text-[0.95rem] leading-relaxed text-warm-ink">{kit.mailer.calendarNote}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-6">
          {clubNav().canPrint && <button type="button" className={link} onClick={() => printDocument(DOC, 'portrait')}>Print it</button>}
          <button type="button" className={link} aria-expanded={preview} onClick={() => setPreview(!preview)}>{preview ? 'Hide the preview' : 'Preview the printout'}</button>
          <button type="button" className={link} onClick={copyText}>{copy === 'copied' ? 'Copied' : 'Copy as text'}</button>
        </div>
        {!clubNav().canPrint && <PreviewOnlyNote />}
        {copy === 'manual' && (
          <label className="mt-2 block">
            <span className="text-[0.85rem] text-warm-soft">Select the text and copy it:</span>
            <textarea readOnly rows={10} className="mt-1 block w-full rounded-[4px] border border-warm-rule bg-white p-2 font-mono text-[0.85rem] text-warm-ink" value={text} onFocus={(e) => e.target.select()} />
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * V16 Family Meeting: Our Focus → Let's Talk → Everyone's Part → Let's Practice, one step at a time, resumable;
 * the Week Four check-in; and the "We have a plan" summary. Content comes from the real engines:
 * buildFamilyMeeting (the Club month, src/lib/club/family-meeting.ts) and the development rules
 * (src/lib/family-development/records.ts, via src/lib/v16/model.ts). Stages are never shown.
 */
import { useMemo, useState } from 'react';
import { coachLine } from '../../lib/family-development/language';
import {
  MAX_PER_WEEK, SHOWN, agreedParts, endDiscussion, addNotePriority, currentPriorities, dayName, decide, isReadOnly, linkOf, occurrenceOf, priorityCount, practiceQuestions,
  sharedOccurrences, togglePriority, type MeetingStep, type Part, type PracticeQuestion,
} from '../../lib/v16/model';
import { timeLabel, type Occurrence } from '../../lib/calendar/recurrence';
import { PartRow } from './Parts';
import { Arrow, Art, CheckMark, Down, Illo, Person, artFor, fmtDate, type Ctx } from './shared';
import WallCalendar from './WallCalendar';
import { enginePeople } from '../v18/TodayV18';
import { buildTodayV19 } from '../../lib/v19/engine';
import { talked } from '../../lib/v19/resolve';
import CarryForward from '../v21/CarryForward';

export const STEPS = ['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice'] as const;
const FREE_QUESTIONS = [
  'What went well since last time?',
  'What was hard this week? Everyone answers, the youngest first.',
  'Is there anything coming up that someone is worried about?',
];

function setStep(ctx: Ctx, step: MeetingStep) {
  ctx.set((s) => ({ ...s, meeting: { ...s.meeting, step, started: true } }));
  try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
}

function Nav({ ctx, step, next, nextLabel = 'Continue' }: { ctx: Ctx; step: MeetingStep; next: () => void; nextLabel?: string }) {
  return (
    <>
      <div className="v16-actions">
        <button type="button" className="of-btn of-btn--soft" onClick={() => (step === 0 ? ctx.go('today') : setStep(ctx, (step - 1) as MeetingStep))} data-meeting-back>Back</button>
        <button type="button" className="of-btn" onClick={next} data-meeting-next>{nextLabel} <Arrow /></button>
      </div>
      <div className="v16-later"><button type="button" className="v16-link" onClick={() => ctx.go('today')} data-come-back-later>Come back later</button></div>
    </>
  );
}

function Head({ step, title, lede, look = 'v16' }: { step: MeetingStep; title: string; lede: string; look?: Ctx['look'] }) {
  return (
    <header>
      {look === 'v17' ? (
        <div className="v17-steps pt-2" aria-label={`Family Meeting, part ${step + 1} of 4`}>
          {STEPS.map((name, i) => <span key={name} data-on={i <= step ? '' : undefined} title={name} />)}
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3 pt-2">
          <p className="v16-eyebrow">Family Meeting</p>
          <p className="v16-meta" aria-label={`Part ${step + 1} of 4`}>{step + 1} of 4</p>
        </div>
      )}
      <h1 className="v16-h1" data-step-title>{title}</h1>
      <p className="v16-lede">{lede}</p>
    </header>
  );
}

export default function Meeting({ ctx }: { ctx: Ctx }) {
  const step = ctx.s.meeting.step;
  if (step === 0) return <Focus ctx={ctx} />;
  if (step === 1) return <Talk ctx={ctx} />;
  if (step === 2) return <EveryonesPart ctx={ctx} />;
  return <Practice ctx={ctx} />;
}

// ------------------------------------------------------------------ 1. Our Focus

function Members({ ctx, ids }: { ctx: Ctx; ids: string[] }) {
  const known = ids.filter((id) => ctx.names[id]);
  if (!known.length) return null;
  return <span className="inline-flex items-center gap-1" aria-label={`For ${known.map((id) => ctx.names[id]).join(', ')}`}>{known.map((id) => <span key={id} className="of-dot" style={{ background: ctx.colors[id]?.hex }} />)}</span>;
}

function FocusRow({ ctx, o, full }: { ctx: Ctx; o: Occurrence; full: boolean }) {
  const link = linkOf(o.event);
  const on = ctx.s.priorities.some((p) => p.from === 'this-week' && p.eventLink === link);
  return (
    <div className="v16-row" data-focus-event={o.event.title}>
      {ctx.look === 'v17' && <Art name={artFor(o.event.title)} />}
      <span className="v16-row-main">
        <span className="v16-row-title block">{o.event.title}</span>
        <span className="v16-meta flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{dayName(o.date)} · {timeLabel(o.event)}{o.event.recurrence ? ' · every week' : ''}</span>
          <Members ctx={ctx} ids={o.event.member_ids} />
          {isReadOnly(o.event) && <span className="v16-pill v16-pill--ro">{o.event.external!.name}</span>}</span>
      </span>
      <button type="button" className="v16-toggle" aria-pressed={on} disabled={!on && full} onClick={() => ctx.set((s) => ({ ...s, priorities: togglePriority(s, link) }))}
        aria-label={`${on ? 'Remove' : 'Highlight'} ${o.event.title}`} data-highlight>
        <span aria-hidden="true" className="v16-toggle-dot">{on && <CheckMark />}</span>
      </button>
    </div>
  );
}

function Focus({ ctx }: { ctx: Ctx }) {
  const [note, setNote] = useState('');
  const occ = sharedOccurrences(ctx.s, ctx.monday).filter((o) => o.event.title !== 'Family Meeting' && o.date >= ctx.monday);
  const prepared = new Set(ctx.s.parts.filter((p) => p.eventLink && p.status !== 'skipped').map((p) => p.eventLink!));
  const seen = new Set<string>();
  const once = (o: Occurrence) => { const k = `${linkOf(o.event)}`; if (seen.has(k)) return false; seen.add(k); return true; };
  // One-off events first; a repeating activity that needs preparation this week joins them; the rest are "Our usual week".
  const main = occ.filter((o) => !o.event.recurrence || prepared.has(linkOf(o.event))).filter(once);
  const usual = occ.filter((o) => o.event.recurrence && !prepared.has(linkOf(o.event))).filter(once);
  const n = priorityCount(ctx.s);
  const full = n >= MAX_PER_WEEK;
  const notes = ctx.s.priorities.filter((p) => p.from === 'this-week' && p.kind === 'note');
  return (
    <section aria-labelledby="focus-h" data-meeting-step="focus">
      <Head look={ctx.look} step={0} title="Our Focus" lede="What needs our attention this week?" />
      <div className="v16-rows mt-3">
        {main.map((o) => <FocusRow key={`${o.event.id}-${o.date}`} ctx={ctx} o={o} full={full} />)}
        {!main.length && <p className="v16-meta py-4">Nothing new on the shared calendar this week.</p>}
      </div>
      {usual.length > 0 && (
        <details className="v16-details mt-2 border-t border-[color:var(--of-rule)]" data-usual-week>
          <summary>Our usual week ({usual.length}) <Down open={false} /></summary>
          <div className="v16-rows">{usual.map((o) => <FocusRow key={`${o.event.id}-${o.date}`} ctx={ctx} o={o} full={full} />)}</div>
        </details>
      )}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); ctx.set((s) => ({ ...s, priorities: addNotePriority(s, note) })); setNote(''); }}>
        <label className="v16-sr" htmlFor="focus-note">Something else that matters this week</label>
        <input id="focus-note" className="v16-input" placeholder="Something else? A few words" value={note} maxLength={120} disabled={full} onChange={(e) => setNote(e.target.value)} data-focus-note />
        <button type="submit" className="v16-choice" disabled={full || !note.trim()}>Add</button>
      </form>
      {notes.length > 0 && <ul className="mt-2 grid gap-1">{notes.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-2 text-[0.92rem]">“{p.text}”
          <button type="button" className="v16-link !min-h-[40px] !text-[0.78rem]" onClick={() => ctx.set((s) => ({ ...s, priorities: s.priorities.filter((x) => x.id !== p.id) }))}>Remove</button></li>))}</ul>}
      <p className="v16-meta mt-4" role="status" data-focus-count>
        {n === 0 ? `Choose a few. ${SHOWN} is normal; ${MAX_PER_WEEK} at most.` : `${n} chosen${n > SHOWN ? ' · that’s a full week' : ''}.${full ? ' That’s the most for one week.' : ''}`} Everything else stays in Plans.
      </p>
      <Nav ctx={ctx} step={0} next={() => setStep(ctx, 1)} />
    </section>
  );
}

// ------------------------------------------------------------------ 2. Let's Talk

function Talk({ ctx }: { ctx: Ctx }) {
  const club = ctx.club;
  const questions = club ? club.talk.questions.map((q) => q.text) : FREE_QUESTIONS;
  const i = Math.min(ctx.s.meeting.talkIndex, questions.length - 1);
  const [by, setBy] = useState(ctx.people.find((m) => m.kind === 'child')?.id ?? ctx.people[0]?.id ?? '');
  const [idea, setIdea] = useState('');
  const ideas = ctx.s.parts.filter((p) => p.origin === 'idea');
  const add = () => {
    const t = idea.trim();
    if (!t || !by) return;
    ctx.set((s) => ({ ...s, parts: [...s.parts, { id: `p-idea-${Date.now()}`, origin: 'idea', title: t.slice(0, 80), ownerId: by, ideaBy: by, finishLine: '', status: 'suggested' } satisfies Part] }));
    setIdea('');
  };
  return (
    <section data-meeting-step="talk">
      <Head look={ctx.look} step={1} title="Let’s Talk" lede="Talk it through out loud. Nothing here needs typing." />
      <div className={`v16-card ${club ? 'v16-card--month' : 'v16-card--quiet'}`} data-talk-card data-club={club ? '' : undefined}>
        {ctx.look === 'v17' && <Illo name="conversation-bubbles" size="lg" />}
        {club ? (
          <p className="v16-eyebrow !text-[color:var(--of-month-accent)]">This month · {club.theme}</p>
        ) : (
          <p className="v16-eyebrow">Our conversation</p>
        )}
        <p className="v16-card-title mt-2" aria-live="polite" data-talk-question>{questions[i]}</p>
        {club && i === 0 && <p className="v16-meta mt-2">{club.focus.principle}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="v16-meta">Question {i + 1} of {questions.length}</span>
          {questions.length > 1 && (
            <button type="button" className="v16-link" onClick={() => ctx.set((s) => ({ ...s, meeting: { ...s.meeting, talkIndex: (i + 1) % questions.length } }))} data-next-question>
              {i + 1 < questions.length ? 'Another question' : 'Back to the first'} <Arrow />
            </button>
          )}
        </div>
        {club && <p className="v16-meta mt-1">From {club.resourceTitle}, this month’s Family Meeting Club kit.</p>}
      </div>

      {(ctx.gen === 19 || ctx.gen === 20 || ctx.gen === 21) && <AgendaV19 ctx={ctx} />}
      {ctx.gen === 21 && <CarryForward ctx={ctx} />}
      {ctx.gen !== 19 && ctx.gen !== 20 && ctx.gen !== 21 && ctx.s.intel && ctx.s.intel.topics.length > 0 && (
        <div className="v16-section" data-meeting-topics-list>
          <h2 className="v16-h3">Brought up from Today</h2>
          <ul className="v16-rows">{ctx.s.intel.topics.map((t) => (
            <li key={t.key} className="v16-row" data-topic={t.key}>
              <span className="v16-row-main">{t.text}</span>
              <button type="button" className="v16-link" onClick={() => ctx.set((s) => ({ ...s, intel: { ...s.intel!, topics: s.intel!.topics.filter((x) => x.key !== t.key) } }))} data-topic-done>Talked about it</button>
            </li>
          ))}</ul>
        </div>
      )}

      <h2 className="v16-h3 mt-7" id="idea-h">Someone have an idea?</h2>
      <p className="v16-meta mt-1">In their own words. It stays an idea until the family agrees.</p>
      <form className="mt-3 grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-2" onSubmit={(e) => { e.preventDefault(); add(); }} aria-labelledby="idea-h">
        <label className="v16-sr" htmlFor="idea-by">Whose idea</label>
        <select id="idea-by" className="v16-input" value={by} onChange={(e) => setBy(e.target.value)} data-idea-by>
          {ctx.people.map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}
        </select>
        <label className="v16-sr" htmlFor="idea-text">Their idea</label>
        <input id="idea-text" className="v16-input" placeholder="I could help with…" value={idea} maxLength={80} onChange={(e) => setIdea(e.target.value)} data-idea-text />
        <button type="submit" className="v16-choice col-span-2" disabled={!idea.trim()} data-add-idea>Add their idea</button>
      </form>
      {ideas.length > 0 && (
        <ul className="v16-rows mt-3" data-ideas>
          {ideas.map((p) => (
            <li key={p.id} className="v16-row"><Person ctx={ctx} id={p.ideaBy ?? null} />
              <span className="v16-row-main"><span className="v16-row-title block">“{p.title}”</span><span className="v16-meta">{ctx.names[p.ideaBy!]}’s idea · <span className="v16-pill">{p.status === 'agreed' ? 'Agreed' : 'Not agreed yet'}</span> · decide in Everyone’s Part</span></span>
            </li>
          ))}
        </ul>
      )}
      <Nav ctx={ctx} step={1} next={() => setStep(ctx, 2)} />
    </section>
  );
}

// ------------------------------------------------------------------ 3. Everyone's Part

const ORDER = (p: Part) => (p.eventLink ? 0 : p.cleaningTask ? 1 : p.origin === 'idea' ? 2 : p.origin === 'month' ? 3 : 1);

export function EveryonesPartList({ ctx, parts, startOpen }: { ctx: Ctx; parts: Part[]; startOpen?: string }) {
  const [open, setOpen] = useState<string | null>(startOpen ?? null);
  return (
    <div className="v16-rows">
      {parts.map((p, i) => <PartRow key={p.id} ctx={ctx} part={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} prominent={i === 0 && p.status !== 'agreed'} />)}
    </div>
  );
}

function EveryonesPart({ ctx }: { ctx: Ctx }) {
  const [more, setMore] = useState(false);
  // Agreed before this week: stays in this list while being discussed or changed, so an open editor never jumps away.
  const inForce = ctx.s.parts.filter((p) => p.agreedCopy && p.agreedOn && p.agreedOn < ctx.monday && p.status !== 'skipped');
  const open = ctx.s.parts.filter((p) => !inForce.includes(p) && p.status !== 'skipped').sort((a, b) => ORDER(a) - ORDER(b));
  const skipped = ctx.s.parts.filter((p) => p.status === 'skipped');
  const ideas = open.filter((p) => p.origin === 'idea');
  // One prepared proposal first; ideas from the family are never hidden behind "more".
  const shown = more ? open : [...open.slice(0, 1), ...ideas.filter((p) => p !== open[0])];
  const hidden = open.length - shown.length;
  return (
    <section data-meeting-step="parts">
      <Head look={ctx.look} step={2} title="Everyone’s Part" lede="Decide together. You can edit right here without leaving the meeting." />
      {inForce.length > 0 && (
        <details className="v16-details mt-3" data-in-force>
          <summary>Already agreed · still in place ({inForce.length}) <Down open={false} /></summary>
          <EveryonesPartList ctx={ctx} parts={inForce} />
        </details>
      )}
      <div className="mt-2" data-proposals>
        <EveryonesPartList ctx={ctx} parts={shown} />
        {!open.length && <p className="v16-meta py-4">No new suggestions this week.</p>}
      </div>
      {(hidden > 0 || more) && open.length > 1 && (
        <div className="flex justify-center border-t border-[color:var(--of-rule)] pt-1">
          <button type="button" className="v16-link" aria-expanded={more} onClick={() => setMore(!more)} data-more-suggestions>
            {more ? 'Show fewer' : `See other suggestions (${hidden})`} <Down open={more} />
          </button>
        </div>
      )}
      {skipped.length > 0 && (
        <details className="v16-details mt-1" data-skipped>
          <summary>Skipped ({skipped.length}) <Down open={false} /></summary>
          <EveryonesPartList ctx={ctx} parts={skipped} />
        </details>
      )}
      <p className="v16-meta mt-3 v16-explain">Only what you agree shows on Today as someone’s part. Suggestions you don’t decide on stay here for next time.</p>
      <Nav ctx={ctx} step={2} next={() => setStep(ctx, 3)} />
    </section>
  );
}

// ------------------------------------------------------------------ 4. Let's Practice

export function Readiness({ ctx, compact = false }: { ctx: Ctx; compact?: boolean }) {
  const questions = useMemo(() => practiceQuestions(ctx.s, ctx.names, ctx.kids), [ctx.s, ctx.names, ctx.kids]);
  const [who, setWho] = useState<string | null>(null);
  const [others, setOthers] = useState(false);
  const answered = ctx.s.practice.memberId && ctx.s.practice.outcome;
  const q: PracticeQuestion | undefined = questions.find((x) => x.memberId === who) ?? questions[0];
  if (ctx.s.practice.nothing) {
    return <div className="v16-card v16-card--quiet" data-practice-none><p className="text-[0.95rem]">Nothing to practice this time. That’s fine.</p>
      <button type="button" className="v16-link" onClick={() => ctx.set((s) => ({ ...s, practice: {} }))}>Choose something after all</button></div>;
  }
  if (answered) {
    return (
      <div className="v16-card" role="status" data-practice-outcome>
        <p className="v16-card-title">{ctx.s.practice.outcome}</p>
        <button type="button" className="v16-link !text-[color:var(--of-sage-ink)]" onClick={() => ctx.set((s) => ({ ...s, practice: {} }))}>Talk about someone else</button>
      </div>
    );
  }
  if (!q) {
    return <p className="v16-meta" data-practice-empty>{agreedParts(ctx.s).length > 0 ? 'Everyone’s agreed parts are already theirs. Nothing to practice right now.' : 'Agree on a part in Everyone’s Part first; practice grows from what the family agreed.'}</p>;
  }
  const choose = (c: PracticeQuestion['choices'][number]) => ctx.set((s) => {
    const records = decide(s, q, c, ctx.today);
    const r = records.find((x) => x.memberId === q.memberId && x.skillId === q.skill)!;
    const outcome = c.decision === 'stay' ? `Saved. ${ctx.names[q.memberId]} keeps practicing with help this week.` : `Saved. This week: ${coachLine(r.stage!, ctx.names[q.memberId])}`;
    return { ...s, records, practice: { memberId: q.memberId, skill: q.skill, outcome } };
  });
  return (
    <div className={compact ? '' : 'v16-card'} data-practice-question={q.memberId}>
      <div className="flex items-start gap-3">
        <Person ctx={ctx} id={q.memberId} size="md" />
        <p className={compact ? 'text-[1.02rem] font-medium' : 'text-[1.08rem] font-medium leading-snug'}>{q.text}</p>
      </div>
      <div className="v16-choices v16-choices--pair">
        {q.choices.filter((c) => !c.more || others).map((c) => <button key={c.label} type="button" className={`v16-choice${c.primary ? ' v16-choice--primary' : ''}`} onClick={() => choose(c)} data-practice-choice={c.decision} data-practice-stage-choice={c.stage ? '' : undefined}>{c.label}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4">
        {q.choices.some((c) => c.more) && !others && <button type="button" className="v16-link" onClick={() => setOthers(true)} data-practice-more>Other answers</button>}
        {questions.length > 1 && <button type="button" className="v16-link" onClick={() => setWho(questions[(questions.indexOf(q) + 1) % questions.length].memberId)} data-practice-other>Someone else</button>}
        <button type="button" className="v16-link" onClick={() => ctx.set((s) => ({ ...s, practice: { nothing: true } }))} data-practice-nothing>Nothing to practice this time</button>
      </div>
    </div>
  );
}

function Practice({ ctx }: { ctx: Ctx }) {
  const finish = () => {
    celebrateNext = true;
    if (ctx.look === 'v17') try { navigator.vibrate?.(12); } catch { /* not supported */ }
    ctx.set((s) => ({ ...s, parts: endDiscussion(s.parts), meeting: { ...s.meeting, step: 0, started: false, finishedOn: ctx.today, talkIndex: 0 } }));
    ctx.go('plan');
  };
  return (
    <section data-meeting-step="practice">
      <Head look={ctx.look} step={3} title="Let’s Practice" lede="One small step toward more responsibility. No extra tracking." />
      <div className="mt-4"><Readiness ctx={ctx} /></div>
      {ctx.club && (
        <details className="v16-details mt-3" data-club-practice>
          <summary>This month’s practice: {ctx.club.practice.title} <Down open={false} /></summary>
          <ol className="list-decimal pl-5 text-[0.92rem] leading-relaxed">{ctx.club.practice.steps.map((t) => <li key={t}>{t}</li>)}</ol>
          <p className="v16-meta mt-2">{ctx.club.practice.resource}</p>
        </details>
      )}
      <WallCalendar ctx={ctx} />
      <Nav ctx={ctx} step={3} next={finish} nextLabel="Finish meeting" />
    </section>
  );
}

// ------------------------------------------------------------------ Week Four check-in

export function CheckIn({ ctx }: { ctx: Ctx }) {
  const still = agreedParts(ctx.s).filter((p) => p.agreedOn && p.agreedOn < ctx.monday);
  const stillIds = new Set(still.map((p) => p.id));
  const fresh = ctx.s.parts.filter((p) => !stillIds.has(p.id) && p.eventLink && p.origin === 'prepared');
  return (
    <section data-check-in>
      <p className="v16-eyebrow pt-2">Family check-in</p>
      <h1 className="v16-h1">Anything new this week?</h1>
      {still.length > 0 && (
        <div className="v16-card" data-still-working>
          {ctx.look === 'v17' && <Illo name="helping-hands" size="lg" />}
          <p className="v16-card-title">Still working</p>
          <ul className="mt-2 grid gap-2">{still.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-[0.92rem]"><Person ctx={ctx} id={p.ownerId} /> {ctx.names[p.ownerId!]} · {p.title}</li>))}</ul>
          <p className="v16-meta mt-2 !text-[color:var(--of-sage-ink)]">Agreed before. Nothing to confirm again.</p>
        </div>
      )}
      {fresh.map((p) => {
        const o = p.eventLink ? occurrenceOf(ctx.s, ctx.monday, p.eventLink) : null;
        return (
          <div key={p.id} className="v16-section" data-new-activity>
            <div className="v17-lead">
              {ctx.look === 'v17' && <Art name={artFor(o?.event.title ?? '')} />}
              <div className="min-w-0">
                <p className="v16-eyebrow">New · {o ? dayName(o.date) : 'this week'}</p>
                <h2 className="v16-h2 mt-1">{o?.event.title ?? 'Activity'}</h2>
                {o && <p className="v16-meta">{fmtDate(o.date)} · {timeLabel(o.event)}{o.event.external ? ` · from ${o.event.external.name}, read-only` : ''}</p>}
              </div>
            </div>
            <EveryonesPartList ctx={ctx} parts={[p]} startOpen={p.id} />
          </div>
        );
      })}
      <div className="v16-section border-t border-[color:var(--of-rule)] pt-5"><Readiness ctx={ctx} compact /></div>
      <button type="button" className="of-btn of-btn--block mt-6" onClick={() => { ctx.set((s) => ({ ...s, parts: endDiscussion(s.parts), meeting: { ...s.meeting, checkInDone: true } })); ctx.go('today'); }} data-finish-check-in>Finish check-in</button>
      <div className="v16-later"><button type="button" className="v16-link" onClick={() => ctx.go('meeting')} data-full-meeting>Full Family Meeting</button></div>
    </section>
  );
}

// ------------------------------------------------------------------ We have a plan

/** Set by Finish meeting: the summary celebrates once, on arrival, not every time it's reopened. */
let celebrateNext = false;
// The calendar's own colors, at full strength, for the few sparks.
const SPARKS = ['#3a7895', '#4b8746', '#bf5d69', '#c98b0c', '#7357ad', '#3a7895', '#c98b0c', '#bf5d69'];

/** V17's Family Meeting completion: the family illustration (a celebratory moment), a check, a few sparks. Once. */
function Celebrate() {
  return (
    <div className="v17-celebrate" aria-hidden="true" data-celebrate>
      {SPARKS.map((c, i) => <span key={i} className="v17-spark" style={{ '--c': c, '--a': `${i * 45 + 20}deg` } as import('react').CSSProperties} />)}
      <span className="v17-celebrate-art"><img src="/assets/icons/ofc/v2/routines/family-group.webp" alt="" /></span>
      <span className="v17-celebrate-check"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.6 4.6L19 7.5" /></svg></span>
    </div>
  );
}

export function PlanSummary({ ctx }: { ctx: Ctx }) {
  const prios = currentPriorities(ctx.s);
  const agreed = agreedParts(ctx.s);
  const [celebrate] = useState(() => { const c = celebrateNext; celebrateNext = false; return c && ctx.look === 'v17'; });
  return (
    <section data-plan-summary data-celebrating={celebrate ? '' : undefined}>
      <div className={celebrate ? 'v17-moment' : undefined} data-moment={celebrate ? '' : undefined}>
        {celebrate && <Celebrate />}
        {!celebrate && <p className="v16-eyebrow pt-2">Family Meeting</p>}
        <h1 className="v16-h1">We have a plan.</h1>
        <p className="v16-lede">Everyone’s part is on Today. Come back to the meeting any time.</p>
      </div>
      <div className="v16-section">
        <h2 className="v16-h3">What matters</h2>
        <ul className="v16-rows">{prios.map((p) => {
          const o = p.eventLink ? occurrenceOf(ctx.s, ctx.monday, p.eventLink) : null;
          return <li key={p.id} className="v16-row"><span className="v16-row-main"><span className="v16-row-title block">{p.kind === 'note' ? p.text : o?.event.title ?? 'Not on this week’s calendar'}</span>{o && <span className="v16-meta">{dayName(o.date)} · {timeLabel(o.event)}</span>}</span></li>;
        })}
        {!prios.length && <li className="v16-meta py-3">No priorities chosen. That’s allowed.</li>}</ul>
      </div>
      <div className="v16-section">
        <h2 className="v16-h3">Everyone’s part</h2>
        <ul className="v16-rows">{agreed.map((p) => <li key={p.id} className="v16-row"><Person ctx={ctx} id={p.ownerId} /><span className="v16-row-main"><span className="v16-row-title block">{ctx.names[p.ownerId!]} · {p.title}</span><span className="v16-meta">Done means: {p.finishLine || '—'}</span></span></li>)}
        {!agreed.length && <li className="v16-meta py-3">Nothing agreed this time.</li>}</ul>
      </div>
      {ctx.s.practice.outcome && <p className="v16-card">{ctx.s.practice.outcome}</p>}
      <button type="button" className="of-btn of-btn--block mt-7" onClick={() => ctx.go('today')} data-back-to-today>Back to Today</button>
      <div className="v16-later"><button type="button" className="v16-link" onClick={() => { ctx.set((s) => ({ ...s, meeting: { ...s.meeting, step: 0, started: true } })); ctx.go('meeting'); }}>Open the meeting again</button></div>
    </section>
  );
}

/**
 * V19: what Today routed to the meeting (friction, ownership, seasons, intentions, early preparation), one at a time in
 * the same light brown card, like the month's questions. Prepared, never decided: "Talked about it" just clears it.
 */
function AgendaV19({ ctx }: { ctx: Ctx }) {
  const people = useMemo(() => enginePeople(ctx), [ctx.people, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const agenda = buildTodayV19({ s: ctx.s, monday: ctx.monday, today: ctx.today, people }).agenda;
  const [i, setI] = useState(0);
  if (!agenda.length) return null;
  const item = agenda[Math.min(i, agenda.length - 1)];
  return (
    <section className="v18-heads v19-agenda" aria-label="Worth talking about" data-agenda={item.key}>
      <p className="v18-heads-eyebrow">{item.eyebrow} · {Math.min(i, agenda.length - 1) + 1} of {agenda.length}</p>
      <h2 className="v18-heads-title">{item.title}</h2>
      {item.body && <p className="v18-heads-body">{item.body}</p>}
      <div className="v18-heads-actions">
        <button type="button" className="v18-heads-primary" onClick={() => ctx.set((s) => talked(s, item.key, ctx.today))} data-agenda-talked>Talked about it <span aria-hidden="true">✓</span></button>
        {agenda.length > 1 && <button type="button" className="v18-heads-quiet" onClick={() => setI((i + 1) % agenda.length)} data-agenda-next>Next</button>}
      </div>
    </section>
  );
}

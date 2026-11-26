/**
 * V18 Intelligent Today (docs/ios/V18_TODAY_INTELLIGENCE.md), on the V17 visual system. Today only; every other
 * screen is the V17 preview's.
 *
 *   headline        grounded in the day, from the engine (src/lib/v18/engine.ts)
 *   heads-up card   at most one, or none; one primary action into an existing workflow, a quiet Dismiss
 *   What matters    the family's priorities (and, separately, an activity with a live attention line), preparation nested
 *   Everyone's part the viewer's own and today's first; the rest behind "See other responsibilities (n)"
 *   Family Meeting  one compact row, or a resume row
 *
 * No AI branding, persona or chat. The interpreter is optional and, in this preview, simulated.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { dailyEssentials, weeklySchedule } from '../../data/cleaning';
import { timeLabel } from '../../lib/calendar/recurrence';
import { DAY_NAMES, dayName, partDate, sessionDay, sharedOccurrences, zoneKey, type Part } from '../../lib/v16/model';
import {
  buildToday, matterRows, nextMeeting, observe, orderParts, pendingInterpretations, propose, resolve, memoryLine,
  type ActionId, type Insight, type Person as EnginePerson, type TodayInput,
} from '../../lib/v18/engine';
import { confirm, forget } from '../../lib/v18/memory';
import { simulatedInterpreter, validateInterpretation } from '../../lib/v18/interpret';
import { act, PartRow } from '../v16/Parts';
import { Art, artFor, Check, CleaningBox, Person, Sheet, StatusPill, fmtDate, type Ctx, type Glyph } from '../v16/shared';
import { Chevron } from '../app/ui';

const STEP = ['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice'];
const SHOWN_PARTS = 3;

const ICON: Record<Insight['type'], Glyph> = { exception: 'sync', 'invisible-work': 'calendar', 'open-loop': 'chat', capacity: 'calendar', development: 'heart' };

export function enginePeople(ctx: Ctx): EnginePerson[] {
  const year = Number(ctx.today.slice(0, 4));
  return ctx.people.map((m) => ({ id: m.id, firstName: m.firstName, kind: m.kind === 'adult' ? 'adult' : 'child', age: m.birthYear ? year - m.birthYear : undefined }));
}

function actionLabel(a: ActionId, meetingDay: string | null): string {
  switch (a) {
    case 'make-plan': return 'Make a plan';
    case 'finish-plan': return 'Finish the plan';
    case 'review-plan': return 'Review the plan';
    case 'review-week': return 'Review our week';
    case 'bring-up': return meetingDay ? `Bring it up ${meetingDay}` : 'Bring it up at your meeting';
    case 'handled': return 'Already handled';
    case 'dismiss': return 'Dismiss';
  }
}

export default function TodayV18({ ctx }: { ctx: Ctx }) {
  const intel = ctx.s.intel!;
  const people = useMemo(() => enginePeople(ctx), [ctx.people, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const inp: TodayInput = { s: ctx.s, monday: ctx.monday, today: ctx.today, people };
  const model = useMemo(() => buildToday(inp), [ctx.s, ctx.today, people]); // eslint-disable-line react-hooks/exhaustive-deps
  const meeting = nextMeeting(inp);
  const meetingDay = meeting ? dayName(meeting.date) : null;
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [allParts, setAllParts] = useState(false);

  // The optional interpreter: only events the rules can't place, once per fingerprint, cached in the family's state.
  const available = useRef(intel.aiAvailable);
  available.current = intel.aiAvailable;
  const interpreter = useMemo(() => simulatedInterpreter(() => available.current), []);
  const pending = pendingInterpretations(inp);
  const pendingIds = pending.map((p) => p.fingerprint).join(',');
  useEffect(() => {
    let live = true;
    for (const { fingerprint, input } of pending) {
      interpreter.interpret(input).then((raw) => {
        const v = validateInterpretation(raw, interpreter.simulated ? 'simulated' : 'model');
        if (live && v) ctx.set((s) => ({ ...s, intel: { ...s.intel!, interpretations: { ...s.intel!.interpretations, [fingerprint]: v } } }));
      }).catch(() => { /* unavailable: the rules' reading stands */ });
    }
    return () => { live = false; };
  }, [pendingIds, intel.aiAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (i: Insight, a: ActionId) => {
    if (a === 'dismiss') return ctx.set((s) => resolve(s, i, 'dismissed', ctx.today));
    if (a === 'handled') { setSheetKey(null); return ctx.set((s) => resolve(s, i, 'handled', ctx.today)); }
    if (a === 'bring-up') { setSheetKey(null); return ctx.set((s) => resolve(s, i, 'topic', ctx.today)); }
    if (a === 'review-week') return ctx.go('plans');
    setSheetKey(i.key);
  };

  const card = model.card;
  const rows = matterRows(inp, model);
  // Preparation already shown under its activity in What matters isn't repeated here.
  const parts = orderParts(inp).filter((p) => !p.eventLink || !rows.some((r) => r.link === p.eventLink));
  const shownParts = allParts ? parts : parts.slice(0, SHOWN_PARTS);
  const sheet = sheetKey ? model.all.find((i) => i.key === sheetKey) ?? null : null;
  const todayWd = new Date(`${ctx.today}T12:00:00Z`).getUTCDay();
  const dailyDone = dailyEssentials.tasks.filter((t) => ctx.s.cleaning.checks[`daily:${ctx.today}:${t.id}`]).length;

  return (
    <section data-screen="today" data-v18 data-headline={model.headline}>
      <p className="v16-kicker">{ctx.household.displayName?.replace(/^The /, '') ?? 'Our family'} · {fmtDate(ctx.today)}</p>
      <h1 className="v16-h1" data-v18-headline>{model.headline}</h1>
      {model.sub && <p className="v18-sub" data-v18-sub>{model.sub}</p>}

      {card && (
        <section className="v18-heads" aria-labelledby="v18-heads-title" data-heads-up={card.type} data-insight={card.key} data-source={card.source}>
          <p className="v18-heads-eyebrow"><Art name={ICON[card.type]} size="sm" />{card.eyebrow}</p>
          <h2 className="v18-heads-title" id="v18-heads-title">{card.title}</h2>
          {card.body && <p className="v18-heads-body">{card.body}</p>}
          <div className="v18-heads-actions">
            <button type="button" className="v18-heads-primary" onClick={() => run(card, card.action)} data-heads-action={card.action}>{actionLabel(card.action, meetingDay)} <span aria-hidden="true">→</span></button>
            {card.secondary === 'bring-up' && card.action !== 'bring-up' && <button type="button" className="v18-heads-quiet" onClick={() => run(card, 'bring-up')} data-heads-secondary>{actionLabel('bring-up', meetingDay)}</button>}
            <button type="button" className="v18-heads-quiet v18-heads-dismiss" onClick={() => run(card, 'dismiss')} data-heads-dismiss>Dismiss</button>
          </div>
        </section>
      )}

      <div className="v16-section">
        <div className="v16-section-head">
          <h2 className="v16-h2">What matters</h2>
          <button type="button" className="v16-link" onClick={() => ctx.go('plans')} data-our-week>Our week <Chevron /></button>
        </div>
        {rows.some((r) => r.priority) && ctx.s.priorities.every((p) => p.from === 'last-meeting') && <p className="v16-meta">Still your focus from last time.</p>}
        {!rows.length && <p className="v16-meta">Nothing chosen yet. Choose what matters together in your Family Meeting.</p>}
        <div className="v16-rows">
          {rows.map((r) => (
            <div key={r.link} className="py-3" data-matter={r.occ.event.title} data-priority={r.priority ? '' : undefined}>
              <div className="v17-lead">
                <Art name={artFor(r.occ.event.title)} />
                <div className="min-w-0">
                  <p className="v16-meta">{fmtDate(r.occ.date, { weekday: 'long' })} · {timeLabel(r.occ.event)}</p>
                  <p className="v16-h3">{r.occ.event.title}</p>
                  {r.attention && <p className="v18-attention" data-attention>{r.attention}</p>}
                </div>
              </div>
              {r.preps.length > 0 && <div className="v16-nested mt-2">{r.preps.map(({ part, date, doneYesterday }) => (
                <PrepLine key={part.id} ctx={ctx} p={part} date={date} doneYesterday={doneYesterday} />
              ))}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="v16-section">
        <h2 className="v16-h2">Everyone’s part</h2>
        {!parts.length && <p className="v16-meta mt-1">What everyone agrees to do shows up here.</p>}
        <div className="v16-rows">
          {shownParts.map((p) => <PartLine key={p.id} ctx={ctx} p={p} />)}
        </div>
        {parts.length > SHOWN_PARTS && (
          <button type="button" className="v16-link mt-2" aria-expanded={allParts} onClick={() => setAllParts(!allParts)} data-other-parts>
            {allParts ? 'Show fewer' : `See other responsibilities (${parts.length - SHOWN_PARTS})`} <span aria-hidden="true" className={`v18-caret${allParts ? ' is-open' : ''}`}>⌄</span>
          </button>
        )}
      </div>

      <MeetingRow ctx={ctx} topics={model.topics.length} occ={meeting} />

      <nav aria-label="More" className="v16-shortcuts">
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('plans')} data-shortcut="plans"><Art name="calendar" tile="blue" /> Plans <small>{sharedOccurrences(ctx.s, ctx.monday).filter((o) => o.date === ctx.today).length} today</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('cleaning')} data-shortcut="cleaning"><Art name="sparkle" tile="sage" /> Cleaning <small>{ctx.s.cleaning.dailyReset ? `Daily Reset ${dailyDone} of ${dailyEssentials.tasks.length}` : weeklySchedule.find((z) => z.day === todayWd)?.zone ?? 'This week'}</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('resources')} data-shortcut="resources"><Art name="book" tile="rose" /> Resources <small>{ctx.club ? ctx.club.resourceTitle : 'Family & guides'}</small></button>
      </nav>

      {sheet && <InsightSheet ctx={ctx} i={sheet} meetingDay={meetingDay} onAction={(a) => run(sheet, a)} onClose={() => setSheetKey(null)} />}
      {sheetKey && !sheet && <Sheet title="All set" onClose={() => setSheetKey(null)}><p className="v18-sheet-lede" data-sheet-resolved>That’s planned. It’s on Today with everyone’s part.</p></Sheet>}
    </section>
  );
}

/** Agreed preparation gets the owner's check; a proposal shows its status. Completing one teaches household memory. */
function PrepLine({ ctx, p, date, doneYesterday }: { ctx: Ctx; p: Part; date: string | null; doneYesterday: boolean }) {
  const agreed = p.status === 'agreed';
  const toggle = () => ctx.set((s) => {
    const next = { ...s, parts: s.parts.map((x) => (x.id === p.id && x.status === 'agreed' && x.eventLink ? { ...x, done: !x.done } : x)) };
    const now = next.parts.find((x) => x.id === p.id)!;
    return now.done && date ? observe(next, now, date) : next;
  });
  return (
    <div className="v16-row !min-h-[52px] !py-2" data-today-prep={p.id} data-state={p.status}>
      <Person ctx={ctx} id={p.ownerId} size="md" />
      <button type="button" className="v16-row-main text-left" onClick={() => ctx.go(agreed ? 'plans' : 'meeting')}>
        <span className="block text-[0.95rem]">{p.ownerId ? ctx.names[p.ownerId] : 'Someone'} · {p.title}</span>
        <span className="v16-meta flex flex-wrap items-center gap-2">
          {doneYesterday ? <span className="v18-done" data-done-yesterday>Done yesterday ✓</span> : date ? dayName(date) : ''}
          {!agreed && <StatusPill part={p} />}
        </span>
      </button>
      {agreed ? <Check checked={Boolean(p.done)} label={`${p.title}, done`} tone={p.ownerId ? ctx.colors[p.ownerId]?.hex : undefined} onChange={toggle} /> : <Chevron />}
    </div>
  );
}

function PartLine({ ctx, p }: { ctx: Ctx; p: Part }) {
  const date = partDate(ctx.s, ctx.monday, p);
  if (p.eventLink) {
    const o = sharedOccurrences(ctx.s, ctx.monday).find((x) => (x.event.external?.uid ?? x.event.id) === p.eventLink);
    return (
      <div className="py-1" data-everyone-event={o?.event.title}>
        <PrepLine ctx={ctx} p={p} date={date} doneYesterday={false} />
      </div>
    );
  }
  const ct = p.cleaningTask;
  const sessionWd = ct ? sessionDay(ctx.s, ctx.monday, ct.zoneDay) : null;
  const zone = ct ? weeklySchedule.find((z) => z.day === ct.zoneDay) : null;
  const key = ct ? zoneKey(ctx.monday, ct.zoneDay, ct.taskId) : null;
  return (
    <div className="v16-row" data-everyone-part={p.id}>
      <Person ctx={ctx} id={p.ownerId} size="md" />
      <button type="button" className="v16-row-main text-left" onClick={() => ctx.go(ct ? 'cleaning' : 'plans')}>
        <span className="block text-[0.95rem]">{ctx.names[p.ownerId!]} · {p.title}</span>
        <span className="v16-meta">{ct && sessionWd !== null ? `${DAY_NAMES[sessionWd]} · Cleaning, ${zone?.zone}${sessionWd !== ct.zoneDay ? ' (moved this week)' : ''}` : date ? `Every ${dayName(date)}` : p.cue ?? ''}{p.pending ? ' · waiting to share' : ''}</span>
      </button>
      {key ? <CleaningBox checked={Boolean(ctx.s.cleaning.checks[key])} label={`${zone?.zone}: ${p.title}, done this week`}
        onChange={() => ctx.set((s) => { const checks = { ...s.cleaning.checks }; if (checks[key]) delete checks[key]; else checks[key] = true; return { ...s, cleaning: { ...s.cleaning, checks } }; })} />
        : <Chevron />}
    </div>
  );
}

function MeetingRow({ ctx, topics, occ }: { ctx: Ctx; topics: number; occ: ReturnType<typeof nextMeeting> }) {
  const m = ctx.s.meeting;
  const open = () => (m.started ? ctx.go('meeting') : ctx.s.scenario === 'week4' && !m.checkInDone ? ctx.go('check-in') : ctx.go('meeting'));
  if (m.started) {
    return (
      <button type="button" className="v18-meeting v18-meeting--resume" onClick={() => ctx.go('meeting')} data-meeting-row="resume">
        <Art name="people" />
        <span className="min-w-0 flex-1"><span className="v18-meeting-title">Continue your Family Meeting</span><span className="v16-meta block">You stopped at {STEP[m.step]}. Pick up whenever you’re ready.</span></span>
        <span aria-hidden="true" className="v18-meeting-go">→</span>
      </button>
    );
  }
  return (
    <button type="button" className="v18-meeting" onClick={open} data-meeting-row={occ ? 'next' : 'plan'}>
      <Art name="people" />
      <span className="min-w-0 flex-1">
        <span className="v18-meeting-title">{occ ? `Next Family Meeting · ${dayName(occ.date)}, ${timeLabel(occ.event).split('–')[0].trim()}` : 'Plan this week together'}</span>
        {topics > 0 && <span className="v16-meta block" data-meeting-topics={topics}>{topics === 1 ? '1 thing to bring up' : `${topics} things to bring up`}</span>}
      </span>
      <Chevron />
    </button>
  );
}

/** One lightweight sheet per action. Every choice goes through an existing workflow; nothing is decided for the family. */
function InsightSheet({ ctx, i, meetingDay, onAction, onClose }: { ctx: Ctx; i: Insight; meetingDay: string | null; onAction: (a: ActionId) => void; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const eventTitle = i.eventLink ? sharedOccurrences(ctx.s, ctx.monday).find((o) => (o.event.external?.uid ?? o.event.id) === i.eventLink)?.event.title ?? 'This activity' : '';
  const reviewParts = i.type === 'exception' ? ctx.s.parts.filter((p) => i.partIds.includes(p.id)) : [];
  return (
    <Sheet title={actionLabel(i.action, meetingDay)} onClose={onClose}>
      <div data-insight-sheet={i.key}>
        <p className="v18-sheet-lede">{i.title}</p>
        {reviewParts.length > 0 && <>
          <p className="v16-meta mt-1">Change who, what or when if it doesn’t work anymore. The activity itself stays as its calendar says.</p>
          <div className="v16-rows mt-2">{reviewParts.map((p) => <PartRow key={p.id} ctx={ctx} part={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />)}</div>
          <button type="button" className="v16-link mt-3" onClick={() => { onClose(); ctx.go('plans'); }} data-sheet-week>See the week <Chevron /></button>
        </>}
        {i.possibilities.length > 0 && <div className="v16-rows mt-2">{i.possibilities.map((p) => {
          const part = p.partId ? ctx.s.parts.find((x) => x.id === p.partId) : null;
          if (part) return <PartRow key={p.need} ctx={ctx} part={part} prominent open={open === part.id} onToggle={() => setOpen(open === part.id ? null : part.id)} />;
          return (
            <div key={p.need} className="v18-possibility" data-possibility={p.need}>
              <p className="v16-eyebrow">{p.label}</p>
              <p className="v16-row-title mt-0.5">{p.title}</p>
              <p className="v16-meta mt-0.5">{p.ownerId ? `Could be ${ctx.names[p.ownerId]}. ${p.ownerWhy ?? ''}` : 'Nobody yet. Choose who when you make it a plan.'}</p>
              <div className="v16-choices">
                <button type="button" className="v16-choice" onClick={() => { const r = propose(ctx.s, p, eventTitle); ctx.set(() => r.state); setOpen(r.partId); }} data-suggest>Suggest it</button>
                {i.kind && <button type="button" className="v16-choice v16-choice--quiet" onClick={() => ctx.set((s) => ({ ...s, intel: { ...s.intel!, memory: confirm(s.intel!.memory, { eventKind: i.kind!, need: p.need, effect: 'not-needed' }, ctx.today) } }))} data-not-needed>Not needed for us</button>}
              </div>
            </div>
          );
        })}</div>}
        {i.type === 'development' && <p className="v16-meta mt-2">{i.body}</p>}

        <div className="v18-sheet-foot">
          {i.action !== 'bring-up' && i.type !== 'exception' && <button type="button" className="v16-choice" onClick={() => onAction('bring-up')} data-sheet-bring-up>{actionLabel('bring-up', meetingDay)}</button>}
          {i.type !== 'development' && <button type="button" className="v16-choice v16-choice--quiet" onClick={() => onAction('handled')} data-sheet-handled>Already handled</button>}
        </div>
        <details className="v16-details mt-3" data-why>
          <summary className="!min-h-[40px] !text-[0.85rem] !font-semibold">Why am I seeing this?</summary>
          <ul className="v18-why">
            {i.evidence.map((e) => <li key={e}>{e}</li>)}
            {i.memories.map((m) => (
              <li key={m.id} data-memory={m.kind}>{memoryLine(m, ctx.names)} {m.kind === 'inferred' ? '(noticed, not confirmed)' : '(you told us)'}{' '}
                <button type="button" className="v16-link" onClick={() => ctx.set((s) => ({ ...s, intel: { ...s.intel!, memory: forget(s.intel!.memory, m.id, ctx.today) } }))} data-forget>Forget this</button></li>
            ))}
          </ul>
          {i.source === 'simulated-interpreter' && <p className="v18-simulated" data-simulated>Preview: this reading of the event is simulated demonstration data, not a live model.</p>}
        </details>
      </div>
    </Sheet>
  );
}

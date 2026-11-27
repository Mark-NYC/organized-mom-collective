/**
 * V21 Today (docs/ios/V21_PREVIEW.md): What matters (only what needs this adult) · Today's plan (agreed
 * responsibilities with owners and completion) · Our week (awareness, with an optional "Plan something") ·
 * Everyone's part (standing agreements, collapsed) · the Family Meeting row · Plans, Cleaning, Resources.
 *
 * The model is src/lib/v21/today.ts; every write goes through src/lib/v21/model.ts.
 */
import { useMemo, useState } from 'react';
import { timeLabel } from '../../lib/calendar/recurrence';
import { dayName, sharedOccurrences, type Part } from '../../lib/v16/model';
import { nextMeeting } from '../../lib/v18/engine';
import { buildTodayV19 } from '../../lib/v19/engine';
import { acknowledge, answer, markSeen, toggleDone, withdraw } from '../../lib/v21/model';
import { buildTodayV21, carryForward, type Matter, type PlanItem, type WeekItem } from '../../lib/v21/today';
import { dailyEssentials } from '../../data/cleaning';
import { Badge, badgeFor } from '../v20/Badge';
import { Check, type Ctx } from '../v16/shared';
import { Chevron } from '../app/ui';
import { enginePeople } from '../v18/TodayV18';
import { ChangedSheet, PartSheet, ResolveSheet } from '../v19/TodayV19';
import { giveFeedback } from '../../lib/v19/resolve';
import { AgreementsPanel, AskSheet, IntentSheet, MakePlanSheet, UsualOffer } from './Sheets';
import { Chip, othersOf, ownerName, viewerOf } from './ui';

const WEEK_SHOWN = 3;

export function useV21(ctx: Ctx) {
  const people = useMemo(() => enginePeople(ctx), [ctx.people, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const inp = { s: ctx.s, monday: ctx.monday, today: ctx.today, people };
  const model = useMemo(() => buildTodayV21(inp), [ctx.s, ctx.today, people]); // eslint-disable-line react-hooks/exhaustive-deps
  return { inp, model, people };
}

type Open = { kind: 'ask'; part: Part; date: string; time: string | null } | { kind: 'plan'; m: Matter } | { kind: 'intent'; w: WeekItem } | { kind: 'changed' } | { kind: 'resolve'; key: string } | null;

export default function TodayV21({ ctx }: { ctx: Ctx }) {
  const { inp, model } = useV21(ctx);
  const viewer = viewerOf(ctx);
  const [open, setOpen] = useState<Open>(null);
  const [scope, setScope] = useState<'everyone' | 'mine'>('everyone');
  const [weekAll, setWeekAll] = useState(false);
  const [parts, setParts] = useState(false);
  const meeting = nextMeeting(inp);
  // V20's change handling is kept for real changes only: a cascading calendar change, a reported day, backup.
  const v19 = useMemo(() => buildTodayV19(inp), [ctx.s, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  // Kept from V20 (no new rules): a calendar change, "Something changed?" → simplify today / a little backup, and a
  // request made with V20's "Share the load". A backup card that repeats a V21 conflict on the same commitment is skipped.
  const conflictParts = new Set(model.matters.filter((m) => m.kind === 'conflict').map((m) => m.part?.id));
  const stopped = new Set(v19.suppressed.map((x) => x.insight.key));
  const change = v19.all.find((i) => i.destination === 'today' && !stopped.has(i.key)
    && (i.category === 'changed' || /^(simplify|asked):/.test(i.key) || (i.key.startsWith('backup:') && !conflictParts.has(i.partLink)))) ?? null;

  const matters = model.matters;
  const requestsIn = matters.filter((m) => m.kind === 'request-in');
  const others = matters.filter((m) => m.kind !== 'request-in' && m.kind !== 'waiting' && m.kind !== 'focus' && m.kind !== 'practice');
  const waiting = matters.filter((m) => m.kind === 'waiting');
  const quietRows = matters.filter((m) => m.kind === 'focus' || m.kind === 'practice');
  const plan = scope === 'mine' ? model.plan.filter((p) => p.mine || p.part.ownerId === 'together') : model.plan;
  const doneCount = plan.filter((p) => p.done).length;
  const week = weekAll ? model.week : model.week.slice(0, WEEK_SHOWN);
  const routines = model.routines.length, weekly = model.weekly.length;
  const resolve = open?.kind === 'resolve' ? v19.all.find((i) => i.key === open.key) ?? null : null;
  const todayWd = new Date(`${ctx.today}T12:00:00Z`).getUTCDay();
  const dailyDone = dailyEssentials.tasks.filter((t) => ctx.s.cleaning.checks[`daily:${ctx.today}:${t.id}`]).length;

  return (
    <section data-screen="today" data-v21 data-viewer={viewer} data-quiet={model.quiet ? '' : undefined}>
      <p className="v21-date">{new Date(`${ctx.today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).toUpperCase()}</p>
      <h1 className="v21-h1" data-v21-headline>{model.headline}</h1>
      {model.sub && <p className="v21-sub" data-v21-sub>{model.sub}</p>}

      <div className="v21-section" data-what-matters>
        <h2 className="v21-h2">What matters</h2>
        {change && (
          <div className="v21-card" data-matter="change" data-heads-up={change.category} data-insight={change.key}>
            <div className="v21-card-head"><Badge name={badgeFor(change.title)} /><div className="min-w-0"><p className="v21-card-title" data-heads-title>{change.title}</p>{change.body && <p className="v21-meta">{change.body}</p>}</div></div>
            <div className="v21-actions v21-actions--two">
              <button type="button" className="v21-btn" onClick={() => (change.flow === 'resolve' || change.flow === 'part' ? setOpen({ kind: 'resolve', key: change.key }) : ctx.go('plans'))} data-heads-action>{change.actionLabel}</button>
              {!change.key.startsWith('asked:') && <button type="button" className="v21-btn v21-btn--outline" onClick={() => ctx.set((x) => giveFeedback(x, change, 'dismissed', ctx.today))} data-heads-dismiss>Dismiss</button>}
            </div>
          </div>
        )}
        {requestsIn.map((m, i) => <RequestCard key={m.key} ctx={ctx} m={m} compact={i > 0} />)}
        {others.map((m) => <MatterCard key={m.key} ctx={ctx} m={m} onPlan={() => setOpen({ kind: 'plan', m })} onAsk={(part, date, time) => setOpen({ kind: 'ask', part, date, time })} />)}
        {waiting.map((m) => (
          <div key={m.key} className="v21-row v21-row--quiet" data-matter="waiting" data-request={m.request!.id}>
            <Badge name={badgeFor(m.icon)} size="sm" />
            <div className="min-w-0 flex-1"><p className="v21-row-title">{m.title}</p><p className="v21-meta">{m.meta}</p></div>
            <button type="button" className="v21-link" onClick={() => ctx.set((s) => withdraw(s, m.request!.id, viewer, ctx.today))} data-withdraw>Take it back</button>
          </div>
        ))}
        {quietRows.map((m) => (
          <div key={m.key} className="v21-row v21-row--quiet" data-matter={m.kind}>
            <Badge name={badgeFor(m.icon)} size="sm" />
            <div className="min-w-0 flex-1"><p className="v21-row-title">{m.title}</p><p className="v21-meta">{m.meta}</p></div>
          </div>
        ))}
        {!matters.length && !change && <p className="v21-meta mt-1" data-nothing-matters>{model.firstTime ? 'What needs you will show up here after your first meeting.' : 'Nothing needs you right now.'}</p>}
        <button type="button" className="v21-link mt-1" onClick={() => setOpen({ kind: 'changed' })} data-something-changed>Something changed?</button>
      </div>

      <div className="v21-section" data-todays-plan>
        <div className="v21-section-head">
          <h2 className="v21-h2">Today’s plan</h2>
          {model.plan.length > 0 && (
            <div className="v21-seg" role="group" aria-label="Show">
              <button type="button" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')} data-scope="mine">Mine</button>
              <button type="button" aria-pressed={scope === 'everyone'} onClick={() => setScope('everyone')} data-scope="everyone">Everyone</button>
            </div>
          )}
        </div>
        {plan.map((p) => <PlanRow key={`${p.part.id}@${p.date}`} ctx={ctx} p={p} onAsk={() => setOpen({ kind: 'ask', part: p.part, date: p.date, time: p.time })} />)}
        {!model.plan.length && <p className="v21-meta mt-1" data-plan-empty>{model.firstTime ? 'Your plan starts at your first Family Meeting.' : 'Nothing on today’s plan.'}</p>}
        {model.plan.length > 0 && !plan.length && <p className="v21-meta mt-1">Nothing of yours today.</p>}
        {plan.length > 0 && <p className="v21-count" data-plan-count>{doneCount} of {plan.length} {plan.length === 1 ? 'commitment' : 'commitments'} completed</p>}
      </div>

      <div className="v21-section" data-our-week>
        <div className="v21-section-head"><h2 className="v21-h2">Our week</h2><button type="button" className="v21-link" onClick={() => ctx.go('plans')} data-open-plans>Calendar <Chevron /></button></div>
        {!model.week.length && <p className="v21-meta mt-1">Nothing else on the shared calendar this week.</p>}
        {week.map((w) => <WeekRow key={`${w.link}@${w.occ.date}`} ctx={ctx} w={w} onPlan={() => setOpen({ kind: 'intent', w })} />)}
        {model.week.length > WEEK_SHOWN && (
          <button type="button" className="v21-link" aria-expanded={weekAll} onClick={() => setWeekAll(!weekAll)} data-week-all>{weekAll ? 'Show less' : `Show all (${model.week.length})`}</button>
        )}
      </div>

      <div className="v21-section" data-everyones-part>
        <h2 className="v21-h2">Everyone’s part</h2>
        <button type="button" className="v21-row v21-row--button" aria-expanded={parts} onClick={() => setParts(!parts)} data-agreements-toggle>
          <Badge name="family-group" />
          <span className="min-w-0 flex-1 text-left"><span className="v21-row-title block">Our family agreements</span>
            <span className="v21-meta block">{routines || weekly ? [routines ? `${routines} daily ${routines === 1 ? 'routine' : 'routines'}` : null, weekly ? `${weekly} weekly ${weekly === 1 ? 'responsibility' : 'responsibilities'}` : null].filter(Boolean).join(' · ') : 'Agreed at your Family Meeting'}</span></span>
          <span aria-hidden="true" className={`v21-caret${parts ? ' is-open' : ''}`}><Chevron /></span>
        </button>
        {parts && <AgreementsPanel ctx={ctx} routines={model.routines} weekly={model.weekly} />}
      </div>

      <MeetingRow ctx={ctx} occ={meeting} first={model.firstTime} topics={carryForward(inp).length + v19.agenda.length} />

      <nav aria-label="More" className="v16-shortcuts">
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('plans')} data-shortcut="plans"><Badge name="calendar" size="sm" /> Plans <small>{sharedOccurrences(ctx.s, ctx.monday).filter((o) => o.date === ctx.today).length} today</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('cleaning')} data-shortcut="cleaning"><Badge name="spray-bottle-cloth" size="sm" /> Cleaning <small>{ctx.s.cleaning.dailyReset ? `Daily Reset ${dailyDone} of ${dailyEssentials.tasks.length}` : `Day ${todayWd}`}</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('resources')} data-shortcut="resources"><Badge name="book" size="sm" /> Resources <small>{ctx.club ? ctx.club.resourceTitle : 'Family & guides'}</small></button>
      </nav>

      {open?.kind === 'ask' && <AskSheet ctx={ctx} part={open.part} date={open.date} time={open.time} onClose={() => setOpen(null)} />}
      {open?.kind === 'plan' && <MakePlanSheet ctx={ctx} m={open.m} meetingDate={meeting?.date ?? null} onClose={() => setOpen(null)} />}
      {open?.kind === 'intent' && <IntentSheet ctx={ctx} w={open.w} onClose={() => setOpen(null)} />}
      {open?.kind === 'changed' && <ChangedSheet ctx={ctx} onClose={() => setOpen(null)} />}
      {resolve && resolve.flow === 'part' && <PartSheet ctx={ctx} i={resolve} onClose={() => setOpen(null)} />}
      {resolve && resolve.flow !== 'part' && <ResolveSheet ctx={ctx} i={resolve} meetingDay={meeting ? dayName(meeting.date) : null} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** "Can you pick up the boys?" with the two answers. The first is a full card; any more are compact. */
function RequestCard({ ctx, m, compact }: { ctx: Ctx; m: Matter; compact: boolean }) {
  const viewer = viewerOf(ctx);
  const r = m.request!;
  const reply = (c: 'accept' | 'decline') => ctx.set((s) => answer(s, r.id, viewer, c, ctx.today).state);
  return (
    <div className={`v21-card${compact ? ' v21-card--compact' : ''}`} data-matter="request-in" data-request={r.id}>
      {!compact && <Badge name={badgeFor(m.icon)} />}
      <div className={compact ? 'v21-card-head' : undefined}>
        {compact && <Badge name={badgeFor(m.icon)} size="sm" />}
        <div className="min-w-0"><p className={compact ? 'v21-row-title' : 'v21-card-title mt-3'}>{m.title}</p><p className="v21-meta mt-1">{m.meta}</p></div>
      </div>
      <div className="v21-actions v21-actions--two">
        <button type="button" className="v21-btn" onClick={() => reply('accept')} data-answer="accept">I’ve got it</button>
        <button type="button" className="v21-btn v21-btn--outline" onClick={() => reply('decline')} data-answer="decline">Not this time</button>
      </div>
    </div>
  );
}

function MatterCard({ ctx, m, onPlan, onAsk }: { ctx: Ctx; m: Matter; onPlan: () => void; onAsk: (p: Part, date: string, time: string | null) => void }) {
  const viewer = viewerOf(ctx);
  const ack = () => ctx.set((s) => (m.request ? acknowledge(s, m.request.id, viewer, ctx.today) : markSeen(s, viewer, m.key, ctx.today)));
  const other = othersOf(ctx)[0];
  const head = (
    <div className="v21-card-head"><Badge name={badgeFor(m.icon)} /><div className="min-w-0"><p className="v21-card-title">{m.title}</p><p className="v21-meta mt-0.5">{m.meta}</p></div></div>
  );
  if (m.kind === 'needs-owner') {
    return (
      <div className="v21-card" data-matter="needs-owner" data-key={m.key}>
        {head}
        <div className="v21-actions"><button type="button" className="v21-btn v21-btn--block" onClick={onPlan} data-make-plan>Make a plan</button></div>
      </div>
    );
  }
  if (m.kind === 'declined') {
    return (
      <div className="v21-card" data-matter="declined" data-request={m.request!.id}>
        {head}
        <div className="v21-actions">
          {m.attention ? <button type="button" className="v21-btn v21-btn--block" onClick={onPlan} data-make-plan>Make a plan</button> : <button type="button" className="v21-btn" onClick={ack} data-ack>OK</button>}
        </div>
      </div>
    );
  }
  if (m.kind === 'accepted') {
    return (
      <div className="v21-card v21-card--done" data-matter="accepted" data-request={m.request!.id}>
        {head}
        <div className="v21-actions v21-actions--split">
          <button type="button" className="v21-btn" onClick={ack} data-ack>OK</button>
          <UsualOffer ctx={ctx} m={m} />
        </div>
      </div>
    );
  }
  if (m.kind === 'conflict') {
    return (
      <div className="v21-card" data-matter="conflict" data-key={m.key}>
        {head}
        <div className="v21-actions v21-actions--two">
          {other && m.part && <button type="button" className="v21-btn" onClick={() => onAsk(m.part!, m.date!, m.time ?? null)} data-ask-other>Ask {other.firstName}</button>}
          <button type="button" className="v21-btn v21-btn--outline" onClick={ack} data-ack>I’ll handle it</button>
        </div>
      </div>
    );
  }
  // changed
  return (
    <div className="v21-card" data-matter={m.kind} data-key={m.key}>
      {head}
      <div className="v21-actions"><button type="button" className="v21-btn" onClick={ack} data-ack>OK</button></div>
    </div>
  );
}

function PlanRow({ ctx, p, onAsk }: { ctx: Ctx; p: PlanItem; onAsk: () => void }) {
  const viewer = viewerOf(ctx);
  const [more, setMore] = useState(false);
  const toggle = () => ctx.set((s) => {
    if (p.cleaningKey) { const checks = { ...s.cleaning.checks }; if (checks[p.cleaningKey]) delete checks[p.cleaningKey]; else checks[p.cleaningKey] = true; return { ...s, cleaning: { ...s.cleaning, checks } }; }
    return toggleDone(s, p.part.id, p.date, viewer);
  });
  const canAsk = (p.mine || p.part.ownerId === 'together') && othersOf(ctx).length > 0 && !p.done;
  const meta = [p.time ? (p.dueTonight ? `Tonight · ${t(p.time)}` : t(p.time)) : p.part.cue, p.covering ? `Covering for ${ownerName(ctx, p.covering)}` : null].filter(Boolean).join(' · ');
  return (
    <div className="v21-plan" data-plan-item={p.part.id} data-done={p.done ? '' : undefined} data-mine={p.mine ? '' : undefined}>
      <Check checked={p.done} label={`${p.part.title}, done`} onChange={toggle} />
      <button type="button" className="v21-plan-main" aria-expanded={more} onClick={() => setMore(!more)}>
        <span className="v21-row-title block">{p.part.title}</span>
        <span className="v21-plan-meta"><Chip ctx={ctx} id={p.part.ownerId} />{meta && <span className="v21-meta">{meta}</span>}</span>
      </button>
      {more && (
        <div className="v21-plan-more">
          {p.part.finishLine && <p className="v21-meta">Done when: {p.part.finishLine}</p>}
          {canAsk && <button type="button" className="v21-link" onClick={onAsk} data-ask-hand>Ask for a hand</button>}
        </div>
      )}
    </div>
  );
}
const t = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

function WeekRow({ ctx, w, onPlan }: { ctx: Ctx; w: WeekItem; onPlan: () => void }) {
  const it = w.intent;
  const part = w.plannedPart;
  const status = it?.nothing ? 'Nothing needed' : part ? `${ownerName(ctx, part.ownerId)} · ${part.title}${part.done ? ' ✓' : ''}` : it?.requestId ? `Asked ${ownerName(ctx, ctx.s.intel && (ctx.s.intel as { requests?: Record<string, { to: string }> }).requests?.[it.requestId]?.to)} · ${it.label}` : null;
  return (
    <div className="v21-row" data-week={w.occ.event.title} data-intent={it?.choice}>
      <Badge name={badgeFor(w.occ.event.title)} />
      <div className="min-w-0 flex-1">
        <p className="v21-row-title">{w.occ.event.title}</p>
        <p className="v21-meta">{w.today ? 'Today' : dayName(w.occ.date)} · {timeLabel(w.occ.event)}</p>
        {status && <p className="v21-meta mt-0.5" data-week-status>{status}</p>}
        {!status && w.preference && <p className="v21-meta mt-0.5" data-week-usually>Usually: {w.preference.text.replace(/^We usually /i, '')}</p>}
      </div>
      {!(part && !it) && <button type="button" className="v21-link v21-link--small" onClick={onPlan} data-plan-something>{it ? 'Change' : w.preference ? 'Plan it' : 'Plan something'}</button>}
    </div>
  );
}

function MeetingRow({ ctx, occ, first, topics }: { ctx: Ctx; occ: ReturnType<typeof nextMeeting>; first: boolean; topics: number }) {
  const m = ctx.s.meeting;
  const label = m.started ? 'Continue your Family Meeting' : first ? 'Start your first Family Meeting' : occ ? `Next Family Meeting · ${dayName(occ.date)}${occ.event.start_time ? `, ${t(occ.event.start_time)}` : ''}` : 'Plan this week together';
  return (
    <button type="button" className={`v21-row v21-row--button v21-meeting${first ? ' v21-meeting--first' : ''}`} onClick={() => ctx.go('meeting')} data-meeting-row={m.started ? 'resume' : first ? 'first' : 'next'}>
      <Badge name="family-meeting-around-a-table" />
      <span className="min-w-0 flex-1 text-left"><span className="v21-row-title block">{label}</span><span className="v21-meta block" data-meeting-topics={topics || undefined}>{first ? 'Ten minutes. Everyone’s part, together.' : m.started ? 'Pick up where you left off.' : topics ? `${topics === 1 ? '1 thing' : `${topics} things`} to talk about` : 'Our Focus · Let’s Talk · Everyone’s Part · Let’s Practice'}</span></span>
      <Chevron />
    </button>
  );
}


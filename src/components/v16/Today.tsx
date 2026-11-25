/**
 * V16 Today: we follow through together. Greeting and this week; one gentle meeting invitation (or a quiet
 * confirmation); What matters (priorities, each event with its preparation nested underneath, in the owner's color);
 * Everyone's part (agreed standing parts only; no fake done state); Plans · Cleaning · Resources.
 * Suggestions are labeled Suggested; only agreed preparation gets a checkbox; a meeting time shows only when a
 * Family Meeting is really on the calendar.
 */
import { dailyEssentials, weeklySchedule } from '../../data/cleaning';
import { timeLabel } from '../../lib/calendar/recurrence';
import { Chevron, Icon } from '../app/ui';
import {
  SHOWN, currentPriorities, dailyKey, dayName, agreedParts, durable, missingReason, occurrenceOf, titleOf, partDate, sessionDay, sharedOccurrences, zoneKey, type Part, type Priority,
} from '../../lib/v16/model';
import { act } from './Parts';
import { Check, CleaningBox, Person, StatusPill, fmtDate, type Ctx } from './shared';
import { useState } from 'react';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
}

function Invitation({ ctx }: { ctx: Ctx }) {
  const m = ctx.s.meeting;
  const agreedBefore = agreedParts(ctx.s).filter((p) => p.agreedOn && p.agreedOn < ctx.monday).length;
  const newOnes = ctx.s.parts.filter((p) => p.status !== 'agreed' && p.status !== 'skipped' && p.eventLink && p.origin === 'prepared' && occurrenceOf(ctx.s, ctx.monday, p.eventLink)).length;
  if (m.started) {
    return <button type="button" className="v16-card" onClick={() => ctx.go('meeting')} data-invite="continue">
      <span className="v16-card-title flex items-center justify-between gap-3">Continue your Family Meeting <span aria-hidden="true">↗</span></span>
      <span className="mt-1 block text-[0.88rem]">You stopped at {['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice'][m.step]}. Pick up whenever you’re ready.</span></button>;
  }
  if (ctx.s.scenario === 'week4' && !m.checkInDone && m.finishedOn !== ctx.today) {
    return <button type="button" className="v16-card" onClick={() => ctx.go('check-in')} data-invite="check-in">
      <span className="v16-card-title flex items-center justify-between gap-3">A quick family check-in <span aria-hidden="true">↗</span></span>
      <span className="mt-1 block text-[0.88rem]">{agreedBefore} agreement{agreedBefore === 1 ? '' : 's'} continue{agreedBefore === 1 ? 's' : ''}.{newOnes ? ` ${newOnes === 1 ? 'One new activity' : `${newOnes} new activities`} to decide.` : ''}</span></button>;
  }
  if (m.finishedOn === ctx.today || m.checkInDone) {
    return <p className="v16-meta mt-4 flex items-center gap-2" data-invite="done"><Icon name="check" size={18} /> You talked it through {m.finishedOn === ctx.today ? 'today' : 'this week'}. Everyone’s part is below.</p>;
  }
  return <button type="button" className="v16-card" onClick={() => ctx.go('meeting')} data-invite="start">
    <span className="v16-card-title flex items-center justify-between gap-3">Make this week’s plan <span aria-hidden="true">↗</span></span>
    <span className="mt-1 block text-[0.88rem]">A few decisions together can make the week easier.</span></button>;
}

function PrepRow({ ctx, p }: { ctx: Ctx; p: Part }) {
  const date = partDate(ctx.s, ctx.monday, p);
  const agreed = p.status === 'agreed';
  return (
    <div className="v16-row !min-h-[52px] !py-2" data-today-prep={p.id} data-state={p.status}>
      <Person ctx={ctx} id={p.ownerId} size="md" />
      <button type="button" className="v16-row-main text-left" onClick={() => ctx.go(agreed ? 'plans' : 'meeting')}>
        <span className="block text-[0.95rem]">{p.ownerId ? ctx.names[p.ownerId] : 'Someone'} · {p.title}</span>
        <span className="v16-meta flex flex-wrap items-center gap-2">{date ? dayName(date) : ''}{!agreed && <StatusPill part={p} />}</span>
      </button>
      {agreed
        ? <Check checked={Boolean(p.done)} label={`${p.title}, done`} onChange={() => act(ctx, { type: 'toggle-done', id: p.id })} />
        : <Chevron />}
    </div>
  );
}

function Matter({ ctx, pr }: { ctx: Ctx; pr: Priority }) {
  if (pr.kind === 'note') return <div className="py-3"><p className="v16-meta">This week</p><p className="v16-h3">{pr.text}</p></div>;
  const o = occurrenceOf(ctx.s, ctx.monday, pr.eventLink!);
  // The durable agreement where there is one (edits in a meeting don't show here until agreed); else the labeled proposal.
  const preps = ctx.s.parts.filter((p) => p.eventLink === pr.eventLink && p.status !== 'skipped' && p.origin !== 'idea').map((p) => durable(p) ?? p);
  if (!o) {
    const why = missingReason(ctx.s, ctx.monday, pr.eventLink!);
    return <div className="py-3" data-matter-missing={why}><p className="v16-meta">{why === 'cancelled' ? 'Cancelled in its calendar' : why === 'private' ? 'Its calendar is now private' : 'Not on the calendar this week'}</p>
      <p className="v16-h3 text-[color:var(--of-soft)]">{why === 'private' ? 'A private activity' : titleOf(ctx.s, ctx.monday, pr.eventLink!)}</p>
      {preps.length > 0 && why === 'cancelled' && <p className="v16-meta mt-1">Its preparation isn’t needed this week. Nothing was deleted; the agreement stays for next time.</p>}</div>;
  }
  return (
    <div className="py-3" data-matter={o.event.title}>
      <p className="v16-meta">{fmtDate(o.date, { weekday: 'long' })} · {timeLabel(o.event)}{o.event.id === 'e-soccer-moved' ? ' · moved' : ''}</p>
      <p className="v16-h3">{o.event.title}</p>
      {preps.length > 0 && <div className="v16-nested mt-2">{preps.map((p) => <PrepRow key={p.id} ctx={ctx} p={p} />)}</div>}
    </div>
  );
}

export default function Today({ ctx }: { ctx: Ctx }) {
  const [all, setAll] = useState(false);
  const prios = currentPriorities(ctx.s);
  const carried = prios.length > 0 && prios[0].from === 'last-meeting';
  // Before the family's first meeting only: activities with prepared preparation, labeled "coming up", never as priorities.
  const comingUp = prios.length || ctx.s.meeting.finishedOn || ctx.s.meeting.checkInDone ? [] : sharedOccurrences(ctx.s, ctx.monday)
    .filter((o) => ctx.s.parts.some((p) => p.eventLink === (o.event.external?.uid ?? o.event.id) && p.status !== 'skipped'))
    .filter((o, i, a) => a.findIndex((x) => x.event.id === o.event.id) === i);
  const agreed = agreedParts(ctx.s);
  const standing = agreed.filter((p) => !p.eventLink);
  // Agreed preparation for an activity the family did NOT choose as a priority: it's someone's part, shown under its
  // activity here. Agreeing to prepare never makes the activity a priority; that's a separate family decision.
  const shownEvents = new Set([...prios.map((pr) => pr.eventLink), ...comingUp.map((o) => o.event.external?.uid ?? o.event.id)]);
  const eventAgreed = agreed.filter((p) => p.eventLink && !shownEvents.has(p.eventLink) && occurrenceOf(ctx.s, ctx.monday, p.eventLink));
  const meetingOcc = sharedOccurrences(ctx.s, ctx.monday).find((o) => o.event.title === 'Family Meeting' && o.date >= ctx.today);
  const todayWd = new Date(`${ctx.today}T12:00:00Z`).getUTCDay();
  const dailyDone = dailyEssentials.tasks.filter((t) => ctx.s.cleaning.checks[dailyKey(ctx.today, t.id)]).length;
  const shown = all ? prios : prios.slice(0, SHOWN);
  return (
    <section data-screen="today">
      <p className="v16-kicker">{ctx.household.displayName?.replace(/^The /, '') ?? 'Our family'} · This week</p>
      <h1 className="v16-h1">{ctx.s.scenario === 'week4' ? 'A good week starts here.' : greeting()}</h1>
      <Invitation ctx={ctx} />

      <div className="v16-section">
        <div className="v16-section-head">
          <h2 className="v16-h2">What matters</h2>
          <button type="button" className="v16-link" onClick={() => ctx.go('plans')} data-see-all>See all <Chevron /></button>
        </div>
        {carried && <p className="v16-meta">Still your focus from last time. Change it in your next meeting.</p>}
        {!prios.length && <p className="v16-meta">Coming up. Choose what matters together in your Family Meeting.</p>}
        <div className="v16-rows">
          {shown.map((pr) => <Matter key={pr.id} ctx={ctx} pr={pr} />)}
          {comingUp.map((o) => <Matter key={o.event.id} ctx={ctx} pr={{ id: o.event.id, kind: 'event', eventLink: o.event.external?.uid ?? o.event.id, from: 'this-week' }} />)}
        </div>
        {prios.length > SHOWN && <button type="button" className="v16-link" onClick={() => setAll(!all)} data-more-priorities>{all ? 'Show fewer' : `${prios.length - SHOWN} more`}</button>}
      </div>

      <div className="v16-section">
        <h2 className="v16-h2">Everyone’s part</h2>
        {!standing.length && !eventAgreed.length && <p className="v16-meta mt-1">Agreed household responsibilities appear here.</p>}
        <div className="v16-rows">
          {eventAgreed.map((p) => {
            const o = occurrenceOf(ctx.s, ctx.monday, p.eventLink!)!;
            return (
              <div key={p.id} className="py-3" data-everyone-event={o.event.title}>
                <p className="v16-meta">For {o.event.title} · {fmtDate(o.date, { weekday: 'long' })}, {timeLabel(o.event)}</p>
                <div className="v16-nested mt-1"><PrepRow ctx={ctx} p={p} /></div>
              </div>
            );
          })}
          {standing.map((p) => {
            const date = partDate(ctx.s, ctx.monday, p);
            const ct = p.cleaningTask;
            const sessionWd = ct ? sessionDay(ctx.s, ctx.monday, ct.zoneDay) : null;
            const zone = ct ? weeklySchedule.find((z) => z.day === ct.zoneDay) : null;
            const key = ct ? zoneKey(ctx.monday, ct.zoneDay, ct.taskId) : null;
            return (
              <div key={p.id} className="v16-row" data-everyone-part={p.id}>
                <Person ctx={ctx} id={p.ownerId} size="md" />
                <button type="button" className="v16-row-main text-left" onClick={() => ctx.go(ct ? 'cleaning' : 'plans')}>
                  <span className="block text-[0.95rem]">{ctx.names[p.ownerId!]} · {p.title}</span>
                  <span className="v16-meta">{ct && sessionWd !== null ? `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][sessionWd]} · Cleaning, ${zone?.zone}${sessionWd !== ct.zoneDay ? ' (moved this week)' : ''}` : date ? `Every ${dayName(date)}` : p.cue ?? ''}{p.pending ? ' · waiting to share' : ''}</span>
                </button>
                {/* The cleaning task's own checkbox: the same check the Cleaning screen shows (one canonical state). */}
                {key ? <CleaningBox checked={Boolean(ctx.s.cleaning.checks[key])} label={`${zone?.zone}: ${p.title}, done this week`}
                  onChange={() => ctx.set((s) => { const checks = { ...s.cleaning.checks }; if (checks[key]) delete checks[key]; else checks[key] = true; return { ...s, cleaning: { ...s.cleaning, checks } }; })} />
                  : <Chevron />}
              </div>
            );
          })}
        </div>
      </div>

      {meetingOcc && <p className="v16-meta mt-5" data-next-meeting>Next Family Meeting: {fmtDate(meetingOcc.date, { weekday: 'long' })} at {timeLabel(meetingOcc.event)} (on your calendar).</p>}

      <nav aria-label="More" className="v16-shortcuts">
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('plans')} data-shortcut="plans"><Icon name="calendar" /> Plans <small>{sharedOccurrences(ctx.s, ctx.monday).filter((o) => o.date === ctx.today).length} today</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('cleaning')} data-shortcut="cleaning"><Icon name="check" /> Cleaning <small>{ctx.s.cleaning.dailyReset ? `Daily Reset ${dailyDone} of ${dailyEssentials.tasks.length}` : weeklySchedule.find((z) => z.day === todayWd)?.zone ?? 'This week'}</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('resources')} data-shortcut="resources"><Icon name="list" /> Resources <small>{ctx.club ? ctx.club.resourceTitle : 'Family & guides'}</small></button>
      </nav>
    </section>
  );
}

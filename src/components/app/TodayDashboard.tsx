/**
 * Today (/app), the family dashboard: the same on the website and in the iPhone app (docs/ios/APP_DESIGN_SYSTEM.md).
 * Every tile shows the family's real data, worked out on the device: today's plans from the shared calendar (or what's
 * next), today's cleaning reset and its progress, this week's Family Meeting preparation, everyone's agreed part, and
 * this month's Club plan for households that have the Club. Nothing is invented: an empty family sees empty states.
 */
import { useEffect, useState } from 'react';
import { useToday } from '../../lib/hooks';
import { isDemo, useCalendar } from '../../lib/calendar/client';
import { localToday, occurrences, timeLabel, type CalendarEvent } from '../../lib/calendar/recurrence';
import { useExternalCalendars } from '../../lib/calendar/feeds';
import { upcomingTasks, useEventTasks, type EventTasks, type TodayTask } from '../../lib/calendar/event-tasks';
import { monthAgreements, monthOf, weekAhead } from '../../lib/family-meeting-support';
import { useFamilyProfile } from '../../lib/family-meeting-client';
import { planFor } from '../../lib/schedule';
import { dailyEssentials, weekend } from '../../data/cleaning';
import { dateKey } from '../../lib/dates';
import { keys, readList } from '../../lib/storage';
import { MEETING_GUIDE } from '../../data/club/meeting-guide';
import { visibleFeatures } from '../../data/app/features';
import { routes } from '../../routes';
import { monthPageName } from '../../data/club/month-pages';
import { useShowsClub } from './TodayOverview';
import { Avatar, Chevron, Progress, TileHead } from './ui';
import { householdAccess } from '../../lib/household/api';
import { appShellBuild } from '../../lib/native/platform';
import { firstSteps, gettingStarted, nextStep, type FirstStep } from '../../lib/app/first-steps';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

export default function TodayDashboard() {
  const today = useToday();
  const cal = useCalendar();
  const profile = useFamilyProfile(cal.state.scope !== 'local' ? cal.state.scope : null);
  const date = localToday(today);
  // Her subscribed calendars too (private ones are hers to see); read-only.
  const ext = useExternalCalendars(cal.state.scope !== 'local' && cal.signedIn && !isDemo() ? cal.state.scope : null, 'mine');
  const events = [...Object.values(cal.state.events), ...ext.events];
  // Who does what for imported events, the next 7 days (staged rollout: hidden until it's on for the household).
  const eventTasks = useEventTasks(cal.state.scope !== 'local' && cal.signedIn && !isDemo() ? cal.state.scope : null);
  const doing = eventTasks.available ? upcomingTasks(eventTasks.tasks, ext.events, date) : [];
  const week = weekAhead(events, date, today);
  const agreed = monthAgreements(cal.household, profile, monthOf(today));
  const showsClub = useShowsClub() && visibleFeatures().some((f) => f.id === 'club');
  const month = MONTHS[today.getMonth()];
  const [shared, setShared] = useState(false);
  useEffect(() => {
    if (!cal.signedIn || isDemo()) return;
    void householdAccess().then((a) => setShared((a?.adults.length ?? 1) > 1), () => setShared(false));
  }, [cal.signedIn]);
  const steps = firstSteps({ household: cal.household, signedIn: cal.signedIn, hasPlans: Object.keys(cal.state.events).length > 0, shared,
    agreedCount: agreed?.people.length ?? 0, offerClub: !appShellBuild() && !showsClub });
  const starting = !isDemo() && !(cal.signedIn && !cal.household && cal.status === 'syncing') && gettingStarted(steps);

  // Phones: one column in this order. Wide screens: plans and the week on the left, the reset and the month on the right.
  return (
    <div className="of-dash">
      {isDemo() && (
        <div className="family-note of-span-all" data-today-demo><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm">A made-up family, to show how Today looks. Nothing here is shared or synced. <a href="/app" className="underline">Leave the demo</a>.</p></div>
      )}
      {starting && <StartHere steps={steps} household={Boolean(cal.household)} />}
      <div className="of-dash-col">
        <TodayPlans date={date} cal={cal} events={events} week={week} style={{ order: 1 }} />
        {doing.length > 0 && <WhoDoesWhat items={doing} today={date} cal={cal} tasks={eventTasks} style={{ order: 1 }} />}
        <MeetingWeek week={week} agreedRoute={agreed?.route} style={{ order: 3 }} />
      </div>
      <div className="of-dash-col">
        <TodayReset today={today} style={{ order: 2 }} />
        {showsClub && <ClubMonth month={month} title={monthPageName(monthOf(today))} style={{ order: 4 }} />}
        {agreed && <EveryonesPart agreed={agreed} colors={cal.colors} month={month} style={{ order: 5 }} />}
      </div>
      {cal.signedIn && !isDemo() && (
        <p className="of-span-all text-center text-[0.85rem] text-warm-soft" style={{ order: 99 }} data-feedback-quiet>
          Something confusing or not working? <a href="/app/feedback?from=/app" className="underline underline-offset-4">Tell us</a>
        </p>
      )}
    </div>
  );
}

type Cal = ReturnType<typeof useCalendar>;
type Week = ReturnType<typeof weekAhead>;
type Style = { order: number };

function TodayPlans({ date, cal, events, week, style }: { date: string; cal: Cal; events: CalendarEvent[]; week: Week; style: Style }) {
  const list = occurrences(events, date, date);
  const name = (id?: string | null) => (id ? cal.household?.members.find((m) => m.id === id)?.firstName : undefined);
  const color = (id?: string | null) => cal.colors[id ?? '']?.hex ?? '#8fa686';
  // Nothing today: the next plan this week, so the tile still says something useful.
  const next = list.length ? null : week.days.find((d) => d.date > date && d.items.length);
  return (
    <section className="of-tile" style={{ ['--of-order' as string]: style.order }} aria-labelledby="today-plans-h" data-today-plans>
      <TileHead
        eyebrow={<span id="today-plans-h">Today’s plans</span>}
        title={list.length ? `${list.length === 1 ? 'One plan' : `${list.length} plans`} today` : 'A clear day on the calendar'}
        action={<a href={routes.familyCalendar} className="of-tile-action">Week <Chevron /></a>}
      />
      {list.length > 0 ? (
        <ul className="of-rows">
          {list.map((o) => {
            const who = o.event.member_ids.map(name).filter(Boolean);
            const owner = name(o.event.owner_member_id);
            return (
              <li key={o.event.id} className="of-row" data-today-event={o.event.title}>
                <span className="of-time">{o.continued ? 'Continues' : timeLabel(o.event)}</span>
                <span aria-hidden="true" className="of-swatch" style={{ background: color(o.event.member_ids[0] ?? o.event.owner_member_id) }} />
                <span className="min-w-0">
                  <span className="of-row-title">{o.event.title}</span>
                  {(who.length > 0 || owner || o.event.external) && <span className="of-row-meta">{[who.join(', '), owner ? `${owner} handles it` : '', o.event.external?.name ?? ''].filter(Boolean).join(' · ')}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3">
          {next ? (
            <p className="text-[0.92rem] text-warm-soft">Next up · <span className="font-semibold text-warm-ink">{dayName(next.date)}</span>: {next.items.slice(0, 2).map((i) => `${i.title} (${i.time})`).join(', ')}{next.items.length > 2 ? ` and ${next.items.length - 2} more` : ''}</p>
          ) : (
            <p className="text-[0.92rem] text-warm-soft">Nothing on the family calendar today.</p>
          )}
          <a href={routes.familyCalendar} className="of-btn of-btn--soft mt-4">Add a plan</a>
        </div>
      )}
    </section>
  );
}

/**
 * Responsibilities on imported events for the next 7 days (docs/calendar/EVENT_RESPONSIBILITIES.md): each with its
 * person's color, the event and its day; checked off here or in the event, the same everywhere. One whose event left
 * the calendar says so and can be removed.
 */
function WhoDoesWhat({ items, today, cal, tasks, style }: { items: TodayTask[]; today: string; cal: Cal; tasks: EventTasks; style: Style }) {
  const [error, setError] = useState<string | null>(null);
  const name = (id: string | null) => (id ? cal.household?.members.find((m) => m.id === id && !m.archived)?.firstName : undefined);
  const open = items.filter((x) => !x.task.done).length;
  const when = (x: TodayTask) => (x.date === today ? 'Today' : dayName(x.date)) + (x.event && x.event.start_time ? ` ${timeLabel(x.event)}` : '');
  return (
    <section className="of-tile" style={{ ['--of-order' as string]: style.order }} aria-labelledby="who-does-what-h" data-who-does-what>
      <TileHead
        eyebrow={<span id="who-does-what-h">Who’s doing what</span>}
        title={open ? `${open === 1 ? 'One thing' : `${open} things`} to do this week` : 'All done this week'}
        action={<a href={routes.familyCalendar} className="of-tile-action">Calendar <Chevron /></a>}
      />
      <ul className="of-rows">
        {items.map((x) => {
          const who = name(x.task.member_id);
          return (
            <li key={x.task.id} className="of-row !gap-2" data-today-task={x.task.title} data-done={x.task.done ? '' : undefined}>
              <button type="button" role="checkbox" aria-checked={x.task.done} aria-label={`${x.task.title}${who ? `, ${who}` : ''}`}
                onClick={async () => setError(await tasks.toggle(x.task.id))} className="grid size-11 shrink-0 place-items-center" data-task-done>
                <span aria-hidden="true" className={`grid size-6 place-items-center rounded-[6px] border-2 text-[0.85rem] font-bold ${x.task.done ? 'border-warm-ink bg-warm-ink text-white' : 'border-[var(--of-rule-strong)] bg-white'}`}>{x.task.done ? '✓' : ''}</span>
              </button>
              <span aria-hidden="true" className="of-swatch" style={{ background: who ? cal.colors[x.task.member_id!]?.hex ?? '#8fa686' : '#d8d2c8' }} />
              <span className="min-w-0 flex-1">
                <span className={`of-row-title block ${x.task.done ? 'text-warm-soft line-through' : ''}`}>{x.task.title}</span>
                <span className="of-row-meta">
                  {[who ?? 'Anyone', x.event ? x.event.title : x.task.event_title, when(x)].join(' · ')}
                  {!x.event && <span className="block text-[#a33]" data-task-orphan>No longer on the calendar · <button type="button" className="underline underline-offset-2" onClick={async () => setError(await tasks.remove(x.task.id))} data-task-orphan-remove>Remove</button></span>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-2 text-[0.88rem] text-[#a33]">{error}</p>}
    </section>
  );
}

/** Today's cleaning reset and its progress, from the same checkmarks the cleaning companion keeps (HomeStatus's rule). */
function TodayReset({ today, style }: { today: Date; style: Style }) {
  const [, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('pageshow', refresh); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('pageshow', refresh); window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  const plan = planFor(today);
  const zone = plan.kind === 'weekday' ? plan.focus.zone : plan.day.zone;
  const icon = plan.kind === 'weekday' ? plan.focus.icon : weekend.icon;
  const minutes = plan.kind === 'weekday' ? plan.focus.minutes : 'Optional';
  const daily = new Set(readList(keys.daily(dateKey(today))));
  const zoneTasks = plan.kind === 'weekday' ? plan.focus.tasks : [];
  const zoneChecked = new Set(readList(keys.focus(dateKey(today))));
  const done = dailyEssentials.tasks.filter((t) => daily.has(t.id)).length + zoneTasks.filter((t) => zoneChecked.has(t.id)).length;
  const total = dailyEssentials.tasks.length + zoneTasks.length;
  return (
    <section className="of-tile of-tile--sage" style={{ ['--of-order' as string]: style.order }} aria-label="Today's cleaning" data-today-reset>
      <div className="of-tile-head">
        <div className="min-w-0">
          <p className="of-eyebrow">Today’s reset</p>
          <h2 className="of-tile-title" data-today-zone={zone}>{zone}</h2>
          <p className="of-tile-sub">Your {dailyEssentials.tasks.length} daily essentials and today’s zone · {minutes.replace(/\s*minutes?/i, ' min')}</p>
        </div>
        <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-white/80"><img src={icon} alt="" width={192} height={192} className="size-11" /></span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 text-[0.85rem]">
        <span className="font-semibold">{done} of {total} done today</span>
        <span className="text-warm-soft">{done === total && total ? 'All done' : done ? 'Every check counts' : 'Start with one small task'}</span>
      </div>
      <div className="mt-2"><Progress done={done} total={total} label="Today's cleaning progress" /></div>
      <a href="/app/cleaning" className="of-btn mt-5">Open today’s cleaning</a>
    </section>
  );
}

/** This week's Family Meeting preparation: what's on the calendar, what's new or changed, what nobody has picked up. */
function MeetingWeek({ week, agreedRoute, style }: { week: Week; agreedRoute?: string; style: Style }) {
  // One meeting for everyone: the weekly page carries the Club's month (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §2).
  const meetingHref = '/app/family/meeting';
  const stats = [
    { n: week.count, label: week.count === 1 ? 'plan' : 'plans' },
    { n: week.changes.length, label: 'new or changed' },
    { n: week.unhandled, label: 'need someone' },
  ];
  return (
    <section className="of-tile of-tile--month" style={{ ['--of-order' as string]: style.order }} aria-labelledby="meeting-week-h" data-meeting-week>
      <TileHead eyebrow={<span id="meeting-week-h">For your Family Meeting · next 7 days</span>} title={week.count ? 'What’s coming up this week' : MEETING_GUIDE.subtitle} />
      {week.count > 0 ? (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-[8px] bg-white/75 px-3 py-2.5">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-serif text-[1.6rem] leading-none tabular-nums">{s.n}</dd>
                <dd aria-hidden="true" className="mt-1 text-[0.72rem] font-semibold leading-tight text-warm-soft">{s.label}</dd>
              </div>
            ))}
          </dl>
          {week.changes.length > 0 && (
            <ul className="mt-4 space-y-1.5" data-meeting-changes>
              {week.changes.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-baseline gap-2 text-[0.92rem]"><span className="cal-change" data-change={c.change}>{c.change === 'new' ? 'New' : 'Changed'}</span>{c.title}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <ol className="mt-4 grid grid-cols-2 gap-2" aria-label="The four parts">
          {MEETING_GUIDE.parts.map((p, i) => (
            <li key={p.title} className="flex items-center gap-2 rounded-[8px] bg-white/75 px-3 py-2 text-[0.85rem]"><span className="font-serif text-warm-soft">{i + 1}</span><span className="font-semibold">{p.title}</span></li>
          ))}
        </ol>
      )}
      <div className="mt-4 flex flex-wrap gap-x-5">
        <a href={meetingHref} className="of-tile-action" data-open-meeting>Start our Family Meeting <Chevron /></a>
        {week.count > 0 && <a href={routes.familyCalendar} className="of-tile-action">See the week <Chevron /></a>}
      </div>
    </section>
  );
}

function EveryonesPart({ agreed, colors, month, style }: { agreed: NonNullable<ReturnType<typeof monthAgreements>>; colors: Cal['colors']; month: string; style: Style }) {
  return (
    <section className="of-tile" style={{ ['--of-order' as string]: style.order }} aria-labelledby="everyones-part-h" data-everyones-part>
      <TileHead eyebrow={<span id="everyones-part-h">Everyone’s part · {cap(month)}</span>} title={agreed.people.length ? 'Who’s doing what' : 'Nothing agreed yet'} action={<a href="/app/family/responsibilities" className="of-tile-action">All <Chevron /></a>} />
      {agreed.people.length ? (
        <ul className="of-rows" data-agreed-parts>
          {agreed.people.map((p) => (
            <li key={p.memberId} className="of-row !items-start" data-part-person={p.name}>
              <Avatar name={p.name} color={colors[p.memberId]} size="sm" />
              <span className="min-w-0">
                <span className="of-row-title">{p.name}</span>
                <span className="of-row-meta">{p.parts.map((x) => <span key={x.id} className="block" data-agreement={x.id}>{x.text}{x.when ? ` · ${x.when}` : ''}</span>)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.92rem] text-warm-soft" data-no-agreements>In your Family Meeting, tap “We agreed” when someone takes a part. It shows here for everyone.</p>
      )}
      <p className="mt-3 text-[0.78rem] text-warm-soft">Agreed in your Family Meeting.</p>
    </section>
  );
}

function ClubMonth({ month, title, style }: { month: string; title?: string; style: Style }) {
  return (
    <a href={`/app/club/${month}`} className="of-tile of-tile--month" style={{ ['--of-order' as string]: style.order }} data-club-month={month}>
      <div className="of-tile-head">
        <div className="min-w-0">
          <p className="of-eyebrow">Family Meeting Club · {cap(month)}</p>
          <h2 className="of-tile-title">{title ?? `${cap(month)}’s family plan`}</h2>
          <p className="of-tile-sub">One shared plan for the month, with a part for everyone.</p>
        </div>
        <Chevron className="mt-1" />
      </div>
      <span className="of-tile-action mt-3">Open {cap(month)} <Chevron /></span>
    </a>
  );
}

/**
 * A new family's first screen: what the app is for in one line, and ONE next step (docs/pilot/PILOT_TESTING.md).
 * Gone once the family has started (src/lib/app/first-steps.ts); the same steps stay listed on Family until then.
 */
function StartHere({ steps, household }: { steps: FirstStep[]; household: boolean }) {
  const next = nextStep(steps);
  if (!next) return null;
  const own = steps.filter((s) => s.id !== 'club');
  const done = own.filter((s) => s.done).length;
  if (!household) {
    return (
      <section className="of-tile of-tile--month of-span-all" style={{ order: -1 }} aria-labelledby="start-here-h" data-start-here="household">
        <p className="of-eyebrow">Start here · Free</p>
        <h2 id="start-here-h" className="of-tile-title of-tile-title--lg">One shared plan for your family’s week.</h2>
        <p className="of-tile-sub">A calendar everyone can see, a ten-minute daily cleaning reset, and a weekly Family Meeting where everyone takes a part, so it isn’t all on you.</p>
        <a href={next.href} className="of-btn mt-5" data-start-next={next.id}>Set up your family</a>
        <p className="mt-3 text-[0.85rem] text-warm-soft">About a minute: first names and ages. Kids don’t need accounts.</p>
      </section>
    );
  }
  return (
    <section className="of-tile of-span-all" style={{ order: -1 }} aria-labelledby="start-here-h" data-start-here={next.id}>
      <p className="of-eyebrow">Getting started · {done} of {own.length} done</p>
      <h2 id="start-here-h" className="of-tile-title">{next.label}</h2>
      <a href={next.href} className="of-btn mt-4" data-start-next={next.id}>{next.id === 'meeting' ? 'Open the Family Meeting' : next.id === 'week' ? 'Add a plan' : 'Invite them'}</a>
      {next.id === 'adult' && <a href="/app/family-calendar" className="ml-4 text-[0.9rem] underline underline-offset-4" data-start-skip>Skip for now</a>}
    </section>
  );
}

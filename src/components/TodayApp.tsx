import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { dailyEssentials, weekend } from '../data/cleaning';
import type { MonthlyFocus, WeekdayFocus, WeekendDay } from '../data/cleaning';
import { dateForWeekday, dateKey, monthKey, parseDayParam, weekendStart } from '../lib/dates';
import { useCheckedSet, useToday } from '../lib/hooks';
import { monthFocusFor, planFor } from '../lib/schedule';
import { takeSourceParam } from '../lib/entry';
import { isOnboarded, keys, pruneOld, setEntrySource, setOnboarded } from '../lib/storage';
import { routes } from '../routes';
import { TimeMark, ZoneTag, shortTime } from './marks';
import Onboarding from './Onboarding';
import { Tally, TaskList } from './TaskList';

export default function TodayApp() {
  const [onboarded, setOnboardedState] = useState(isOnboarded);
  // True only right after finishing the welcome screen, to point at the first task.
  const [justStarted, setJustStarted] = useState(false);

  // Note how this visit arrived (e.g. ?source=calendar from /start), then tidy the URL.
  useEffect(() => {
    const here = window.location.pathname + window.location.search + window.location.hash;
    const { source, cleaned } = takeSourceParam(here);
    if (source) setEntrySource(source);
    if (cleaned !== here) window.history.replaceState(window.history.state, '', cleaned);
  }, []);

  const finish = () => {
    setOnboarded(true);
    setOnboardedState(true);
    setJustStarted(true);
    document.documentElement.classList.remove('needs-onboarding');
    window.scrollTo(0, 0);
  };

  if (!onboarded) return <Onboarding onDone={finish} />;
  return <Today justStarted={justStarted} />;
}

function Today({ justStarted }: { justStarted: boolean }) {
  const today = useToday();
  const todayKey = dateKey(today);

  // ?day=monday (from the Tidy week) shows that weekday of the current week.
  // Progress for it is saved under that day's own date, never today's.
  const [selectedDow] = useState(() => parseDayParam(new URLSearchParams(window.location.search).get('day')));
  const viewing = selectedDow !== null && selectedDow !== today.getDay() ? dateForWeekday(today, selectedDow) : null;
  const shown = viewing ?? today;
  const plan = planFor(shown);

  useEffect(() => pruneOld(today), [today]);

  const [daily, toggleDaily] = useCheckedSet(keys.daily(todayKey));
  const dailyDone = dailyEssentials.tasks.filter((t) => daily.has(t.id)).length;

  const weekday = shown.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = String(shown.getDate()).padStart(2, '0');
  const monthYear = shown.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const longDate = shown.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      {viewing && (
        <div className="mb-5 flex items-center justify-between gap-3 bg-band px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="label">Viewing {weekday}</p>
            <p className="mt-1 text-[0.9rem] leading-snug text-muted">
              {viewing < today ? 'Earlier' : 'Later'} this week · today is{' '}
              {today.toLocaleDateString('en-US', { weekday: 'long' })}
            </p>
          </div>
          <a href={routes.today} className="text-link inline-flex min-h-11 shrink-0 items-center">
            Back to today
          </a>
        </div>
      )}

      <header className="border-l-[3px] border-month pl-3.5">
        <h1 aria-label={viewing ? `Viewing ${longDate}` : `Today, ${longDate}`}>
          <span className="block text-[1.5rem] leading-tight font-bold tracking-[0.12em] uppercase sm:text-[1.75rem]">
            {weekday} {dayNum}
          </span>
          <span className="month-title mt-1 block text-[1.15rem] leading-none">{monthYear}</span>
        </h1>
      </header>

      <div className="mt-7 grid gap-6 md:mt-10 md:grid-cols-2 md:gap-x-12">
        {!viewing && (
          <Section
            id="daily"
            first
            heading={
              <h2 id="daily-heading" className="text-[1rem] font-bold tracking-[0.18em] uppercase">
                {dailyEssentials.title}
              </h2>
            }
            meta={
              <>
                <TimeMark>{shortTime(dailyEssentials.minutes)}</TimeMark>
                <Tally done={dailyDone} total={dailyEssentials.tasks.length} />
              </>
            }
          >
            {justStarted && dailyDone === 0 && (
              <p role="status" className="mt-2.5 bg-band px-3.5 py-2.5 text-[1rem] leading-snug">
                <strong className="font-semibold">You’re set.</strong> Start here — tap a task when it’s done.
              </p>
            )}
            <TaskList tasks={dailyEssentials.tasks} checked={daily} onToggle={toggleDaily} scope="daily" label="Daily reset tasks" />
          </Section>
        )}

        {plan.kind === 'weekday' ? (
          <FocusSection focus={plan.focus} date={dateKey(shown)} first={!!viewing} />
        ) : (
          <WeekendSection day={plan.day} month={plan.month} date={shown} first={!!viewing} />
        )}
      </div>

      <MonthlyTeaser month={monthFocusFor(shown)} />

      <nav aria-label="More" className="mt-8 border-t border-rule-strong">
        <a href={routes.tidy} className="flex min-h-12 items-center justify-between border-b border-rule text-[0.7rem] font-semibold tracking-[0.16em] uppercase">
          How the system works <span aria-hidden="true">→</span>
        </a>
        <a href={routes.reorder} className="flex min-h-12 items-center justify-between border-b border-rule text-[0.7rem] font-semibold tracking-[0.16em] text-muted uppercase">
          Reorder your calendar <span aria-hidden="true">→</span>
        </a>
      </nav>
    </div>
  );
}

/** A quiet reminder that the month's deeper project exists. Links to it on Tidy. */
function MonthlyTeaser({ month }: { month: MonthlyFocus }) {
  return (
    <section aria-labelledby="monthly-teaser-heading" className="mt-9 border-t border-rule-strong pt-3.5">
      <h2 id="monthly-teaser-heading" className="label text-muted">
        Monthly home project
      </h2>
      <a href={routes.monthlyFocus} className="group mt-2.5 block border-l-[3px] border-month pl-3.5">
        <span className="month-title block text-[1.05rem] leading-none">{month.name}</span>
        <span className="project-title mt-1.5 block">{month.title}</span>
        <span className="mt-1 block text-[1rem] leading-snug text-muted">{month.description}</span>
        <span className="mt-2 inline-flex min-h-11 items-center text-[0.7rem] font-semibold tracking-[0.16em] uppercase underline decoration-rule decoration-1 underline-offset-[6px] group-hover:decoration-ink">
          View this month’s project <span aria-hidden="true">&nbsp;→</span>
        </span>
      </a>
    </section>
  );
}

interface SectionProps {
  id: string;
  heading: ReactNode;
  meta: ReactNode;
  note?: ReactNode;
  /** The first block sits directly under the date, without a separating rule. */
  first?: boolean;
  children: ReactNode;
}

/** One block of the day: a single heading line (title left, time + tally right), optional note, then ruled tasks. */
function Section({ id, heading, meta, note, first, children }: SectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className={first ? '' : 'border-t border-rule-strong pt-3.5 md:border-t-0 md:pt-0'}>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <div className="min-w-0">{heading}</div>
        <div className="flex shrink-0 items-center gap-3">{meta}</div>
      </div>
      {note && <p className="mt-1 text-[1rem] leading-snug text-muted">{note}</p>}
      <div className="mt-2.5 border-t border-rule-strong">{children}</div>
    </section>
  );
}

function FocusSection({ focus, date, first }: { focus: WeekdayFocus; date: string; first?: boolean }) {
  const [checked, toggle] = useCheckedSet(keys.focus(date));
  const done = focus.tasks.filter((t) => checked.has(t.id)).length;

  return (
    <Section
      id="focus"
      first={first}
      heading={
        <h2 id="focus-heading">
          <span className="sr-only">{focus.dayLabel} focus: </span>
          <ZoneTag icon={focus.icon} label={focus.zone} />
        </h2>
      }
      meta={
        <>
          <TimeMark>{shortTime(focus.minutes)}</TimeMark>
          <Tally done={done} total={focus.tasks.length} />
        </>
      }
      note={focus.description}
    >
      <TaskList tasks={focus.tasks} checked={checked} onToggle={toggle} scope="focus" label={`${focus.zone} tasks`} />
    </Section>
  );
}

function WeekendSection({ day, month, date, first }: { day: WeekendDay; month: MonthlyFocus; date: Date; first?: boolean }) {
  const [monthly, toggleMonthly] = useCheckedSet(keys.monthly(monthKey(date)));
  const [weekendChecks, toggleWeekend] = useCheckedSet(keys.weekend(dateKey(weekendStart(date))));
  const done = month.tasks.filter((t) => monthly.has(t.id)).length;

  return (
    <Section
      id="weekend"
      first={first}
      heading={
        <h2 id="weekend-heading">
          <span className="sr-only">{day.dayLabel}: </span>
          <ZoneTag icon={weekend.icon} label={day.zone} />
        </h2>
      }
      meta={<TimeMark>Optional</TimeMark>}
      note={weekend.description}
    >
      <div className="border-b border-rule bg-band px-4 py-3.5">
        <p className="label text-muted">{month.name} project</p>
        <h3 className="project-title mt-1">{month.title}</h3>
        <p className="mt-1.5 text-[1rem] leading-snug">
          <strong className="font-semibold">Choose one.</strong> The list is for the whole month — you don’t need to finish it
          now.
        </p>
      </div>
      <div className="flex items-center justify-between pt-3.5 pb-0.5">
        <span className="label text-muted">This month</span>
        <Tally done={done} total={month.tasks.length} />
      </div>
      <TaskList
        tasks={month.tasks}
        checked={monthly}
        onToggle={toggleMonthly}
        scope="monthly"
        label={`${month.title} tasks for ${month.name}`}
      />
      <p className="label pt-4 pb-0.5 text-muted" aria-hidden="true">
        Or
      </p>
      <TaskList tasks={[weekend.catchUp]} checked={weekendChecks} onToggle={toggleWeekend} scope="weekend" label="Catch up instead" />
    </Section>
  );
}

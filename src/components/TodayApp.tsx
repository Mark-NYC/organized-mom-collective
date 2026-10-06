import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { dailyEssentials, weekend } from '../data/cleaning';
import type { MonthlyFocus, WeekdayFocus, WeekendDay } from '../data/cleaning';
import { dateKey, monthKey, weekendStart } from '../lib/dates';
import { useCheckedSet, useToday } from '../lib/hooks';
import { planFor } from '../lib/schedule';
import { isOnboarded, keys, pruneOld, setOnboarded } from '../lib/storage';
import { TimeMark, ZoneTag, shortTime } from './marks';
import Onboarding from './Onboarding';
import { Tally, TaskList } from './TaskList';

export default function TodayApp() {
  const [onboarded, setOnboardedState] = useState(isOnboarded);

  const finish = () => {
    setOnboarded(true);
    setOnboardedState(true);
    document.documentElement.classList.remove('needs-onboarding');
    window.scrollTo(0, 0);
  };

  if (!onboarded) return <Onboarding onDone={finish} />;
  return <Today />;
}

function Today() {
  const today = useToday();
  const date = dateKey(today);
  const plan = planFor(today);

  useEffect(() => pruneOld(today), [today]);

  const [daily, toggleDaily] = useCheckedSet(keys.daily(date));
  const dailyDone = dailyEssentials.tasks.filter((t) => daily.has(t.id)).length;

  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = String(today.getDate()).padStart(2, '0');
  const monthYear = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <header className="border-l-[3px] border-month pl-3.5">
        <h1 aria-label={`Today, ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}>
          <span className="block text-[1.5rem] leading-tight font-bold tracking-[0.12em] uppercase sm:text-[1.75rem]">
            {weekday} {dayNum}
          </span>
          <span className="month-title mt-1 block text-[1.15rem] leading-none">{monthYear}</span>
        </h1>
      </header>

      <div className="mt-7 grid gap-7 md:mt-10 md:grid-cols-2 md:gap-x-12">
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
          <TaskList tasks={dailyEssentials.tasks} checked={daily} onToggle={toggleDaily} scope="daily" label="Daily reset tasks" />
        </Section>

        {plan.kind === 'weekday' ? (
          <FocusSection focus={plan.focus} date={date} />
        ) : (
          <WeekendSection day={plan.day} month={plan.month} today={today} />
        )}
      </div>

      <nav aria-label="More" className="mt-12 border-t border-rule-strong">
        <a href="/tidy" className="flex min-h-12 items-center justify-between border-b border-rule text-[0.7rem] font-semibold tracking-[0.16em] uppercase">
          How the system works <span aria-hidden="true">→</span>
        </a>
        <a href="/reorder" className="flex min-h-12 items-center justify-between border-b border-rule text-[0.7rem] font-semibold tracking-[0.16em] text-muted uppercase">
          Reorder your calendar <span aria-hidden="true">→</span>
        </a>
      </nav>
    </div>
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
    <section aria-labelledby={`${id}-heading`} className={first ? '' : 'border-t border-rule-strong pt-5 md:border-t-0 md:pt-0'}>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <div className="min-w-0">{heading}</div>
        <div className="flex shrink-0 items-center gap-3">{meta}</div>
      </div>
      {note && <p className="mt-2 text-[1rem] leading-snug text-muted">{note}</p>}
      <div className="mt-3 border-t border-rule-strong">{children}</div>
    </section>
  );
}

function FocusSection({ focus, date }: { focus: WeekdayFocus; date: string }) {
  const [checked, toggle] = useCheckedSet(keys.focus(date));
  const done = focus.tasks.filter((t) => checked.has(t.id)).length;

  return (
    <Section
      id="focus"
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

function WeekendSection({ day, month, today }: { day: WeekendDay; month: MonthlyFocus; today: Date }) {
  const [monthly, toggleMonthly] = useCheckedSet(keys.monthly(monthKey(today)));
  const [weekendChecks, toggleWeekend] = useCheckedSet(keys.weekend(dateKey(weekendStart(today))));
  const done = month.tasks.filter((t) => monthly.has(t.id)).length;

  return (
    <Section
      id="weekend"
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

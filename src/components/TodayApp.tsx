import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { dailyEssentials, weekend } from '../data/cleaning';
import type { MonthlyFocus, WeekdayFocus, WeekendDay } from '../data/cleaning';
import { dateKey, monthKey, weekendStart } from '../lib/dates';
import { useCheckedSet, useToday } from '../lib/hooks';
import { planFor } from '../lib/schedule';
import { isOnboarded, keys, pruneOld, setOnboarded } from '../lib/storage';
import { MonthBand, TimeMark, ZoneTag, shortTime } from './marks';
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

  const month = today.toLocaleDateString('en-US', { month: 'long' });
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = String(today.getDate()).padStart(2, '0');

  return (
    <div>
      <header>
        <MonthBand month={month} year={today.getFullYear()} className="-mx-5 -mt-8 px-5 pt-7 pb-4 sm:mx-0 sm:mt-0 sm:px-7" />
        <h1
          className="mt-5 flex items-baseline justify-between gap-4"
          aria-label={`Today, ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        >
          <span className="text-[1.45rem] font-bold tracking-[0.16em] uppercase sm:text-[1.7rem]">
            {weekday} {dayNum}
          </span>
          <span className="label text-muted">Today</span>
        </h1>
      </header>

      <div className="mt-8 grid gap-12 md:grid-cols-2 md:gap-x-12">
        <Section
          id="daily"
          heading={<h2 id="daily-heading" className="section-label">{dailyEssentials.title}</h2>}
          meta={
            <>
              <span>Every day</span>
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

      <nav aria-label="More" className="mt-14 border-t border-rule-strong">
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
  children: ReactNode;
}

/** A calendar-style block: major rule, centered heading, small centered meta line, then ruled tasks. */
function Section({ id, heading, meta, note, children }: SectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className="border-t border-rule-strong pt-6">
      <div className="flex flex-col items-center gap-3 text-center">{heading}</div>
      <div className="label mt-3 flex items-center justify-center gap-3 text-muted">{meta}</div>
      {note && <div className="mt-4 text-center text-[0.9rem] leading-relaxed text-muted">{note}</div>}
      <div className="mt-5 border-t border-rule-strong">{children}</div>
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
          <span>{focus.dayLabel}</span>
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
      meta={
        <>
          <span>{day.dayLabel}</span>
          <TimeMark>Optional</TimeMark>
        </>
      }
      note={weekend.description}
    >
      <div className="border-b border-rule bg-band px-4 py-4 text-center">
        <p className="label text-muted">{month.name} project</p>
        <h3 className="project-title mt-2">{month.title}</h3>
        <p className="mt-2 text-[0.88rem] leading-relaxed">
          <strong className="font-semibold">Choose one.</strong> The list is for the whole month — you don’t need to finish it
          now.
        </p>
      </div>
      <div className="flex items-center justify-between pt-4 pb-1">
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
      <p className="label pt-5 pb-1 text-center text-muted" aria-hidden="true">
        Or
      </p>
      <TaskList tasks={[weekend.catchUp]} checked={weekendChecks} onToggle={toggleWeekend} scope="weekend" label="Catch up instead" />
    </Section>
  );
}

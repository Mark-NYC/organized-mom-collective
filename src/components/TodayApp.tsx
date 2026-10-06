import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { dailyEssentials, weekend } from '../data/cleaning';
import type { MonthlyFocus, WeekdayFocus } from '../data/cleaning';
import { dateKey, monthKey, weekendStart } from '../lib/dates';
import { useCheckedSet, useToday } from '../lib/hooks';
import { planFor } from '../lib/schedule';
import { isOnboarded, keys, pruneOld, setOnboarded } from '../lib/storage';
import { accentClasses } from './accent';
import { DayMark, TimeMark, shortTime } from './marks';
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
  const monthDay = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div>
      <header>
        <p className="rule-label text-muted">Today</p>
        <h1 className="mt-4">
          <span className="block font-serif text-[3.4rem] leading-[0.95] font-medium tracking-[-0.01em] sm:text-[4.25rem]">
            {weekday}
          </span>
          <span className="mt-2.5 block text-[0.82rem] font-semibold tracking-[0.3em] uppercase">{monthDay}</span>
        </h1>
      </header>

      <div className="mt-10 grid gap-12 md:mt-12 md:grid-cols-2 md:gap-x-14">
        <PlannerSection
          id="daily"
          rule="border-ink"
          mark={<DayMark label="Daily" icon={dailyEssentials.icon} />}
          kicker="Every day"
          title={dailyEssentials.title}
          time={shortTime(dailyEssentials.minutes)}
          tally={<Tally done={dailyDone} total={dailyEssentials.tasks.length} />}
        >
          <TaskList
            tasks={dailyEssentials.tasks}
            checked={daily}
            onToggle={toggleDaily}
            scope="daily"
            label="Daily reset tasks"
          />
        </PlannerSection>

        {plan.kind === 'weekday' ? (
          <FocusSection focus={plan.focus} date={date} />
        ) : (
          <WeekendSection month={plan.month} today={today} />
        )}
      </div>

      <nav aria-label="More" className="mt-14 border-t border-rule">
        <a href="/tidy" className="flex min-h-12 items-center justify-between border-b border-rule text-[0.72rem] font-semibold tracking-[0.16em] uppercase">
          How the system works <span aria-hidden="true">→</span>
        </a>
        <a href="/reorder" className="flex min-h-12 items-center justify-between border-b border-rule text-[0.72rem] font-semibold tracking-[0.16em] text-muted uppercase">
          Reorder your calendar <span aria-hidden="true">→</span>
        </a>
      </nav>
    </div>
  );
}

interface PlannerSectionProps {
  id: string;
  /** Color of the heavy rule that opens the section */
  rule: string;
  mark?: ReactNode;
  kicker: string;
  title: string;
  note?: string;
  time: string;
  tally?: ReactNode;
  children: ReactNode;
}

/** A section of the planner page: heavy rule, heading block, then ruled lines. */
function PlannerSection({ id, rule, mark, kicker, title, note, time, tally, children }: PlannerSectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className={`border-t-[3px] ${rule} pt-4`}>
      <div className="flex items-start gap-4">
        {mark}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="label">{kicker}</p>
            <TimeMark>{time}</TimeMark>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <h2 id={`${id}-heading`} className="font-serif text-[1.85rem] leading-[1.05] font-semibold">
              {title}
            </h2>
            <div className="pb-1">{tally}</div>
          </div>
        </div>
      </div>
      {note && <p className="mt-3 font-serif text-[1.08rem] leading-snug text-muted italic">{note}</p>}
      <div className="mt-4 border-t border-rule">{children}</div>
    </section>
  );
}

function FocusSection({ focus, date }: { focus: WeekdayFocus; date: string }) {
  const [checked, toggle] = useCheckedSet(keys.focus(date));
  const done = focus.tasks.filter((t) => checked.has(t.id)).length;

  return (
    <PlannerSection
      id="focus"
      rule={accentClasses[focus.accent].rule}
      mark={<DayMark label={focus.shortLabel} icon={focus.icon} accent={focus.accent} />}
      kicker={`${focus.dayLabel} / ${focus.zone}`}
      title={focus.title}
      note={focus.description}
      time={shortTime(focus.minutes)}
      tally={<Tally done={done} total={focus.tasks.length} />}
    >
      <TaskList tasks={focus.tasks} checked={checked} onToggle={toggle} scope="focus" label={`${focus.title} tasks`} />
    </PlannerSection>
  );
}

function WeekendSection({ month, today }: { month: MonthlyFocus; today: Date }) {
  const [monthly, toggleMonthly] = useCheckedSet(keys.monthly(monthKey(today)));
  const [weekendChecks, toggleWeekend] = useCheckedSet(keys.weekend(dateKey(weekendStart(today))));
  const done = month.tasks.filter((t) => monthly.has(t.id)).length;

  return (
    <PlannerSection
      id="weekend"
      rule={accentClasses[month.accent].rule}
      mark={<DayMark label={weekend.shortLabel} icon={weekend.icon} accent={month.accent} />}
      kicker={weekend.title}
      title={month.title}
      time="Optional"
    >
      <div className="border-b border-rule py-4">
        <p className="label text-muted">{month.name} project</p>
        <p className="mt-2 font-serif text-[1.15rem] leading-snug">
          <em>This weekend, choose one.</em> The list is for the whole month — you don’t need to finish it now.
        </p>
      </div>
      <div className="flex items-center justify-between pt-4 pb-1">
        <h3 className="label text-muted">This month</h3>
        <Tally done={done} total={month.tasks.length} />
      </div>
      <TaskList
        tasks={month.tasks}
        checked={monthly}
        onToggle={toggleMonthly}
        scope="monthly"
        label={`${month.title} tasks for ${month.name}`}
      />
      <p className="pt-5 pb-1 label text-muted" aria-hidden="true">
        Or
      </p>
      <TaskList
        tasks={[weekend.catchUp]}
        checked={weekendChecks}
        onToggle={toggleWeekend}
        scope="weekend"
        label="Catch up instead"
      />
    </PlannerSection>
  );
}

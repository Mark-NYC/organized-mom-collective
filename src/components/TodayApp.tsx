import { useEffect, useState } from 'react';
import { dailyEssentials, weekend } from '../data/cleaning';
import type { MonthlyFocus, WeekdayFocus } from '../data/cleaning';
import { dateKey, formatLongDate, monthKey, weekendStart } from '../lib/dates';
import { useCheckedSet, useToday } from '../lib/hooks';
import { planFor } from '../lib/schedule';
import { isOnboarded, keys, pruneOld, setOnboarded } from '../lib/storage';
import { accentClasses } from './accent';
import Onboarding from './Onboarding';
import { Progress, TaskList } from './TaskList';

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

  const focusLabel = plan.kind === 'weekday' ? plan.focus.zone : 'Weekend project';
  const focusTime = plan.kind === 'weekday' ? plan.focus.minutes.replace('minutes', 'min') : 'optional';

  return (
    <div className="space-y-5">
      <header className="pb-1">
        <p className="eyebrow">Today</p>
        <h1 className="mt-1.5 font-serif text-[2.35rem] leading-tight font-medium sm:text-5xl">{formatLongDate(today)}</h1>
        <p className="mt-2 text-[0.95rem] text-muted">
          Daily reset <span className="text-faint">·</span> {dailyEssentials.minutes.replace('minutes', 'min')}
          <span className="mx-2 text-line" aria-hidden="true">|</span>
          {focusLabel} <span className="text-faint">·</span> {focusTime}
        </p>
      </header>

      <section aria-labelledby="daily-heading" className="card px-5 pt-5 pb-3 sm:px-7 sm:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Every day · {dailyEssentials.minutes}</p>
            <h2 id="daily-heading" className="mt-1 font-serif text-[1.7rem] leading-tight font-semibold">
              Today’s reset
            </h2>
          </div>
          <div className="pt-1">
            <Progress done={dailyDone} total={dailyEssentials.tasks.length} />
          </div>
        </div>
        <div className="mt-2">
          <TaskList
            tasks={dailyEssentials.tasks}
            checked={daily}
            onToggle={toggleDaily}
            scope="daily"
            label="Daily reset tasks"
          />
        </div>
      </section>

      {plan.kind === 'weekday' ? (
        <FocusCard focus={plan.focus} date={date} />
      ) : (
        <WeekendCard month={plan.month} today={today} />
      )}

      <footer className="space-y-3 pt-4 text-center text-sm text-muted">
        <p>
          New here? <a href="/tidy" className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">See how the system works</a>
        </p>
        <p className="text-faint">
          Nearing the end of your calendar?{' '}
          <a href="/reorder" className="underline decoration-line underline-offset-4 hover:text-ink">Order the next one</a>
        </p>
      </footer>
    </div>
  );
}

function FocusCard({ focus, date }: { focus: WeekdayFocus; date: string }) {
  const [checked, toggle] = useCheckedSet(keys.focus(date));
  const done = focus.tasks.filter((t) => checked.has(t.id)).length;
  const a = accentClasses[focus.accent];

  return (
    <section aria-labelledby="focus-heading" className="card overflow-hidden">
      <div className={`${a.tint} border-b ${a.border} px-5 pt-5 pb-4 sm:px-7`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {focus.dayLabel} focus · {focus.minutes}
            </p>
            <h2 id="focus-heading" className="mt-1 font-serif text-[1.7rem] leading-tight font-semibold">
              {focus.title}
            </h2>
          </div>
          <div className="pt-1">
            <Progress done={done} total={focus.tasks.length} />
          </div>
        </div>
        <p className="mt-1 text-[0.95rem] text-muted">{focus.description}</p>
      </div>
      <div className="px-5 pt-2 pb-3 sm:px-7">
        <TaskList tasks={focus.tasks} checked={checked} onToggle={toggle} scope="focus" label={`${focus.title} tasks`} />
      </div>
    </section>
  );
}

function WeekendCard({ month, today }: { month: MonthlyFocus; today: Date }) {
  const [monthly, toggleMonthly] = useCheckedSet(keys.monthly(monthKey(today)));
  const [weekendChecks, toggleWeekend] = useCheckedSet(keys.weekend(dateKey(weekendStart(today))));
  const done = month.tasks.filter((t) => monthly.has(t.id)).length;
  const a = accentClasses[month.accent];

  return (
    <section aria-labelledby="weekend-heading" className="card overflow-hidden">
      <div className={`${a.tint} border-b ${a.border} px-5 pt-5 pb-4 sm:px-7`}>
        <p className="eyebrow">
          {weekend.title} · {month.name}
        </p>
        <h2 id="weekend-heading" className="mt-1 font-serif text-[1.7rem] leading-tight font-semibold">
          {month.title}
        </h2>
        <p className="mt-1 text-[0.95rem] text-muted">{month.description}</p>
      </div>

      <div className="px-5 pt-4 pb-3 sm:px-7">
        <div className="rounded-xl bg-paper px-4 py-3 text-[0.92rem] leading-relaxed text-muted">
          <strong className="font-semibold text-ink">This weekend, choose one.</strong> This list is for the whole
          month — you don’t need to finish it now.
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <h3 className="eyebrow">This month’s project</h3>
          <p className="text-sm text-muted tabular-nums" aria-live="polite">
            {done} of {month.tasks.length} this month
          </p>
        </div>
        <TaskList
          tasks={month.tasks}
          checked={monthly}
          onToggle={toggleMonthly}
          scope="monthly"
          label={`${month.title} tasks for ${month.name}`}
        />

        <div className="my-1 flex items-center gap-3 text-xs tracking-[0.16em] text-faint uppercase" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>
        <TaskList
          tasks={[weekend.catchUp]}
          checked={weekendChecks}
          onToggle={toggleWeekend}
          scope="weekend"
          label="Catch up instead"
        />
      </div>
    </section>
  );
}

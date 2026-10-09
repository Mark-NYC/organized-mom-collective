import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { dailyEssentials, weekend } from '../data/cleaning';
import { monthFocusFor, planFor } from '../lib/schedule';
import { TimeMark, Wordmark, ZoneTag, shortTime } from './marks';

interface Props {
  onDone: () => void;
}

/**
 * One welcome screen, no questions. The cleaning zones are printed on the
 * calendar, so there's nothing to set up — just show how today's zone, the
 * daily reset and the monthly home project fit together, then get her cleaning.
 */
export default function Onboarding({ onDone }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const now = new Date();
  const plan = planFor(now);
  const month = monthFocusFor(now);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const todayZone =
    plan.kind === 'weekday'
      ? { icon: plan.focus.icon, zone: plan.focus.zone, time: shortTime(plan.focus.minutes) }
      : { icon: weekend.icon, zone: plan.day.zone, time: 'Optional' };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onboarding-heading" className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="h-1 bg-month" aria-hidden="true" />
      <div className="mx-auto flex min-h-[calc(100dvh-0.25rem)] max-w-md flex-col px-6 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 shrink-0 items-center border-b border-rule">
          <Wordmark />
        </div>

        <div className="flex-1 pt-5 pb-5">
          <p className="label text-muted">Your calendar companion</p>
          <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="mt-2.5 text-[1.45rem] leading-[1.2] font-bold outline-none min-[390px]:text-[1.6rem]">
            Your calendar plans the week. This shows you what to clean today.
          </h1>

          <ul className="mt-5 border-t border-rule-strong">
            <Row when="Today’s zone" note="The same zone printed on your calendar." time={todayZone.time}>
              <ZoneTag icon={todayZone.icon} label={todayZone.zone} size="sm" />
            </Row>
            <Row when="Every day" note="The same five tasks every day: beds, dishes, counters." time={shortTime(dailyEssentials.minutes)}>
              <ZoneTag icon={dailyEssentials.icon} label={dailyEssentials.title} size="sm" />
            </Row>
            <Row when="Monthly home project" note={`${month.name}’s deeper job. Weekends, if you have time.`}>
              <span className="project-title block text-[0.8rem]">{month.title}</span>
            </Row>
          </ul>

          <p className="mt-4 border-l-[3px] border-month pl-3.5 text-[1.05rem] leading-snug font-semibold">
            Do what fits. Skip what doesn’t.
          </p>
        </div>

        <div className="sticky bottom-0 -mx-6 shrink-0 border-t border-rule bg-paper px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={onDone} className="btn-primary w-full min-h-14 text-[0.8rem]">
            Start Cleaning
          </button>
          <p className="mt-2 text-center text-[0.8rem] text-muted">No account. Nothing to buy. Saved on this phone.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ when, note, time, children }: { when: string; note: string; time?: string; children: ReactNode }) {
  return (
    <li className="border-b border-rule py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="label text-muted">{when}</p>
        {time && <TimeMark>{time}</TimeMark>}
      </div>
      <div className="mt-2">{children}</div>
      <p className="mt-1 text-[0.95rem] leading-snug">{note}</p>
    </li>
  );
}

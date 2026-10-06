import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { dailyEssentials, weekend, weeklySchedule } from '../data/cleaning';
import { accentClasses } from './accent';
import { DayMark, CalendarEdge, TimeMark, Wordmark, shortTime } from './marks';

interface Props {
  onDone: () => void;
}

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const last = 2;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const heading = (text: string) => (
    <h1
      id="onboarding-heading"
      ref={headingRef}
      tabIndex={-1}
      className="mt-5 font-serif text-[2.6rem] leading-[1.02] font-medium tracking-[-0.01em] outline-none"
    >
      {text}
    </h1>
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onboarding-heading" className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <CalendarEdge />
      <div className="mx-auto flex min-h-[calc(100dvh-0.25rem)] max-w-md flex-col px-6 pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex h-14 items-center justify-between border-b border-rule">
          <Wordmark />
          {step < last && (
            <button
              type="button"
              onClick={onDone}
              className="-mr-2 min-h-11 px-2 text-[0.66rem] font-semibold tracking-[0.18em] text-faint uppercase hover:text-ink"
            >
              Skip
            </button>
          )}
        </div>

        <div className="flex-1 pt-10 pb-10">
          <p className="rule-label text-muted">
            <span className="tabular-nums">
              {String(step + 1).padStart(2, '0')} / 03
            </span>
          </p>

          {step === 0 && (
            <>
              {heading('Welcome to your Organized Mom cleaning system.')}
              <p className="mt-8 border-l-[3px] border-blush pl-4 font-serif text-[1.45rem] leading-snug italic">
                You don’t need to clean the whole house every day.
              </p>
              <p className="mt-6 text-[1.02rem] leading-relaxed text-muted">
                Your calendar helps you plan the week. This companion tells you which part of the house to tackle today:
                a small daily reset, plus one area to focus on.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              {heading('A simple weekly rhythm.')}
              <ol className="mt-8 border-t-[3px] border-ink">
                <RhythmRow
                  mark={<DayMark label="Daily" icon={dailyEssentials.icon} size="sm" />}
                  when="Every day"
                  what="A few essential reset tasks"
                  time={shortTime(dailyEssentials.minutes)}
                />
                <RhythmRow
                  mark={
                    <span className="grid size-[3.25rem] shrink-0 grid-cols-2 grid-rows-2" aria-hidden="true">
                      {weeklySchedule.map((d) => (
                        <span key={d.day} className={accentClasses[d.accent].fill} />
                      ))}
                    </span>
                  }
                  when="Mon–Thu"
                  what="One room, quick and focused"
                  time="10–15 min"
                />
                <RhythmRow
                  mark={<DayMark label={weekend.shortLabel} icon={weekend.icon} accent="apricot" size="sm" />}
                  when="Fri–Sun"
                  what="A deep-clean project, seasonal project, or catch-up"
                  time="Optional"
                />
              </ol>
            </>
          )}

          {step === 2 && (
            <>
              {heading('Open this each day. We’ll show you what to do.')}
              <p className="mt-8 text-[1.02rem] leading-relaxed text-muted">
                Check things off as you go. Your progress stays on this phone — no account, no sign-up.
              </p>
              <p className="mt-6 border-l-[3px] border-green pl-4 font-serif text-[1.3rem] leading-snug italic">
                Missed a day? Nothing piles up. Tomorrow starts fresh.
              </p>
            </>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          Step {step + 1} of 3
        </p>
        <div className="flex items-center gap-5 border-t border-rule pt-5">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="text-link min-h-11">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (step === last ? onDone() : setStep(step + 1))}
            className="btn-primary flex-1"
          >
            {step === last ? 'Start My Week' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RhythmRow({ mark, when, what, time }: { mark: ReactNode; when: string; what: string; time: string }) {
  return (
    <li className="flex items-center gap-4 border-b border-rule py-4">
      {mark}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="label">{when}</p>
          <TimeMark>{time}</TimeMark>
        </div>
        <p className="mt-1.5 leading-snug text-muted">{what}</p>
      </div>
    </li>
  );
}

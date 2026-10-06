import { useEffect, useRef, useState } from 'react';
import { dailyEssentials, weekend, weeklySchedule } from '../data/cleaning';
import { TimeMark, Wordmark, shortTime } from './marks';

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
    <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="page-title mt-5 outline-none">
      {text}
    </h1>
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onboarding-heading" className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="h-2 bg-month" aria-hidden="true" />
      <div className="mx-auto flex min-h-[calc(100dvh-0.5rem)] max-w-md flex-col px-6 pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex h-14 items-center justify-between border-b border-rule">
          <Wordmark badge={false} />
          {step < last && (
            <button
              type="button"
              onClick={onDone}
              className="-mr-2 min-h-11 px-2 text-[0.64rem] font-semibold tracking-[0.18em] text-muted uppercase hover:text-ink"
            >
              Skip
            </button>
          )}
        </div>

        <div className="flex-1 pt-8 pb-10">
          <p className="label text-muted tabular-nums">{String(step + 1).padStart(2, '0')} / 03</p>

          {step === 0 && (
            <>
              <img src="/brand/omc-badge.png" alt="Organized Mom Collective" width={512} height={512} className="mt-6 size-28" />
              {heading('Welcome to your Organized Mom cleaning system.')}
              <p className="mt-7 border-l-[3px] border-month pl-4 text-[1.1rem] leading-snug font-semibold">
                You don’t need to clean the whole house every day.
              </p>
              <p className="mt-5 text-[0.98rem] leading-relaxed">
                Your calendar helps you plan the week. This companion tells you which part of the house to tackle today:
                a small daily reset, plus one area to focus on.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              {heading('A simple weekly rhythm.')}
              <ol className="mt-8 border-t border-rule-strong">
                <RhythmRow
                  icons={[dailyEssentials.icon]}
                  when="Every day"
                  what="A few essential reset tasks"
                  time={shortTime(dailyEssentials.minutes)}
                />
                <RhythmRow
                  icons={weeklySchedule.map((d) => d.icon)}
                  when="Mon–Thu"
                  what={weeklySchedule.map((d) => d.zone).join(' · ')}
                  time="10–15 min"
                />
                <RhythmRow icons={[weekend.icon]} when="Fri–Sun" what={weekend.days.map((d) => d.zone).join(' · ')} time="Optional" />
              </ol>
            </>
          )}

          {step === 2 && (
            <>
              {heading('Open this each day. We’ll show you what to do.')}
              <p className="mt-7 text-[0.98rem] leading-relaxed">
                Check things off as you go. Your progress stays on this phone — no account, no sign-up.
              </p>
              <p className="mt-6 border-l-[3px] border-month pl-4 text-[1.1rem] leading-snug font-semibold">
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
          <button type="button" onClick={() => (step === last ? onDone() : setStep(step + 1))} className="btn-primary flex-1">
            {step === last ? 'Start My Week' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RhythmRow({ icons, when, what, time }: { icons: string[]; when: string; what: string; time: string }) {
  return (
    <li className="border-b border-rule py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label">{when}</p>
        <TimeMark>{time}</TimeMark>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="flex shrink-0 items-center rounded-full bg-month px-1.5 py-0.5" aria-hidden="true">
          {icons.map((src) => (
            <img key={src} src={src} alt="" width={192} height={192} className="size-7" />
          ))}
        </span>
        <p className="text-[0.72rem] leading-snug font-semibold tracking-[0.12em] text-muted uppercase">{what}</p>
      </div>
    </li>
  );
}

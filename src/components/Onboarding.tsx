import { useEffect, useRef, useState } from 'react';
import { dailyEssentials } from '../data/cleaning';

interface Props {
  onDone: () => void;
}

const rhythm = [
  { when: 'Every day', what: 'A few essential reset tasks', time: dailyEssentials.minutes.replace('minutes', 'min'), dot: 'bg-green' },
  { when: 'Mon–Thu', what: 'Quick room-focused cleaning', time: '10–15 min', dot: 'bg-blue' },
  { when: 'Fri–Sun', what: 'A deep-clean project, seasonal project, or catch-up', time: 'Optional', dot: 'bg-apricot' },
];

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const last = 2;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-heading"
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
    >
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex h-11 items-center justify-between">
          <p className="font-serif text-[1.35rem] font-semibold">
            Organized <span className="font-medium italic">Mom</span>
          </p>
          {step < last && (
            <button type="button" onClick={onDone} className="-mr-3 min-h-11 px-3 text-sm text-muted hover:text-ink">
              Skip
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          {step === 0 && (
            <>
              <p className="eyebrow">Welcome</p>
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="mt-4 font-serif text-[2.4rem] leading-[1.08] font-medium outline-none">
                Welcome to your Organized Mom cleaning system.
              </h1>
              <div className="mt-8 border-l-2 border-blush pl-5">
                <p className="font-serif text-[1.45rem] leading-snug italic">
                  You don’t need to clean the whole house every day.
                </p>
              </div>
              <p className="mt-6 text-[1.05rem] leading-relaxed text-muted">
                We’ll give you a small daily reset, plus one area to focus on. That’s it.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <p className="eyebrow">How it works</p>
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="mt-4 font-serif text-[2.4rem] leading-[1.08] font-medium outline-none">
                A simple weekly rhythm.
              </h1>
              <ul className="mt-8 space-y-3">
                {rhythm.map((r) => (
                  <li key={r.when} className="card flex gap-4 p-5">
                    <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${r.dot}`} />
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-semibold tracking-[0.12em] uppercase">{r.when}</p>
                        <p className="text-xs text-muted">{r.time}</p>
                      </div>
                      <p className="mt-1 leading-snug text-muted">{r.what}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 2 && (
            <>
              <p className="eyebrow">You’re set</p>
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="mt-4 font-serif text-[2.4rem] leading-[1.08] font-medium outline-none">
                Open this each day. We’ll show you what to do.
              </h1>
              <p className="mt-6 text-[1.05rem] leading-relaxed text-muted">
                Check things off as you go. Your progress stays on this phone — no account, no sign-up.
              </p>
              <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">
                Missed a day? Nothing piles up. Tomorrow starts fresh.
              </p>
            </>
          )}
        </div>

        <div>
          <div className="mb-6 flex justify-center gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-ink' : 'w-1.5 bg-line'}`} />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Step {step + 1} of 3
          </p>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
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
    </div>
  );
}

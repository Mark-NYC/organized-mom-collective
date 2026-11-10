import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { dailyEssentials, weekend } from '../data/cleaning';
import { monthFocusFor, planFor } from '../lib/schedule';
import { TimeMark, Wordmark, ZoneTag, shortTime } from './marks';

interface Props { onDone: () => void; }

const STEPS = [
  {
    label: 'Gather the family',
    title: 'Start with a family meeting.',
    intro: 'Before anyone fills in the calendar, bring everyone together for ten minutes. This works best when the family helps build it, not when one person fills it all in alone.',
    action: 'Put the calendar and a set of colored pens on the table. Ask: “What do we want everyone to know about this week?”',
  },
  {
    label: 'Pick your colors',
    title: 'Everyone gets their own color.',
    intro: 'Let each person choose a pen color. They get to use that same color for their activities and responsibilities on the calendar.',
    action: 'Invite each person to write at least one thing on the calendar in their own color. For younger kids, help them write or draw it. Let them own the pen.',
  },
  {
    label: 'Give it a home',
    title: 'Put it where everyone sees it.',
    intro: 'Choose a spot your family passes every day: the kitchen, entryway, or another shared space. Low enough for kids to see and use is even better.',
    action: 'Decide together when you will look at it again. A quick check at dinner or during a weekly family meeting is enough.',
  },
] as const;

/** First-run and replayable paper-calendar walkthrough. No user account or data collection. */
export default function Onboarding({ onDone }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const now = new Date();
  const plan = planFor(now);
  const month = monthFocusFor(now);
  const todayZone = plan.kind === 'weekday'
    ? { icon: plan.focus.icon, zone: plan.focus.zone, time: shortTime(plan.focus.minutes) }
    : { icon: weekend.icon, zone: plan.day.zone, time: 'Optional' };
  const last = step === STEPS.length;
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onboarding-heading" className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="h-1 bg-month" aria-hidden="true" />
      <div className="mx-auto flex min-h-[calc(100dvh-0.25rem)] max-w-md flex-col px-6 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 shrink-0 items-center border-b border-rule"><Wordmark /></div>
        <div className="flex-1 pt-6 pb-5">
          <p className="label text-muted">Set up your family calendar · {step + 1} of 4</p>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-label={`Step ${step + 1} of 4`}>
            {[0,1,2,3].map(i => <span key={i} className={`h-1.5 rounded-full ${i <= step ? 'bg-[#3D6671]' : 'bg-[#D5C5B8]'}`} />)}
          </div>
          {!last ? (
            <div>
              <p className="label mt-7 text-[#71866c]">{STEPS[step].label}</p>
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="mt-3 font-serif text-[1.9rem] leading-[1.15] text-ink outline-none">
                {STEPS[step].title}
              </h1>
              <p className="mt-5 text-[1.06rem] leading-relaxed text-ink">{STEPS[step].intro}</p>
              <div className="mt-7 rounded-xl border border-rule bg-[#FBF7F1] p-5">
                <p className="label text-[#3D6671]">Try this together</p>
                <p className="mt-3 text-[1.05rem] leading-relaxed">{STEPS[step].action}</p>
              </div>
              {step === 1 && (
                <div className="mt-6 flex items-center gap-3" aria-label="Sample pen colors">
                  {['#3D6671','#C17D61','#78956A','#C08DA3','#C4A147','#786C9D'].map(color => (
                    <span key={color} className="h-8 w-8 rounded-full border border-rule" style={{ backgroundColor: color }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="label mt-7 text-[#71866c]">Your cleaning companion</p>
              <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="mt-3 font-serif text-[1.9rem] leading-[1.15] text-ink outline-none">
                Now keep the rhythm going.
              </h1>
              <p className="mt-5 text-[1.06rem] leading-relaxed">
                The printed calendar helps everyone see the plan. This free companion helps you see today’s cleaning jobs. Choose who owns what at a family meeting, then follow your daily reset and zone.
              </p>
              <ul className="mt-6 border-t border-rule-strong">
                <Row when="Today’s zone" note="The same zone shown on the printed calendar." time={todayZone.time}>
                  <ZoneTag icon={todayZone.icon} label={todayZone.zone} size="sm" />
                </Row>
                <Row when="Every day" note="Share the reset: beds, dishes, counters and pickup." time={shortTime(dailyEssentials.minutes)}>
                  <ZoneTag icon={dailyEssentials.icon} label={dailyEssentials.title} size="sm" />
                </Row>
                <Row when="Monthly project" note="Choose a little extra together when you have time.">
                  <span className="project-title block text-[0.8rem]">{month.title}</span>
                </Row>
              </ul>
              <p className="mt-5 border-l-[3px] border-month pl-3.5 text-[1.05rem] leading-snug font-semibold">
                Everyone has a color. Everyone has a part. Everyone can see the plan.
              </p>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 -mx-6 shrink-0 border-t border-rule bg-paper px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => last ? onDone() : setStep(n => n + 1)} className="btn-primary w-full min-h-14 text-[0.8rem]">
            {last ? 'Open Today’s Cleaning' : step === 0 ? 'Next: Pick Your Colors' : step === 1 ? 'Next: Find Its Home' : 'Next: Cleaning Companion'}
          </button>
          {step > 0 && <button type="button" onClick={() => setStep(n => n - 1)} className="mt-2 min-h-11 w-full text-[0.85rem] text-muted underline underline-offset-4">Back</button>}
          <p className="mt-2 text-center text-[0.8rem] text-muted">No login needed. Your cleaning checkmarks stay on this device.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ when, note, time, children }: { when: string; note: string; time?: string; children: ReactNode }) {
  return <li className="border-b border-rule py-2.5">
    <div className="flex items-center justify-between gap-3"><p className="label text-muted">{when}</p>{time && <TimeMark>{time}</TimeMark>}</div>
    <div className="mt-2">{children}</div><p className="mt-1 text-[0.95rem] leading-snug">{note}</p>
  </li>;
}

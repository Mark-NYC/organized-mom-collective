/**
 * /app/sunday-setup: the weekly review (docs/ios/SUNDAY_SETUP.md). Free. About 10 minutes, ideally together.
 *
 * It supports the printed 11×17 wall calendar; it isn't another calendar. Each step reads what already exists (the
 * family calendar, the family profile's responsibilities, the cleaning companion's zones, the Club's month) and asks
 * only what's new this week; the last step is a day-by-day summary to copy onto the wall calendar with each person's
 * pen, and an optional one-page printable.
 */
import { useEffect, useMemo, useState } from 'react';
import { useCalendar, isDemo } from '../../lib/calendar/client';
import { addDays, localToday } from '../../lib/calendar/recurrence';
import { planningWeek, unhandled, weekSummary, cleaningZone } from '../../lib/sunday-setup/summary';
import { useWeekPlan } from '../../lib/sunday-setup/client';
import { accountStore } from '../../lib/club/store';
import { appPreviewStore } from '../../lib/app-family';
import { loadMembership } from '../../lib/club/membership';
import { accountsEnabled, getSession } from '../../lib/account';
import type { FamilyProfile, Responsibility } from '../../lib/club/family-profile';
import { GROWTH_ITEMS, RESPONSIBILITY_CATEGORIES } from '../../data/club/family-profile';
import { routes } from '../../routes';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
const jobLabel = (r: Responsibility) => r.label ?? GROWTH_ITEMS.find((g) => g.id === r.item)?.label ?? RESPONSIBILITY_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category;

type StepId = 'week' | 'jobs' | 'dinners' | 'cleaning' | 'club' | 'wall';

export default function SundaySetup() {
  const cal = useCalendar();
  const startsOn = (cal.household?.preferences as { week_starts?: string } | undefined)?.week_starts === 'monday' ? 1 : 0;
  const [week, setWeek] = useState(() => planningWeek(localToday(), 0));
  useEffect(() => { setWeek(planningWeek(localToday(), startsOn as 0 | 1)); }, [startsOn]);
  const { plan, update, status, conflict, dismissConflict } = useWeekPlan(week);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [member, setMember] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isDemo()) { void appPreviewStore()?.profile().then(setProfile); return; }
    if (!accountsEnabled()) return;
    getSession().then(async (s) => {
      if (!s) return;
      setProfile(await accountStore.profile().catch(() => null));
      const me = await loadMembership().catch(() => null);
      setMember(Boolean(me && (me.member || me.grant)));
    }).catch(() => {});
  }, []);

  const people = (cal.household?.members ?? []).filter((m) => !m.archived);
  const events = useMemo(() => Object.values(cal.state.events), [cal.state.events]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const steps: StepId[] = ['week', 'jobs', 'dinners', 'cleaning', ...(member ? (['club'] as StepId[]) : []), 'wall'];
  const id = steps[Math.min(step, steps.length - 1)];
  const color = (memberId?: string | null) => (memberId ? cal.colors[memberId]?.hex : undefined);
  const Person = ({ id: pid }: { id: string }) => {
    const m = people.find((x) => x.id === pid);
    return m ? <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: color(pid) }} />{m.firstName}</span> : null;
  };
  const PersonSelect = ({ value, onChange, label }: { value?: string; onChange: (v: string) => void; label: string }) => (
    <select aria-label={label} className="ss-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{people.length ? 'Who?' : 'Set up your family first'}</option>
      {people.map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}
    </select>
  );

  return (
    <div className="family-brand mx-auto max-w-3xl" data-sunday-setup>
      <header className="print:hidden">
        <p className="label text-[#71866c]">SUNDAY SETUP · {fmt(days[0], { month: 'short', day: 'numeric' })} – {fmt(days[6], { month: 'short', day: 'numeric' })}</p>
        <h1 className="family-title mt-3 !text-[2.1rem]">Ten minutes. <em className="text-[#71866c]">The whole week.</em></h1>
        <p className="family-lede mt-3">Go through it together if you can. Everything you already entered is here; you only add what’s new this week.</p>
        {isDemo() && <div className="family-note mt-4" data-sunday-demo><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm">A made-up family, to show how Sunday Setup works. Nothing here is shared or synced.</p></div>}
        {conflict && <div role="alert" className="family-note mt-4"><strong className="text-sm">Changed on another phone</strong><p className="mt-1 text-sm">The other grown-up saved this week’s plan first, so we loaded theirs. Check it and add anything you still need.</p><button type="button" className="family-link" onClick={dismissConflict}>OK</button></div>}
        <ol className="mt-6 flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((s, i) => <li key={s} className={`h-1.5 flex-1 ${i <= step ? 'bg-[#71866c]' : 'bg-warm-rule'}`} />)}
        </ol>
      </header>

      <section className="mt-6" data-setup-step={id}>
        {id === 'week' && (
          <>
            <h2 className="family-panel-title">1. What’s happening</h2>
            <p className="mt-2 text-sm text-warm-soft">Everything on the family calendar this week. Anything nobody is handling yet is first.</p>
            {(() => {
              const open = unhandled(week, events);
              if (!events.length) return <p className="family-note mt-4 text-sm">Nothing on the calendar yet. <a className="underline" href={`${routes.familyCalendar}${isDemo() ? '?demo=1' : ''}`}>Add this week’s plans</a>, then come back.</p>;
              return (
                <>
                  {open.length > 0 ? (
                    <ul className="mt-4 space-y-3" data-unhandled>
                      {open.map(({ event, date }) => (
                        <li key={event.id} className="family-panel !p-4">
                          <p className="text-sm font-semibold">{event.title} <span className="font-normal text-warm-soft">· {fmt(date, { weekday: 'short' })}{event.recurrence ? ' and more' : ''}</span></p>
                          <p className="mt-1 text-sm text-warm-soft">Who’s handling it?</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {people.filter((m) => m.kind === 'adult' || (m.birthYear && new Date().getFullYear() - m.birthYear >= 12)).map((m) => (
                              <button key={m.id} type="button" className="ss-chip" data-assign={m.firstName} onClick={() => cal.save({ ...event, owner_member_id: m.id })}><Person id={m.id} /></button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-4 text-sm text-[#536e4e]" data-all-handled>Everything this week has someone handling it.</p>}
                  <ul className="mt-5 divide-y divide-warm-rule border-y border-warm-rule text-sm">
                    {weekSummary(week, events, plan, people).map((d) => d.lines.filter((l) => l.kind === 'event').length > 0 && (
                      <li key={d.date} className="py-2.5"><span className="font-semibold">{d.label}</span>
                        {d.lines.filter((l) => l.kind === 'event').map((l, i) => <span key={i} className="mt-1 flex items-center gap-2 text-warm-soft"><span aria-hidden="true" className="inline-block h-3 w-[4px]" style={{ background: color(l.memberId) ?? '#c9c2bb' }} />{l.text}</span>)}
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </>
        )}

        {id === 'jobs' && (
          <>
            <h2 className="family-panel-title">2. Who does what</h2>
            <p className="mt-2 text-sm text-warm-soft">The jobs each person owns, from your family profile. Same list the cleaning companion and the Club use.</p>
            {profile?.responsibilities.length ? (
              <ul className="mt-4 space-y-3" data-jobs>
                {people.map((m) => {
                  const mine = profile.responsibilities.filter((r) => r.ownerIds.includes(m.id) && (r.status === 'existing' || r.status === 'confirmed'));
                  if (!mine.length) return null;
                  return <li key={m.id} className="family-panel !p-4"><p className="font-semibold"><Person id={m.id} /></p><p className="mt-1 text-sm text-warm-soft">{mine.map(jobLabel).join(' · ')}</p></li>;
                })}
              </ul>
            ) : <p className="family-note mt-4 text-sm">No jobs saved yet. <a className="underline" href={routes.clubFamily}>Add who owns what</a> once, and it shows here every week.</p>}
          </>
        )}

        {id === 'dinners' && (
          <>
            <h2 className="family-panel-title">3. Dinners</h2>
            <p className="mt-2 text-sm text-warm-soft">Just the plan. Leave a night blank for leftovers or “we’ll see”.</p>
            <ul className="mt-4 divide-y divide-warm-rule border-y border-warm-rule" data-dinners>
              {days.map((d) => (
                <li key={d} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 py-2.5 sm:grid-cols-[5rem_1fr_9rem]">
                  <span className="text-sm font-semibold">{fmt(d, { weekday: 'short', day: 'numeric' })}</span>
                  <input className="ss-input" placeholder="What’s for dinner" maxLength={60} value={plan.dinners[d]?.meal ?? ''} data-dinner={d}
                    onChange={(e) => update({ dinners: { ...plan.dinners, [d]: { ...plan.dinners[d], meal: e.target.value } } })} />
                  <span className="col-start-2 sm:col-start-auto"><PersonSelect label={`Who cooks ${d}`} value={plan.dinners[d]?.cook} onChange={(v) => update({ dinners: { ...plan.dinners, [d]: { ...plan.dinners[d], cook: v || undefined } } })} /></span>
                </li>
              ))}
            </ul>
          </>
        )}

        {id === 'cleaning' && (
          <>
            <h2 className="family-panel-title">4. Cleaning this week</h2>
            <p className="mt-2 text-sm text-warm-soft">Each day’s zone from the cleaning companion, the same rows as your wall calendar. Pick who helps.</p>
            <ul className="mt-4 divide-y divide-warm-rule border-y border-warm-rule" data-cleaning>
              {days.map((d) => (
                <li key={d} className="grid grid-cols-[4.5rem_1fr_9rem] items-center gap-3 py-2.5">
                  <span className="text-sm font-semibold">{fmt(d, { weekday: 'short', day: 'numeric' })}</span>
                  <span className="text-sm">{cleaningZone(d)}</span>
                  <PersonSelect label={`Who helps with ${cleaningZone(d)}`} value={plan.chores[d]} onChange={(v) => { const { [d]: _old, ...rest } = plan.chores; update({ chores: v ? { ...rest, [d]: v } : rest }); }} />
                </li>
              ))}
            </ul>
          </>
        )}

        {id === 'club' && (
          <>
            <h2 className="family-panel-title">5. This month’s family plan</h2>
            <p className="mt-2 text-sm text-warm-soft">Your Family Meeting Club plan for {fmt(days[3], { month: 'long' })}. Bring it up at your family meeting.</p>
            <a className="family-action mt-4" href={`/app/club/${MONTHS[+days[3].slice(5, 7) - 1]}`}>Open {fmt(days[3], { month: 'long' })}’s plan</a>
          </>
        )}

        {id === 'wall' && (
          <>
            <h2 className="family-panel-title print:hidden">{steps.length}. Copy it to the wall calendar</h2>
            <p className="mt-2 text-sm text-warm-soft print:hidden">One block per day, in each person’s color. Copy it onto your 11×17 calendar with their pen, so everyone can check the plan without asking.</p>
            <label className="mt-4 block print:hidden"><span className="label">A NOTE FOR THE FAMILY (OPTIONAL)</span>
              <input className="ss-input" maxLength={500} value={plan.notes ?? ''} placeholder="Grandma visits Saturday" onChange={(e) => update({ notes: e.target.value })} /></label>
            <div className="ss-print mt-5" data-wall-summary>
              <p className="hidden print:block font-serif text-[20pt]">Our week · {fmt(days[0], { month: 'short', day: 'numeric' })} – {fmt(days[6], { month: 'short', day: 'numeric' })}</p>
              {plan.notes && <p className="mb-3 text-sm font-semibold print:text-[11pt]">{plan.notes}</p>}
              <ol className="grid gap-2 sm:grid-cols-2 print:grid-cols-2">
                {weekSummary(week, events, plan, people).map((d) => (
                  <li key={d.date} className="border border-warm-rule bg-white p-3 print:break-inside-avoid">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-warm-soft">{d.label}</p>
                    <ul className="mt-1.5 space-y-1 text-[0.88rem] print:text-[10pt]">
                      {d.lines.map((l, i) => (
                        <li key={i} className="flex gap-2"><span aria-hidden="true" className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full print:[print-color-adjust:exact]" style={{ background: color(l.memberId) ?? '#d8d1ca' }} /><span className={l.kind === 'cleaning' ? 'text-warm-soft' : ''}>{l.text}</span></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              {people.length > 0 && <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-warm-soft">{people.map((m) => <Person key={m.id} id={m.id} />)}</p>}
            </div>
            <div className="mt-5 flex flex-wrap gap-3 print:hidden">
              <button type="button" className="family-action" data-finish onClick={() => update({ completed: true })}>{plan.completed ? 'Done for this week ✓' : 'We’re set for the week'}</button>
              <button type="button" className="family-link" onClick={() => window.print()}>Print one page</button>
            </div>
          </>
        )}
      </section>

      <nav className="mt-8 flex items-center justify-between print:hidden" aria-label="Sunday Setup steps">
        <button type="button" className="family-link" disabled={step === 0} onClick={() => setStep(step - 1)}>{step === 0 ? '' : '← Back'}</button>
        <span className="text-xs text-warm-soft" data-setup-status>{status === 'saving' ? 'Saving…' : status === 'offline' ? 'Saved on this phone, will sync' : status === 'saved' ? 'Saved for your family' : 'Saved on this phone'}</span>
        {step < steps.length - 1 && <button type="button" className="family-action !min-h-11" data-next onClick={() => setStep(step + 1)}>Next →</button>}
      </nav>
      <style>{`
        .ss-input{display:block;width:100%;min-height:44px;border:1px solid var(--color-warm-rule,#e7ddd4);background:#fff;padding:.5rem .65rem;font-size:16px;color:var(--color-warm-ink,#4d4544)}
        .ss-chip{display:inline-flex;min-height:44px;align-items:center;border:1px solid var(--color-warm-rule,#e7ddd4);background:#fff;padding:0 .8rem;font-size:.9rem}
        @media print { body * { visibility: hidden !important; } .ss-print, .ss-print * { visibility: visible !important; } .ss-print { position: absolute; inset: 0; padding: .4in; } @page { size: letter; margin: 0; } }
      `}</style>
    </div>
  );
}

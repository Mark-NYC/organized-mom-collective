/**
 * The family plan inside the weekly Family Meeting (docs/ios/FAMILY_PLAN.md), fitted into the four approved parts:
 *
 *   Our Focus        WeekReview    look ahead: the coming week from the family's calendar and the calendars shared
 *                                  with the household (never private ones), and choose the few things that matter
 *                                  ("Highlight"), or add a few words. Nothing becomes a priority on its own.
 *   Everyone's Part  GettingReady  for each highlighted event, who does what to get ready (optional): the existing
 *                                  event responsibilities for imported events, "who handles it" for the family's own.
 *   (Finish)         PlanSummary   "We have a plan.": this week's priorities and who owns what. Printable.
 *
 * Restraint is the point: three priorities shown, the first five days' events, the rest one tap away.
 */
import { useState } from 'react';
import type { CalendarEvent } from '../../lib/calendar/recurrence';
import type { WeekAhead, PersonAgreements } from '../../lib/family-meeting-support';
import { SHOWN, MAX_NOTE, sameRef, type Priorities, type Resolved } from '../../lib/app/priorities';
import { doneLabel, tasksFor, type EventTasks } from '../../lib/calendar/event-tasks';
import type { MarkerColor } from '../../data/club/family-colors';
import type { Household } from '../../lib/club/profile';
import { EventResponsibilities } from '../calendar/CalendarSources';
import { Avatar } from '../app/ui';

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Look ahead, and choose what matters. */
export function WeekReview({ week, priorities, current, weekStart, colors }: {
  week: WeekAhead; priorities: Priorities | null; current: Resolved[]; weekStart: string; colors: Record<string, MarkerColor>;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const items = week.days.flatMap((d) => d.items.map((item) => ({ day: d.label, item })));
  const chosen = priorities?.items.filter((p) => p.week_of === weekStart) ?? [];
  const run = async (key: string, f: () => Promise<string | null>) => { setBusy(key); setError(await f()); setBusy(null); };
  const row = ({ day, item }: (typeof items)[number], i: number) => {
    const picked = chosen.find((p) => sameRef(p, item.ref));
    return (
      <li key={item.id + item.date + i} className="flex items-center gap-2" data-meeting-week-item={item.title}>
        <span aria-hidden="true" className="mt-0.5 inline-block size-2 shrink-0 rounded-full" style={{ background: colors[item.memberIds[0] ?? item.ownerId ?? '']?.hex ?? '#9aab8f' }} />
        <span className="min-w-0 flex-1"><strong>{day}</strong> · {item.time === 'All day' ? '' : `${item.time} · `}{item.title}{item.source ? <span className="text-warm-soft"> · {item.source}</span> : null}</span>
        {priorities?.available && (
          <button type="button" aria-pressed={Boolean(picked)} disabled={busy !== null || (!picked && chosen.length >= SHOWN)}
            onClick={() => void run(item.id, () => (picked ? priorities.remove(picked.id) : priorities.highlight(item.ref, weekStart)))}
            className={`min-h-[40px] shrink-0 rounded-full border px-3 text-[0.82rem] font-semibold ${picked ? 'border-[var(--of-sage-bar)] bg-[var(--of-sage)] text-warm-ink' : 'border-[var(--of-rule)] bg-white text-warm-soft'}`}
            data-highlight={item.title}>{busy === item.id ? '…' : picked ? 'Highlighted' : 'Highlight'}</button>
        )}
      </li>
    );
  };
  return (
    <div className="mt-5 space-y-4">
      {(priorities?.available || current.length > 0) && (
        <div className="rounded-[9px] border border-[var(--of-month-accent)]/40 bg-white p-3 sm:p-4" data-meeting-priorities>
          <div className="flex items-baseline justify-between gap-3">
            <p className="of-eyebrow">Our priorities this week</p>
            <span className="text-xs text-warm-soft">{chosen.length ? `${chosen.length} chosen` : 'Choose up to three'}</span>
          </div>
          {current.length ? (
            <ul className="mt-2 space-y-1.5 text-[0.95rem]" data-meeting-priority-list>
              {current.map((r) => (
                <li key={r.priority.id} className="flex items-center gap-2" data-meeting-priority={r.title}>
                  <span className="min-w-0 flex-1"><strong className="font-semibold">{r.title}</strong>{r.date ? <span className="text-warm-soft"> · {dayLabel(r.date)}{r.time ? ` · ${r.time}` : ''}</span> : null}{r.gone ? <span className="text-[#a33]"> · no longer on the calendar</span> : null}</span>
                  {priorities?.available && <button type="button" className="min-h-[40px] px-2 text-[0.82rem] text-warm-soft underline underline-offset-4" onClick={() => void run(r.priority.id, () => priorities.remove(r.priority.id))} aria-label={`Remove ${r.title}`} data-priority-remove>Remove</button>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[0.9rem] text-warm-soft">What does the whole family need to know about, or get ready for? Highlight it below, or add it in a few words.</p>
          )}
          {priorities?.available && chosen.length < SHOWN && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run('note', async () => { const err = await priorities.addNote(note, weekStart); if (!err) setNote(''); return err; }); }} data-priority-note-form>
              <label className="sr-only" htmlFor="priority-note">Something else that matters this week</label>
              <input id="priority-note" value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} placeholder="Something else that matters this week" className="min-h-[44px] min-w-0 flex-1 rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem]" data-priority-note />
              <button type="submit" disabled={!note.trim() || busy !== null} className="of-btn of-btn--soft !min-h-[44px] !px-3 !normal-case !tracking-normal" data-priority-add>Add</button>
            </form>
          )}
          {error && <p role="alert" className="mt-2 text-[0.85rem] text-[#a33]" data-priority-error>{error}</p>}
        </div>
      )}
      {week.count > 0 && (
        <div className="rounded-[9px] border border-[var(--of-rule)] bg-white/70 p-3 sm:p-4" data-meeting-week>
          <div className="flex items-center justify-between gap-3">
            <p className="of-eyebrow">Coming up this week</p>
            <span className="text-xs text-warm-soft">{week.count} events</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-[0.9rem]" data-meeting-week-highlights>{items.slice(0, 5).map(row)}</ul>
          {items.length > 5 && (
            <details className="mt-3 border-t border-[var(--of-rule)] pt-3" data-meeting-week-all>
              <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">See the full week ({week.count} events)</summary>
              <ul className="mt-2 space-y-1.5 text-[0.88rem]">{items.slice(5).map((x, i) => row(x, i + 5))}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/** Everyone's Part: for each highlighted event, who does what to get ready. Optional; nothing is required. */
export function GettingReady({ current, external, own, tasks, household, colors }: {
  current: Resolved[]; external: CalendarEvent[]; own: CalendarEvent[]; tasks: EventTasks; household: Household | null; colors: Record<string, MarkerColor>;
}) {
  const events = current.filter((r) => r.priority.kind === 'event' && !r.gone);
  if (!events.length) return null;
  const people = (household?.members ?? []).filter((m) => !m.archived);
  return (
    <div className="mb-5" data-getting-ready>
      <p className="of-eyebrow">Getting ready for our priorities</p>
      <ul className="mt-1">
        {events.map((r) => {
          const ext = r.priority.source === 'imported' ? external.find((e) => e.external?.uid === r.priority.event_uid && e.external?.instance_key === r.priority.instance_key) : undefined;
          const fam = r.priority.source === 'family' ? own.find((e) => e.id === r.priority.event_uid) : undefined;
          const label = ext && tasks.available ? doneLabel(tasksFor(tasks.tasks, ext)) : null;
          const owner = fam?.owner_member_id ? people.find((m) => m.id === fam.owner_member_id)?.firstName : null;
          return (
            <li key={r.priority.id} className="border-b border-[var(--of-rule)] last:border-b-0" data-getting-ready-item={r.title}>
              <details className="group">
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="inline-flex size-4 items-center justify-center text-warm-soft transition-transform group-open:rotate-90">›</span>
                  <span className="min-w-0 flex-1"><span className="font-semibold">{r.title}</span>{r.date ? <span className="text-warm-soft"> · {dayLabel(r.date)}</span> : null}</span>
                  <span className="text-[0.8rem] text-warm-soft">{label ?? (owner ? `${owner} handles it` : 'Who’s doing what?')}</span>
                </summary>
                <div className="pb-3 pl-6">
                  {ext && tasks.available ? (
                    <EventResponsibilities e={ext} tasks={tasks} people={people} colors={colors} />
                  ) : fam ? (
                    <p className="text-[0.9rem] text-warm-soft">{owner ? `${owner} is handling it.` : 'Nobody is handling it yet.'} Change who on <a href="/app/family-calendar" className="underline underline-offset-4">the calendar</a>, or agree each person’s part below.</p>
                  ) : (
                    <p className="text-[0.9rem] text-warm-soft">Agree each person’s part below.</p>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "We have a plan.": the week's priorities and who owns what. Nothing gamified; it can be printed. */
export function PlanSummary({ current, agreed, external, tasks, household, colors, onAgain }: {
  current: Resolved[]; agreed: PersonAgreements[]; external: CalendarEvent[]; tasks: EventTasks; household: Household | null; colors: Record<string, MarkerColor>; onAgain: () => void;
}) {
  const people = (household?.members ?? []).filter((m) => !m.archived);
  const name = (id: string | null) => people.find((m) => m.id === id)?.firstName;
  const prep = current.flatMap((r) => {
    const ext = r.priority.source === 'imported' ? external.find((e) => e.external?.uid === r.priority.event_uid && e.external?.instance_key === r.priority.instance_key) : undefined;
    return ext && tasks.available ? tasksFor(tasks.tasks, ext).map((t) => ({ t, for: r.title })) : [];
  });
  return (
    <section className="space-y-5" aria-labelledby="plan-h" data-plan-summary>
      <header>
        <p className="of-eyebrow">Our Family Meeting</p>
        <h1 id="plan-h" className="of-page-title mt-2">We have a plan.</h1>
      </header>
      {current.length > 0 && (
        <div className="of-tile" data-plan-priorities>
          <p className="of-eyebrow">This week’s priorities</p>
          <ul className="mt-2 space-y-1.5">
            {current.map((r) => <li key={r.priority.id} className="text-[1rem]"><strong className="font-semibold">{r.title}</strong>{r.date ? <span className="text-warm-soft"> · {dayLabel(r.date)}</span> : null}</li>)}
          </ul>
        </div>
      )}
      {(prep.length > 0 || agreed.length > 0) && (
        <div className="of-tile" data-plan-parts>
          <p className="of-eyebrow">Everyone’s part</p>
          <ul className="of-rows mt-1">
            {prep.map(({ t, for: f }) => (
              <li key={t.id} className="of-row !gap-3">
                <Avatar name={name(t.member_id) ?? '·'} color={t.member_id ? colors[t.member_id] : undefined} size="sm" />
                <span className="min-w-0"><span className="of-row-title block">{name(t.member_id) ?? 'Anyone'}</span><span className="block text-[0.92rem]">{t.title}</span><span className="of-row-meta">For {f}</span></span>
              </li>
            ))}
            {agreed.map((p) => (
              <li key={p.memberId} className="of-row !items-start !gap-3">
                <Avatar name={p.name} color={colors[p.memberId]} size="sm" />
                <span className="min-w-0"><span className="of-row-title block">{p.name}</span>{p.parts.slice(-2).reverse().map((x) => <span key={x.id} className="block text-[0.92rem]">{x.text}{x.when ? <span className="text-warm-soft"> · {x.when}</span> : null}</span>)}{p.parts.length > 2 && <span className="of-row-meta">+{p.parts.length - 2} more, on <a href="/app/family/responsibilities" className="underline underline-offset-2">Who does what</a></span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!current.length && !prep.length && !agreed.length && <p className="text-warm-soft">You talked it through together. That counts. Next time, pick one priority and one part each.</p>}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <a href="/app" className="of-btn" data-plan-today>See it on Today</a>
        <button type="button" className="of-btn of-btn--soft" onClick={() => window.print()} data-plan-print>Print our plan</button>
        <button type="button" className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4" onClick={onAgain} data-plan-back>Back to the meeting</button>
      </div>
    </section>
  );
}

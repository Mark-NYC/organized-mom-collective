/**
 * The family plan inside the weekly Family Meeting (docs/ios/FAMILY_PLAN.md), fitted into the four approved parts:
 *
 *   Our Focus        WeekReview    look ahead together: the coming week from the family's calendar and the calendars
 *                                  shared with the household (never private ones), each event once, and choose the
 *                                  few that matter ("Highlight"), or add a few words. Nothing becomes a priority on
 *                                  its own.
 *   Everyone's Part  GettingReady  for each highlighted event, who will do what to get ready (optional): the existing
 *                                  event responsibilities for imported events, "who handles it" for the family's own.
 *   (Finish)         PlanSummary   "We have a plan.": each priority with its getting-ready parts under it, then what
 *                                  each person agreed in this meeting. Printable.
 *
 * The priority rule (PRIORITY_RULE below): three is the normal number; a busy week can hold up to five; never more.
 * The meeting says so in words, never with a greyed-out button.
 */
import { useState } from 'react';
import type { CalendarEvent } from '../../lib/calendar/recurrence';
import type { WeekAhead, WeekItem, PersonAgreements } from '../../lib/family-meeting-support';
import { SHOWN, MAX_PER_WEEK, MAX_NOTE, sameRef, type Priorities, type Resolved } from '../../lib/app/priorities';
import { doneLabel, tasksFor, type EventTasks } from '../../lib/calendar/event-tasks';
import type { MarkerColor } from '../../data/club/family-colors';
import type { Household } from '../../lib/club/profile';
import { EventResponsibilities } from '../calendar/CalendarSources';
import { Avatar } from '../app/ui';

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** What the meeting says about how many priorities, by how many are chosen (one place, tested). */
export function priorityRule(chosen: number): { canAdd: boolean; note: string | null } {
  if (chosen >= MAX_PER_WEEK) return { canAdd: false, note: `That’s ${MAX_PER_WEEK}, the most for one week. Remove one to choose another.` };
  if (chosen >= SHOWN) return { canAdd: true, note: 'Three is usually plenty. A busy week can hold up to five.' };
  return { canAdd: true, note: null };
}

/** The coming week with each event once (a daily school run is one line, "and 4 more days"), in date order. */
export function reviewItems(week: WeekAhead): { day: string; item: WeekItem; more: number }[] {
  const seen = new Map<string, { day: string; item: WeekItem; more: number }>();
  for (const d of week.days) for (const item of d.items) {
    const key = `${item.ref.source}|${item.ref.event_uid}`;
    const first = seen.get(key);
    if (first) first.more++; else seen.set(key, { day: d.label, item, more: 0 });
  }
  return [...seen.values()];
}

/** Look ahead together, and choose what matters. */
export function WeekReview({ week, priorities, current, weekStart, colors, intakeActivities = [] }: {
  week: WeekAhead; priorities: Priorities | null; current: Resolved[]; weekStart: string; colors: Record<string, MarkerColor>; intakeActivities?: string[];
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const items = reviewItems(week);
  const chosen = priorities?.items.filter((p) => p.week_of === weekStart) ?? [];
  const rule = priorityRule(chosen.length);
  const run = async (key: string, f: () => Promise<string | null>) => { setBusy(key); setError(await f()); setBusy(null); };
  const row = ({ day, item, more }: (typeof items)[number]) => {
    const picked = chosen.find((p) => sameRef(p, item.ref));
    return (
      <li key={item.id + item.date} className="flex min-h-[44px] items-center gap-2" data-meeting-week-item={item.title}>
        <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full" style={{ background: colors[item.memberIds[0] ?? item.ownerId ?? '']?.hex ?? '#9aab8f' }} />
        <span className="min-w-0 flex-1"><strong>{day}</strong> · {item.time === 'All day' ? '' : `${item.time} · `}{item.title}
          {item.source ? <span className="text-warm-soft"> · {item.source}</span> : null}
          {more > 0 && <span className="text-warm-soft"> · and {more} more {more === 1 ? 'day' : 'days'}</span>}</span>
        {/* A chosen event can always be un-chosen; a new one only while there's room (no disabled buttons). */}
        {priorities?.available && (picked || rule.canAdd) && (
          <button type="button" aria-pressed={Boolean(picked)} disabled={busy !== null}
            onClick={() => void run(item.id, () => (picked ? priorities.remove(picked.id) : priorities.highlight(item.ref, weekStart)))}
            className={`min-h-[44px] shrink-0 rounded-full border px-3 text-[0.82rem] font-semibold ${picked ? 'border-[var(--of-sage-bar)] bg-[var(--of-sage)] text-warm-ink' : 'border-[var(--of-rule)] bg-white text-warm-soft'}`}
            aria-label={`${picked ? 'Remove from priorities' : 'Highlight'}: ${item.title}`}
            data-highlight={item.title}>{busy === item.id ? '…' : picked ? 'Highlighted' : 'Highlight'}</button>
        )}
      </li>
    );
  };
  // What happens every day stays one tap away, so a routine school run never looks as weighty as a trip. Grouped by
  // whether it repeats this week, never ranked: the family decides what matters.
  const special = items.filter((x) => x.more === 0);
  const usual = items.filter((x) => x.more > 0);
  return (
    <div className="mt-5 space-y-4" data-meeting-what-matters>
      <div>
        <p className="font-serif text-[1.3rem] leading-snug text-warm-ink" data-meeting-what-matters-title>What matters most this week?</p>
        <p className="mt-1 text-[0.95rem] leading-relaxed" data-meeting-week-prompt>Look ahead together. Is there anything we need to prepare for, decide about, or handle as a family?</p>
      </div>
      {priorities?.available && (
        <div className="rounded-[9px] border border-[var(--of-month-accent)]/40 bg-white p-3 sm:p-4" data-meeting-priorities data-chosen={chosen.length}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="of-eyebrow">Our priorities this week</p>
            {chosen.length > 0 && <span className="text-xs text-warm-soft">{chosen.length} chosen</span>}
          </div>
          {current.length ? (
            <ul className="mt-1 text-[0.95rem]" data-meeting-priority-list>
              {current.map((r) => (
                <li key={r.priority.id} className="flex min-h-[44px] items-center gap-2" data-meeting-priority={r.title}>
                  <span className="min-w-0 flex-1"><strong className="font-semibold">{r.title}</strong>{r.date ? <span className="text-warm-soft"> · {dayLabel(r.date)}{r.time ? ` · ${r.time}` : ''}</span> : null}{r.gone ? <span className="text-[#a33]"> · no longer on the calendar</span> : null}</span>
                  <button type="button" className="min-h-[44px] px-2 text-[0.82rem] text-warm-soft underline underline-offset-4" onClick={() => void run(r.priority.id, () => priorities.remove(r.priority.id))} aria-label={`Remove ${r.title}`} data-priority-remove>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[0.9rem] text-warm-soft" data-priorities-empty>Nothing chosen yet. Choose what needs the whole family this week, from the calendar below or in a few words.</p>
          )}
          {rule.note && <p className="mt-1.5 text-[0.85rem] text-warm-soft" data-priority-rule>{rule.note}</p>}
          {rule.canAdd && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run('note', async () => { const err = await priorities.addNote(note, weekStart); if (!err) setNote(''); return err; }); }} data-priority-note-form>
              <label className="sr-only" htmlFor="priority-note">Something that matters this week, in a few words</label>
              <input id="priority-note" value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} placeholder="In a few words: Decide on Sofia’s camp" className="min-h-[44px] min-w-0 flex-1 rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem]" data-priority-note />
              <button type="submit" disabled={!note.trim() || busy !== null} className="of-btn of-btn--soft !min-h-[44px] !px-3 !normal-case !tracking-normal" data-priority-add>Add</button>
            </form>
          )}
          {error && <p role="alert" className="mt-2 text-[0.85rem] text-[#a33]" data-priority-error>{error}</p>}
        </div>
      )}
      {intakeActivities.length > 0 && (
        <details className="border-t border-[var(--of-rule)] pt-2 text-[0.9rem]" data-onboarding-week-cues>
          <summary className="min-h-11 cursor-pointer text-warm-soft">From your family setup: regular activities</summary>
          <p className="mt-1 text-warm-soft">{intakeActivities.join(' · ')}</p>
          <p className="mt-1 text-[0.82rem] text-warm-soft">These are reminders of what you shared, not calendar events or selected priorities.</p>
        </details>
      )}
      {week.count > 0 && (
        <div className="rounded-[9px] border border-[var(--of-rule)] bg-white/70 p-3 sm:p-4" data-meeting-week>
          <p className="of-eyebrow">On the calendar this week</p>
          {special.length > 0
            ? <ul className="mt-2 text-[0.9rem]" data-meeting-week-highlights>{special.slice(0, 6).map(row)}</ul>
            : <p className="mt-1 text-[0.9rem] text-warm-soft">Just the usual week.</p>}
          {special.length > 6 && (
            <details className="mt-2 border-t border-[var(--of-rule)] pt-2" data-meeting-week-all>
              <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-semibold">More this week ({special.length - 6})</summary>
              <ul className="text-[0.88rem]">{special.slice(6).map(row)}</ul>
            </details>
          )}
          {usual.length > 0 && (
            <details className="mt-2 border-t border-[var(--of-rule)] pt-2" data-meeting-week-usual>
              <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-semibold">Our usual week ({usual.length}: {usual.slice(0, 2).map((x) => x.item.title).join(', ')}{usual.length > 2 ? '…' : ''})</summary>
              <ul className="text-[0.88rem]">{usual.map(row)}</ul>
            </details>
          )}
        </div>
      )}
      {week.count === 0 && (
        <p className="text-[0.9rem] text-warm-soft" data-meeting-week-empty>Nothing on the family calendar this week. Talk it through, and add what matters in a few words. If it helps to look ahead together next time, <a href="/app/family-calendar" className="underline underline-offset-4">put a few plans on the calendar</a>.</p>
      )}
    </div>
  );
}

/** Everyone's Part: for each highlighted event, who will do what to get ready. Optional; nothing is required. */
export function GettingReady({ current, external, own, tasks, household, colors }: {
  current: Resolved[]; external: CalendarEvent[]; own: CalendarEvent[]; tasks: EventTasks; household: Household | null; colors: Record<string, MarkerColor>;
}) {
  const events = current.filter((r) => r.priority.kind === 'event' && !r.gone);
  if (!events.length) return null;
  const people = (household?.members ?? []).filter((m) => !m.archived);
  return (
    <div className="mb-5" data-getting-ready>
      <p className="of-eyebrow">Getting ready for our priorities</p>
      <p className="mt-1 text-[0.9rem] text-warm-soft" data-getting-ready-prompt>Ask who will take each part. Let them say it, then write it down.</p>
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

/**
 * "We have a plan.": what THIS meeting decided, not the household's whole list. This week's priorities (three
 * prominently, a busy week's fourth and fifth on one line) with their getting-ready parts under them; then the
 * responsibilities agreed in this meeting; then one compact link to everyone's standing parts. Nothing invented,
 * nothing repeated, nothing gamified. The printout adds everyone's standing parts in a compact list (one page).
 */
export function PlanSummary({ current, agreed, newIds, external, tasks, household, colors, onAgain }: {
  current: Resolved[]; agreed: PersonAgreements[]; newIds: Set<string> | null; external: CalendarEvent[]; tasks: EventTasks; household: Household | null; colors: Record<string, MarkerColor>; onAgain: () => void;
}) {
  const people = (household?.members ?? []).filter((m) => !m.archived);
  const name = (id: string | null) => people.find((m) => m.id === id)?.firstName;
  const prepFor = (r: Resolved) => {
    const ext = r.priority.source === 'imported' ? external.find((e) => e.external?.uid === r.priority.event_uid && e.external?.instance_key === r.priority.instance_key) : undefined;
    return ext && tasks.available ? tasksFor(tasks.tasks, ext) : [];
  };
  // Children first, as on Today: their parts are the ones the family is handing over.
  const kid = (id: string) => people.find((m) => m.id === id)?.kind === 'child';
  const byKids = <T extends { memberId: string }>(xs: T[]) => [...xs].sort((a, b) => Number(kid(b.memberId)) - Number(kid(a.memberId)));
  const fresh = byKids(newIds && newIds.size ? agreed.map((p) => ({ ...p, parts: p.parts.filter((x) => newIds.has(x.id)) })).filter((p) => p.parts.length) : []);
  const total = new Set(agreed.flatMap((p) => p.parts.map((x) => x.id))).size;
  const top = current.slice(0, SHOWN);
  const also = current.slice(SHOWN);
  const when = (r: Resolved) => (r.date ? ` · ${dayLabel(r.date)}${r.time ? ` · ${r.time}` : ''}` : '');
  return (
    <section className="space-y-5" aria-labelledby="plan-h" data-plan-summary>
      <header>
        <p className="of-eyebrow">Our Family Meeting</p>
        <h1 id="plan-h" className="of-page-title mt-2">We have a plan.</h1>
      </header>
      {current.length > 0 && (
        <div className="of-tile" data-plan-priorities>
          <p className="of-eyebrow">This week’s priorities</p>
          <ol className="mt-1">
            {top.map((r, i) => {
              const prep = prepFor(r);
              return (
                <li key={r.priority.id} className="border-b border-[var(--of-rule)] py-2.5 last:border-b-0" data-plan-priority={r.title}>
                  <p className="text-[1.05rem]"><span className="mr-2 font-serif text-[var(--of-month-accent)]">{i + 1}</span><strong className="font-semibold">{r.title}</strong><span className="text-warm-soft">{when(r)}</span></p>
                  {prep.length > 0 && (
                    <ul className="mt-1.5 space-y-1 pl-6" data-plan-prep>
                      {prep.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-[0.92rem]">
                          <Avatar name={name(t.member_id) ?? '·'} color={t.member_id ? colors[t.member_id] : undefined} size="sm" />
                          <span><strong className="font-semibold">{name(t.member_id) ?? 'Anyone'}</strong> · {t.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
          {also.length > 0 && <p className="mt-1 text-[0.88rem] text-warm-soft" data-plan-also>Also this week: {also.map((r) => r.title).join(', ')}</p>}
        </div>
      )}
      <div className="of-tile" data-plan-parts data-plan-parts-kind={fresh.length ? 'new' : 'none'}>
        <p className="of-eyebrow">{fresh.length ? 'What we agreed today' : 'Everyone’s parts'}</p>
        {fresh.length ? (
          <ul className="of-rows mt-1">
            {fresh.map((p) => (
              <li key={p.memberId} className="of-row !items-start !gap-3" data-plan-person={p.name}>
                <Avatar name={p.name} color={colors[p.memberId]} size="sm" />
                <span className="min-w-0"><span className="of-row-title block">{p.name}</span>{p.parts.map((x) => <span key={x.id} className="block text-[0.92rem]">{x.text}{x.when ? <span className="text-warm-soft"> · {x.when}</span> : null}</span>)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[0.95rem]" data-plan-no-new>{total ? 'Nothing new this week. Everyone keeps the parts they already have.' : current.length ? 'No standing parts yet. When you’re ready, each person can take one.' : 'You talked it through together. That counts. Next time, pick one priority and one part each.'}</p>
        )}
        {total > 0 && <a href="/app/family/responsibilities" className="of-tile-action mt-3 print:hidden" data-plan-all-parts>All of everyone’s parts ({total})</a>}
        {/* On paper only: everyone's standing parts, compact, so the fridge copy is the whole plan on one page. */}
        {total > 0 && (
          <div className="hidden print:block" data-plan-print-parts>
            <p className="of-eyebrow mt-4">Everyone’s parts</p>
            <ul className="mt-1 text-[0.85rem] leading-snug">
              {byKids(agreed).map((p) => <li key={p.memberId}><strong>{p.name}</strong>: {p.parts.map((x) => x.text).join('; ')}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <a href="/app" className="of-btn" data-plan-today>See it on Today</a>
        <button type="button" className="of-btn of-btn--soft" onClick={() => window.print()} data-plan-print>Print our plan</button>
        <button type="button" className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4" onClick={onAgain} data-plan-back>Back to the meeting</button>
      </div>
    </section>
  );
}

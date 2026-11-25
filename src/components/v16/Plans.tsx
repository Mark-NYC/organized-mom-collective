/**
 * V16 Plans ("Our week"): every activity stays visible, preparation appears on the day it needs to happen, and the
 * real calendar controls stay: Week / Month / Agenda, Add event, connected calendars shared or private.
 * Imported events are read-only (change them at their source); a private calendar never reaches the shared plan,
 * and preparation for an event that left the shared plan is hidden or flagged, never shown as if nothing changed.
 *
 * Preview honesty: the calendars here are sample data. No Google account is connected from this page; the real
 * connection, OAuth and sync live in /app/family-calendar (src/components/calendar/*).
 */
import { useState } from 'react';
import { addDays, occurrences, repeatLabel, timeLabel, weekday, type CalendarEvent, type Occurrence } from '../../lib/calendar/recurrence';
import { Icon } from '../app/ui';
import {
  DAY_NAMES, eventsFor, isReadOnly, isShared, linkOf, missingReason, partDate, weekOccurrences, type Part,
} from '../../lib/v16/model';
import { demoEvents } from '../../lib/v16/demo';
import { act } from './Parts';
import { Check, Person, StatusPill, fmtDate, type Ctx } from './shared';

type View = 'week' | 'month' | 'agenda';

function EventRow({ ctx, o }: { ctx: Ctx; o: Occurrence }) {
  const [open, setOpen] = useState(false);
  const e = o.event;
  const own = ctx.s.extraEvents.some((x) => x.id === e.id);
  return (
    <div data-plan-event={e.title}>
      <button type="button" className="v16-row !items-start" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="mt-0.5 text-[color:var(--of-sage-ink)]"><Icon name="calendar" size={18} /></span>
        <span className="v16-row-main">
          <span className="v16-row-title block">{e.title}</span>
          <span className="v16-meta flex flex-wrap items-center gap-2">{timeLabel(e)}
            {e.member_ids.filter((id) => ctx.names[id]).map((id) => <span key={id} className="inline-flex items-center gap-1"><span className="of-dot" style={{ background: ctx.colors[id]?.hex }} />{ctx.names[id]}</span>)}
            {!isShared(e) && <span className="v16-pill v16-pill--private">Private · only you</span>}
            {isReadOnly(e) && isShared(e) && <span className="v16-pill v16-pill--ro">{e.external!.name}</span>}
            {e.id === 'e-soccer-moved' && <span className="v16-pill v16-pill--pending">Moved from Thursday</span>}
          </span>
        </span>
      </button>
      {open && (
        <div className="v16-meta pb-3 pl-8" data-event-detail>
          {isReadOnly(e)
            ? <p>From {e.external!.name}. Read-only here: change the date or title in that calendar, and it updates here. {repeatLabel(e) ? `${repeatLabel(e)}.` : ''}</p>
            : <p>Your family’s own event{repeatLabel(e) ? ` · ${repeatLabel(e)}` : ''}.</p>}
          {own && <button type="button" className="v16-link" onClick={() => ctx.set((s) => ({ ...s, extraEvents: s.extraEvents.filter((x) => x.id !== e.id) }))}>Remove event</button>}
        </div>
      )}
    </div>
  );
}

function PrepLine({ ctx, p }: { ctx: Ctx; p: Part }) {
  const [why, setWhy] = useState(false);
  const agreed = p.status === 'agreed';
  const forWhat = p.eventLink ? eventsFor(ctx.s, ctx.monday).find((e) => linkOf(e) === p.eventLink) : null;
  return (
    <div className="v16-row !items-start" data-plan-prep={p.id}>
      <Person ctx={ctx} id={p.ownerId} />
      <span className="v16-row-main">
        <span className="block text-[0.95rem]">{p.ownerId ? ctx.names[p.ownerId] : 'Needs an owner'} · {p.title}</span>
        <span className="v16-meta flex flex-wrap items-center gap-2">
          {p.eventLink ? `For ${forWhat?.title.toLowerCase() ?? 'an activity'}` : p.cleaningTask ? 'Cleaning' : `Every ${DAY_NAMES[p.weekday ?? 0]}`}
          <StatusPill part={p} />
          {p.why && <button type="button" className="underline underline-offset-2" aria-expanded={why} onClick={() => setWhy(!why)}>Why this?</button>}
        </span>
        {why && <span className="v16-meta mt-1 block">{p.why}</span>}
      </span>
      {agreed && p.eventLink && <Check checked={Boolean(p.done)} label={`${p.title}, done`} onChange={() => act(ctx, { type: 'toggle-done', id: p.id })} />}
    </div>
  );
}

function AddEvent({ ctx, onDone }: { ctx: Ctx; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(ctx.today >= ctx.monday && ctx.today <= addDays(ctx.monday, 6) ? ctx.today : ctx.monday);
  const [time, setTime] = useState('');
  const [who, setWho] = useState('');
  const save = () => {
    if (!title.trim()) return;
    const e: CalendarEvent = { id: `e-added-${Date.now()}`, title: title.trim().slice(0, 80), starts_on: day, start_time: time || null, timezone: 'America/Chicago',
      member_ids: who ? [who] : [], source: 'manual', revision: 0 };
    ctx.set((s) => ({ ...s, extraEvents: [...s.extraEvents, e] }));
    onDone();
  };
  return (
    <form className="v16-editor mt-3" onSubmit={(e) => { e.preventDefault(); save(); }} data-add-event-form>
      <label className="v16-field">What
        <input className="v16-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Swim lesson" required data-new-title /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="v16-field">Day
          <select className="v16-input" value={day} onChange={(e) => setDay(e.target.value)} data-new-day>
            {Array.from({ length: 7 }, (_, i) => addDays(ctx.monday, i)).map((d) => <option key={d} value={d}>{fmtDate(d, { weekday: 'long' })}</option>)}
          </select></label>
        <label className="v16-field">Time
          <input className="v16-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} data-new-time /></label>
      </div>
      <label className="v16-field">Who’s going
        <select className="v16-input" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone</option>{ctx.people.map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}
        </select></label>
      <div className="grid grid-cols-2 gap-2"><button type="button" className="of-btn of-btn--soft" onClick={onDone}>Cancel</button><button type="submit" className="of-btn" data-new-save>Add</button></div>
    </form>
  );
}

function Calendars({ ctx }: { ctx: Ctx }) {
  const feeds = new Map<string, CalendarEvent['external']>();
  for (const e of demoEvents(ctx.monday, ctx.s.scenario, ctx.s.adults)) if (e.external) feeds.set(e.external.feed_id, e.external);
  const mine = [...feeds.values()].filter((f) => f!.mine);
  const others = [...feeds.values()].filter((f) => !f!.mine && f!.visibility === 'private').length;
  return (
    <details className="v16-details mt-6 border-t border-[color:var(--of-rule)]" data-calendars>
      <summary>Connected calendars</summary>
      <ul className="v16-rows">
        {mine.map((f) => {
          const v = ctx.s.feedVisibility[f!.feed_id] ?? f!.visibility;
          return (
            <li key={f!.feed_id} className="v16-row">
              <span className="v16-row-main"><span className="v16-row-title block">{f!.name}</span><span className="v16-meta">{f!.feed_id === 'feed-lincoln' ? 'School calendar (iCal)' : 'Google Calendar'} · read-only · added by Ana</span></span>
              <div className="of-seg" role="group" aria-label={`${f!.name}: who sees it`}>
                <button type="button" aria-pressed={v === 'private'} onClick={() => ctx.set((s) => ({ ...s, feedVisibility: { ...s.feedVisibility, [f!.feed_id]: 'private' } }))} data-feed-private={f!.feed_id}>Private</button>
                <button type="button" aria-pressed={v === 'household'} onClick={() => ctx.set((s) => ({ ...s, feedVisibility: { ...s.feedVisibility, [f!.feed_id]: 'household' } }))} data-feed-shared={f!.feed_id}>Shared</button>
              </div>
            </li>
          );
        })}
      </ul>
      {others > 0 && <p className="v16-meta mt-2">Luis has {others} private calendar{others === 1 ? '' : 's'}. Nothing from {others === 1 ? 'it' : 'them'} is shown here, and Organized Family never shares it for him.</p>}
      <p className="v16-meta mt-2">New calendars start private. An adult chooses which to share with the household. <strong>Preview:</strong> these are sample calendars; connecting Google happens in the current app’s Plans.</p>
    </details>
  );
}

export default function Plans({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<View>('week');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState(ctx.today);
  const occ = weekOccurrences(ctx.s, ctx.monday);
  const visibleParts = ctx.s.parts.filter((p) => p.status !== 'skipped' && p.origin !== 'idea');
  const hidden = visibleParts.filter((p) => p.eventLink && !partDate(ctx.s, ctx.monday, p));
  const days = Array.from({ length: 7 }, (_, i) => addDays(ctx.monday, i));
  return (
    <section data-screen="plans">
      <div className="flex items-center justify-between gap-3 pt-2">
        <h1 className="v16-h1">Our week</h1>
        <button type="button" className="v16-link" onClick={() => ctx.go('today')} data-plans-done>Done</button>
      </div>
      <p className="v16-lede">All activities stay visible. Preparation appears on the day it needs to happen.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="of-seg flex-1" role="group" aria-label="Calendar view">
          {(['week', 'month', 'agenda'] as View[]).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} data-view={v}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
        <button type="button" className="of-btn !min-h-[46px]" onClick={() => setAdding(true)} data-add-event>Add event</button>
      </div>
      {adding && <AddEvent ctx={ctx} onDone={() => setAdding(false)} />}

      {hidden.length > 0 && (
        <div className="v16-card v16-card--quiet" role="status" data-hidden-prep>
          {hidden.map((p) => {
            const why = missingReason(ctx.s, ctx.monday, p.eventLink!);
            return <p key={p.id} className="text-[0.9rem]">{why === 'cancelled' ? `Soccer practice was cancelled this week, so “${p.title}” isn’t needed. The agreement stays for next week.` : why === 'private' ? `One preparation is hidden because its calendar is now private.` : `“${p.title}” has no activity this week.`}</p>;
          })}
        </div>
      )}

      {view === 'week' && (
        <div className="mt-3" data-week>
          {days.map((d) => {
            const today = occ.filter((o) => o.date === d);
            const prep = visibleParts.filter((p) => partDate(ctx.s, ctx.monday, p) === d && (p.eventLink || p.weekday !== undefined));
            return (
              <div key={d} className="border-b border-[color:var(--of-rule)] py-3" data-day={DAY_NAMES[weekday(d)]}>
                <p className="v16-eyebrow">{fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}{d === ctx.today ? ' · Today' : ''}</p>
                {today.map((o) => <EventRow key={`${o.event.id}-${o.date}`} ctx={ctx} o={o} />)}
                {prep.map((p) => <PrepLine key={p.id} ctx={ctx} p={p} />)}
              </div>
            );
          })}
        </div>
      )}

      {view === 'month' && <Month ctx={ctx} picked={picked} setPicked={setPicked} />}

      {view === 'agenda' && (
        <ul className="mt-3" data-agenda>
          {occurrences(eventsFor(ctx.s, ctx.monday), ctx.today, addDays(ctx.today, 13)).filter((o) => !o.continued).map((o) => (
            <li key={`${o.event.id}-${o.date}`} className="flex gap-3 border-b border-[color:var(--of-rule)] py-1">
              <span className="v16-meta w-24 shrink-0 pt-4">{fmtDate(o.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <div className="min-w-0 flex-1"><EventRow ctx={ctx} o={o} /></div>
            </li>
          ))}
        </ul>
      )}
      <Calendars ctx={ctx} />
    </section>
  );
}

function Month({ ctx, picked, setPicked }: { ctx: Ctx; picked: string; setPicked: (d: string) => void }) {
  const first = `${ctx.today.slice(0, 7)}-01`;
  const start = addDays(first, -((weekday(first) + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const all = occurrences(eventsFor(ctx.s, ctx.monday), start, cells[41]);
  const dayOcc = all.filter((o) => o.date === picked);
  return (
    <div data-month>
      <p className="v16-h3 mt-4">{fmtDate(first, { month: 'long', year: 'numeric' })}</p>
      <div className="v16-month" role="grid" aria-label="Month">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="v16-mh">{d}</span>)}
        {cells.map((d) => {
          const people = [...new Set(all.filter((o) => o.date === d).flatMap((o) => o.event.member_ids))].filter((id) => ctx.names[id]);
          return (
            <button key={d} type="button" onClick={() => setPicked(d)} data-today={d === ctx.today ? '' : undefined} aria-pressed={d === picked}
              className={`text-left ${d.slice(0, 7) !== first.slice(0, 7) ? 'opacity-40' : ''} ${d === picked ? '!bg-[var(--of-month-wash)]' : ''}`} aria-label={`${fmtDate(d)}, ${all.filter((o) => o.date === d).length} events`}>
              <span className="block font-semibold">{+d.slice(8)}</span>
              <span className="mt-1 flex flex-wrap gap-0.5">{people.slice(0, 5).map((id) => <span key={id} className="of-dot !h-[7px] !w-[7px]" style={{ background: ctx.colors[id]?.hex }} />)}</span>
            </button>
          );
        })}
      </div>
      <p className="v16-eyebrow mt-4">{fmtDate(picked)}</p>
      {dayOcc.length ? dayOcc.map((o) => <EventRow key={`${o.event.id}-${o.date}`} ctx={ctx} o={o} />) : <p className="v16-meta py-2">Nothing planned.</p>}
      <p className="v16-meta mt-2">Dots are each person’s own color.</p>
    </div>
  );
}

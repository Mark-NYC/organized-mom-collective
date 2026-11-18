/**
 * /app/family-calendar: the family's shared week (docs/ios/FAMILY_CALENDAR.md). Free; no Club membership.
 *
 * Week first (the shape of the 11×17 wall calendar), with Month and Agenda as other views of the same plans: each plan in
 * the people's colors from the one family profile, who's responsible ("Sam drives"), and repeats. Add/edit in a bottom
 * sheet. The view choice is remembered on the device only. Works offline and before
 * signing in (saved on this phone); signed in, it's the household's calendar, shared by both grown-ups.
 */
import { thisDevice } from '../../lib/native/platform';
import { useMemo, useState } from 'react';
import { useCalendar, importTypicalWeek, isDemo, type SyncStatus } from '../../lib/calendar/client';
import { addDays, localToday, occurrences, repeatLabel, timeLabel, weekStart, type CalendarEvent, type Freq, type Occurrence } from '../../lib/calendar/recurrence';
import { newEventId } from '../../lib/calendar/store';
import type { Household } from '../../lib/club/profile';
import type { MarkerColor } from '../../data/club/family-colors';
import { routes } from '../../routes';
import { agreementsByPerson, changeOf, type Change } from '../../lib/family-meeting-support';
import { useFamilyProfile } from '../../lib/family-meeting-client';
import AgreedParts from '../family/AgreedParts';
import { tint } from '../app/ui';

// In Our Week (the iPhone app) the calendar is free: its sign-in and family setup are Our Week's own, never the Club's.
// The same on the website and in the app: the free app's sign-in and family setup, never the Club's onboarding.
const SIGN_IN = '/app/sign-in?next=/app/family-calendar';
const FAMILY_SETUP = '/app/family/setup';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };

type View = 'week' | 'month' | 'agenda';
const VIEW_KEY = 'omc:calendar-view:v1';
const readView = (): View => { try { const v = localStorage.getItem(VIEW_KEY); return v === 'month' || v === 'agenda' ? v : 'week'; } catch { return 'week'; } };
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const addMonths = (d: string, n: number) => { const x = new Date(`${d.slice(0, 7)}-01T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };

export default function FamilyCalendar() {
  const cal = useCalendar();
  const today = localToday();
  const startsOn = ((cal.household?.preferences as { week_starts?: string } | undefined)?.week_starts === 'monday' ? 1 : 0) as 0 | 1;
  // Week is the approved layout (the wall calendar's shape); Month and Agenda show the same plans another way.
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* this visit only */ } };
  const [week, setWeek] = useState(() => weekStart(today, startsOn));
  const [month, setMonth] = useState(() => monthStart(today));
  const [picked, setPicked] = useState(today);
  const [editing, setEditing] = useState<{ event: CalendarEvent; date: string; isNew: boolean } | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const events = useMemo(() => Object.values(cal.state.events), [cal.state.events]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const list = occurrences(events, days[0], days[6]);
  const people = (cal.household?.members ?? []).filter((m) => !m.archived);
  // The Family Meeting itself is the Club's (one a month, met weekly); the calendar only links to it for a household.
  const monthName = MONTHS[Number(today.slice(5, 7)) - 1];
  const meetingHref = cal.household && !isDemo() ? `/app/club/${monthName}?view=meeting` : null;
  const now = new Date();
  // What the family agreed in its Family Meeting, beside the week it plays out in. Agreements only.
  const profile = useFamilyProfile(cal.state.scope !== 'local' ? cal.state.scope : null);
  const agreed = agreementsByPerson(cal.household, profile);

  const blank = (date: string): CalendarEvent => ({
    id: newEventId(), title: '', starts_on: date, start_time: null, end_time: null, timezone: zone(),
    recurrence: null, skip_dates: [], member_ids: [], owner_member_id: null, revision: 0,
  });
  const add = (date: string) => setEditing({ event: blank(date), date, isNew: true });
  const open = (o: Occurrence) => setEditing({ event: cal.state.events[o.event.id], date: o.date, isNew: false });
  const row = (o: Occurrence) => <EventRow key={`${o.event.id}-${o.date}`} o={o} change={changeOf(o.event, now)} colors={cal.colors} household={cal.household} onOpen={() => open(o)} />;

  const title = view === 'week'
    ? `${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days[6], { month: days[0].slice(5, 7) === days[6].slice(5, 7) ? undefined : 'short', day: 'numeric' })}`
    : view === 'month' ? fmt(month, { month: 'long', year: 'numeric' }) : 'Coming up';
  const step = (n: number) => (view === 'week' ? setWeek(addDays(week, 7 * n)) : setMonth(addMonths(month, n)));
  const unit = view === 'week' ? 'week' : 'month';

  return (
    <div className="family-brand of-page max-w-4xl" data-family-calendar data-calendar-view={view}>
      <header>
        <p className="of-eyebrow">Family calendar</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <h1 className="of-page-title !text-[clamp(1.9rem,6vw,2.5rem)]" data-week-title={view === 'week' ? '' : undefined}>{title}</h1>
          <button type="button" className="of-btn max-sm:!hidden" onClick={() => add(view === 'month' ? picked : today)} data-add-event>Add event</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="of-seg" role="group" aria-label="Calendar view">
            {(['week', 'month', 'agenda'] as View[]).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} data-view={v}>{v[0].toUpperCase() + v.slice(1)}</button>)}
          </div>
          {view !== 'agenda' && (
            <div className="flex items-center gap-1" role="group" aria-label={`Change ${unit}`}>
              <button type="button" className="cal-nav" aria-label={`Previous ${unit}`} onClick={() => step(-1)}>‹</button>
              <button type="button" className="cal-today" onClick={() => { setWeek(weekStart(today, startsOn)); setMonth(monthStart(today)); setPicked(today); }}>{view === 'week' ? 'This week' : 'Today'}</button>
              <button type="button" className="cal-nav" aria-label={`Next ${unit}`} onClick={() => step(1)}>›</button>
            </div>
          )}
        </div>
        {meetingHref && <a href={meetingHref} className="of-tile-action mt-1" data-open-meeting>This month’s Family Meeting <span aria-hidden="true">›</span></a>}
      </header>

      {isDemo() && (
        <div className="family-note mt-4" data-calendar-demo><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm">A made-up family, to show how the calendar looks. Nothing here is shared or synced. <a href={routes.familyCalendar} className="underline">Leave the demo</a>.</p></div>
      )}
      {!isDemo() && <StatusLine status={cal.status} signedIn={cal.signedIn} unsaved={cal.unsaved} waiting={cal.state.outbox.length} />}
      {cal.state.conflicts.length > 0 && (() => {
        const names = (kind: 'changed' | 'refused') => cal.state.conflicts.filter((c) => (c.kind ?? 'changed') === kind).map((c) => `“${c.title}”`);
        const changed = names('changed');
        const refused = names('refused');
        return (
          <div role="alert" className="family-note mt-4" data-calendar-conflict>
            {changed.length > 0 && (<>
              <strong className="text-sm">Changed on another phone</strong>
              <p className="mt-1 text-sm">{changed.join(', ')} {changed.length > 1 ? 'were' : 'was'} changed by the other grown-up first, so we kept their version. Check it and make your change again if you still need it.</p>
            </>)}
            {refused.length > 0 && (<>
              <strong className={`text-sm ${changed.length ? 'mt-3 block' : ''}`}>Couldn’t be saved</strong>
              <p className="mt-1 text-sm" data-calendar-refused>{refused.join(', ')} couldn’t be saved to your family’s calendar, so {refused.length > 1 ? 'those changes weren’t' : 'that change wasn’t'} kept. Everything else is saved. Add it again if you still need it.</p>
            </>)}
            <button type="button" className="family-link mt-1" onClick={cal.dismissConflicts}>OK</button>
          </div>
        );
      })()}

      {people.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Family colors" data-calendar-legend>
          {people.map((m) => <li key={m.id} className="of-chip"><span aria-hidden="true" className="of-avatar of-avatar--sm !size-6 !text-[0.72rem]" style={{ background: tint(cal.colors[m.id]?.hex ?? '#8fa686'), color: cal.colors[m.id]?.hex }}>{m.firstName.charAt(0)}</span>{m.firstName}</li>)}
        </ul>
      )}

      {agreed.length > 0 && (
        <details className="of-tile mt-5 !py-4" data-calendar-agreements>
          <summary className="cursor-pointer list-none text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--of-sage-ink)]">Everyone’s part · agreed in our Family Meeting ▾</summary>
          <AgreedParts people={agreed} colors={cal.colors} compact />
        </details>
      )}

      {view === 'week' && (
        <ol className="mt-5 space-y-2.5" data-calendar-week>
          {days.map((d) => {
            const items = list.filter((o) => o.date === d);
            const isToday = d === today;
            return (
              <li key={d} className={`of-tile !p-0 ${isToday ? '!border-[var(--of-month-accent)]/40 ring-1 ring-[var(--of-month)]' : ''}`} data-calendar-day={d}>
                <div className="flex items-center justify-between gap-3 py-2 pr-2 pl-4">
                  <h2 className="flex items-center gap-3">
                    <span className={`grid size-11 place-items-center rounded-[9px] font-serif text-[1.3rem] leading-none ${isToday ? 'bg-[var(--of-month-wash)]' : ''}`}>{+d.slice(8, 10)}</span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-warm-soft">{DAY_NAMES[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
                      {isToday ? <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--of-month-accent)]">Today</span> : <span className="text-[0.75rem] text-warm-soft">{items.length ? `${items.length} ${items.length === 1 ? 'plan' : 'plans'}` : 'Nothing planned'}</span>}
                    </span>
                  </h2>
                  <button type="button" className="cal-add" aria-label={`Add to ${fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}`} onClick={() => add(d)}>+</button>
                </div>
                {items.length > 0 && <ul className="space-y-2 px-3 pb-3">{items.map(row)}</ul>}
              </li>
            );
          })}
        </ol>
      )}

      {view === 'month' && <MonthGrid month={month} today={today} picked={picked} startsOn={startsOn} events={events} colors={cal.colors} onPick={setPicked} onAdd={add} row={row} />}

      {view === 'agenda' && <Agenda today={today} events={events} row={row} onAdd={() => add(today)} />}

      {events.length === 0 && (
        <div className="of-tile of-tile--month mt-6" data-calendar-empty>
          <h2 className="of-tile-title !mt-0">Put this week where everyone can see it</h2>
          <p className="of-tile-sub">Add practices, appointments and early pickups. Give each one the people it’s for and who’s handling it, so the plan doesn’t live only in your head.</p>
          {cal.signedIn && cal.status !== 'no-household' && (
            <button type="button" className="of-btn of-btn--soft mt-4" data-import-week onClick={async () => {
              try {
                const n = await importTypicalWeek(week, zone());
                setImportMsg(n ? `Added ${n} weekly ${n === 1 ? 'activity' : 'activities'} from your family profile.` : 'No weekly activities with days in your family profile yet.');
                await cal.syncNow();
              } catch { setImportMsg('Couldn’t add them right now. Check your connection and try again.'); }
            }}>Add our usual week from the family profile</button>
          )}
          {importMsg && <p className="mt-2 text-sm text-warm-soft" role="status">{importMsg}</p>}
        </div>
      )}

      {/* Phones: one clear way to add, above the tab bar. */}
      <button type="button" className="of-btn of-btn--block mt-6 sm:!hidden" onClick={() => add(view === 'month' ? picked : today)} data-add-event>Add event</button>

      {editing && (
        <EventSheet
          key={editing.event.id}
          initial={editing.event}
          date={editing.date}
          isNew={editing.isNew}
          people={people}
          colors={cal.colors}
          onClose={() => setEditing(null)}
          onSave={(e) => { cal.save(e); setEditing(null); }}
          onDelete={(scope) => {
            if (scope === 'one') cal.skip(editing.event.id, editing.date);
            else cal.remove(editing.event.id);
            setEditing(null);
          }}
        />
      )}
      <style>{`
        .cal-nav{display:inline-flex;min-width:44px;min-height:44px;align-items:center;justify-content:center;border:1px solid var(--of-rule);border-radius:9px;background:var(--of-surface);font-size:1.3rem;color:var(--of-ink)}
        .cal-today{display:inline-flex;min-height:44px;align-items:center;justify-content:center;border:1px solid var(--of-rule);border-radius:9px;background:var(--of-surface);padding:0 .9rem;font-size:.68rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--of-ink)}
        .cal-add{display:inline-flex;width:44px;height:44px;flex-shrink:0;align-items:center;justify-content:center;border-radius:999px;border:1px solid var(--of-rule);background:var(--of-surface);font-size:1.4rem;line-height:1;color:var(--of-ink)}
        .cal-add:hover,.cal-nav:hover,.cal-today:hover{background:#f6f2ec}
      `}</style>
    </div>
  );
}

/** Month view: the month at a glance, each day's plans as dots in each person's color; the picked day's plans below. */
function MonthGrid({ month, today, picked, startsOn, events, colors, onPick, onAdd, row }: {
  month: string; today: string; picked: string; startsOn: 0 | 1; events: CalendarEvent[]; colors: Record<string, MarkerColor>;
  onPick: (d: string) => void; onAdd: (d: string) => void; row: (o: Occurrence) => React.ReactNode;
}) {
  const first = weekStart(month, startsOn);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const weeks = cells.slice(35).every((d) => d.slice(0, 7) !== month.slice(0, 7)) ? 5 : 6;
  const shown = cells.slice(0, weeks * 7);
  const all = occurrences(events, shown[0], shown[shown.length - 1]);
  const on = (d: string) => all.filter((o) => o.date === d);
  const pickedItems = on(picked);
  const heads = Array.from({ length: 7 }, (_, i) => DAY_NAMES[(i + startsOn) % 7]);
  return (
    <div className="mt-5" data-calendar-month>
      <div className="of-tile !p-2 sm:!p-3">
        <div className="grid grid-cols-7 text-center" aria-hidden="true">
          {heads.map((h) => <span key={h} className="py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-warm-soft">{h}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={fmt(month, { month: 'long', year: 'numeric' })}>
          {shown.map((d) => {
            const items = on(d);
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const dots = [...new Set(items.map((o) => o.event.member_ids[0] ?? o.event.owner_member_id ?? ''))].slice(0, 4);
            return (
              <button key={d} type="button" aria-pressed={d === picked} onClick={() => onPick(d)} data-month-day={d}
                aria-label={`${fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}${items.length ? `, ${items.length} ${items.length === 1 ? 'plan' : 'plans'}` : ''}`}
                className={`flex min-h-[3.4rem] flex-col items-center justify-start gap-1 rounded-[8px] pt-1.5 sm:min-h-[4.6rem] ${d === picked ? 'bg-[var(--of-month-wash)] ring-1 ring-[var(--of-month)]' : 'hover:bg-[#f6f2ec]'} ${inMonth ? '' : 'opacity-40'}`}>
                <span className={`grid size-7 place-items-center rounded-full text-[0.9rem] tabular-nums ${d === today ? 'bg-warm-ink font-semibold text-white' : ''}`}>{+d.slice(8, 10)}</span>
                <span className="flex gap-[3px]" aria-hidden="true">{dots.map((id) => <span key={id || 'x'} className="of-dot !size-[7px]" style={{ background: colors[id]?.hex ?? '#8fa686' }} />)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <section className="mt-4" aria-label={fmt(picked, { weekday: 'long', month: 'long', day: 'numeric' })} data-month-picked={picked}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-[1.35rem]">{fmt(picked, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          <button type="button" className="cal-add" aria-label={`Add to ${fmt(picked, { weekday: 'long', month: 'long', day: 'numeric' })}`} onClick={() => onAdd(picked)}>+</button>
        </div>
        {pickedItems.length ? <ul className="mt-2 space-y-2">{pickedItems.map(row)}</ul> : <p className="mt-1 text-sm text-warm-soft">Nothing planned.</p>}
      </section>
    </div>
  );
}

/** Agenda: the next four weeks, only the days with plans. */
function Agenda({ today, events, row, onAdd }: { today: string; events: CalendarEvent[]; row: (o: Occurrence) => React.ReactNode; onAdd: () => void }) {
  const to = addDays(today, 27);
  const all = occurrences(events, today, to);
  const dates = [...new Set(all.map((o) => o.date))].sort();
  return (
    <div className="mt-5 space-y-5" data-calendar-agenda>
      {dates.length === 0 && (
        <div className="of-tile"><p className="text-sm text-warm-soft">Nothing on the family calendar in the next four weeks.</p><button type="button" className="of-btn of-btn--soft mt-4" onClick={onAdd}>Add a plan</button></div>
      )}
      {dates.map((d) => (
        <section key={d} aria-label={fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}>
          <h2 className="mb-2 flex items-baseline gap-2">
            <span className="font-serif text-[1.2rem]">{fmt(d, { weekday: 'long' })}</span>
            <span className="text-[0.8rem] text-warm-soft">{fmt(d, { month: 'short', day: 'numeric' })}{d === today ? ' · Today' : ''}</span>
          </h2>
          <ul className="space-y-2">{all.filter((o) => o.date === d).map(row)}</ul>
        </section>
      ))}
    </div>
  );
}

function StatusLine({ status, signedIn, unsaved, waiting }: { status: SyncStatus; signedIn: boolean; unsaved: boolean; waiting: number }) {
  let text: string;
  if (unsaved) text = 'This browser isn’t saving: changes last until you leave.';
  else if (!signedIn) text = `Saved on ${thisDevice()}. Sign in to share it with the other grown-up.`;
  else if (status === 'no-household') text = `Saved on ${thisDevice()}. Set up your family to share it and add who’s going.`;
  else if (status === 'offline') text = waiting ? `No connection: ${waiting} ${waiting === 1 ? 'change' : 'changes'} saved here, will sync when you’re back online.` : `No connection. Showing what’s saved on ${thisDevice()}.`;
  else if (status === 'syncing') text = 'Syncing…';
  else text = 'Shared with your family · up to date';
  const link = !signedIn ? SIGN_IN : status === 'no-household' ? FAMILY_SETUP : null;
  return (
    <p className="mt-3 text-[0.8rem] text-warm-soft" role="status" data-sync-status={unsaved ? 'unsaved' : !signedIn ? 'local' : status}>
      {text}{link && <> <a href={link} className="underline underline-offset-4">{!signedIn ? 'Sign in' : 'Set up our family'}</a></>}
    </p>
  );
}

function EventRow({ o, change, colors, household, onOpen }: { o: Occurrence; change?: Change; colors: Record<string, MarkerColor>; household: Household | null; onOpen: () => void }) {
  const e = o.event;
  const name = (id: string) => household?.members.find((m) => m.id === id)?.firstName;
  const who = e.member_ids.map((id) => ({ id, name: name(id), color: colors[id] })).filter((p) => p.name);
  const owner = e.owner_member_id ? name(e.owner_member_id) : null;
  // Like the wall calendar: the color says whose plan it is (the first person it's for); who handles it is in words.
  const bar = colors[e.member_ids[0] ?? e.owner_member_id ?? '']?.hex ?? '#9aab8f';
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-stretch gap-3 overflow-hidden rounded-[8px] border border-[var(--of-rule)] text-left transition-colors hover:border-[var(--of-rule-strong)]" style={{ background: tint(bar, 0.07) }} data-calendar-event={e.title}>
        <span aria-hidden="true" className="w-[5px] shrink-0" style={{ background: bar }} />
        <span className="min-w-0 flex-1 py-2.5 pr-3">
          <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">{o.continued ? 'Continues' : timeLabel(e)}{e.recurrence ? ' · repeats' : ''}{change && <span className="cal-change ml-2 align-[1px]" data-change={change}>{change === 'new' ? 'New' : 'Changed'}</span>}</span>
          <span className="mt-0.5 block font-semibold text-warm-ink">{e.title}</span>
          {(who.length > 0 || owner) && (
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-warm-soft">
              {who.map((p) => <span key={p.id} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: p.color?.hex }} />{p.name}</span>)}
              {owner && <span data-event-owner>· {owner} handles it</span>}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

type RepeatChoice = 'none' | Freq;

function EventSheet({ initial, date, isNew, people, colors, onClose, onSave, onDelete }: {
  initial: CalendarEvent; date: string; isNew: boolean; people: Household['members']; colors: Record<string, MarkerColor>;
  onClose: () => void; onSave: (e: CalendarEvent) => void; onDelete: (scope: 'one' | 'all') => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [on, setOn] = useState(initial.starts_on);
  // Most family plans have a time (practice, pickup, appointments): a new event starts timed; All day is one tap.
  const [allDay, setAllDay] = useState(isNew ? false : !initial.start_time);
  const [start, setStart] = useState(initial.start_time ?? '16:00');
  const [end, setEnd] = useState(initial.end_time ?? '');
  const [repeat, setRepeat] = useState<RepeatChoice>(initial.recurrence?.freq ?? 'none');
  const [byDay, setByDay] = useState<number[]>(initial.recurrence?.by_day ?? [new Date(`${initial.starts_on}T12:00:00Z`).getUTCDay()]);
  const [until, setUntil] = useState(initial.recurrence?.until ?? '');
  const [members, setMembers] = useState<string[]>(initial.member_ids);
  const [owner, setOwner] = useState(initial.owner_member_id ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim()) return setError('Give it a name, like “Swim practice”.');
    if (!allDay && end && end <= start) return setError('The end time needs to be after the start.');
    if (repeat !== 'none' && until && until < on) return setError('“Until” needs to be after the first date.');
    onSave({
      ...initial, title: title.trim().slice(0, 80), starts_on: on, notes: notes.trim() || null,
      start_time: allDay ? null : start, end_time: allDay || !end ? null : end, ends_on: null,
      recurrence: repeat === 'none' ? null : { freq: repeat, interval: 1, ...(repeat === 'weekly' ? { by_day: byDay.length ? [...byDay].sort() : undefined } : {}), ...(until ? { until } : {}) },
      member_ids: members, owner_member_id: owner || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="event-sheet-h" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="family-brand max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[16px] bg-[var(--of-bg)] px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-[14px]" data-event-sheet>
        <div className="flex items-center justify-between">
          <h2 id="event-sheet-h" className="font-serif text-[1.5rem] text-warm-ink">{isNew ? 'Add to the calendar' : 'Edit'}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4">Cancel</button>
        </div>
        <label className="mt-4 block"><span className="label">WHAT</span>
          <input autoFocus={isNew} className="cal-input" value={title} maxLength={80} placeholder="Swim practice" onChange={(e) => setTitle(e.target.value)} data-field="title" /></label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block"><span className="label">{repeat === 'none' ? 'DAY' : 'STARTS'}</span>
            <input type="date" className="cal-input" value={on} onChange={(e) => setOn(e.target.value)} required /></label>
          <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-5" /> All day</label>
        </div>
        {!allDay && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block"><span className="label">FROM</span><input type="time" className="cal-input" value={start} onChange={(e) => setStart(e.target.value)} required data-field="start" /></label>
            <label className="block"><span className="label">TO (OPTIONAL)</span><input type="time" className="cal-input" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
        )}
        <label className="mt-4 block"><span className="label">REPEATS</span>
          <select className="cal-input" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatChoice)} data-field="repeat">
            <option value="none">Doesn’t repeat</option><option value="weekly">Every week</option><option value="daily">Every day</option>
            <option value="monthly">Every month (same date)</option><option value="yearly">Every year</option>
          </select></label>
        {repeat === 'weekly' && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="On these days">
            {DAY_NAMES.map((n, i) => (
              <button key={n} type="button" aria-pressed={byDay.includes(i)} onClick={() => setByDay(byDay.includes(i) ? byDay.filter((d) => d !== i) : [...byDay, i])}
                className={`min-h-11 min-w-11 border px-2 text-sm ${byDay.includes(i) ? 'border-[var(--of-month-accent)] bg-[var(--of-month-wash)] font-semibold' : 'border-warm-rule bg-white'} rounded-[8px]`}>{n}</button>
            ))}
          </div>
        )}
        {repeat !== 'none' && (
          <label className="mt-3 block"><span className="label">UNTIL (OPTIONAL)</span><input type="date" className="cal-input" value={until} min={on} onChange={(e) => setUntil(e.target.value)} /></label>
        )}
        {people.length > 0 ? (
          <>
            <fieldset className="mt-5"><legend className="label">WHO IT’S FOR</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {people.map((m) => {
                  const on_ = members.includes(m.id);
                  return (
                    <button key={m.id} type="button" aria-pressed={on_} onClick={() => setMembers(on_ ? members.filter((x) => x !== m.id) : [...members, m.id])}
                      className={`inline-flex min-h-11 items-center gap-2 border px-3 text-sm ${on_ ? 'border-[var(--of-month-accent)] bg-[var(--of-month-wash)] font-semibold' : 'border-warm-rule bg-white'} rounded-full`} data-member-chip={m.firstName}>
                      <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: colors[m.id]?.hex }} />{m.firstName}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="mt-4 block"><span className="label">WHO’S HANDLING IT (DRIVES, BRINGS, REMEMBERS)</span>
              <select className="cal-input" value={owner} onChange={(e) => setOwner(e.target.value)} data-field="owner">
                <option value="">Nobody yet</option>
                {people.map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}
              </select></label>
          </>
        ) : (
          <p className="mt-5 text-sm text-warm-soft">Set up your family to add who it’s for and who’s handling it. <a className="underline" href={FAMILY_SETUP}>Set up our family</a></p>
        )}
        <label className="mt-4 block"><span className="label">NOTES (OPTIONAL)</span>
          <textarea className="cal-input min-h-20" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} /></label>
        {error && <p role="alert" className="mt-3 text-sm text-[#a33]">{error}</p>}
        {!isNew && initial.recurrence && <p className="mt-3 text-xs text-warm-soft">{repeatLabel(initial)}. Changes here apply every time.</p>}
        <button type="submit" className="of-btn of-btn--block mt-5" data-save-event>Save</button>
        {!isNew && !confirmDelete && <button type="button" className="mt-3 min-h-11 w-full text-sm text-[#a33] underline underline-offset-4" onClick={() => setConfirmDelete(true)}>Delete…</button>}
        {!isNew && confirmDelete && (
          <div className="mt-3 grid gap-2" data-delete-choices>
            {initial.recurrence && <button type="button" className="min-h-11 border border-warm-rule bg-white text-sm" onClick={() => onDelete('one')}>Just {fmt(date, { weekday: 'short', month: 'short', day: 'numeric' })}</button>}
            <button type="button" className="min-h-11 border border-[#a33] bg-white text-sm text-[#a33]" onClick={() => onDelete('all')}>{initial.recurrence ? 'Every time' : 'Delete it'}</button>
          </div>
        )}
        <style>{`.cal-input{margin-top:.4rem;display:block;width:100%;min-height:48px;border:1px solid var(--color-warm-rule,#e7ddd4);border-radius:8px;background:#fff;padding:.6rem .75rem;font-size:16px;color:var(--color-warm-ink,#4d4544)}`}</style>
      </form>
    </div>
  );
}

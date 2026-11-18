/**
 * Connected calendars on the family calendar (docs/ios/CALENDAR_INTEGRATION.md): the Calendars sheet (connect Google,
 * add a school or team link, choose what shows, share with the family or keep private, whose calendar it is) and the
 * read-only sheet for an event that came from one. Imported events are never edited here: they change where they live.
 */
import { useState } from 'react';
import type { ConnectedHook, ConnectError, MyCalendar, MyConnection } from '../../lib/calendar/connected';
import { timeLabel, type CalendarEvent } from '../../lib/calendar/recurrence';
import type { Household } from '../../lib/club/profile';
import type { MarkerColor } from '../../data/club/family-colors';

const SIGN_IN = '/app/sign-in?next=/app/family-calendar';
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });

export const ERROR_TEXT: Record<ConnectError, string> = {
  not_signed_in: 'Sign in first, so your calendars stay yours.',
  google_unavailable: 'Google Calendar can’t be connected yet. A calendar link still works.',
  unavailable: 'Connecting calendars isn’t available right now. Try again later.',
  invalid_url: 'That doesn’t look like a calendar link. Copy the whole link, starting with https:// or webcal://.',
  unsupported_url: 'That kind of link can’t be added. Use a link that starts with https:// or webcal://.',
  private_host: 'That link points to a private network, so it can’t be added.',
  unreachable: 'We couldn’t open that link. Check it and try again.',
  not_a_calendar: 'That link opened a web page, not a calendar. Look for “Subscribe”, “iCal” or a link ending in .ics.',
  duplicate: 'You’ve already added that calendar.',
  too_many: 'You’ve connected the most calendars we allow (12). Remove one to add another.',
  reauth: 'Google needs you to reconnect.',
  not_found: 'That calendar is already gone.',
  failed: 'Something went wrong. Try again.',
};

/** Where an event came from, in a few words: "Google · Ana", "Lincoln Elementary". */
export function sourceTag(e: CalendarEvent): string {
  const x = e.external!;
  return x.provider === 'google' ? `Google · ${x.sourceName}` : x.sourceName;
}

/** The read-only event: when, where, from which calendar, and a way to open it where it lives. */
export function ImportedSheet({ event, date, household, colors, onClose, onManage }: {
  event: CalendarEvent; date: string; household: Household | null; colors: Record<string, MarkerColor>; onClose: () => void; onManage: () => void;
}) {
  const x = event.external!;
  const who = event.member_ids.map((id) => household?.members.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const span = event.ends_on && event.ends_on > event.starts_on ? `${fmt(event.starts_on, { weekday: 'short', month: 'short', day: 'numeric' })} – ${fmt(event.ends_on, { weekday: 'short', month: 'short', day: 'numeric' })}` : fmt(date, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="imported-h" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="family-brand max-h-[92dvh] w-full max-w-lg overflow-y-auto bg-[var(--of-bg)] px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl" data-imported-sheet>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="of-eyebrow">{x.provider === 'google' ? 'From Google Calendar' : 'From a subscribed calendar'}</p>
            <h2 id="imported-h" className="mt-1 font-serif text-[1.5rem] leading-tight text-warm-ink">{event.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4">Close</button>
        </div>
        <dl className="mt-4 grid gap-3 text-[0.95rem]">
          <div><dt className="label">WHEN</dt><dd className="mt-1">{span} · {event.ends_on && event.start_time ? `starts ${timeLabel({ start_time: event.start_time, end_time: null })}` : timeLabel(event)}</dd></div>
          {event.location && <div><dt className="label">WHERE</dt><dd className="mt-1">{event.location}</dd></div>}
          {who.length > 0 && (
            <div><dt className="label">WHOSE CALENDAR</dt><dd className="mt-1 flex flex-wrap gap-3">{who.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colors[m.id]?.hex }} />{m.firstName}</span>)}</dd></div>
          )}
          <div><dt className="label">CALENDAR</dt><dd className="mt-1" data-imported-source>{x.sourceName}{x.alsoOn.length > 0 && <span className="text-warm-soft"> · also on {x.alsoOn.join(', ')}</span>}{!x.mine && <span className="text-warm-soft"> · shared by the other grown-up</span>}</dd></div>
          {event.notes && <div><dt className="label">NOTES</dt><dd className="mt-1 whitespace-pre-line text-warm-soft">{event.notes}</dd></div>}
        </dl>
        <div className="family-note mt-5 text-sm" data-imported-readonly>
          This plan lives in {x.provider === 'google' ? 'Google Calendar' : `“${x.sourceName}”`}, so it changes there and shows up here on its own.
        </div>
        {x.url && <a href={x.url} target="_blank" rel="noopener" className="of-btn of-btn--block mt-5" data-open-original>{x.provider === 'google' ? 'Open in Google Calendar' : 'Open where it came from'}</a>}
        {x.mine && <button type="button" className="mt-3 min-h-11 w-full text-sm text-warm-soft underline underline-offset-4" onClick={onManage}>Choose which calendars show</button>}
      </div>
    </div>
  );
}

function CalendarRow({ cal, people, colors, canShare, busy, onChange }: {
  cal: MyCalendar; people: Household['members']; colors: Record<string, MarkerColor>; canShare: boolean; busy: boolean;
  onChange: (c: { selected?: boolean; shared?: boolean; member_ids?: string[] }) => void;
}) {
  return (
    <li className="border-t border-[var(--of-rule)] py-3 first:border-t-0" data-connected-calendar={cal.name}>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5" checked={cal.selected} disabled={busy} onChange={(e) => onChange({ selected: e.target.checked })} data-calendar-show />
        <span aria-hidden="true" className="inline-block size-3 shrink-0" style={{ background: cal.color ?? '#b9c2cb' }} />
        <span className="min-w-0 flex-1 truncate font-semibold">{cal.name}</span>
      </label>
      {cal.selected && (
        <div className="mt-2 grid gap-3 pl-8">
          <div className="of-seg" role="group" aria-label={`Who sees ${cal.name}`}>
            <button type="button" aria-pressed={!cal.shared} disabled={busy} onClick={() => onChange({ shared: false })} data-share="private">Only me</button>
            <button type="button" aria-pressed={cal.shared} disabled={busy || !canShare} onClick={() => onChange({ shared: true })} data-share="family">Our family</button>
          </div>
          {people.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Whose calendar is ${cal.name}`}>
              <span className="label w-full">WHOSE CALENDAR (FOR THEIR COLOR)</span>
              {people.map((m) => {
                const on = cal.member_ids.includes(m.id);
                return (
                  <button key={m.id} type="button" aria-pressed={on} disabled={busy} onClick={() => onChange({ member_ids: on ? cal.member_ids.filter((x) => x !== m.id) : [...cal.member_ids, m.id] })}
                    className={`inline-flex min-h-11 items-center gap-2 border px-3 text-sm ${on ? 'border-[var(--of-month-accent)] bg-[var(--of-month-wash)] font-semibold' : 'border-warm-rule bg-white'}`}>
                    <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: colors[m.id]?.hex }} />{m.firstName}
                  </button>
                );
              })}
            </div>
          )}
          {cal.sync_error && cal.sync_error !== 'held_large_removal' && <p className="text-xs text-[#a33]">Couldn’t update lately. We’ll keep trying; what’s here may be out of date.</p>}
          {cal.sync_error === 'held_large_removal' && <p className="text-xs text-warm-soft">Most of this calendar disappeared at the source, so we’re double-checking before removing it here.</p>}
        </div>
      )}
    </li>
  );
}

/** The Calendars sheet. */
export function ConnectedSheet({ connected, household, colors, signedIn, onClose }: {
  connected: ConnectedHook; household: Household | null; colors: Record<string, MarkerColor>; signedIn: boolean; onClose: () => void;
}) {
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const people = (household?.members ?? []).filter((m) => !m.archived);
  const canShare = Boolean(household);
  const run = async (f: () => Promise<ConnectError | null>, ok?: string) => {
    setBusy(true);
    setMessage(null);
    const err = await f();
    setBusy(false);
    setMessage(err ? { text: ERROR_TEXT[err], error: true } : ok ? { text: ok, error: false } : null);
    return err;
  };
  const mine = connected.sources?.mine ?? [];
  const shared = connected.sources?.shared_with_me ?? [];
  const heading = (c: MyConnection) => (c.provider === 'google' ? `Google · ${c.label}` : `Link · ${c.label}`);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="connected-h" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="family-brand max-h-[92dvh] w-full max-w-lg overflow-y-auto bg-[var(--of-bg)] px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl" data-connected-sheet>
        <div className="flex items-center justify-between">
          <h2 id="connected-h" className="font-serif text-[1.5rem] text-warm-ink">Calendars</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4">Done</button>
        </div>
        <p className="mt-2 text-sm text-warm-soft">Bring in the calendars you already keep, so nobody types the week twice. They show here beside your family’s plans and change only where they came from.</p>

        {!signedIn ? (
          <div className="of-tile mt-5"><p className="text-sm">Sign in to connect your calendars. Each grown-up connects their own, and chooses what the family sees.</p><a href={SIGN_IN} className="of-btn mt-4">Sign in</a></div>
        ) : (
          <>
            {message && <p role={message.error ? 'alert' : 'status'} className={`mt-4 text-sm ${message.error ? 'text-[#a33]' : 'text-warm-soft'}`} data-connected-message>{message.text}</p>}

            <section className="mt-5" aria-labelledby="connected-mine">
              <h3 id="connected-mine" className="label">YOURS</h3>
              {mine.length === 0 && <p className="mt-2 text-sm text-warm-soft">Nothing connected yet.</p>}
              {mine.map((c) => (
                <div key={c.id} className="of-tile mt-3 !p-4" data-connection={c.provider}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-warm-soft">{heading(c)}</p>
                    {removing === c.id ? (
                      <span className="flex shrink-0 gap-2">
                        <button type="button" className="min-h-11 px-2 text-sm text-[#a33] underline" disabled={busy} onClick={() => run(() => connected.disconnect(c.id), 'Removed. Its events are gone from your calendar.').then(() => setRemoving(null))} data-confirm-remove>Remove</button>
                        <button type="button" className="min-h-11 px-2 text-sm underline" onClick={() => setRemoving(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="min-h-11 shrink-0 px-2 text-sm text-warm-soft underline" onClick={() => setRemoving(c.id)} data-remove-connection>Remove…</button>
                    )}
                  </div>
                  {c.status === 'reauth' && (
                    <div className="family-note mt-2 text-sm" data-connection-reauth>
                      Google stopped sharing this calendar with us (a password change, or access removed). What’s here may be out of date.
                      <button type="button" className="of-btn of-btn--soft mt-3" disabled={busy} onClick={() => run(connected.connectGoogle)}>Reconnect Google</button>
                    </div>
                  )}
                  {c.status === 'error' && <p className="family-note mt-2 text-sm" data-connection-error>This calendar link stopped working. Check it with whoever shared it, or remove it.</p>}
                  <ul className="mt-1">
                    {c.calendars.map((cal) => (
                      <CalendarRow key={cal.id} cal={cal} people={people} colors={colors} canShare={canShare} busy={busy} onChange={(change) => void run(() => connected.update(cal.id, change))} />
                    ))}
                  </ul>
                  {c.provider === 'google' && c.status === 'active' && <button type="button" className="mt-1 min-h-11 text-sm text-warm-soft underline" disabled={busy} onClick={() => run(() => connected.relistGoogle(c.id), 'Calendar list updated.')}>Look for new calendars</button>}
                </div>
              ))}
              {!canShare && mine.length > 0 && <p className="mt-2 text-xs text-warm-soft">Set up your family to share a calendar with the other grown-up.</p>}
            </section>

            <section className="mt-6" aria-labelledby="connected-add">
              <h3 id="connected-add" className="label">ADD A CALENDAR</h3>
              {connected.googleReady && (
                <button type="button" className="of-btn of-btn--block mt-3" disabled={busy} onClick={() => run(connected.connectGoogle)} data-connect-google>Connect Google Calendar</button>
              )}
              <form className="of-tile mt-3 !p-4" onSubmit={(e) => { e.preventDefault(); if (link.trim()) void run(() => connected.subscribe(link.trim(), name.trim() || undefined), 'Added. Its events are on your calendar, just for you until you share it.').then((err) => { if (!err) { setLink(''); setName(''); } }); }} data-subscribe-form>
                <p className="font-semibold">School, sports team or another calendar link</p>
                <p className="mt-1 text-sm text-warm-soft">Look for “Subscribe”, “iCal” or “Add to calendar” on the school or team site, and copy the link (it often starts with webcal:// or ends in .ics). We check it for updates every few hours.</p>
                <label className="mt-3 block"><span className="label">LINK</span>
                  <input className="cal-input" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="webcal://…" value={link} onChange={(e) => setLink(e.target.value)} data-field="feed-url" /></label>
                <label className="mt-3 block"><span className="label">NAME (OPTIONAL)</span>
                  <input className="cal-input" maxLength={120} placeholder="Lincoln Elementary" value={name} onChange={(e) => setName(e.target.value)} /></label>
                <button type="submit" className="of-btn mt-4" disabled={busy || !link.trim()} data-subscribe>{busy ? 'Adding…' : 'Add calendar'}</button>
              </form>
              <p className="mt-3 text-xs text-warm-soft">Read only: nothing is ever changed or added in your Google calendars or on the school’s calendar. Outlook and iPhone calendars can share a link the same way.</p>
            </section>

            {shared.length > 0 && (
              <section className="mt-6" aria-labelledby="connected-shared">
                <h3 id="connected-shared" className="label">SHARED BY THE OTHER GROWN-UP</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {shared.map((s) => <li key={s.id} className="flex min-h-9 items-center gap-2" data-shared-calendar={s.name}><span aria-hidden="true" className="inline-block size-2.5 bg-[#b9c2cb]" />{s.name}<span className="text-warm-soft">· {s.provider === 'google' ? 'Google' : 'link'}{s.stale ? ' · may be out of date' : ''}</span></li>)}
                </ul>
              </section>
            )}
          </>
        )}
        <style>{`.cal-input{margin-top:.4rem;display:block;width:100%;min-height:48px;border:1px solid var(--color-warm-rule,#e7ddd4);background:#fff;padding:.6rem .75rem;font-size:16px;color:var(--color-warm-ink,#4d4544)}`}</style>
      </div>
    </div>
  );
}

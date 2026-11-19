/**
 * "Calendars": the school, sports and work calendars an adult subscribes to (docs/calendar/CALENDAR_INTEGRATION.md),
 * shown read-only in the family calendar. Each adult controls their own: private (only them) or shared with the
 * household (both adults, and the weekly Family Meeting); whose calendar it is (that person's permanent color);
 * refresh now; unsubscribe. The other adult's shared calendars are listed by name only (never their link).
 * Also: the read-only sheet for an imported event.
 */
import { useState } from 'react';
import type { Household } from '../../lib/club/profile';
import type { MarkerColor } from '../../data/club/family-colors';
import { feedsApi, type Feed, type FeedVisibility } from '../../lib/calendar/feeds';
import { timeLabel, type CalendarEvent } from '../../lib/calendar/recurrence';

const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };
const ago = (iso: string | null) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};
const ERRORS: Record<string, string> = {
  invalid_url: 'That doesn’t look like a calendar link. Paste the iCal (.ics) or webcal link.',
  too_many: 'You can subscribe to up to 20 calendars.',
  no_household: 'Set up your family first, then add calendars to it.',
  not_signed_in: 'Sign in to add calendars.',
};

function Sheet({ title, onClose, children, data }: { title: string; onClose: () => void; children: React.ReactNode; data: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={`${data}-h`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="family-brand max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[16px] bg-[var(--of-bg)] px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-[14px]" {...{ [`data-${data}`]: '' }}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${data}-h`} className="font-serif text-[1.5rem] text-warm-ink">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4">Done</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Whose({ people, colors, value, onChange }: { people: Household['members']; colors: Record<string, MarkerColor>; value: string | null; onChange: (id: string | null) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Whose calendar">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={`min-h-[44px] rounded-[8px] border px-3 text-sm ${value === null ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>Whole family</button>
      {people.map((m) => (
        <button key={m.id} type="button" aria-pressed={value === m.id} onClick={() => onChange(m.id)} data-feed-member={m.firstName}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border px-3 text-sm ${value === m.id ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>
          <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colors[m.id]?.hex }} />{m.firstName}
        </button>
      ))}
    </div>
  );
}

function Visibility({ value, onChange, name }: { value: FeedVisibility; onChange: (v: FeedVisibility) => void; name: string }) {
  return (
    <div className="of-seg mt-2" role="group" aria-label={`Who sees ${name}`}>
      <button type="button" aria-pressed={value === 'private'} onClick={() => onChange('private')} data-visibility="private">Only me</button>
      <button type="button" aria-pressed={value === 'household'} onClick={() => onChange('household')} data-visibility="household">Our household</button>
    </div>
  );
}

export function CalendarSources({ feeds, people, colors, onClose, onChanged }: {
  feeds: Feed[]; people: Household['members']; colors: Record<string, MarkerColor>; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(feeds.length === 0);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [member, setMember] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<FeedVisibility>('private');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const run = async (key: string, f: () => Promise<unknown>, done?: string) => {
    setBusy(key); setMsg('');
    try { await f(); await onChanged(); if (done) setMsg(done); } catch (e) { const m = (e as Error).message; setMsg(ERRORS[m] ?? (/\s/.test(m) ? m : 'That didn’t work. Check your connection and try again.')); await onChanged().catch(() => {}); } finally { setBusy(null); }
  };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return setMsg(ERRORS.invalid_url);
    void run('add', async () => {
      const f = await feedsApi.add({ url: url.trim(), name: name.trim() || 'Calendar', visibility, member_id: member, timezone: zone() });
      const r = await feedsApi.refresh(f.id).catch(() => null);
      setUrl(''); setName(''); setAdding(false);
      if (r && r.result !== 'ok' && r.result !== 'not_modified') setMsg(r.error ?? 'Added. We couldn’t read it yet; we’ll keep trying.');
    }, 'Added. Its events are on your calendar.');
  };
  const mine = feeds.filter((f) => f.mine);
  const shared = feeds.filter((f) => !f.mine);
  return (
    <Sheet title="Calendars" onClose={onClose} data="calendar-sources">
      <p className="mt-1 text-[0.9rem] text-warm-soft">School, sports and work calendars, read-only beside your family’s plans. They refresh on their own.</p>

      {mine.length > 0 && <p className="of-eyebrow mt-5">Yours</p>}
      <ul className="mt-2 space-y-3">
        {mine.map((f) => (
          <li key={f.id} className="of-tile !p-4" data-feed={f.name}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: f.member_id ? colors[f.member_id]?.hex : '#9aab8f' }} />{f.name}</p>
                <p className="mt-0.5 text-[0.8rem] text-warm-soft" data-feed-status={f.status}>
                  {f.url_host && <span className="block" data-feed-host>{f.url_host}</span>}
                  {f.status === 'ok' ? `${f.event_count} events · updated ${ago(f.last_success_at) ?? ''}` : f.status === 'pending' ? 'Getting its events…' : f.last_error ?? 'Couldn’t refresh it.'}
                </p>
              </div>
              <button type="button" className="of-tile-action !mt-0 shrink-0" disabled={busy === f.id} onClick={() => void run(f.id, async () => {
                if (f.status === 'disconnected') await feedsApi.retry(f.id);
                const r = await feedsApi.refresh(f.id);
                if (r.error) throw new Error(r.error);
              }, 'Refreshed.')} data-feed-refresh>{busy === f.id ? 'Refreshing…' : 'Refresh'}</button>
            </div>
            <p className="label mt-3">WHO SEES IT</p>
            <Visibility name={f.name} value={f.visibility} onChange={(v) => void run(f.id, () => feedsApi.update(f.id, { visibility: v }))} />
            <p className="label mt-3">WHOSE CALENDAR</p>
            <Whose people={people} colors={colors} value={f.member_id} onChange={(id) => void run(f.id, () => feedsApi.update(f.id, { member_id: id }))} />
            <button type="button" className="mt-3 min-h-11 text-sm text-[#8a3b2e] underline underline-offset-4" onClick={() => void run(f.id, () => feedsApi.remove(f.id), 'Removed. Its events are off your calendar; the original calendar isn’t touched.')} data-feed-remove>Remove this calendar</button>
          </li>
        ))}
      </ul>

      {shared.length > 0 && (
        <>
          <p className="of-eyebrow mt-5">Shared with your household</p>
          <ul className="mt-2 space-y-2">
            {shared.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-[0.92rem]" data-feed-shared={f.name}>
                <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: f.member_id ? colors[f.member_id]?.hex : '#9aab8f' }} />{f.name}
                <span className="text-[0.8rem] text-warm-soft">· added by the other grown-up</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {adding ? (
        <form onSubmit={add} className="of-tile mt-5 !p-4" data-feed-add>
          <p className="font-semibold">Add a calendar</p>
          <label className="mt-3 block"><span className="label">CALENDAR LINK</span>
            <input className="cal-input" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="webcal://… or https://….ics" data-field="feed-url" /></label>
          <p className="mt-1 text-[0.78rem] text-warm-soft">Schools and teams usually offer “Subscribe” or an iCal link. From Google Calendar on a computer: Settings → the calendar → “Secret address in iCal format”. Treat a secret link like a password: only you see it here, and you can reset it in Google any time.</p>
          <label className="mt-3 block"><span className="label">NAME</span>
            <input className="cal-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Lincoln Elementary" data-field="feed-name" /></label>
          <p className="label mt-3">WHOSE CALENDAR</p>
          <Whose people={people} colors={colors} value={member} onChange={setMember} />
          <p className="label mt-3">WHO SEES IT</p>
          <Visibility name="this calendar" value={visibility} onChange={setVisibility} />
          <p className="mt-1 text-[0.78rem] text-warm-soft">{visibility === 'private' ? 'Only you. Change it any time.' : 'Both grown-ups, and your weekly Family Meeting. The link stays yours.'}</p>
          <button type="submit" className="of-btn mt-4" disabled={busy === 'add'} data-feed-save>{busy === 'add' ? 'Adding…' : 'Add calendar'}</button>
        </form>
      ) : (
        <button type="button" className="of-btn of-btn--soft mt-5" onClick={() => setAdding(true)} data-feed-new>Add a calendar</button>
      )}
      <p role="status" className="mt-3 text-sm text-[var(--of-sage-ink)]" data-feed-msg>{msg}</p>
      <style>{`.cal-input{display:block;width:100%;min-height:46px;margin-top:4px;border:1px solid var(--of-rule);border-radius:8px;background:#fff;padding:0 .7rem;font-size:1rem;color:var(--of-ink)}`}</style>
    </Sheet>
  );
}

/** An imported event: read-only, with where it came from. */
export function ExternalEventSheet({ e, date, household, onClose }: { e: CalendarEvent; date: string; household: Household | null; onClose: () => void }) {
  const ext = e.external!;
  const whose = e.member_ids[0] ? household?.members.find((m) => m.id === e.member_ids[0])?.firstName : null;
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return (
    <Sheet title={e.title} onClose={onClose} data="external-event">
      <p className="mt-2 text-[0.95rem]">{day} · {timeLabel(e)}{ext.tentative ? ' · tentative' : ''}</p>
      {e.location && <p className="mt-1 text-[0.95rem] text-warm-soft">{e.location}</p>}
      <p className="of-tile mt-4 !p-4 text-[0.9rem]">
        From <strong>{ext.name}</strong>{whose ? ` (${whose}’s calendar)` : ''} · {ext.visibility === 'household' ? 'shared with your household' : 'only you see it'}.
        It’s read-only here: change it in the original calendar and it updates on its own.
      </p>
    </Sheet>
  );
}

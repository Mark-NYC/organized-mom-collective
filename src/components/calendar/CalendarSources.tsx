/**
 * "Calendars": the school, sports and work calendars an adult subscribes to (docs/calendar/CALENDAR_INTEGRATION.md),
 * shown read-only in the family calendar. Each adult controls their own: private (only them) or shared with the
 * household (both adults, and the weekly Family Meeting); whose calendar it is (that person's permanent color);
 * refresh now; unsubscribe. The other adult's shared calendars are listed by name only (never their link).
 * Also: the read-only sheet for an imported event.
 */
import { useEffect, useState } from 'react';
import type { Household } from '../../lib/club/profile';
import type { MarkerColor } from '../../data/club/family-colors';
import { GOOGLE_RESULT, feedsApi, type Feed, type FeedVisibility } from '../../lib/calendar/feeds';
import { GooglePicker, GoogleSection, useGoogleAccounts, useGoogleReturn } from './GoogleCalendars';
import { timeLabel, type CalendarEvent } from '../../lib/calendar/recurrence';
import { MAX_TASK_TITLE, MAX_TASKS_PER_EVENT, occurrenceOf, tasksFor, type EventTasks } from '../../lib/calendar/event-tasks';

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
  // Escape closes it (keyboards, iPad); the Done button stays the visible way out.
  useEffect(() => {
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
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

export function CalendarSources({ feeds, people, colors, onClose, onChanged, googleReturn }: {
  feeds: Feed[]; people: Household['members']; colors: Record<string, MarkerColor>; onClose: () => void; onChanged: () => Promise<void>;
  /** Back from Google's screen on the website: ?google=<result>&account=<id>. */
  googleReturn?: { result: string; account: string | null } | null;
}) {
  const google = useGoogleAccounts();
  const [picker, setPicker] = useState<string | null>(null);
  useGoogleReturn(google.reload, setPicker);
  useEffect(() => {
    if (!googleReturn) return;
    setMsg(GOOGLE_RESULT[googleReturn.result] ?? GOOGLE_RESULT.error);
    if (googleReturn.result === 'connected' && googleReturn.account) setPicker(googleReturn.account);
  }, [googleReturn]);
  const [adding, setAdding] = useState(false);
  const linkFirst = !google.available && feeds.length === 0;
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
      <p className="mt-1 text-[0.9rem] text-warm-soft">Your Google, school, sports and work calendars, read-only beside your family’s plans. They refresh on their own.</p>
      {google.available && (
        <GoogleSection accounts={google.accounts} onPick={setPicker} setMsg={setMsg}
          onChanged={async () => { await google.reload(); await onChanged(); }} />
      )}

      {mine.length > 0 && <p className="of-eyebrow mt-5">Yours</p>}
      <ul className="mt-2 space-y-3">
        {mine.map((f) => (
          <li key={f.id} className="of-tile !p-4" data-feed={f.name}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: f.member_id ? colors[f.member_id]?.hex : '#9aab8f' }} />{f.name}</p>
                <p className="mt-0.5 text-[0.8rem] text-warm-soft" data-feed-status={f.status}>
                  {f.kind === 'google'
                    ? <span className="block" data-feed-host>Google · {google.accounts.find((a) => a.id === f.google_account_id)?.email ?? 'connected account'}</span>
                    : f.url_host && <span className="block" data-feed-host>{f.url_host}</span>}
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

      {adding || linkFirst ? (
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
        google.available
          ? <button type="button" className="mt-5 min-h-11 text-[0.92rem] text-warm-ink underline underline-offset-4" onClick={() => setAdding(true)} data-feed-new>Add a calendar by link (school, sports, iCal)</button>
          : <button type="button" className="of-btn of-btn--soft mt-5" onClick={() => setAdding(true)} data-feed-new>Add a calendar</button>
      )}
      <p role="status" className="mt-3 text-sm text-[var(--of-sage-ink)]" data-feed-msg>{msg}</p>
      {picker && (
        <GooglePicker account={google.accounts.find((a) => a.id === picker) ?? null} people={people} colors={colors}
          onClose={() => setPicker(null)}
          onSaved={async (m) => { setPicker(null); await google.reload(); await onChanged(); setMsg(m); }} />
      )}
      <style>{`.cal-input{display:block;width:100%;min-height:46px;margin-top:4px;border:1px solid var(--of-rule);border-radius:8px;background:#fff;padding:0 .7rem;font-size:1rem;color:var(--of-ink)}`}</style>
    </Sheet>
  );
}

/** An imported event: read-only, with where it came from. */
export function ExternalEventSheet({ e, date, household, colors = {}, tasks, onClose }: {
  e: CalendarEvent; date: string; household: Household | null; colors?: Record<string, MarkerColor>; tasks?: EventTasks; onClose: () => void;
}) {
  const ext = e.external!;
  const whose = e.member_ids[0] ? household?.members.find((m) => m.id === e.member_ids[0])?.firstName : null;
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return (
    <Sheet title={e.title} onClose={onClose} data="external-event">
      <p className="mt-2 text-[0.95rem]" data-event-when>{day} · {timeLabel(e)}{ext.tentative ? ' · tentative' : ''}</p>
      {e.location && <p className="mt-1 text-[0.95rem] text-warm-soft" data-event-location>{e.location}</p>}
      <p className="mt-1 text-[0.85rem] text-warm-soft" data-event-from>
        From <strong className="font-semibold text-warm-ink">{ext.name}</strong>{whose ? ` · ${whose}’s calendar` : ''} · {ext.visibility === 'household' ? 'shared with your household' : 'only you see it'}
      </p>
      {tasks?.available && occurrenceOf(e)
        ? <EventResponsibilities e={e} tasks={tasks} people={(household?.members ?? []).filter((m) => !m.archived)} colors={colors} />
        : null}
      <p className="mt-5 text-[0.8rem] text-warm-soft">It’s read-only here: change it in {ext.name} and it updates on its own.</p>
    </Sheet>
  );
}

/** Who does what for one imported occurrence: check off, add, edit, reassign, remove. The event itself never changes. */
export function EventResponsibilities({ e, tasks, people, colors }: { e: CalendarEvent; tasks: EventTasks; people: Household['members']; colors: Record<string, MarkerColor> }) {
  const list = tasksFor(tasks.tasks, e);
  const [form, setForm] = useState<{ id?: string; title: string; member: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const name = (id: string | null) => (id ? people.find((m) => m.id === id)?.firstName : undefined);
  const run = async (p: Promise<string | null>) => { setSaving(true); const err = await p; setSaving(false); setError(err); return err; };
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form || saving) return;
    if (!(await run(tasks.save({ id: form.id, event: e, title: form.title, member_id: form.member })))) setForm(null);
  };
  const done = list.filter((t) => t.done).length;
  return (
    <section className="mt-5 border-t border-[var(--of-rule)] pt-4" aria-labelledby="event-tasks-h" data-event-tasks>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="event-tasks-h" className="label">Who’s doing what</h3>
        {list.length > 0 && <span className="text-[0.8rem] text-warm-soft" data-event-tasks-count>{done} of {list.length} done</span>}
      </div>
      {list.length > 0 && (
        <ul className="mt-2 divide-y divide-[var(--of-rule)]">
          {list.map((t) => {
            const who = name(t.member_id);
            return (
              <li key={t.id} className="flex items-center gap-2 py-1" data-event-task={t.title} data-done={t.done ? '' : undefined}>
                <button type="button" role="checkbox" aria-checked={t.done} aria-label={`${t.title}${who ? `, ${who}` : ''}`} onClick={() => void run(tasks.toggle(t.id))}
                  className="grid size-11 shrink-0 place-items-center" data-task-done>
                  <span aria-hidden="true" className={`grid size-6 place-items-center rounded-[6px] border-2 text-[0.85rem] font-bold ${t.done ? 'border-warm-ink bg-warm-ink text-white' : 'border-[var(--of-rule-strong)] bg-white'}`}>{t.done ? '✓' : ''}</span>
                </button>
                <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => { setError(null); setForm({ id: t.id, title: t.title, member: t.member_id }); }} aria-label={`Edit ${t.title}`} data-task-edit>
                  <span className={`block text-[0.98rem] ${t.done ? 'text-warm-soft line-through' : 'text-warm-ink'}`}>{t.title}</span>
                  <span className="flex items-center gap-1.5 text-[0.82rem] text-warm-soft" data-task-who>
                    <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: who ? colors[t.member_id!]?.hex ?? '#8fa686' : 'transparent', border: who ? undefined : '1px solid #b9b2a8' }} />
                    {who ?? 'Anyone'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-[0.88rem] text-[#a33]" data-task-error>{error}</p>}
      {form ? (
        <form onSubmit={submit} className="mt-3" data-task-form>
          <label className="block"><span className="label">{form.id ? 'Responsibility' : 'New responsibility'}</span>
            <input autoFocus className="cal-input" value={form.title} maxLength={MAX_TASK_TITLE} placeholder="Pack soccer bag" enterKeyHint="done"
              onChange={(ev) => setForm({ ...form, title: ev.target.value })} data-task-title />
          </label>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Who’s doing it">
            {[...people.map((m) => ({ id: m.id as string | null, label: m.firstName })), { id: null, label: 'Anyone' }].map((p) => (
              <button key={p.id ?? 'anyone'} type="button" role="radio" aria-checked={form.member === p.id} onClick={() => setForm({ ...form, member: p.id })} data-task-member={p.label}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${form.member === p.id ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>
                {p.id && <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colors[p.id]?.hex }} />}{p.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" className="of-btn" disabled={saving} data-task-save>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4" onClick={() => { setForm(null); setError(null); }}>Cancel</button>
            {form.id && (
              <button type="button" className="ml-auto min-h-11 px-2 text-sm text-[#a33] underline underline-offset-4" data-task-remove
                onClick={async () => { if (!(await run(tasks.remove(form.id!)))) setForm(null); }}>Remove</button>
            )}
          </div>
        </form>
      ) : list.length < MAX_TASKS_PER_EVENT && (
        <button type="button" className="of-btn of-btn--soft mt-3" onClick={() => { setError(null); setForm({ title: '', member: null }); }} data-task-add>
          {list.length ? 'Add another' : 'Add a responsibility'}
        </button>
      )}
    </section>
  );
}

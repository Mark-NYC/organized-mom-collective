/**
 * Connect Google Calendar (docs/calendar/GOOGLE_CALENDAR.md): the primary way to add calendars.
 * Tap Connect → Google's own account and permission screen (read-only) → back here → tick the calendars to show,
 * whose each one is, Only me / Our household → done. More than one Google account can be connected.
 *
 * The website goes to Google in the same tab and comes back to the calendar. The iPhone app opens Google in Safari's
 * sheet (Google doesn't allow its sign-in inside an app's web view); when she taps Done, the app picks the new account
 * up and opens the calendar picker. No Google token ever reaches the app: it only sees account ids and calendar names.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Household } from '../../lib/club/profile';
import type { MarkerColor } from '../../data/club/family-colors';
import { feedsApi, googleApi, type FeedVisibility, type GoogleAccount, type GoogleCalendarChoice } from '../../lib/calendar/feeds';
import { APP_RESUME_EVENT, isNativeApp } from '../../lib/native/platform';

const PENDING = 'omc:google:pending'; // sessionStorage: a connection started in Safari's sheet (iPhone app)

export async function connectGoogle(): Promise<void> {
  const native = isNativeApp();
  const { url } = await googleApi.start(native ? 'app' : 'web', location.origin);
  if (!native) { location.assign(url); return; }
  try { sessionStorage.setItem(PENDING, String(Date.now())); } catch { /* fine */ }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'popover' });
}

const START_ERRORS: Record<string, string> = {
  not_configured: 'Google Calendar isn’t available yet.',
  not_enabled: 'Google Calendar isn’t available for your family yet.',
  too_many: 'Too many connection attempts. Wait a few minutes and try again.',
  not_signed_in: 'Sign in to connect Google Calendar.',
};

/** Her Google accounts; `available` is false when Google isn't on for her (or not set up on the server). */
export function useGoogleAccounts() {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [available, setAvailable] = useState(false);
  const reload = useCallback(async (): Promise<GoogleAccount[]> => {
    try { const a = await googleApi.accounts(); setAccounts(a); setAvailable(true); return a; } catch { setAvailable(false); return []; }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { accounts, available, reload };
}

/** The Google section of the Calendars panel. */
export function GoogleSection({ accounts, onPick, onChanged, setMsg }: {
  accounts: GoogleAccount[]; onPick: (accountId: string) => void; onChanged: () => Promise<void>; setMsg: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const start = async () => {
    setBusy('connect'); setMsg('');
    try { await connectGoogle(); } catch (e) { setMsg(START_ERRORS[(e as Error).message] ?? 'Google Calendar couldn’t be opened. Try again.'); } finally { setBusy(null); }
  };
  const disconnect = async (a: GoogleAccount) => {
    if (confirm !== a.id) { setConfirm(a.id); return; }
    setBusy(a.id); setConfirm(null);
    try {
      const r = await googleApi.disconnect(a.id);
      await onChanged();
      setMsg(r.revoked
        ? `Disconnected ${a.email ?? 'Google'}. Its calendars are off your family calendar, and our access to it is revoked. Your Google Calendar isn’t changed.`
        : `Disconnected ${a.email ?? 'Google'}. Its calendars are off your family calendar. Google didn’t answer, so to be sure, remove Organized Family at myaccount.google.com/permissions.`);
    } catch { setMsg('That didn’t work. Check your connection and try again.'); } finally { setBusy(null); }
  };
  return (
    <section className="mt-4" data-google-section>
      <button type="button" className="of-btn of-btn--block google-connect" onClick={() => void start()} disabled={busy === 'connect'} data-google-connect>
        <GoogleMark />{busy === 'connect' ? 'Opening Google…' : accounts.length ? 'Connect another account' : 'Connect Google Calendar'}
      </button>
      {!accounts.length && <p className="mt-2 text-[0.8rem] text-warm-soft">Read-only: we can see your events, never change them. You choose which calendars appear and who sees them.</p>}
      {accounts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="of-tile !p-4" data-google-account={a.email ?? a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-semibold"><GoogleMark small />{a.email ?? 'Google account'}</p>
                  <p className="mt-0.5 text-[0.8rem] text-warm-soft" data-google-status={a.status}>
                    {a.status === 'reconnect' ? (a.last_error ?? 'Google stopped accepting this connection.') : a.calendars ? `${a.calendars} ${a.calendars === 1 ? 'calendar' : 'calendars'} on your family calendar` : 'No calendars chosen yet'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                {a.status === 'reconnect'
                  ? <button type="button" className="of-tile-action !mt-0" onClick={() => void start()} data-google-reconnect>Reconnect</button>
                  : <button type="button" className="of-tile-action !mt-0" onClick={() => onPick(a.id)} data-google-choose>Choose calendars</button>}
                <button type="button" className="min-h-11 text-sm text-[#8a3b2e] underline underline-offset-4" disabled={busy === a.id} onClick={() => void disconnect(a)} data-google-disconnect>
                  {busy === a.id ? 'Disconnecting…' : confirm === a.id ? 'Tap again to disconnect' : 'Disconnect'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <style>{`.google-connect{gap:.6rem}`}</style>
    </section>
  );
}

/** "G", in Google's colors, so she recognizes the button (no Google trademark text in our own words). */
function GoogleMark({ small }: { small?: boolean }) {
  const s = small ? 16 : 20;
  return (
    <svg aria-hidden="true" width={s} height={s} viewBox="0 0 48 48" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Choose which of a Google account's calendars to show, whose each is, and who sees it. */
export function GooglePicker(props: {
  account: GoogleAccount | null; people: Household['members']; colors: Record<string, MarkerColor>; onClose: () => void; onSaved: (msg: string) => Promise<void>;
}) {
  return <PickerBody key={props.account?.id ?? 'none'} {...props} />;
}

interface Choice { on: boolean; member_id: string | null; visibility: FeedVisibility }

function PickerBody({ account, people, colors, onClose, onSaved }: {
  account: GoogleAccount | null; people: Household['members']; colors: Record<string, MarkerColor>; onClose: () => void; onSaved: (msg: string) => Promise<void>;
}) {
  const [cals, setCals] = useState<GoogleCalendarChoice[] | null>(null);
  const [missing, setMissing] = useState<{ id: string; name: string }[]>([]);
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'reconnect' | 'error'>('loading');
  useEffect(() => {
    if (!account) return;
    googleApi.calendars(account.id).then((r) => {
      setCals(r.calendars);
      setMissing(r.missing);
      setChoice(Object.fromEntries(r.calendars.map((c) => [c.id, { on: c.imported, member_id: c.member_id, visibility: c.visibility }])));
      setState('ready');
    }).catch((e) => setState((e as Error).message === 'reconnect' ? 'reconnect' : 'error'));
  }, [account]);
  const set = (id: string, patch: Partial<Choice>) => setChoice((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const chosen = (cals ?? []).filter((c) => choice[c.id]?.on);
  const save = async () => {
    if (!account || !cals) return;
    setState('saving');
    try {
      const feeds = await googleApi.select(account.id, chosen.map((c) => ({ id: c.id, name: c.name, member_id: choice[c.id].member_id, visibility: choice[c.id].visibility, timezone: c.time_zone })));
      // Fetch their events now (the scheduled refresh keeps them up to date afterwards).
      await Promise.all(feeds.map((f) => feedsApi.refresh(f.id).catch(() => null)));
      await onSaved(chosen.length ? `${chosen.length} Google ${chosen.length === 1 ? 'calendar is' : 'calendars are'} on your family calendar.` : 'No Google calendars are shown now.');
    } catch {
      setState('ready');
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="google-picker-h" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="family-brand flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-[var(--of-bg)] shadow-xl sm:rounded-[14px]" data-google-picker>
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="google-picker-h" className="font-serif text-[1.5rem] text-warm-ink">Choose calendars</h2>
            <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-warm-soft underline underline-offset-4">Cancel</button>
          </div>
          <p className="mt-1 text-[0.9rem] text-warm-soft">{account?.email ?? 'Your Google account'} · read-only. New calendars are private until you share them.</p>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto px-5 pb-3">
          {state === 'loading' && <p className="text-sm text-warm-soft" role="status">Getting your calendars from Google…</p>}
          {state === 'reconnect' && <p className="family-note text-sm">Google stopped accepting this connection. Close this and tap Reconnect.</p>}
          {state === 'error' && <p className="family-note text-sm">Google didn’t answer. Try again in a minute.</p>}
          {cals && (
            <ul className="space-y-2">
              {cals.map((c) => {
                const ch = choice[c.id] ?? { on: false, member_id: null, visibility: 'private' as FeedVisibility };
                return (
                  <li key={c.id} className={`of-tile !p-0 ${ch.on ? '!border-warm-ink' : ''}`} data-google-calendar={c.name}>
                    <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-3">
                      <input type="checkbox" className="size-5 shrink-0 accent-[var(--of-sage-ink)]" checked={ch.on} onChange={(e) => set(c.id, { on: e.target.checked })} data-google-check />
                      <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-full" style={{ background: c.color ?? '#9aab8f' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.name}</span>
                        {c.primary && <span className="block text-[0.75rem] text-warm-soft">Your main Google calendar</span>}
                      </span>
                    </label>
                    {ch.on && (
                      <div className="border-t border-[var(--of-rule)] px-4 pt-2 pb-4">
                        <p className="label mt-1">WHOSE CALENDAR</p>
                        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Whose calendar is ${c.name}`}>
                          <button type="button" aria-pressed={ch.member_id === null} onClick={() => set(c.id, { member_id: null })} className={`min-h-[44px] rounded-[8px] border px-3 text-sm ${ch.member_id === null ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>Whole family</button>
                          {people.map((m) => (
                            <button key={m.id} type="button" aria-pressed={ch.member_id === m.id} onClick={() => set(c.id, { member_id: m.id })} data-google-member={m.firstName}
                              className={`inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border px-3 text-sm ${ch.member_id === m.id ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>
                              <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colors[m.id]?.hex }} />{m.firstName}
                            </button>
                          ))}
                        </div>
                        <p className="label mt-3">WHO SEES IT</p>
                        <div className="of-seg mt-2" role="group" aria-label={`Who sees ${c.name}`}>
                          <button type="button" aria-pressed={ch.visibility === 'private'} onClick={() => set(c.id, { visibility: 'private' })} data-google-visibility="private">Only me</button>
                          <button type="button" aria-pressed={ch.visibility === 'household'} onClick={() => set(c.id, { visibility: 'household' })} data-google-visibility="household">Our household</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {missing.length > 0 && <p className="mt-3 text-[0.8rem] text-warm-soft" data-google-missing>No longer in your Google account, removed when you save: {missing.map((m) => m.name).join(', ')}.</p>}
        </div>
        <div className="border-t border-[var(--of-rule)] px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" className="of-btn of-btn--block" disabled={!cals || state === 'saving'} onClick={() => void save()} data-google-save>
            {state === 'saving' ? 'Adding your calendars…' : chosen.length ? `Show ${chosen.length} ${chosen.length === 1 ? 'calendar' : 'calendars'}` : 'Show none'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** iPhone app: after Google's sheet closes (Done, or the app returns to the foreground), pick up a new connection. */
export function useGoogleReturn(reload: () => Promise<GoogleAccount[] | void>, onNew: (accountId: string) => void) {
  useEffect(() => {
    if (!isNativeApp()) return;
    const check = async () => {
      let since = 0;
      try { since = Number(sessionStorage.getItem(PENDING) ?? 0); } catch { /* none */ }
      if (!since) return;
      const accounts = await reload();
      const fresh = (accounts ?? []).filter((a) => a.calendars === 0 || Date.parse(a.created_at) >= since - 60_000);
      if (fresh.length) {
        try { sessionStorage.removeItem(PENDING); } catch { /* fine */ }
        onNew(fresh[fresh.length - 1].id);
      }
    };
    const onResume = () => void check();
    window.addEventListener(APP_RESUME_EVENT, onResume);
    let remove: (() => void) | null = null;
    void import('@capacitor/browser').then(({ Browser }) => Browser.addListener('browserFinished', onResume)).then((h) => { remove = () => void h.remove(); }).catch(() => {});
    return () => { window.removeEventListener(APP_RESUME_EVENT, onResume); remove?.(); };
  }, [reload, onNew]);
}

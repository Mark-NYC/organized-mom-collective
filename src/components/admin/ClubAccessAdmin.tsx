/**
 * /admin/club → Club access (owner admins): find a person by email, see their household and whether it has Free,
 * Complimentary Club or Paid Club access, and grant, revoke or set an expiry on complimentary access.
 *
 * Everything goes through the club_admin_access_* database functions (supabase/migrations/
 * 20261208000000_club_complimentary_access.sql): each checks is_admin('owner') itself and writes the append-only audit
 * log. Nothing here can change a paid membership: Stripe stays the billing record (Members tab).
 */
import { useState } from 'react';
import { adminInput, type AdminContext } from './AdminGate';
import { adminRpc } from '../../lib/admin/session';

export type AccessStatus = 'free' | 'complimentary' | 'paid' | 'paid_and_complimentary';

export interface AccessSummary {
  user_id: string;
  email: string;
  signed_up_at: string | null;
  household: {
    id: string; display_name: string | null; owner_user_id: string; children: number;
    adults: { user_id: string; email: string; role: 'owner' | 'partner'; club_access: boolean }[];
  } | null;
  status: AccessStatus;
  paid: { plan: string | null; status: string; current_period_end: string | null; cancel_at_period_end: boolean; revoked: boolean } | null;
  grant: {
    on: string; reason: 'preview' | 'beta' | 'complimentary'; note: string | null; live: boolean;
    granted_at: string; granted_by: string | null; expires_at: string | null; expired: boolean;
    revoked_at: string | null; revoked_by: string | null; updated_at: string;
  } | null;
  history?: { at: string; by: string | null; action: string; detail: Record<string, unknown> }[];
}

export const STATUS_LABEL: Record<AccessStatus, string> = {
  free: 'Free',
  complimentary: 'Complimentary Club',
  paid: 'Paid Club',
  paid_and_complimentary: 'Paid Club + Complimentary',
};
const STATUS_CLASS: Record<AccessStatus, string> = {
  free: 'admin-status',
  complimentary: 'admin-status admin-status--info',
  paid: 'admin-status admin-status--success',
  paid_and_complimentary: 'admin-status admin-status--success',
};
const ACTION_LABEL: Record<string, string> = {
  'club.access.grant': 'Granted',
  'club.access.revoke': 'Revoked',
  'club.access.expiry': 'Expiry changed',
};
const ERRORS: Record<string, string> = {
  invalid: 'Check the details: an expiry must be in the future, a note at most 200 characters, a search at least 3 characters.',
  not_granted: 'There is no live complimentary access to change.',
  not_found: 'That account no longer exists.',
  forbidden: 'Only an owner admin can change Club access.',
  rate_limited: 'Too many changes in a minute. Wait a moment.',
};
const errorText = (e: Error) => ERRORS[e.message] ?? e.message;

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '–');
/** A date picked in the form (YYYY-MM-DD) means "through the end of that day", in the admin's time zone. */
export const endOfDay = (date: string) => new Date(`${date}T23:59:59`).toISOString();
const dateValue = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');

export default function ClubAccessAdmin({ session, signOut }: AdminContext) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AccessSummary[] | null>(null);
  const [picked, setPicked] = useState<AccessSummary | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = (e: Error) => (e.message === 'expired' ? signOut() : setErr(errorText(e)));

  const search = async () => {
    setErr('');
    if (q.trim().length < 3) return setErr('Type at least 3 characters of an email.');
    setBusy(true);
    try {
      setRows(await adminRpc<AccessSummary[]>(session, 'club_admin_access_search', { p_query: q.trim() }));
      setPicked(null);
    } catch (e) { fail(e as Error); } finally { setBusy(false); }
  };
  const open = async (userId: string) => {
    setErr('');
    try { setPicked(await adminRpc<AccessSummary>(session, 'club_admin_access_detail', { p_user: userId })); } catch (e) { fail(e as Error); }
  };
  const changed = (s: AccessSummary) => {
    setPicked(s);
    setRows((r) => r?.map((x) => (x.user_id === s.user_id || (x.household && x.household.id === s.household?.id) ? { ...x, status: s.status, grant: s.grant } : x)) ?? r);
  };

  return (
    <div data-club-access>
      <p className="text-[0.9rem] text-soft">Family Meeting Club by invitation: give a household complimentary access, without charging them. Paid memberships are managed in Stripe (Members tab) and are never changed here.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void search(); }} role="search">
        <label className="block min-w-[260px] flex-1"><span className="label">Find by email</span>
          <input type="search" className={adminInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="name@example.com or part of it" autoComplete="off" data-access-search />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {err && <p role="alert" className="mt-3">{err}</p>}
      {rows && (
        rows.length === 0 ? <p className="mt-4 text-soft">No account with that email.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[0.9rem]" data-access-results>
              <thead><tr className="border-b border-rule"><th className="py-2">Account</th><th>Household</th><th>Access</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-b border-rule align-top">
                    <td className="py-2">{r.email}</td>
                    <td>{r.household ? `${r.household.display_name ?? 'Unnamed family'} · ${r.household.adults.length} adult${r.household.adults.length === 1 ? '' : 's'}` : <span className="text-soft">No family set up yet</span>}</td>
                    <td><span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                    <td><button type="button" className="underline" onClick={() => void open(r.user_id)} data-access-open={r.email}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {picked && <AccessDetail s={picked} session={session} onChange={changed} onError={fail} />}
    </div>
  );
}

function AccessDetail({ s, session, onChange, onError }: { s: AccessSummary; session: AdminContext['session']; onChange: (s: AccessSummary) => void; onError: (e: Error) => void }) {
  const live = Boolean(s.grant?.live);
  const [expiry, setExpiry] = useState(dateValue(live ? s.grant!.expires_at : null));
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: string, args: Record<string, unknown>, done: string) => {
    setBusy(true); setMsg('');
    try {
      const r = await adminRpc<AccessSummary>(session, fn, { p_user: s.user_id, ...args });
      onChange(r);
      setNote('');
      setExpiry(dateValue(r.grant?.live ? r.grant.expires_at : null));
      setMsg(done);
    } catch (e) { onError(e as Error); } finally { setBusy(false); }
  };
  const who = s.household ? (s.household.display_name ?? 'this family') : s.email;
  const grant = () => {
    if (!confirm(`Give ${who} complimentary Family Meeting Club access${expiry ? ` until ${expiry}` : ''}? Both adults of the household get access. Nobody is charged.`)) return;
    void run('club_admin_access_grant', { p_expires_at: expiry ? endOfDay(expiry) : null, p_note: note.trim() || null }, 'Granted. The household has Club access now. Recorded in the audit log.');
  };
  const revoke = () => {
    if (!confirm(`End complimentary Club access for ${who}? Their family, agreements and history stay.${s.status === 'paid_and_complimentary' ? ' They keep their paid membership.' : ''}`)) return;
    void run('club_admin_access_revoke', { p_note: note.trim() || null }, s.status === 'paid_and_complimentary' ? 'Revoked. They still have Paid Club.' : 'Revoked. The Club is closed for this household; their family data is kept.');
  };
  const saveExpiry = (clear: boolean) =>
    void run('club_admin_access_expiry', { p_expires_at: clear || !expiry ? null : endOfDay(expiry) }, clear || !expiry ? 'Expiry removed.' : `Expires at the end of ${expiry}.`);

  return (
    <section className="mt-6 rounded-[8px] border border-rule bg-paper p-4" aria-labelledby="access-detail-h" data-access-detail={s.email}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="access-detail-h" className="text-[1.05rem] font-semibold">{s.email}</h3>
        <span className={STATUS_CLASS[s.status]} data-access-status={s.status}>{STATUS_LABEL[s.status]}</span>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-semibold">Household</p>
          {s.household ? (
            <>
              <p className="text-[0.9rem]">{s.household.display_name ?? 'Unnamed family'} · {s.household.children} child{s.household.children === 1 ? '' : 'ren'}</p>
              <ul className="mt-1 text-[0.9rem]">
                {s.household.adults.map((a) => <li key={a.user_id}>{a.email} <span className="text-soft">({a.role === 'owner' ? 'set up the family' : 'second adult'}) · {a.club_access ? 'has Club' : 'no Club'}</span></li>)}
              </ul>
            </>
          ) : <p className="text-[0.9rem] text-soft">No family set up yet. Access goes on this account and covers the family they create.</p>}
          <p className="mt-3 font-semibold">Paid membership</p>
          <p className="text-[0.9rem]">{s.paid ? `${s.paid.plan ?? 'plan'} · ${s.paid.status}${s.paid.cancel_at_period_end ? ` (ends ${when(s.paid.current_period_end)})` : ''}${s.paid.revoked ? ' · access revoked' : ''}` : 'None'}</p>
        </div>
        <div>
          <p className="font-semibold">Complimentary access</p>
          {s.grant ? (
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.9rem]">
              <dt className="text-soft">State</dt><dd>{s.grant.live ? 'Active' : s.grant.revoked_at ? 'Revoked' : s.grant.expired ? 'Expired' : 'Ended'}{s.grant.reason !== 'complimentary' ? ` (${s.grant.reason})` : ''}</dd>
              <dt className="text-soft">Granted</dt><dd>{when(s.grant.granted_at)}{s.grant.granted_by ? ` by ${s.grant.granted_by}` : ''}</dd>
              <dt className="text-soft">Expires</dt><dd>{s.grant.expires_at ? when(s.grant.expires_at) : 'Never'}</dd>
              {s.grant.revoked_at && <><dt className="text-soft">Revoked</dt><dd>{when(s.grant.revoked_at)}{s.grant.revoked_by ? ` by ${s.grant.revoked_by}` : ''}</dd></>}
              {s.grant.note && <><dt className="text-soft">Note</dt><dd>{s.grant.note}</dd></>}
            </dl>
          ) : <p className="text-[0.9rem] text-soft">Never granted.</p>}

          <div className="mt-3 space-y-2">
            <label className="block"><span className="label">{live ? 'Expiry date' : 'Expiry date (optional)'}</span>
              <input type="date" className={adminInput} value={expiry} min={new Date().toLocaleDateString('en-CA')} onChange={(e) => setExpiry(e.target.value)} data-access-expiry />
            </label>
            <label className="block"><span className="label">Note (optional, kept in the log)</span>
              <input className={adminInput} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Beta family, App Review account" data-access-note />
            </label>
            <div className="flex flex-wrap gap-3">
              {!live && <button type="button" className="btn-primary" disabled={busy} onClick={grant} data-access-grant>Grant complimentary Club</button>}
              {live && <button type="button" className="btn-primary" disabled={busy} onClick={() => saveExpiry(false)} data-access-save-expiry>Save expiry</button>}
              {live && s.grant?.expires_at && <button type="button" className="underline" disabled={busy} onClick={() => saveExpiry(true)} data-access-clear-expiry>Remove expiry</button>}
              {live && <button type="button" className="underline" disabled={busy} onClick={revoke} data-access-revoke>Revoke complimentary access</button>}
            </div>
          </div>
        </div>
      </div>
      {msg && <p role="status" className="mt-3" data-access-msg>{msg}</p>}
      {s.history && s.history.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold">History</p>
          <ul className="mt-1 text-[0.85rem]" data-access-history>
            {s.history.map((h, i) => (
              <li key={h.at + i}>{when(h.at)} · {ACTION_LABEL[h.action] ?? h.action}{h.by ? ` by ${h.by}` : ''}
                {typeof h.detail.expires_at === 'string' ? ` · until ${when(h.detail.expires_at)}` : ''}{typeof h.detail.note === 'string' ? ` · “${h.detail.note}”` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

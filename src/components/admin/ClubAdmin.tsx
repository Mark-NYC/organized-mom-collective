/**
 * /admin/club (owner admins): Organized Family Club members, billing state, paid months, the monthly fulfillment
 * queue, kit publishing, email batches, Stripe setup. Reads and changes go through the club_admin_* database
 * functions (owner check and audit log in the database) and the club-admin Edge Function (Stripe, Resend). Children's
 * names appear only in a mailing's print view, one household at a time (audited).
 */
import { Fragment, useEffect, useState } from 'react';
import AdminGate, { adminInput, type AdminContext } from './AdminGate';
import { adminRpc, adminSelect } from '../../lib/admin/session';
import { routes } from '../../routes';
import { clubResourceBySlug } from '../../data/club/resources';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../lib/supabase-config';

const SUPABASE = SUPABASE_URL;
const ANON = SUPABASE_ANON_KEY;

async function clubAdmin<T = Record<string, unknown>>(token: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE}/functions/v1/club-admin`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('expired');
  if (!res.ok) throw new Error(String(data.error ?? `error_${res.status}`));
  return data as T;
}

interface Member {
  user_id: string;
  email: string;
  display_name: string | null;
  enrolled_at: string | null;
  first_paid_month: string | null;
  onboarded: boolean;
  adults: number;
  children: number;
  child_birth_years: number[];
  plan: string | null;
  status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  ended_at: string | null;
  livemode: boolean | null;
  flags: string[] | null;
  revoked: boolean;
  payment_problem: boolean;
  stripe_subscription_id: string | null;
  months: string[];
  address: { name: string; line1: string; line2: string | null; city: string; state: string; postal_code: string; paused: boolean } | null;
}

interface Order {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  resource_month: string;
  kit_slug: string | null;
  status: string;
  readiness: string;
  late: boolean;
  pdf_status: string;
  member_approved_at: string | null;
  mailed_at: string | null;
  note: string | null;
  address: Record<string, string> | null;
}

const NEXT: Record<string, string[]> = {
  pending: ['approved', 'on_hold', 'skipped'],
  on_hold: ['pending', 'skipped'],
  approved: ['printed', 'pending', 'on_hold'],
  printed: ['mailed'],
  mailed: ['returned'],
  returned: ['approved', 'skipped'],
  skipped: ['pending'],
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–');
const month = (iso: string) => iso.slice(0, 7);
// Cutoffs are New York deadlines: shown in New York time wherever the owner is.
const deadline = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '–';
const monthName = (iso: string) => new Date(`${iso.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const ORDINALS: [number, string][] = [[1, 'first'], [2, 'second'], [3, 'third'], [4, 'fourth'], [-1, 'last']];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function ClubAdmin() {
  return <AdminGate>{(ctx) => <Club {...ctx} />}</AdminGate>;
}

function Club(ctx: AdminContext) {
  const [tab, setTab] = useState<'members' | 'fulfillment' | 'kits' | 'setup'>('members');
  return (
    <div>
      <h1 className="page-title">Organized Family Club</h1>
      <nav className="mt-4 flex flex-wrap gap-4 text-[0.95rem]" aria-label="Club admin">
        {(['members', 'fulfillment', 'kits', 'setup'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? 'font-semibold underline underline-offset-4' : 'text-soft underline-offset-4 hover:underline'}>
            {t === 'members' ? 'Members' : t === 'fulfillment' ? 'Fulfillment' : t === 'kits' ? 'Monthly resources' : 'Setup & emails'}
          </button>
        ))}
      </nav>
      <div className="mt-6">
        {tab === 'members' && <Members {...ctx} />}
        {tab === 'fulfillment' && <Fulfillment {...ctx} />}
        {tab === 'kits' && <Kits {...ctx} />}
        {tab === 'setup' && <Setup {...ctx} />}
      </div>
    </div>
  );
}

function Members({ session, signOut }: AdminContext) {
  const [status, setStatus] = useState('');
  const [m, setM] = useState('');
  const [rows, setRows] = useState<Member[] | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const load = () =>
    adminRpc<Member[]>(session, 'club_admin_members', { p_status: status || null, p_month: m ? `${m}-01` : null }).then(setRows, (e: Error) => (e.message === 'expired' ? signOut() : setErr(e.message)));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, m]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block"><span className="label">Status</span>
          <select className={adminInput} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="active">Active</option><option value="canceling">Canceling</option><option value="problem">Payment problem</option>
            <option value="canceled">Canceled</option><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="no_profile">No family profile</option>
          </select></label>
        <label className="block"><span className="label">Has month</span><input type="month" className={adminInput} value={m} onChange={(e) => setM(e.target.value)} /></label>
        {rows && <p className="pb-2 text-soft">{rows.length} household{rows.length === 1 ? '' : 's'}</p>}
      </div>
      {err && <p role="alert" className="mt-4">{err}</p>}
      {rows && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[0.9rem]">
            <thead><tr className="border-b border-rule"><th className="py-2">Member</th><th>Plan · status</th><th>Joined</th><th>Paid months</th><th>Profile</th><th>Address</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.user_id}>
                  <tr className="border-b border-rule align-top">
                    <td className="py-2">{r.email}<br /><span className="text-soft">{r.display_name ?? ''}</span>{r.livemode === false && <span className="ml-1 text-soft">· test</span>}</td>
                    <td>{r.plan ?? '–'} · {r.status ?? 'no subscription'}{r.cancel_at_period_end ? ` (ends ${day(r.current_period_end)})` : ''}
                      {r.payment_problem && <><br /><strong>Payment problem</strong></>}{r.revoked && <><br /><strong>Access revoked</strong></>}
                      {r.flags?.length ? <><br /><span className="text-soft">{r.flags.join(', ')}</span></> : null}</td>
                    <td>{day(r.enrolled_at)}<br /><span className="text-soft">from {r.first_paid_month ? month(r.first_paid_month) : '–'}</span></td>
                    <td>{r.months.length ? `${month(r.months[0])} … ${month(r.months[r.months.length - 1])} (${r.months.length})` : '–'}</td>
                    <td>{r.onboarded ? `${r.adults} adult${r.adults === 1 ? '' : 's'}, kids born ${r.child_birth_years.join(', ') || '–'}` : <strong>Not yet</strong>}</td>
                    <td>{r.address ? `${r.address.city}, ${r.address.state}${r.address.paused ? ' (paused)' : ''}` : <strong>Missing</strong>}</td>
                    <td><button type="button" className="underline" onClick={() => setOpen(open === r.user_id ? null : r.user_id)}>{open === r.user_id ? 'Close' : 'Manage'}</button></td>
                  </tr>
                  {open === r.user_id && <tr><td colSpan={7} className="bg-paper p-4"><MemberTools member={r} session={session} onDone={load} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function MemberTools({ member, session, onDone }: { member: Member; session: AdminContext['session']; onDone: () => void }) {
  const [mon, setMon] = useState('');
  const [kind, setKind] = useState('digital');
  const [action, setAction] = useState('grant');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const override = async () => {
    if (!mon || !note.trim()) return setMsg('Pick a month and write why.');
    if (!confirm(`${action === 'grant' ? 'Grant' : 'Revoke'} ${kind} ${mon} for ${member.email}?`)) return;
    try {
      const r = await adminRpc<{ changed: number }>(session, 'club_admin_entitlement', { p_user: member.user_id, p_month: `${mon}-01`, p_kind: kind, p_action: action, p_note: note.trim() });
      setMsg(r.changed ? 'Done. Recorded in the audit log.' : 'Nothing changed (already that way).');
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const resync = async () => {
    if (!member.stripe_subscription_id) return;
    try {
      const r = await clubAdmin<{ status: string }>(session.access_token, { action: 'resync', subscription: member.stripe_subscription_id });
      setMsg(`Re-read from Stripe: ${r.status}`);
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="font-semibold">Entitlement override</p>
        <p className="text-[0.85rem] text-soft">For goodwill, a refund of part of a year, or a correction. Every override needs a note and goes in the audit log. Refunds made in Stripe revoke their months by themselves.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="month" className={adminInput} value={mon} onChange={(e) => setMon(e.target.value)} />
          <select className={adminInput} value={kind} onChange={(e) => setKind(e.target.value)}><option value="digital">Digital</option><option value="physical">Printed mailing</option></select>
          <select className={adminInput} value={action} onChange={(e) => setAction(e.target.value)}><option value="grant">Grant</option><option value="revoke">Revoke</option></select>
        </div>
        <input className={adminInput} placeholder="Why (required)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="btn-primary mt-2" onClick={override}>Apply</button>
      </div>
      <div>
        <p className="font-semibold">Billing</p>
        <p className="text-[0.85rem] text-soft">Stripe is the billing record. Refund or cancel in Stripe (or the member’s Billing Portal); the webhook updates access.</p>
        {member.stripe_subscription_id && <button type="button" className="mt-2 underline" onClick={resync}>Re-read from Stripe</button>}
        {member.address && <p className="mt-3 text-[0.9rem]">{member.address.name}<br />{member.address.line1}{member.address.line2 ? `, ${member.address.line2}` : ''}<br />{member.address.city}, {member.address.state} {member.address.postal_code}</p>}
      </div>
      {msg && <p role="status" className="sm:col-span-2">{msg}</p>}
    </div>
  );
}

function Fulfillment({ session, signOut }: AdminContext) {
  const [m, setM] = useState(thisMonth().slice(0, 7));
  const [rows, setRows] = useState<Order[] | null>(null);
  const [err, setErr] = useState('');
  const load = () => adminRpc<Order[]>(session, 'club_admin_fulfillment', { p_month: `${m}-01` }).then(setRows, (e: Error) => (e.message === 'expired' ? signOut() : setErr(e.message)));
  const [cutoff, setCutoff] = useState<Cutoff | null>(null);
  useEffect(() => {
    load();
    adminRpc<Cutoff[]>(session, 'club_admin_cutoffs', { p_from: `${m}-01`, p_count: 1 }).then((r) => setCutoff(r[0] ?? null), () => setCutoff(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);
  const set = async (o: Order, status: string) => {
    const note = status === 'skipped' || status === 'on_hold' || status === 'returned' ? prompt('Note (why):') ?? '' : null;
    try {
      await adminRpc(session, 'club_admin_set_fulfillment', { p_order: o.id, p_status: status, p_note: note || null, p_pdf: null });
      load();
    } catch (e) {
      alert((e as Error).message === 'not_ready' ? 'Not ready: it needs a profile, an address, a published resource and a ready PDF first.' : (e as Error).message);
    }
  };
  const csv = () => {
    const ready = (rows ?? []).filter((o) => o.status === 'approved');
    const head = ['order_id', 'month', 'resource', 'name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'late'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(','), ...ready.map((o) => [o.id, month(o.resource_month), o.kit_slug, o.address?.name, o.address?.line1, o.address?.line2, o.address?.city, o.address?.state, o.address?.postal_code, o.late].map(esc).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `club-mailing-${m}.csv`;
    a.click();
  };
  const counts = (rows ?? []).reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.readiness]: (acc[o.readiness] ?? 0) + 1 }), {});
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block"><span className="label">Delivery month</span><input type="month" className={adminInput} value={m} onChange={(e) => setM(e.target.value)} /></label>
        <button type="button" className="underline" onClick={csv}>Download approved addresses (CSV)</button>
        <p className="pb-2 text-soft">{Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
      </div>
      {cutoff && (
        <p className="mt-3 text-[0.95rem]">
          {monthName(cutoff.month)}’s list {new Date(cutoff.cutoff_at) < new Date() ? 'closed' : 'closes'} <strong>{deadline(cutoff.cutoff_at)}</strong>
          {cutoff.launch_exception_cutoff_at && <> · launch exception open until <strong>{deadline(cutoff.launch_exception_cutoff_at)}</strong></>}
        </p>
      )}
      <p className="mt-2 max-w-3xl text-[0.85rem] text-soft">Pipeline: paid month → family profile → address → published resource → print view, Save as PDF, mark PDF ready → Approve (freezes the address) → Printed → Mailed. Payments earn the earliest month whose list is still open, so a month’s list is complete once it closes. Late = added by hand after the list closed: mail it in a catch-up batch.</p>
      {err && <p role="alert" className="mt-4">{err}</p>}
      {rows && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[0.9rem]">
            <thead><tr className="border-b border-rule"><th className="py-2">Household</th><th>Readiness</th><th>Status</th><th>Member review</th><th>Address</th><th>Print</th><th>Move to</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-rule align-top">
                  <td className="py-2">{o.display_name ?? o.email}<br /><span className="text-soft">{o.email}</span>{o.late && <><br /><strong>Late</strong></>}</td>
                  <td>{o.readiness}{o.pdf_status === 'ready' ? ' · PDF ✓' : ''}</td>
                  <td>{o.status}{o.mailed_at ? ` ${day(o.mailed_at)}` : ''}{o.note && <><br /><span className="text-soft">{o.note}</span></>}</td>
                  <td>{o.member_approved_at ? `Approved ${day(o.member_approved_at)}` : '–'}</td>
                  <td>{o.address ? `${o.address.city}, ${o.address.state}` : '–'}</td>
                  <td>{o.kit_slug && clubResourceBySlug(o.kit_slug) ? <a className="underline" href={`${routes.clubResource(o.kit_slug)}?fulfillment=${o.id}`}>Print view</a> : '–'}</td>
                  <td className="space-x-2">{(NEXT[o.status] ?? []).map((s) => <button key={s} type="button" className="underline" onClick={() => set(o, s)}>{s}</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="mt-4 text-soft">No mailings for this month.</p>}
        </div>
      )}
    </>
  );
}

function Kits({ session }: AdminContext) {
  const [kits, setKits] = useState<{ slug: string; month: string; title: string; status: string; mailer_cutoff_at: string }[] | null>(null);
  const load = () => adminSelect<{ slug: string; month: string; title: string; status: string; mailer_cutoff_at: string }>(session, 'club_kits', 'select=slug,month,title,status,mailer_cutoff_at&order=month').then(setKits);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = async (slug: string, status: string) => {
    if (!confirm(status === 'scheduled' ? `Publish ${slug}? Members entitled to that month can open it.` : `Take ${slug} back to draft? Members can’t open it until it’s published again.`)) return;
    await adminRpc(session, 'club_admin_kit_status', { p_slug: slug, p_status: status });
    load();
  };
  return (
    <>
      <p className="max-w-3xl text-[0.9rem] text-soft">A draft opens for nobody, whatever they paid for. Publish a month once its printable and letter are final; entitled members can then open it (annual members can open future months they own).</p>
      <table className="mt-4 w-full text-left text-[0.9rem]">
        <thead><tr className="border-b border-rule"><th className="py-2">Month</th><th>Resource</th><th>Mailing list closes</th><th>Status</th><th /></tr></thead>
        <tbody>
          {kits?.map((k) => (
            <tr key={k.slug} className="border-b border-rule">
              <td className="py-2">{month(k.month)}</td>
              <td>{clubResourceBySlug(k.slug)?.title ?? k.title}<br /><span className="text-soft">{k.slug}{clubResourceBySlug(k.slug) ? '' : ' · no member page yet'}</span></td>
              <td>{deadline(k.mailer_cutoff_at)}</td>
              <td>{k.status}</td>
              <td>{k.status === 'draft' ? <button type="button" className="underline" onClick={() => set(k.slug, 'scheduled')}>Publish</button> : <button type="button" className="underline" onClick={() => set(k.slug, 'draft')}>Back to draft</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

interface Status {
  stripe_key: 'test' | 'live' | null;
  stripe_blocked: string | null;
  live_switch: boolean;
  webhook_secret: boolean;
  resend: boolean;
  prices: { monthly: boolean; annual: boolean } | null;
  settings: {
    checkout_mode: string;
    first_mailing_month: string;
    cutoff_ordinal: number;
    cutoff_weekday: number;
    launch_exception_month: string | null;
    launch_exception_cutoff_at: string | null;
    member_review: boolean;
    portal_configuration_id: string | null;
  };
  webhook_url: string;
}

interface Cutoff { month: string; cutoff_at: string; cutoff_date: string; launch_exception_cutoff_at: string | null }

/** The cutoff rule, the next months' calculated deadlines, and the one-time launch exception. */
function Cutoffs({ session, settings, save }: { session: AdminContext['session']; settings: Status['settings']; save: (p: Record<string, unknown>) => Promise<void> }) {
  const [rows, setRows] = useState<Cutoff[] | null>(null);
  const [launchDay, setLaunchDay] = useState('');
  useEffect(() => {
    adminRpc<Cutoff[]>(session, 'club_admin_cutoffs', { p_from: thisMonth(), p_count: 7 }).then(setRows, () => setRows([]));
  }, [session, settings]);
  const ordinal = ORDINALS.find(([n]) => n === settings.cutoff_ordinal)?.[1] ?? '';
  const rule = `${ordinal} ${WEEKDAYS[settings.cutoff_weekday]}`;
  return (
    <section>
      <h2 className="label">Mailing cutoff</h2>
      <p className="mt-2 text-[0.95rem]">Each month’s printed mailing list closes at <strong>11:59 pm New York time on the {rule}</strong> of the month before. A payment made before a month’s list closes earns that month’s mailing; after it, the next open month’s. Digital access never depends on it.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block"><span className="label">Which</span>
          <select className={adminInput} value={settings.cutoff_ordinal} onChange={(e) => save({ cutoff_ordinal: Number(e.target.value) })}>
            {ORDINALS.map(([n, name]) => <option key={n} value={n}>{name}</option>)}
          </select></label>
        <label className="block"><span className="label">Weekday</span>
          <select className={adminInput} value={settings.cutoff_weekday} onChange={(e) => save({ cutoff_weekday: Number(e.target.value) })}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select></label>
      </div>
      <table className="mt-4 w-full text-left text-[0.9rem]">
        <thead><tr className="border-b border-rule"><th className="py-2">Mailing for</th><th>List closes</th></tr></thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.month} className="border-b border-rule">
              <td className="py-2">{monthName(r.month)}</td>
              <td>
                {deadline(r.cutoff_at)}
                {r.launch_exception_cutoff_at && <><br /><strong>Launch exception: open until {deadline(r.launch_exception_cutoff_at)}</strong> for families whose payment covers {monthName(r.month)}</>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="label mt-6">Launch exception (one time)</h3>
      {settings.launch_exception_month && settings.launch_exception_cutoff_at ? (
        <p className="mt-2 text-[0.95rem]">
          On: families who pay for {monthName(settings.launch_exception_month)} by <strong>{deadline(settings.launch_exception_cutoff_at)}</strong> also get its printed mailing, on top of their regular one. Every other month follows the rule.{' '}
          <button type="button" className="underline" onClick={() => confirm('Turn the launch exception off? Payments after this won’t add its month’s mailing.') && save({ launch_exception_month: null, launch_exception_cutoff_at: null })}>Turn off</button>
        </p>
      ) : (
        <p className="mt-2 text-[0.95rem]">Off. Every month follows the rule.</p>
      )}
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="block"><span className="label">{settings.launch_exception_month ? 'Move the deadline to' : 'Open the first mailing month until'}</span>
          <input type="date" className={adminInput} value={launchDay} onChange={(e) => setLaunchDay(e.target.value)} /></label>
        <button type="button" className="underline" disabled={!launchDay} onClick={() => save({
          launch_exception_month: settings.launch_exception_month ?? settings.first_mailing_month,
          launch_exception_cutoff_at: `${launchDay} 23:59:59 America/New_York`,
        })}>Save (11:59 pm New York time that day)</button>
      </div>
    </section>
  );
}

function Setup({ session }: AdminContext) {
  const [st, setSt] = useState<Status | null>(null);
  const [msg, setMsg] = useState('');
  const [emailMonth, setEmailMonth] = useState(thisMonth().slice(0, 7));
  const load = () => clubAdmin<Status>(session.access_token, { action: 'status' }).then(setSt, (e: Error) => setMsg(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setMsg('Working…');
    try {
      setMsg(JSON.stringify(await clubAdmin(session.access_token, body)));
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const save = async (p: Record<string, unknown>) => {
    try {
      await adminRpc(session, 'club_admin_settings', { p });
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  if (!st) return <p>{msg || 'Loading…'}</p>;
  const yes = (b: boolean) => (b ? '✓' : '✗');
  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h2 className="label">Readiness</h2>
        <ul className="mt-2 space-y-1 text-[0.95rem]">
          <li>{yes(Boolean(st.stripe_key))} Club Stripe key (CLUB_STRIPE_SECRET_KEY): {st.stripe_key ?? 'not set'}{st.stripe_blocked ? ` · ${st.stripe_blocked}` : ''}</li>
          <li>{yes(Boolean(st.prices?.monthly && st.prices?.annual))} Prices: $5/month and $60/year</li>
          <li>{yes(Boolean(st.settings.portal_configuration_id))} Billing Portal configuration</li>
          <li>{yes(st.webhook_secret)} Webhook endpoint ({st.webhook_url})</li>
          <li>{yes(st.resend)} Resend (RESEND_API_KEY)</li>
          <li>{yes(st.live_switch)} Live switch CLUB_LIVE_CHECKOUT=enabled (only after you approve live payments)</li>
        </ul>
        {st.stripe_key && !st.stripe_blocked && (
          <button type="button" className="btn-primary mt-3" onClick={() => run({ action: 'stripe_setup' }, `Create the Club product, prices, portal and webhook in Stripe ${st.stripe_key} mode (anything already there is kept)?`)}>Set up Stripe ({st.stripe_key} mode)</button>
        )}
      </section>
      <section>
        <h2 className="label">Settings</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Checkout</span>
            <select className={adminInput} value={st.settings.checkout_mode} onChange={(e) => {
              if (e.target.value === 'live' && !confirm('Open LIVE checkout? Real cards will be charged. Only after testing and your approval.')) return;
              save({ checkout_mode: e.target.value });
            }}>
              <option value="off">Off: nobody can join</option><option value="test">Test: Stripe test mode only</option><option value="live">Live: real payments</option>
            </select></label>
          <label className="block"><span className="label">First printed mailing month</span>
            <input type="month" className={adminInput} defaultValue={st.settings.first_mailing_month.slice(0, 7)} onBlur={(e) => e.target.value && save({ first_mailing_month: `${e.target.value}-01` })} /></label>
          <label className="flex items-center gap-2 pt-6"><input type="checkbox" checked={st.settings.member_review} onChange={(e) => save({ member_review: e.target.checked })} /> Ask members to review before printing</label>
        </div>
      </section>
      <Cutoffs session={session} settings={st.settings} save={save} />
      <section>
        <h2 className="label">Emails (each member gets each one once)</h2>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <button type="button" className="underline" onClick={() => run({ action: 'send_emails', kind: 'profile_reminder' }, 'Remind members who paid but haven’t added their family?')}>Profile reminders</button>
          <input type="month" className={adminInput} value={emailMonth} onChange={(e) => setEmailMonth(e.target.value)} />
          <button type="button" className="underline" onClick={() => run({ action: 'send_emails', kind: 'resource_ready', month: `${emailMonth}-01` }, `Tell every member with ${emailMonth} that it's ready?`)}>“Resource ready”</button>
          <button type="button" className="underline" onClick={() => run({ action: 'send_emails', kind: 'review', month: `${emailMonth}-01` }, `Ask ${emailMonth} mailing households to review before printing?`)}>“Review before printing”</button>
        </div>
      </section>
      {msg && <pre className="whitespace-pre-wrap break-all bg-paper p-3 text-[0.85rem]">{msg}</pre>}
    </div>
  );
}

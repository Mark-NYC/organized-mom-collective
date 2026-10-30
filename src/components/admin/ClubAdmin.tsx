/**
 * /admin/club (owner admins): Organized Family Club members, billing state, paid months and what fulfills each, the
 * welcome print queue, the monthly fulfillment queue (regular and catch-up batches), kit publishing, email batches,
 * Stripe setup. Reads and changes go through the club_admin_* database
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
  welcome: { status: string; readiness: string; satisfies_month: string | null; mailed_at: string | null } | null;
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
  fulfillment_type: 'monthly_resource' | 'welcome_vision';
  batch: 'regular' | 'catch_up' | 'welcome' | 'welcome_kit';
  satisfies_month: string | null;
  first_paid_month: string | null;
  enrolled_at: string | null;
  vision_value?: string | null;
  family_name?: string | null;
  /** Ships in a Welcome Kit (her welcome print + her first month's resource, one package). */
  in_welcome_kit?: boolean;
  kit_auto_approve_at?: string | null;
  /** On the Welcome Kits list: the kit's first-month order (null: withdrawn, so the kit is held). */
  first_month?: { id: string; resource_month: string; kit_slug: string | null; kit_title: string | null; status: string; pdf_status: string; member_approved_at: string | null } | null;
}

const BATCH: Record<Order['batch'], string> = { regular: 'Regular batch', catch_up: 'Catch-up (paid after the cutoff)', welcome: 'Welcome print', welcome_kit: 'Welcome Kit' };
const printHref = (o: Pick<Order, 'id' | 'kit_slug' | 'fulfillment_type'>) =>
  o.fulfillment_type === 'welcome_vision' ? `${routes.clubFamilyVision}?fulfillment=${o.id}`
    : o.kit_slug && clubResourceBySlug(o.kit_slug) ? `${routes.clubResource(o.kit_slug)}?fulfillment=${o.id}` : null;

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
            <thead><tr className="border-b border-rule"><th className="py-2">Member</th><th>Plan · status</th><th>Joined</th><th>Paid months</th><th>Welcome print</th><th>Profile</th><th>Address</th><th /></tr></thead>
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
                    <td>{r.welcome ? `${r.welcome.status} · ${r.welcome.readiness}` : '–'}{r.welcome?.satisfies_month && <><br /><span className="text-soft">is their {month(r.welcome.satisfies_month)}</span></>}</td>
                    <td>{r.onboarded ? `${r.adults} adult${r.adults === 1 ? '' : 's'}, kids born ${r.child_birth_years.join(', ') || '–'}` : <strong>Not yet</strong>}</td>
                    <td>{r.address ? `${r.address.city}, ${r.address.state}${r.address.paused ? ' (paused)' : ''}` : <strong>Missing</strong>}</td>
                    <td><button type="button" className="underline" onClick={() => setOpen(open === r.user_id ? null : r.user_id)}>{open === r.user_id ? 'Close' : 'Manage'}</button></td>
                  </tr>
                  {open === r.user_id && <tr><td colSpan={8} className="bg-paper p-4"><MemberTools member={r} session={session} onDone={load} /></td></tr>}
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
      <MemberMonths member={member} session={session} />
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

interface MemberMonth {
  month: string;
  fulfilled_by: 'monthly_resource' | 'welcome_vision';
  kit_slug: string | null;
  plan: string;
  invoice: string | null;
  source: string;
  revoked: boolean;
  revoked_reason: string | null;
  mailing: { id: string; status: string; batch: Order['batch']; cutoff_at: string | null; mailed_at: string | null } | null;
}

/** Each paid month: what fulfills it, the payment behind it, and its printed copy. */
function MemberMonths({ member, session }: { member: Member; session: AdminContext['session'] }) {
  const [d, setD] = useState<{ welcome: { status: string; readiness: string; satisfies_month: string | null; vision_value: string | null } | null; months: MemberMonth[] } | null>(null);
  useEffect(() => {
    adminRpc<NonNullable<typeof d>>(session, 'club_admin_member_months', { p_user: member.user_id }).then(setD, () => setD({ welcome: null, months: [] }));
  }, [member.user_id]);
  if (!d) return <p className="sm:col-span-2">Loading months…</p>;
  return (
    <div className="sm:col-span-2">
      <p className="font-semibold">Paid months</p>
      <p className="text-[0.85rem] text-soft">
        Welcome print: {d.welcome ? `${d.welcome.status} · ${d.welcome.readiness}${d.welcome.vision_value ? ` · “${d.welcome.vision_value}”` : ''}${d.welcome.satisfies_month ? ` · fulfills ${month(d.welcome.satisfies_month)}` : ''}` : 'none'}
      </p>
      <table className="mt-2 w-full text-left text-[0.85rem]">
        <thead><tr className="border-b border-rule"><th className="py-1">Month</th><th>Fulfilled by</th><th>Paid by</th><th>Printed copy</th></tr></thead>
        <tbody>
          {d.months.map((x) => (
            <tr key={`${x.month}-${x.invoice}`} className={`border-b border-rule ${x.revoked ? 'text-soft line-through' : ''}`}>
              <td className="py-1">{month(x.month)}</td>
              <td>{x.fulfilled_by === 'welcome_vision' ? 'Family Vision welcome print' : clubResourceBySlug(x.kit_slug)?.title ?? x.kit_slug ?? 'Monthly resource'}</td>
              <td>{x.source === 'admin' ? 'admin grant' : `${x.plan} · ${x.invoice}`}{x.revoked && ` (${x.revoked_reason})`}</td>
              <td>{x.fulfilled_by === 'welcome_vision' ? 'the welcome print' : x.mailing ? `${x.mailing.status} · ${BATCH[x.mailing.batch]}` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A Welcome Kit's readiness in the owner's words. */
const KIT_READINESS: Record<string, string> = {
  needs_profile: 'Waiting for her family details',
  needs_address: 'Needs a mailing address',
  mail_paused: 'Held: she paused printed mailings',
  needs_vision: 'Waiting for her to approve her print',
  needs_resource: 'Her first month isn’t published yet',
  needs_confirmation: 'Waiting for her to confirm her first resource',
  needs_pdf: 'Make the PDFs',
  ready: 'Ready to approve',
  first_month_canceled: 'Held: her first month was withdrawn (refund, dispute or ended early)',
};

/**
 * Welcome Kits: one package per new member, her Family Vision print and her first month's resource, approved, printed
 * and mailed together (club_admin_set_welcome_kit), outside the monthly cutoff. PDFs stay one per item.
 */
function WelcomeKits({ session, onLoad }: AdminContext & { onLoad?: (rows: Order[]) => void }) {
  const [rows, setRows] = useState<Order[] | null>(null);
  const [err, setErr] = useState('');
  const load = () => adminRpc<Order[]>(session, 'club_admin_welcome_queue').then((r) => { setRows(r); onLoad?.(r); }, (e: Error) => setErr(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = async (o: Order, status: string, alone = false) => {
    const note = alone ? prompt('Send the print without her first month. Why?') ?? ''
      : status === 'skipped' || status === 'on_hold' || status === 'returned' ? prompt('Note (why):') ?? '' : null;
    if (alone && !note?.trim()) return;
    try {
      await adminRpc(session, 'club_admin_set_welcome_kit', { p_order: o.id, p_status: status, p_note: note || null });
      load();
    } catch (e) {
      const m = (e as Error).message;
      alert(m === 'not_ready' ? 'Not ready: both items need her approval (or the three-day rule), an address and a ready PDF.' : m === 'note_required' ? 'Add a note saying why the print goes alone.' : m);
    }
  };
  const csv = () => {
    const ready = (rows ?? []).filter((o) => o.status === 'approved');
    const head = ['kit_order_id', 'first_month_order_id', 'contents', 'name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(','), ...ready.map((o) => [o.id, o.first_month?.id, contents(o), o.address?.name, o.address?.line1, o.address?.line2, o.address?.city, o.address?.state, o.address?.postal_code].map(esc).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `club-welcome-kits-${thisMonth().slice(0, 10)}.csv`;
    a.click();
  };
  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="label">Welcome Kits ({rows?.length ?? '…'})</h2>
        <button type="button" className="underline" onClick={csv}>Download approved kits (CSV, one row per package)</button>
      </div>
      <p className="mt-1 max-w-3xl text-[0.85rem] text-soft">One package per new member: her Family Vision print and her first month’s resource, approved, printed and mailed together, outside the monthly cutoff. She approves her print; her first resource counts as confirmed three days later if she hasn’t confirmed it and her details are complete. Make both PDFs → Approve kit → Printed → Mailed.</p>
      {err && <p role="alert">{err}</p>}
      {rows && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[0.9rem] [&_td]:pr-4">
            <thead><tr className="border-b border-rule"><th className="py-2">Household</th><th>In the package</th><th>Readiness</th><th>Status</th><th>Address</th><th>Move kit to</th></tr></thead>
            <tbody>
              {rows.map((o) => {
                const fm = o.first_month;
                const held = o.readiness === 'first_month_canceled';
                return (
                  <tr key={o.id} className="border-b border-rule align-top">
                    <td className="py-2">{o.display_name ?? o.email}<br /><span className="text-soft">{o.email}</span><br /><span className="text-soft">joined {day(o.enrolled_at)}</span></td>
                    <td>
                      <p><strong>Family Vision print</strong> · {o.family_name ? `${o.family_name} · ${o.vision_value}` : <span className="text-soft">not personalized</span>}
                        {' · '}{o.member_approved_at ? `approved ${day(o.member_approved_at)}` : 'not approved'}
                        {' · '}{o.pdf_status === 'ready' ? 'PDF ✓' : o.family_name ? <a className="underline" href={printHref(o)!}>Print view</a> : 'PDF –'}</p>
                      {fm ? (
                        <p className="mt-1"><strong>{monthName(fm.resource_month)}</strong> · {clubResourceBySlug(fm.kit_slug)?.title ?? fm.kit_title ?? 'Monthly resource'}
                          {' · '}{fm.member_approved_at ? `confirmed ${day(fm.member_approved_at)}` : o.kit_auto_approve_at ? `not confirmed · counts as confirmed ${day(o.kit_auto_approve_at)}` : 'not confirmed'}
                          {' · '}{fm.pdf_status === 'ready' ? 'PDF ✓' : printHref({ id: fm.id, kit_slug: fm.kit_slug, fulfillment_type: 'monthly_resource' }) ? <a className="underline" href={printHref({ id: fm.id, kit_slug: fm.kit_slug, fulfillment_type: 'monthly_resource' })!}>Print view</a> : 'PDF –'}</p>
                      ) : <p className="mt-1 text-soft">No first month (withdrawn)</p>}
                    </td>
                    <td>{KIT_READINESS[o.readiness] ?? o.readiness}</td>
                    <td>{o.status}{o.note && <><br /><span className="text-soft">{o.note}</span></>}</td>
                    <td>{o.address ? <>{o.address.name}<br />{o.address.city}, {o.address.state}</> : '–'}</td>
                    <td className="space-x-2">
                      {(NEXT[o.status] ?? []).filter((st) => !held || st !== 'approved').map((st) => <button key={st} type="button" className="underline" onClick={() => set(o, st)}>{st === 'approved' ? 'approve kit' : st}</button>)}
                      {held && o.status === 'pending' && <button type="button" className="underline" onClick={() => set(o, 'approved', true)}>send print alone…</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** What's in one package, for the mail-house CSV. */
const contents = (o: Order) =>
  [`Family Vision print (${o.vision_value ?? '–'})`, o.first_month ? `${month(o.first_month.resource_month)} ${clubResourceBySlug(o.first_month.kit_slug)?.title ?? o.first_month.kit_title ?? ''}`.trim() : null].filter(Boolean).join(' + ');

function Fulfillment(ctx: AdminContext) {
  const [kits, setKits] = useState<Order[] | null>(null);
  return (
    <>
      <WelcomeKits {...ctx} onLoad={setKits} />
      <MonthlyFulfillment {...ctx} kits={kits} />
    </>
  );
}

function MonthlyFulfillment({ session, signOut, kits }: AdminContext & { kits: Order[] | null }) {
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
      {(() => {
        const inKits = (kits ?? []).filter((k) => k.first_month?.resource_month.slice(0, 7) === m).length;
        return inKits > 0 && <p className="mt-2 text-[0.95rem]">Plus <strong>{inKits}</strong> {monthName(`${m}-01`)} {inKits === 1 ? 'resource ships' : 'resources ship'} in Welcome Kits (above), not in this list.</p>;
      })()}
      <p className="mt-2 max-w-3xl text-[0.85rem] text-soft">Pipeline: paid month → family profile → address → published resource → print view, Save as PDF, mark PDF ready → Approve (freezes the address) → Printed → Mailed. Each paid month mails that month’s own resource. Paid by the month’s cutoff → its regular batch; paid after (monthly renewals, late joiners) → its catch-up batch, prepared once the payment lands. Never moved to another month.</p>
      {err && <p role="alert" className="mt-4">{err}</p>}
      {rows && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[0.9rem]">
            <thead><tr className="border-b border-rule"><th className="py-2">Household</th><th>What</th><th>Readiness</th><th>Status</th><th>Member review</th><th>Address</th><th>Print</th><th>Move to</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-rule align-top">
                  <td className="py-2">{o.display_name ?? o.email}<br /><span className="text-soft">{o.email}</span></td>
                  <td>{o.fulfillment_type === 'welcome_vision' ? 'Welcome print' : clubResourceBySlug(o.kit_slug)?.title ?? o.kit_slug ?? 'Monthly resource'}<br />
                    <span className={o.batch === 'catch_up' ? 'font-semibold' : 'text-soft'}>{BATCH[o.batch]}</span>{o.satisfies_month && <><br /><span className="text-soft">is their {month(o.satisfies_month)}</span></>}</td>
                  <td>{o.readiness}{o.pdf_status === 'ready' ? ' · PDF ✓' : ''}</td>
                  <td>{o.status}{o.mailed_at ? ` ${day(o.mailed_at)}` : ''}{o.note && <><br /><span className="text-soft">{o.note}</span></>}</td>
                  <td>{o.member_approved_at ? `Approved ${day(o.member_approved_at)}` : '–'}</td>
                  <td>{o.address ? `${o.address.city}, ${o.address.state}` : '–'}</td>
                  <td>{printHref(o) ? <a className="underline" href={printHref(o)!}>Print view</a> : '–'}</td>
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
  prices: { monthly?: boolean } | null;
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
      <p className="mt-2 text-[0.95rem]">Each month’s printed mailing list closes at <strong>11:59 pm New York time on the {rule}</strong> of the month before. Each paid month’s printed copy is that month’s resource: paid by its cutoff, it’s in the regular batch; paid after, in that month’s catch-up batch. Digital access never depends on it, and the welcome print never waits for it.</p>
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
                {r.launch_exception_cutoff_at && <><br /><strong>Launch exception: open until {deadline(r.launch_exception_cutoff_at)}</strong> for the founding batch</>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="label mt-6">Launch exception (one time)</h3>
      {settings.launch_exception_month && settings.launch_exception_cutoff_at ? (
        <p className="mt-2 text-[0.95rem]">
          On: families who pay for {monthName(settings.launch_exception_month)} by <strong>{deadline(settings.launch_exception_cutoff_at)}</strong> get that month’s printed resource in its regular (founding) batch instead of a catch-up batch. It never adds a mailing; every other month follows the rule.{' '}
          <button type="button" className="underline" onClick={() => confirm('Turn the launch exception off? That month’s regular batch then closes at the normal cutoff (already passed).') && save({ launch_exception_month: null, launch_exception_cutoff_at: null })}>Turn off</button>
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
          <li>{yes(Boolean(st.prices?.monthly))} Price: $5.90/month (annual isn’t offered)</li>
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
          <button type="button" className="underline" onClick={() => run({ action: 'send_emails', kind: 'kit_reminder' }, 'Remind new members to confirm their first resource (two days after approving their print)? Run it daily.')}>Welcome Kit reminders</button>
          <input type="month" className={adminInput} value={emailMonth} onChange={(e) => setEmailMonth(e.target.value)} />
          <button type="button" className="underline" onClick={() => run({ action: 'send_emails', kind: 'resource_ready', month: `${emailMonth}-01` }, `Tell every member with ${emailMonth} that it's ready?`)}>“Resource ready”</button>
          <button type="button" className="underline" onClick={() => run({ action: 'send_emails', kind: 'review', month: `${emailMonth}-01` }, `Ask ${emailMonth} mailing households to review before printing?`)}>“Review before printing”</button>
        </div>
      </section>
      {msg && <pre className="whitespace-pre-wrap break-all bg-paper p-3 text-[0.85rem]">{msg}</pre>}
    </div>
  );
}

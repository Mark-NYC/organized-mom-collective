/**
 * /admin/club → Club access → Rivera demo (owner admins): the private demo family (docs/demo/RIVERA_DEMO.md).
 * First install with the two demo accounts' emails (both @example.com, created in Supabase Auth); after that,
 * "Reset Rivera Demo" puts the family back to its approved starting point. Both go through demo_rivera_reset
 * (supabase/migrations/20261209000000_demo_rivera.sql), which checks is_admin('owner') itself, refuses any account that
 * isn't a clean demo account, touches only the demo household and writes the audit log.
 */
import { useEffect, useState } from 'react';
import { adminInput, type AdminContext } from './AdminGate';
import { adminRpc } from '../../lib/admin/session';

export interface DemoStatus {
  installed: boolean;
  owner_email?: string; partner_email?: string;
  household_present?: boolean; club?: boolean;
  seeded_at?: string | null; seeded_by?: string | null;
}

export const DEMO_ERRORS: Record<string, string> = {
  forbidden: 'Only an owner admin can install or reset the demo.',
  not_installed: 'The demo isn’t installed yet: enter the two demo accounts first.',
  already_installed: 'The demo is already installed. Use Reset Rivera Demo.',
  no_account: 'Both demo accounts must exist in Supabase Auth first (docs/demo/RIVERA_DEMO.md).',
  invalid: 'Use two different accounts.',
  owner_no_account: 'Ana’s demo account no longer exists in Supabase Auth.',
  partner_no_account: 'Luis’s demo account no longer exists in Supabase Auth.',
  owner_not_a_demo_email: 'The account holder must be a demo account ending in @example.com.',
  partner_not_a_demo_email: 'The second adult must be a demo account ending in @example.com.',
  owner_has_subscription: 'That account has a subscription. Demo accounts must be new and unused.',
  partner_has_subscription: 'That account has a subscription. Demo accounts must be new and unused.',
  owner_has_invoice: 'That account has invoices. Demo accounts must be new and unused.',
  partner_has_invoice: 'That account has invoices. Demo accounts must be new and unused.',
  owner_has_entitlement: 'That account has Club months. Demo accounts must be new and unused.',
  partner_has_entitlement: 'That account has Club months. Demo accounts must be new and unused.',
  owner_has_fulfillment: 'That account has mailings. Demo accounts must be new and unused.',
  partner_has_fulfillment: 'That account has mailings. Demo accounts must be new and unused.',
  owner_has_other_household: 'That account belongs to another family. Demo accounts must be new and unused.',
  partner_has_other_household: 'That account belongs to another family. Demo accounts must be new and unused.',
};
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '–');

export default function RiveraDemoAdmin({ session, signOut }: AdminContext) {
  const [s, setS] = useState<DemoStatus | null>(null);
  const [owner, setOwner] = useState('');
  const [partner, setPartner] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = (e: Error) => (e.message === 'expired' ? signOut() : setErr(DEMO_ERRORS[e.message] ?? e.message));

  useEffect(() => { adminRpc<DemoStatus>(session, 'demo_rivera_status').then(setS, fail); }, []);

  const run = async (args: Record<string, unknown>, done: string) => {
    setBusy(true); setErr(''); setMsg('');
    try { setS(await adminRpc<DemoStatus>(session, 'demo_rivera_reset', args)); setMsg(done); } catch (e) { fail(e as Error); } finally { setBusy(false); }
  };
  const install = () => {
    if (!confirm(`Create the Rivera demo family with ${owner.trim()} (Ana, account holder) and ${partner.trim()} (Luis, second adult), and give it complimentary Club access? No email is sent and nothing is charged.`)) return;
    void run({ p_owner_email: owner.trim(), p_partner_email: partner.trim() }, 'Installed. Sign in as either demo adult to explore.');
  };
  const reset = () => {
    if (!confirm('Reset Rivera Demo? Everything anyone changed in the Rivera family goes back to the approved starting point (people, calendar, agreements, cleaning, development history). Only the demo family is touched; the demo sign-ins stay the same.')) return;
    void run({}, 'Reset. The Rivera family is back to its starting point. Sign out and back in on any device that had it open.');
  };

  return (
    <section className="mt-10 border-t border-rule pt-6" data-rivera-demo>
      <h3 className="font-semibold">Rivera demo family</h3>
      <p className="mt-1 text-[0.9rem] text-soft">A private, fully used demo family for exploring the app and the Club. Only the demo family is ever changed here.</p>
      {s === null && !err && <p className="mt-3 text-soft">Loading…</p>}
      {s?.installed && (
        <>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9rem]" data-rivera-status>
            <dt className="text-soft">Ana (account holder)</dt><dd>{s.owner_email}</dd>
            <dt className="text-soft">Luis (second adult)</dt><dd>{s.partner_email}</dd>
            <dt className="text-soft">Club</dt><dd>{s.club ? 'Complimentary Club' : 'No access'}</dd>
            <dt className="text-soft">Last reset</dt><dd>{when(s.seeded_at)}{s.seeded_by ? ` by ${s.seeded_by}` : ''}</dd>
          </dl>
          <button type="button" className="btn-primary mt-4" disabled={busy} onClick={reset} data-rivera-reset>{busy ? 'Resetting…' : 'Reset Rivera Demo'}</button>
        </>
      )}
      {s && !s.installed && (
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); install(); }} data-rivera-install>
          <label className="block"><span className="label">Ana’s demo account email</span>
            <input type="email" className={adminInput} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="name@example.com" required data-rivera-owner />
          </label>
          <label className="block"><span className="label">Luis’s demo account email</span>
            <input type="email" className={adminInput} value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="name@example.com" required data-rivera-partner />
          </label>
          <div className="sm:col-span-2"><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Installing…' : 'Install the Rivera demo'}</button></div>
        </form>
      )}
      {msg && <p className="mt-3" role="status" data-rivera-msg>{msg}</p>}
      {err && <p className="mt-3" role="alert" data-rivera-err>{err}</p>}
    </section>
  );
}

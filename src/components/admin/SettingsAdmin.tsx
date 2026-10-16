import { useEffect, useState } from 'react';
import AdminGate, { type AdminContext } from './AdminGate';
import { adminRpc, adminSelect, createAdminAuth, type Factor } from '../../lib/admin/session';
import type { InventoryRun } from '../../lib/admin/pages';
import { adminAction, type ShopStatus } from '../../lib/shop';
import { GA4_ID, INTEGRATIONS } from '../../data/admin-integrations';

const auth = createAdminAuth();

interface AuditRow {
  id: number;
  at: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** /admin/settings: the admin account and its authenticator, integration status (never secret values), audit log. */
export default function SettingsAdmin() {
  return <AdminGate>{(ctx) => <Settings {...ctx} />}</AdminGate>;
}

function Settings({ session, role, signOut, databaseReady }: AdminContext) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [status, setStatus] = useState<ShopStatus | { error: string } | null>(null);
  const [log, setLog] = useState<AuditRow[] | { error: string } | null>(null);
  const [run, setRun] = useState<InventoryRun | null>(null);
  const [tokenSetAt, setTokenSetAt] = useState<string | null>(null);
  const [newToken, setNewToken] = useState('');
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    auth.factors(session).then(setFactors, () => setFactors([]));
    adminAction<ShopStatus>(session.access_token, { action: 'status' }).then(setStatus, (e: Error) =>
      e.message === 'expired' ? signOut() : setStatus({ error: e.message }),
    );
    if (databaseReady) {
      adminSelect<AuditRow>(session, 'admin_audit_log', 'select=*&order=at.desc&limit=100').then(setLog, (e: Error) => setLog({ error: e.message }));
      adminSelect<InventoryRun>(session, 'site_inventory_runs', 'select=at,build_sha,pages,added,removed,links&order=at.desc&limit=1').then(
        (r) => setRun(r[0] ?? null),
        () => setRun(null),
      );
      adminRpc<string | null>(session, 'admin_inventory_token_set_at').then(setTokenSetAt, () => setTokenSetAt(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shop = status && !('error' in status) ? status : null;

  const rotate = async () => {
    if (tokenSetAt && !confirm('Make a new token? The current one stops working until you update the GitHub secret.')) return;
    setTokenError('');
    try {
      setNewToken(await adminRpc<string>(session, 'admin_rotate_inventory_token'));
      setTokenSetAt(new Date().toISOString());
    } catch (e) {
      setTokenError((e as Error).message);
    }
  };

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="account">
        <h2 id="account" className="text-[1.25rem] font-bold">
          Admin access
        </h2>
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[0.95rem]">
          <dt className="text-muted">Account</dt>
          <dd>{session.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd>{role ?? 'unknown until the admin migration is applied'}</dd>
          <dt className="text-muted">Authenticator</dt>
          <dd>
            {factors === null
              ? 'Loading…'
              : factors.filter((f) => f.status === 'verified').map((f) => f.friendly_name ?? 'Authenticator app').join(', ') || 'None verified'}
          </dd>
          <dt className="text-muted">Idle sign-out</dt>
          <dd>30 minutes</dd>
        </dl>
        <p className="mt-3 text-[0.9rem] text-soft">
          No public sign-up: admins are added in the database only (supabase/ADMIN.md). To replace a lost phone, remove the factor in Supabase → Authentication → Users,
          then sign in here to add the new one.
        </p>
      </section>

      <section aria-labelledby="integrations">
        <h2 id="integrations" className="text-[1.25rem] font-bold">
          Integrations
        </h2>
        <p className="mt-2 text-[0.9rem] text-soft">Whether each one is set up. Secret values never leave the server.</p>
        {status && 'error' in status && (
          <p role="alert" className="mt-3 text-[0.95rem]">
            Couldn’t read the shop status: {status.error}
          </p>
        )}
        <table className="mt-4 w-full text-left text-[0.95rem]">
          <thead className="text-muted">
            <tr>
              <th className="py-2 pr-4 font-semibold">Service</th>
              <th className="py-2 pr-4 font-semibold">State</th>
              <th className="py-2 font-semibold">Used for</th>
            </tr>
          </thead>
          <tbody>
            <Row name="Stripe" state={shop ? (shop.stripe_mode ? `${shop.stripe_mode} key${shop.webhook_secret_set ? ', webhook signed' : ', webhook secret missing'}` : 'not set') : '…'} use="Website checkout, refunds" />
            <Row name="Store switch" state={shop?.checkout_mode ?? '…'} use="Who can check out (Shop & Orders → Settings)" />
            <Row name="Resend" state={shop ? (shop.email_configured ? `configured${shop.reply_to_set ? '' : ', reply-to missing'}` : 'not configured') : '…'} use="Order, download and support emails" />
            <Row name="Google Analytics 4" state={`tag on public pages (${GA4_ID}); data not connected`} use="Traffic, sources, funnels (Phase 5)" />
            {INTEGRATIONS.map((i) => (
              <Row key={i.name} name={i.name} state={i.state} use={i.use} />
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="inventory">
        <h2 id="inventory" className="text-[1.25rem] font-bold">
          Page inventory
        </h2>
        <p className="mt-2 text-[0.9rem] text-soft">
          After every push to the default branch, a GitHub Action builds the site and sends the page list here (Pages & Funnels, broken-button alerts). It signs in with a token that can
          only write the page list.
        </p>
        {!databaseReady ? (
          <p className="mt-3 text-[0.95rem]">Available once the admin migrations are applied.</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[0.95rem]">
              <dt className="text-muted">Last update</dt>
              <dd>{run ? `${when(run.at)} · ${run.pages} pages${run.build_sha ? ` · ${run.build_sha.slice(0, 7)}` : ''}` : 'never'}</dd>
              <dt className="text-muted">Token</dt>
              <dd>{tokenSetAt ? `created ${when(tokenSetAt)}` : 'not created'}</dd>
            </dl>
            <button type="button" className="btn-secondary mt-4" onClick={rotate}>
              {tokenSetAt ? 'Replace token' : 'Create token'}
            </button>
            {tokenError && (
              <p role="alert" className="mt-2 text-[0.95rem] font-semibold">
                {tokenError}
              </p>
            )}
            {newToken && (
              <div role="status" className="mt-4 rounded-[3px] bg-band p-4 text-[0.95rem]">
                <p className="font-semibold">Copy it now: it isn’t shown again.</p>
                <code className="mt-2 block break-all select-all">{newToken}</code>
                <p className="mt-2">
                  GitHub → the repository → Settings → Secrets and variables → Actions → New repository secret, name <code>PAGE_INVENTORY_TOKEN</code>. Then run the
                  “Page inventory” workflow (Actions tab) or push to the default branch.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="audit">
        <h2 id="audit" className="text-[1.25rem] font-bold">
          Audit log
        </h2>
        <p className="mt-2 text-[0.9rem] text-soft">Sign-ins and every change made from the admin. Append-only. Latest 100.</p>
        {!databaseReady && <p className="mt-3 text-[0.95rem]">Available once the admin migration is applied.</p>}
        {log && 'error' in log && <p className="mt-3 text-[0.95rem]">Couldn’t load the audit log: {log.error}</p>}
        {Array.isArray(log) && log.length === 0 && <p className="mt-3 text-[0.95rem]">Nothing recorded yet.</p>}
        {Array.isArray(log) && log.length > 0 && (
          <ul className="mt-4 divide-y divide-rule text-[0.9rem]">
            {log.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-4 py-2">
                <span className="w-full shrink-0 text-muted sm:w-36">{when(r.at)}</span>
                <span className="font-semibold">{r.action}</span>
                {r.target && <span className="text-soft">{r.target}</span>}
                <span className="text-soft">{r.actor_email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ name, state, use }: { name: string; state: string; use: string }) {
  return (
    <tr className="border-t border-rule align-top">
      <td className="py-2 pr-4 font-semibold">{name}</td>
      <td className="py-2 pr-4">{state}</td>
      <td className="py-2 text-soft">{use}</td>
    </tr>
  );
}

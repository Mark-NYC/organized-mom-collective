import { useEffect, useState } from 'react';
import AdminGate, { type AdminContext } from './AdminGate';
import { adminRpc, adminSelect } from '../../lib/admin/session';
import { ago, safeAdminLink, sortAlerts, usd, type AlertRow, type Overview } from '../../lib/admin/overview';

/** /admin: what's broken first, then the numbers that exist. Nothing here is estimated. */
export default function OverviewAdmin() {
  return <AdminGate>{(ctx) => <OverviewPage {...ctx} />}</AdminGate>;
}

function OverviewPage({ session, signOut, databaseReady }: AdminContext) {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      await adminRpc(session, 'admin_alerts_refresh');
      const [rows, overview] = await Promise.all([
        adminSelect<AlertRow>(session, 'admin_alerts', 'select=key,severity,area,title,detail,link,first_seen,last_seen,acked_at&resolved_at=is.null'),
        adminRpc<Overview>(session, 'admin_overview'),
      ]);
      setAlerts(sortAlerts(rows));
      setData(overview);
    } catch (err) {
      if ((err as Error).message === 'expired') signOut();
      else setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (databaseReady) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ack = async (key: string) => {
    try {
      await adminRpc(session, 'admin_alert_ack', { p_key: key });
      setAlerts((a) => (a ? sortAlerts(a.map((r) => (r.key === key ? { ...r, acked_at: new Date().toISOString() } : r))) : a));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!databaseReady) return <p className="mt-8 text-[1.0625rem]">The Overview needs the admin database migration (supabase/ADMIN.md).</p>;

  const open = alerts?.filter((a) => !a.acked_at) ?? [];
  const seen = alerts?.filter((a) => a.acked_at) ?? [];

  return (
    <div className="mt-6 space-y-10">
      <div className="flex justify-end">
        <button type="button" onClick={load} disabled={loading} className="text-link text-[0.9rem]">
          {loading ? 'Checking…' : 'Check again'}
        </button>
      </div>
      {error && (
        <p role="alert" className="font-semibold">
          {error}
        </p>
      )}

      <section aria-labelledby="attention">
        <h2 id="attention" className="text-[1.25rem] font-bold">
          Needs attention {alerts && <span className="text-muted">({open.length})</span>}
        </h2>
        {alerts === null && !error && <p className="mt-3 text-muted">Checking…</p>}
        {alerts && open.length === 0 && (
          <p className="mt-3 text-[0.95rem]">
            Nothing broken that the admin can see. It checks orders to ship, flagged payments, failed customer emails, support and returns waiting, stock, the Stripe
            webhook, and broken buttons and links on the site.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {open.map((a) => (
            <AlertItem key={a.key} a={a} onAck={() => ack(a.key)} />
          ))}
        </ul>
        {seen.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-[0.95rem] text-soft">Seen, still open ({seen.length})</summary>
            <ul className="mt-2 space-y-2 opacity-75">
              {seen.map((a) => (
                <AlertItem key={a.key} a={a} />
              ))}
            </ul>
          </details>
        )}
      </section>

      {data && (
        <>
          {data.checkout_mode !== 'live' && (
            <p className="border-l-[3px] border-month bg-band px-4 py-3 text-[0.95rem]">
              Website checkout is <strong>{data.checkout_mode === 'preview' ? 'in preview' : 'off'}</strong>, so there are no real website orders yet. Numbers below count
              real-money orders only{data.orders.test_orders > 0 && <> ({data.orders.test_orders} test orders not counted)</>}. Etsy sales aren’t in the admin.
            </p>
          )}

          <section aria-labelledby="numbers">
            <h2 id="numbers" className="text-[1.25rem] font-bold">
              Website shop and leads
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Revenue, 30 days" value={usd(data.orders.revenue_30d_cents)} note={`after refunds · ${usd(data.orders.revenue_all_cents)} all time`} />
              <Tile label="Orders, 30 days" value={data.orders.paid_30d} note={`${data.orders.paid_all} all time`} />
              <Tile label="To ship" value={data.orders.to_ship} href="/admin/orders" />
              <Tile label="Open support" value={data.support.open} note={data.support.waiting ? `${data.support.waiting} waiting on customer` : undefined} />
              <Tile label="Returns in progress" value={data.support.returns_in_progress} />
              <Tile label="Low stock" value={data.inventory.low_stock} note={`${data.inventory.active_products} products on sale`} href="/admin/orders?tab=inventory" />
              <Tile label="Email signups, 30 days" value={data.leads.last_30d} note={`${data.leads.total} total · ${data.leads.marketing_opt_in} opted in to marketing`} />
              <Tile label="Checkouts started, 30 days" value={data.orders.checkouts_started_30d} note="website, live" />
            </div>
          </section>

          <section aria-labelledby="unavailable">
            <h2 id="unavailable" className="text-[1.25rem] font-bold">
              Not connected yet
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Visitors" value="—" note="Needs GA4 Data API access (Phase 5)" />
              <Tile label="Visitor → lead" value="—" note="Needs GA4 + lead events" />
              <Tile label="Visitor → purchase" value="—" note="Needs GA4 purchase event" />
              <Tile label="Etsy orders" value="—" note="Not integrated" />
            </div>
          </section>

          <section aria-labelledby="recent">
            <h2 id="recent" className="text-[1.25rem] font-bold">
              Recent activity
            </h2>
            {data.recent.length === 0 && <p className="mt-3 text-[0.95rem]">Nothing yet.</p>}
            <ul className="mt-3 divide-y divide-rule text-[0.95rem]">
              {data.recent.map((r, i) => (
                <li key={i} className="flex flex-col py-2 sm:flex-row sm:gap-x-4">
                  <span className="shrink-0 text-muted sm:w-28">{ago(r.at)}</span>
                  <span>
                    {r.text}
                    {r.kind === 'order' && r.live === false && <span className="ml-2 text-[0.8rem] text-muted">(test)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

const BADGE: Record<AlertRow['severity'], string> = {
  critical: 'bg-ink text-paper',
  warning: 'border border-ink',
  info: 'border border-rule text-soft',
};

function AlertItem({ a, onAck }: { a: AlertRow; onAck?: () => void }) {
  const link = safeAdminLink(a.link);
  return (
    <li className="rounded-[3px] border border-rule p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`rounded-[3px] px-2 py-0.5 text-[0.75rem] font-semibold uppercase ${BADGE[a.severity]}`}>{a.severity}</span>
        <span className="font-semibold">{a.title}</span>
      </div>
      {a.detail && <p className="mt-1 text-[0.9rem] text-soft">{a.detail}</p>}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.85rem] text-muted">
        <span>since {ago(a.first_seen)}</span>
        {link && (
          <a href={link} className="text-link">
            Go fix it
          </a>
        )}
        {onAck && (
          <button type="button" className="text-link" onClick={onAck}>
            Mark as seen
          </button>
        )}
      </div>
    </li>
  );
}

function Tile({ label, value, note, href }: { label: string; value: string | number; note?: string; href?: string }) {
  const body = (
    <>
      <span className="label block text-muted">{label}</span>
      <span className="mt-1 block text-[1.6rem] font-bold">{value}</span>
      {note && <span className="mt-1 block text-[0.8rem] text-soft">{note}</span>}
    </>
  );
  return href ? (
    <a href={href} className="block rounded-[3px] bg-band p-3 hover:bg-rule">
      {body}
    </a>
  ) : (
    <div className="rounded-[3px] bg-band p-3">{body}</div>
  );
}

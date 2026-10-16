/** Types and display helpers for /admin → Overview. Data: admin_overview() and admin_alerts (20261020020000_admin_alerts.sql). */

export type Severity = 'critical' | 'warning' | 'info';

export interface AlertRow {
  key: string;
  severity: Severity;
  area: string;
  title: string;
  detail: string | null;
  link: string | null;
  first_seen: string;
  last_seen: string;
  acked_at: string | null;
}

export interface Overview {
  checkout_mode: 'off' | 'preview' | 'live' | null;
  orders: {
    paid_30d: number;
    paid_all: number;
    revenue_30d_cents: number;
    revenue_all_cents: number;
    refunded_30d_cents: number;
    to_ship: number;
    checkouts_started_30d: number;
    test_orders: number;
  };
  support: { open: number; waiting: number; oldest_open_at: string | null; returns_in_progress: number };
  inventory: { active_products: number; low_stock: number };
  leads: { total: number; last_30d: number; marketing_opt_in: number };
  recent: { at: string; kind: 'order' | 'support' | 'lead' | 'admin'; text: string; live: boolean | null }[];
}

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Unacknowledged first, then by severity, then oldest first (it's been broken longest). */
export function sortAlerts(rows: AlertRow[]): AlertRow[] {
  return [...rows].sort(
    (a, b) => Number(Boolean(a.acked_at)) - Number(Boolean(b.acked_at)) || RANK[a.severity] - RANK[b.severity] || a.first_seen.localeCompare(b.first_seen),
  );
}

export const usd = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 });

/** "3 min ago", "5 h ago", "2 days ago", then a date. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const days = Math.round(s / 86400);
  if (days < 14) return days === 1 ? '1 day ago' : `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Only links inside the admin are followed; anything else isn't rendered as a link. */
export const safeAdminLink = (link: string | null) => (link && /^\/admin(\/|\?|$)/.test(link) ? link : null);

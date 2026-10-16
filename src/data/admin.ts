/**
 * The /admin sections, in nav order. A section without `href` isn't built yet: the nav shows it with
 * `pending` so it's clear what's missing instead of looking like an empty screen.
 * Plan and phases: docs/operations/ADMIN_DASHBOARD_PLAN.md.
 */
export interface AdminSection {
  id: string;
  label: string;
  href?: string;
  /** Why it isn't here yet / where to do it meanwhile. */
  pending?: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { id: 'overview', label: 'Overview', href: '/admin' },
  { id: 'pages', label: 'Pages & Funnels', href: '/admin/pages' },
  { id: 'orders', label: 'Shop & Orders', href: '/admin/orders' },
  { id: 'products', label: 'Products & Inventory', href: '/admin/orders?tab=inventory' },
  { id: 'analytics', label: 'Analytics', pending: 'Needs GA4 Data API access (Phase 5). Use GA4 itself meanwhile.' },
  { id: 'customers', label: 'Customers', pending: 'Phase 7.' },
  { id: 'support', label: 'Customer Service', pending: 'Phase 6. Use the support inbox and Supabase Table Editor → support_requests meanwhile.' },
  { id: 'marketing', label: 'Marketing', pending: 'Phase 10.' },
  { id: 'survey', label: 'Survey', href: '/survey/admin' },
  { id: 'settings', label: 'Settings', href: '/admin/settings' },
];

/** Signed out after this long without a click or key press. */
export const ADMIN_IDLE_MS = 30 * 60 * 1000;

/** /admin → Pages & Funnels: types and filtering. Data: site_pages (20261020010000_admin_pages.sql). */

export const LIVE_ORIGIN = 'https://www.organizedmomcollective.com';
export const REPO_URL = 'https://github.com/Mark-NYC/organized-mom-collective';

export interface Cta {
  placement: string;
  label: string;
  href: string;
  broken?: string;
}

export interface PageRow {
  path: string;
  title: string | null;
  h1: string | null;
  type: string;
  indexable: boolean;
  redirect_to: string | null;
  in_sitemap: boolean;
  in_nav: boolean;
  inbound_links: number;
  orphan: boolean;
  ctas: Cta[];
  source_file: string | null;
  build_sha: string | null;
  first_seen: string;
  last_seen: string;
  removed_at: string | null;
}

export interface InventoryRun {
  at: string;
  build_sha: string | null;
  pages: number;
  added: number;
  removed: number;
  links: { href: string; status: number; broken: boolean; pages: string[] }[];
}

export type PageFilter = { type: string; status: '' | 'indexable' | 'noindex' | 'orphan' | 'problems'; q: string };

export const TYPE_LABELS: Record<string, string> = {
  home: 'Home',
  offer: 'Offer / landing',
  'lead-magnet': 'Lead magnet',
  tool: 'Free tool',
  article: 'Article',
  pillar: 'Topic',
  library: 'Directory',
  page: 'Page',
  support: 'Support',
  checkout: 'Checkout',
  companion: 'Companion',
  gated: 'Buyer-only',
  survey: 'Survey',
  redirect: 'Redirect',
};

export const hasProblem = (p: PageRow) => p.ctas.some((c) => c.broken);

export function filterPages(rows: PageRow[], f: PageFilter): PageRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (p) =>
      (!f.type || p.type === f.type) &&
      (f.status === '' ||
        (f.status === 'indexable' && p.indexable) ||
        (f.status === 'noindex' && !p.indexable) ||
        (f.status === 'orphan' && p.orphan) ||
        (f.status === 'problems' && hasProblem(p))) &&
      (!q || p.path.toLowerCase().includes(q) || (p.title ?? '').toLowerCase().includes(q)),
  );
}

/** GitHub link to the page's source at the commit that was inventoried (main if unknown). */
export const sourceUrl = (p: Pick<PageRow, 'source_file' | 'build_sha'>) =>
  p.source_file && /^src\/[\w./[\]-]+$/.test(p.source_file) ? `${REPO_URL}/blob/${p.build_sha ?? 'main'}/${p.source_file}` : null;

export const liveUrl = (path: string) => (/^\/[\w./-]*$/.test(path) ? LIVE_ORIGIN + path : null);

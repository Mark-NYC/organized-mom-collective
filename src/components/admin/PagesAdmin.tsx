import { useEffect, useMemo, useState } from 'react';
import AdminGate, { adminInput, type AdminContext } from './AdminGate';
import { adminSelect } from '../../lib/admin/session';
import { ago } from '../../lib/admin/overview';
import { TYPE_LABELS, filterPages, hasProblem, liveUrl, sourceUrl, type InventoryRun, type PageFilter, type PageRow } from '../../lib/admin/pages';

/** /admin/pages: every page the last build produced, including unlinked landing pages. */
export default function PagesAdmin() {
  return <AdminGate>{(ctx) => <Pages {...ctx} />}</AdminGate>;
}

function Pages({ session, signOut, databaseReady }: AdminContext) {
  const [rows, setRows] = useState<PageRow[] | null>(null);
  const [run, setRun] = useState<InventoryRun | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<PageFilter>({ type: '', status: '', q: '' });
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!databaseReady) return;
    Promise.all([
      adminSelect<PageRow>(session, 'site_pages', 'select=*&order=path.asc'),
      adminSelect<InventoryRun>(session, 'site_inventory_runs', 'select=at,build_sha,pages,added,removed,links&order=at.desc&limit=1'),
    ]).then(
      ([pages, runs]) => {
        setRows(pages);
        setRun(runs[0] ?? null);
      },
      (err: Error) => (err.message === 'expired' ? signOut() : setError(err.message)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(() => rows?.filter((r) => !r.removed_at) ?? [], [rows]);
  const removed = useMemo(() => rows?.filter((r) => r.removed_at) ?? [], [rows]);
  const shown = useMemo(() => filterPages(current, filter), [current, filter]);
  const types = useMemo(() => [...new Set(current.map((r) => r.type))].sort(), [current]);
  const goneLinks = run?.links.filter((l) => l.broken) ?? [];

  if (!databaseReady) return <p className="mt-8 text-[1.0625rem]">Pages & Funnels needs the admin database migration (supabase/ADMIN.md).</p>;
  if (error) return <p role="alert" className="mt-8 font-semibold">{error}</p>;
  if (rows === null || run === undefined) return <p className="mt-8 text-muted">Loading…</p>;
  if (run === null) {
    return (
      <p className="mt-8 text-[1.0625rem]">
        No inventory yet. It arrives from the GitHub Action after the next push to the default branch, once its token is set up (Settings → Page inventory; steps in supabase/ADMIN.md).
      </p>
    );
  }

  const set = (p: Partial<PageFilter>) => setFilter((f) => ({ ...f, ...p }));

  return (
    <div className="mt-6">
      <p className="text-[0.9rem] text-soft">
        {current.length} pages from the build {run.build_sha ? <code>{run.build_sha.slice(0, 7)}</code> : ''} ({ago(run.at)}).{' '}
        {(() => {
          const n = current.filter((r) => r.orphan).length;
          return n === 1 ? '1 isn’t linked from anywhere.' : `${n} aren’t linked from anywhere.`;
        })()} Traffic, leads and conversions per page need GA4 (not connected); they aren’t estimated.
      </p>

      {goneLinks.length > 0 && (
        <div role="alert" className="mt-4 border-l-[3px] border-ink bg-band px-4 py-3 text-[0.95rem]">
          <strong>Links that answered “gone” in the last check:</strong>
          <ul className="mt-1 list-disc pl-5">
            {goneLinks.map((l) => (
              <li key={l.href} className="break-all">
                {l.href} ({l.status}) on {l.pages.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="label text-soft">Search</span>
          <input type="search" value={filter.q} onChange={(e) => set({ q: e.target.value })} placeholder="URL or title" className={adminInput} />
        </label>
        <label className="block">
          <span className="label text-soft">Type</span>
          <select value={filter.type} onChange={(e) => set({ type: e.target.value })} className={adminInput}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t} ({current.filter((r) => r.type === t).length})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label text-soft">Show</span>
          <select value={filter.status} onChange={(e) => set({ status: e.target.value as PageFilter['status'] })} className={adminInput}>
            <option value="">All pages</option>
            <option value="indexable">In Google (indexable)</option>
            <option value="noindex">Hidden from Google</option>
            <option value="orphan">Not linked anywhere</option>
            <option value="problems">Broken buttons</option>
          </select>
        </label>
      </div>

      <p className="mt-4 text-[0.85rem] text-muted" aria-live="polite">
        Showing {shown.length}
      </p>
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {shown.map((p) => (
          <PageItem key={p.path} p={p} open={preview === p.path} onPreview={() => setPreview(preview === p.path ? null : p.path)} />
        ))}
      </ul>

      {removed.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-semibold">Removed from the site ({removed.length})</summary>
          <ul className="mt-2 text-[0.95rem]">
            {removed.map((p) => (
              <li key={p.path} className="py-1">
                {p.path} <span className="text-muted">removed {ago(p.removed_at!)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PageItem({ p, open, onPreview }: { p: PageRow; open: boolean; onPreview: () => void }) {
  const live = liveUrl(p.path);
  const src = sourceUrl(p);
  const tags = [
    !p.indexable && (p.redirect_to ? `redirects to ${p.redirect_to}` : 'hidden from Google'),
    p.orphan && 'not linked anywhere',
    p.in_nav && 'in site menu',
    p.in_sitemap && 'in sitemap',
  ].filter(Boolean) as string[];
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-[3px] bg-band px-2 py-0.5 text-[0.75rem] font-semibold">{TYPE_LABELS[p.type] ?? p.type}</span>
        <span className="font-semibold break-all">{p.path}</span>
        {hasProblem(p) && <span className="rounded-[3px] bg-ink px-2 py-0.5 text-[0.75rem] font-semibold text-paper">broken button</span>}
      </div>
      {p.title && <p className="mt-1 text-[0.95rem]">{p.title}</p>}
      <p className="mt-1 text-[0.85rem] text-muted">
        {[...tags, `${p.inbound_links} pages link here`, `${p.ctas.length} tracked buttons`].join(' · ')}
      </p>
      {p.ctas.some((c) => c.broken) && (
        <ul className="mt-1 text-[0.85rem]">
          {p.ctas
            .filter((c) => c.broken)
            .map((c, i) => (
              <li key={i}>
                “{c.label}” → {c.href} ({c.broken})
              </li>
            ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem]">
        {live && (
          <button type="button" className="text-link" onClick={onPreview} aria-expanded={open}>
            {open ? 'Close preview' : 'Preview'}
          </button>
        )}
        {live && (
          <a href={live} target="_blank" rel="noopener noreferrer" className="text-link">
            Open live ↗
          </a>
        )}
        {src && (
          <a href={src} target="_blank" rel="noopener noreferrer" className="text-link">
            Source on GitHub ↗
          </a>
        )}
      </div>
      {open && live && (
        <div className="mt-3 flex flex-wrap gap-4">
          <iframe title={`Phone preview of ${p.path}`} src={live} loading="lazy" className="h-[640px] w-[375px] max-w-full border border-rule bg-paper" />
          <iframe title={`Desktop preview of ${p.path}`} src={live} loading="lazy" className="hidden h-[640px] min-w-0 flex-1 border border-rule bg-paper lg:block" />
        </div>
      )}
    </li>
  );
}

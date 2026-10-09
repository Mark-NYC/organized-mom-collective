/**
 * Sitemap of the public, indexable pages. The companion app (/app/…) and the
 * QR redirect (/start) are noindex and left out on purpose.
 */
import type { APIRoute } from 'astro';
import { getArticles, isoDate } from '../lib/articles';
import { pillars } from '../data/pillars';
import { routes } from '../routes';

export const GET: APIRoute = async ({ site }) => {
  const articles = await getArticles();
  const used = new Set(articles.map((a) => a.data.pillar));
  const latest = articles.length ? isoDate(new Date(Math.max(...articles.map((a) => (a.data.updated ?? a.data.published).valueOf())))) : undefined;

  const entries: { path: string; lastmod?: string }[] = [
    { path: routes.home },
    // The hub is noindex until it has articles.
    ...(articles.length ? [{ path: routes.resources, lastmod: latest }] : []),
    ...pillars.filter((p) => used.has(p.id)).map((p) => ({ path: routes.pillar(p.id) })),
    ...articles.map((a) => ({ path: routes.article(a.id), lastmod: isoDate(a.data.updated ?? a.data.published) })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (e) => `  <url><loc>${new URL(e.path, site).href}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};

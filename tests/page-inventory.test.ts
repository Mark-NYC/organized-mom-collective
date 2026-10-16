import { describe, expect, it } from 'vitest';
import {
  brokenStatus,
  buildInventory,
  ctaLinks,
  externalCtas,
  internalLinks,
  navPaths,
  normalizePath,
  pageMeta,
  pageType,
  sitemapPaths,
  sourceFile,
} from '../scripts/lib/page-inventory.mjs';

const SITE = 'https://organizedmomcollective.com';
const html = (body: string, head = '') => `<html><head><title>T</title>${head}</head><body>${body}</body></html>`;

describe('page inventory', () => {
  it('normalizes paths', () => {
    expect(normalizePath('/calendar#buy')).toBe('/calendar');
    expect(normalizePath('/resources/')).toBe('/resources');
    expect(normalizePath('/x/index.html')).toBe('/x');
    expect(normalizePath('/?a=1')).toBe('/');
  });

  it('collects internal page links, including absolute ones to the site, but not files or other sites', () => {
    const links = internalLinks(
      '<a href="/calendar#buy">a</a><a href="https://www.organizedmomcollective.com/shop">b</a><a href="https://etsy.com/x">c</a><a href="/files/x.pdf">d</a><a href="//cdn">e</a>',
      SITE,
    );
    expect([...links].sort()).toEqual(['/calendar', '/shop']);
  });

  it('reads tracked buttons with their visible label', () => {
    expect(ctaLinks('<a class="btn" data-cta="home-hero" href="/calendar#buy"><span>See the</span> calendar &amp; more</a>')).toEqual([
      { placement: 'home-hero', label: 'See the calendar & more', href: '/calendar#buy' },
    ]);
  });

  it('reads title, h1, indexing and redirects', () => {
    const m = pageMeta(html('<h1>Hello <em>there</em></h1>', '<meta name="robots" content="noindex, follow">'));
    expect(m).toMatchObject({ title: 'T', h1: 'Hello there', indexable: false, redirect_to: null });
    expect(pageMeta(html('', '<meta http-equiv="refresh" content="0;url=/returns">'))).toMatchObject({ indexable: false, redirect_to: '/returns' });
    expect(pageMeta(html('<a href="/checkout?product=mug">Buy</a>')).buys).toBe(true);
  });

  it('types pages', () => {
    const ctx = { tools: new Set(['/planner']) };
    expect(pageType('/', ctx)).toBe('home');
    expect(pageType('/start', { redirect: true })).toBe('companion');
    expect(pageType('/refunds', { redirect: true })).toBe('redirect');
    expect(pageType('/app/week', ctx)).toBe('companion');
    expect(pageType('/resources/x', ctx)).toBe('article');
    expect(pageType('/resources/topics/x', ctx)).toBe('pillar');
    expect(pageType('/real-life-reset-kit', ctx)).toBe('offer');
    expect(pageType('/starter-kit', ctx)).toBe('lead-magnet');
    expect(pageType('/planner', ctx)).toBe('tool');
    expect(pageType('/planner/plus-x', { dynamic: true })).toBe('gated');
    expect(pageType('/new-landing', { buys: true })).toBe('offer');
    expect(pageType('/about', ctx)).toBe('page');
  });

  it('maps pages to their source file', () => {
    const files = ['index.astro', 'calendar.astro', 'routine-chart/index.astro', 'planner/[access].astro', 'resources/[slug].astro', 'resources/topics/[pillar].astro'];
    expect(sourceFile('/', files, [])).toEqual({ file: 'src/pages/index.astro', dynamic: false });
    expect(sourceFile('/routine-chart', files, [])).toEqual({ file: 'src/pages/routine-chart/index.astro', dynamic: false });
    expect(sourceFile('/resources/zone', files, ['zone'])).toEqual({ file: 'src/content/articles/zone.mdx', dynamic: false });
    expect(sourceFile('/resources/topics/home', files, [])).toEqual({ file: 'src/pages/resources/topics/[pillar].astro', dynamic: false });
    expect(sourceFile('/planner/plus-abc', files, [])).toEqual({ file: 'src/pages/planner/[access].astro', dynamic: true });
    expect(sourceFile('/nope', files, [])).toEqual({ file: null, dynamic: false });
  });

  it('builds rows: orphans, inbound links, nav, sitemap, broken internal buttons; skips the admin', () => {
    const pages = [
      { path: '/', html: html('<header><a href="/calendar">Cal</a></header><a href="/tools">t</a>') },
      { path: '/calendar', html: html('<a data-cta="buy" href="/checkout">Buy</a><a data-cta="etsy" href="https://www.etsy.com/listing/1">Etsy</a>') },
      { path: '/tools', html: html('<a href="/calendar">c</a>') },
      { path: '/real-life-reset-kit', html: html('<a data-cta="x" href="/gone">Go</a>') },
      { path: '/admin', html: html('') },
      { path: '/admin/orders', html: html('') },
      { path: '/survey/admin', html: html('') },
    ];
    const rows = buildInventory(pages, {
      site: SITE,
      files: ['index.astro', 'calendar.astro', 'tools.astro', 'real-life-reset-kit.astro'],
      articles: [],
      sitemap: sitemapPaths(`<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/calendar</loc></url></urlset>`, SITE),
      nav: navPaths(pages[0].html, SITE),
      exists: (href: string) => ['/checkout', '/', '/calendar', '/tools'].includes(href.split('?')[0]),
    });
    expect(rows.map((r) => r.path)).toEqual(['/', '/calendar', '/real-life-reset-kit', '/tools']);
    const by = Object.fromEntries(rows.map((r) => [r.path, r]));
    expect(by['/calendar']).toMatchObject({ in_nav: true, in_sitemap: true, inbound_links: 2, orphan: false, type: 'offer' });
    expect(by['/real-life-reset-kit']).toMatchObject({ orphan: true, inbound_links: 0 });
    expect(by['/real-life-reset-kit'].ctas[0]).toMatchObject({ href: '/gone', broken: 'missing page' });
    expect(by['/calendar'].ctas.every((c: { broken?: string }) => !c.broken)).toBe(true);
    expect(externalCtas(rows)).toEqual([{ href: 'https://www.etsy.com/listing/1', pages: ['/calendar'] }]);
  });

  it('counts only "gone" answers as broken', () => {
    expect(brokenStatus(404)).toBe(true);
    expect(brokenStatus(410)).toBe(true);
    for (const s of [0, 200, 403, 429, 500]) expect(brokenStatus(s)).toBe(false);
  });
});

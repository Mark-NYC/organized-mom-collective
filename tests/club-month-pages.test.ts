/**
 * The monthly pages are the source of truth (owner, 2026-11-18). src/data/club/month-pages.ts mirrors them; this test
 * fails if a name there is not what the page itself shows, or if anything that names a month on screen stops reading it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MONTH_PAGES } from '../src/data/club/month-pages';

const text = (f: string) => readFileSync(f, 'utf8').replace(/<[^>]+>/g, '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
const norm = (s: string) => s.replace(/[‘’]/g, "'");
const page = (route: string) => `src/pages${route}.astro`;

describe('month pages', () => {
  it('covers all twelve months once, each with its page', () => {
    expect(MONTH_PAGES.map((p) => p.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const p of MONTH_PAGES) expect(existsSync(page(p.route)), p.route).toBe(true);
  });
  it.each(MONTH_PAGES.map((p) => [p.month, p] as const))('month %i: every name is the page’s own words', (_m, p) => {
    const sources = [page(p.route), ...p.source].map(text).join(' ');
    expect(sources).toContain(norm(p.name));
    for (const r of p.resources) {
      if (r.route.startsWith('/app/')) expect(existsSync(page(r.route)), r.route).toBe(true);
      expect(sources).toContain(norm(r.name));
    }
  });
  it('March keeps both resources: the whole-family Family Rhythm and Spring Prep', () => {
    expect(MONTH_PAGES[2].resources.map((r) => r.route)).toEqual(['/app/club/march', '/app/club/march/spring-prep']);
  });
  it('February keeps the laundry guides', () => {
    expect(text('src/pages/app/club/february.astro')).toMatch(/FebruaryLaundryGuides/);
  });
  it('Club Home and the membership tile name months from the pages', () => {
    const lib = readFileSync('src/components/AppKitLibrary.tsx', 'utf8');
    expect(lib).toMatch(/MONTH_PAGES/);
    expect(lib).not.toMatch(/clubResources\.find\(/);
    expect(readFileSync('src/components/club/ClubHomeTiles.tsx', 'utf8')).toMatch(/monthPageName\(me\.next\.month\)/);
  });
});

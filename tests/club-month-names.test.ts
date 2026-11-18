/**
 * Month names agree everywhere a member reads them (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §6b): Club Home's year
 * strip takes each month's name from the resource registry, the registry covers every month once, and the approved
 * months the owner fixed stay fixed (January = the Family Meeting introduction, September = Habit Cards).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clubResources } from '../src/data/club/resources';
import { kits } from '../src/data/club/kits';
import { memberPlanHref } from '../src/lib/club/plan/account';

const library = readFileSync('src/components/AppKitLibrary.tsx', 'utf8');
const copy = library.slice(library.indexOf('const monthCopy = ['), library.indexOf('];', library.indexOf('const monthCopy = [')));

describe('monthly names', () => {
  it('Club Home carries no month names of its own', () => {
    expect(copy).not.toMatch(/"title"\s*:/);
  });
  it('the resource registry covers every calendar month, each edition once (November has 2026 and 2027)', () => {
    const months = clubResources.map((r) => Number(r.month.slice(5, 7)));
    expect([...new Set(months)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(clubResources.map((r) => r.slug)).size).toBe(clubResources.length);
    expect(new Set(clubResources.map((r) => r.month)).size).toBe(clubResources.length);
    expect(clubResources.filter((r) => r.month.endsWith('-11')).map((r) => r.month)).toEqual(['2026-11', '2027-11']);
  });
  it('keeps the owner-approved January and September', () => {
    const by = (m: string) => clubResources.find((r) => r.month === m)!;
    expect(by('2027-01').title).toBe('Our Family Focus'); // the January page's own name
    expect(kits.find((k) => k.month === '2027-01')!.theme).toBe('Our First Family Meeting');
    expect(by('2027-09').title).toBe('Our Family Habit Cards');
    expect(kits.find((k) => k.month === '2027-09')!.theme).toBe('Our Family Habit Cards');
  });
  it('every month but November opens on its app page', () => {
    for (const r of clubResources) {
      const href = memberPlanHref(r.slug);
      if (r.month.endsWith('-11')) expect(href).toBe(`/club/resources/${r.slug}`);
      else expect(href).toMatch(/^\/app\/club\/[a-z]+$/);
    }
  });
});

describe('November prints its own year', () => {
  const src = readFileSync('src/components/club/NovemberOwnershipPrintable.astro', 'utf8');
  it('no fixed year in the headers or the age rule', () => {
    expect(src).not.toMatch(/NOVEMBER 20\d\d/);
    expect(src).not.toMatch(/Math\.max\(2,20\d\d-/);
    expect(src).toMatch(/NOVEMBER \{kitYear\}/);
  });
  it('every page passes the kit period', () => {
    expect(readFileSync('src/pages/club/resources/[slug].astro', 'utf8')).toMatch(/kitMonth=\{resource\.month\}/);
    expect(readFileSync('src/pages/club/worksheet-generator.astro', 'utf8')).toMatch(/kitMonth=\{sampleNovember\}/);
  });
});

describe('November 2027 cannot go live with 2026 meeting ages', () => {
  // /app/club/november is built for one November kit (its meeting works out ages for that kit's month). The day a
  // second November kit is added to the registry, this fails until the page chooses the member's own edition
  // (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §15, "Before November 2027 goes live").
  it('the November meeting page handles every November edition in the registry', () => {
    const novembers = kits.filter((k) => k.month.endsWith('-11')).map((k) => k.month);
    const page = readFileSync('src/pages/app/club/november.astro', 'utf8');
    const pinned = /k\.month === '20\d\d-11'/.test(page);
    expect(novembers.length > 1 && pinned, `November editions ${novembers.join(', ')}; the page pins one`).toBe(false);
  });
});

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
  it('the resource registry names each calendar month exactly once', () => {
    const months = clubResources.map((r) => Number(r.month.slice(5, 7)));
    expect([...new Set(months)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(months.length).toBe(12);
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
      if (r.month === "2026-11") expect(href).toBe(`/club/resources/${r.slug}`);
      else expect(href).toMatch(/^\/app\/club\/[a-z]+$/);
    }
  });
});

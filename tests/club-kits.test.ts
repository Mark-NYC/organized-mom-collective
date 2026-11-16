import { describe, expect, it } from 'vitest';
import { monthlyDeepClean } from '../src/data/cleaning';
import { existsSync, readFileSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';
import { MEETING_MONTHS } from '../src/data/club/family-meeting';
import { clubResourceBySlug } from '../src/data/club/resources';
import { memberPlanHref } from '../src/lib/club/plan/account';
import { clubPrintMessages, clubPrintMobileMessages } from '../src/lib/club-print-deadline';
import { kit as november } from '../src/data/club/kits/2026-11-family-ownership';
import type { KitConfig } from '../src/data/club/types';
import { responsibilities } from '../src/data/responsibilities';
import { routes } from '../src/routes';

describe('club kits: every kit is sound', () => {
  it('passes every check', () => {
    for (const k of kits) expect(kitProblems(k), k.slug).toEqual([]);
  });

  // The product as it is in the kit files today. A month's direction changing is a deliberate edit here, in the same
  // commit as the kit, instead of a per-month test file left describing the draft before it.
  it('each month is the product in its kit file: theme, the one flagship printable and the hosted tool', () => {
    expect(kits.map((k) => [k.slug, k.theme, k.printables.find((p) => p.kind === 'flagship')?.id, k.tool?.tool ?? null])).toEqual([
      ['2026-11-family-ownership', 'Our Family, Our Team', 'ownership-chart', null],
      ['2026-12-christmas-mission', 'Your Christmas Mission Has Arrived!', expect.any(String), null],
      ['2027-01-fresh-start-together', 'Our First Family Meeting', 'family-meeting', null],
      ['2027-02-better-together', 'Better Together', 'connection-challenge', 'connection-planner'],
      ['2027-03-spring-clean-together', 'Our Family Spring Prep', 'spring-prep-family-plan', null],
      ['2027-04-everybody-helps-at-mealtime', 'Everybody Helps at Mealtime', 'dinner-team', 'meal-team'],
      ['2027-05-finish-the-school-year', 'Our Family Summer Rhythm', expect.any(String), 'school-wrap-up'],
      ['2027-06-summer-with-a-plan', 'My Family\'s Snack Station', 'snack-station', null],
      ['2027-07-ready-to-go', 'What Can I Do Right Now?', 'activity-board', null],
      ['2027-08-school-year', 'My School Day', 'school-day', 'routine-chart'],
      ['2027-09-a-week-everyone-can-see', 'Our Family Habit Cards', 'one-thing-plan', 'habit-builder'],
      ['2027-10-home-works-together', 'A Home That Works Together', 'fall-reset', 'chore-chart'],
      ['2027-12-christmas-family-affair', 'Christmas Is a Family Affair', 'christmas-plan', 'traditions-picker'],
    ]);
  });

  // Owner decision 2026-11-16: January is the Family Meeting introduction, September is Habit Cards, everywhere.
  it('January teaches the one four-part, ten-minute Family Meeting; September is the Habit Cards', () => {
    const jan = kitBySlug('2027-01-fresh-start-together')!;
    const sep = kitBySlug('2027-09-a-week-everyone-can-see')!;
    expect(jan.action!.items.map((i) => i.text)).toEqual(MEETING_GUIDE.parts.map((p) => `${p.title}. (${p.minutes} min)`));
    expect(MEETING_GUIDE.parts.reduce((n, p) => n + p.minutes, 0)).toBe(10);
    expect(JSON.stringify(jan)).not.toMatch(/15-minute|fifteen|habit card|family-reset/i);
    expect(sep.theme).toBe('Our Family Habit Cards');
    expect(sep.tool?.tool).toBe('habit-builder');
    expect(clubResourceBySlug(jan.slug)!.title).toBe('Our Family Focus');
    expect(clubResourceBySlug(sep.slug)!.title).toBe('Our Family Habit Cards');
    // The public banner sells the same months.
    const banner = (iso: string) => clubPrintMessages(new Date(iso)).concat(clubPrintMobileMessages(new Date(iso))).join(' | ');
    expect(banner('2026-12-01T12:00:00Z')).toMatch(/January’s Family Meeting Kit/);
    expect(banner('2026-12-01T12:00:00Z')).not.toMatch(/Habit Cards/);
    expect(banner('2027-08-01T12:00:00Z')).toMatch(/September’s Habit Cards/);
  });

  // The banner names each month's resource the way the member pages and the Family Meeting do, so nobody is sold
  // "Connection Cards" and mailed laundry guides.
  it('the public banner names every month’s real resource', () => {
    const key: Record<number, string> = { 1: 'Family', 2: 'Laundry Guides', 3: 'Family Rhythm', 4: 'Dinner Team', 5: 'Summer Day Rhythm', 6: 'Snack Station',
      7: 'Activity Board', 8: 'School Day Routines', 9: 'Habit Cards', 10: '5-Minute Reset', 11: 'Ownership', 12: 'Christmas Mission' };
    const labels = new Set<string>();
    const lines = new Set<string>();
    for (let d = Date.UTC(2026, 11, 1); d < Date.UTC(2027, 11, 30); d += 7 * 86400000) {
      labels.add(clubPrintMobileMessages(new Date(d))[0].split(' · ')[0]);
      lines.add(clubPrintMessages(new Date(d))[0].split('. Order by')[0]);
    }
    expect(labels.size).toBe(12);
    for (const m of MEETING_MONTHS) {
      const name = new Date(Date.UTC(2027, m.month - 1, 15)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
      expect(m.resourceTitle, `${name} resource`).toContain(key[m.month]);
      expect([...labels].find((l) => l.startsWith(name)), `${name} mobile banner`).toContain(key[m.month]);
      expect([...lines].find((l) => l.includes(`${name}’s`)), `${name} banner`).toContain(key[m.month]);
    }
    expect([...labels, ...lines].join(' | ')).not.toMatch(/Connection Cards|Giving Cards|Sunday Reset|Chore Chart|Summer Day Planner|Activity Kit|School Routine Kit/);
  });

  // Every mailed QR code, November 2026 through October 2027: /club/kits/<slug> is a built page, and it sends a
  // member with access to that month's own page, which exists.
  it('every monthly QR code from November 2026 to October 2027 lands on that month’s real member page', () => {
    const year = kits.filter((k) => k.month >= '2026-11' && k.month <= '2027-10');
    expect(year.map((k) => k.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10']);
    const kitPage = readFileSync('src/pages/club/kits/[slug].astro', 'utf8');
    expect(kitPage).toMatch(/planHref=\{planHref\}/);
    for (const k of year) {
      expect(k.mailer.qrPath, k.slug).toBe(`/club/kits/${k.slug}?source=mailer`);
      const dest = memberPlanHref(k.slug);
      if (dest.startsWith('/app/club/')) expect(existsSync(`src/pages${dest}.astro`), `${k.slug} → ${dest}`).toBe(true);
      else {
        // November (and December 2026): the kit page itself is the member page, with its own component.
        expect(dest, k.slug).toBe(`/club/resources/${k.slug}`);
        expect(kitPage, k.slug).toContain(`slug === "${k.slug}"`);
      }
    }
    expect(year.filter((k) => memberPlanHref(k.slug).startsWith('/app/club/')).map((k) => k.month)).toEqual(['2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10']);
  });

  it('every letter is short, and every mailed QR code opens that month\'s own member page', () => {
    for (const k of kits) {
      if (k.mailer.letter) {
        const words = k.mailer.letter.body.split(/\s+/).filter(Boolean).length;
        expect(words, `${k.slug} letter`).toBeGreaterThanOrEqual(60);
        expect(words, `${k.slug} letter`).toBeLessThanOrEqual(220);
      }
      expect(k.mailer.qrPath, k.slug).toBe(`/club/kits/${k.slug}?source=mailer`);
    }
  });

  it('has unique slugs and months, in order', () => {
    expect(new Set(kits.map((k) => k.slug)).size).toBe(kits.length);
    expect(new Set(kits.map((k) => k.month)).size).toBe(kits.length);
    expect([...kits].map((k) => k.month)).toEqual(kits.map((k) => k.month).sort());
    for (const k of kits) expect(kitBySlug(k.slug)).toBe(k);
    expect(kitBySlug('2026-11-nope')).toBeUndefined();
  });

  it('points related links at real free tools', () => {
    const paths = new Set<unknown>(Object.values(routes));
    for (const k of kits) for (const p of k.related ?? []) expect(paths.has(p), `${k.slug} ${p}`).toBe(true);
  });

  it('can’t be scheduled without Megan’s own letter', () => {
    expect(november.mailer.letter).toBeNull();
    expect(schedulable(november)).toBe(false);
    expect(schedulable({ ...november, mailer: { ...november.mailer, letter: { title: 'Dear friend', body: '…' } } })).toBe(true);
  });
});

describe('club kits: the November kit', () => {
  it('matches the year-one calendar', () => {
    expect(november).toMatchObject({ slug: '2026-11-family-ownership', month: '2026-11', theme: 'Our Family, Our Team', engine: 'responsibilities', engineVersion: 1 });
    expect(november.mailer.qrPath).toBe('/club/kits/2026-11-family-ownership?source=mailer');
    expect(november.printables.map((p) => p.id)).toEqual(['ownership-chart', 'kitchen-pantry-reset', 'who-owns-what', 'handing-over']);
    expect(november.printables.find((p) => p.kind === 'flagship')).toMatchObject({ id: 'ownership-chart', page: 'letter-landscape' });
  });

  it('includes every responsibility card, with its own illustration', () => {
    for (const card of responsibilities) {
      expect(november.items.find((i) => i.id === card.id)?.illustration, card.id).toBe(card.id);
    }
  });

  it('reads the team reset from the companion’s November project, never retyped', () => {
    const nov = monthlyDeepClean.find((m) => m.month === 10)!;
    expect(november.reset!.month).toBe(10);
    expect(november.reset!.items.map((i) => [i.id, i.title])).toEqual(nov.tasks.map((t) => [t.id, t.label]));
    expect(november.reset!.items.every((i) => i.scope === 'household' && i.frequency === 'once')).toBe(true);
  });

  it('keeps item ids stable (saved edits point at them; renaming a title is fine, changing an id is not)', () => {
    expect(november.items.map((i) => i.id)).toEqual([
      ...responsibilities.map((r) => r.id),
      'feed-the-pet', 'shoes-and-coats', 'empty-the-dishwasher', 'load-the-dishwasher', 'put-groceries-away', 'water-the-plants', 'wipe-the-bathroom-sink', 'vacuum-the-living-room',
      'close-the-kitchen', 'cook-one-dinner', 'clean-the-bathroom', 'floors', 'dinner-two-nights', 'groceries', 'family-laundry', 'family-calendar', 'school-paperwork', 'appointments', 'birthday-parties', 'bills',
    ]);
  });

  it('gives adults whole jobs and children jobs with a path to owning them', () => {
    const adults = november.items.filter((i) => i.for === 'adult');
    expect(adults.length).toBeGreaterThanOrEqual(6);
    expect(adults.every((i) => i.scope === 'household' && i.effort >= 2)).toBe(true);
    for (const i of november.items.filter((x) => x.for !== 'adult' && x.levels)) expect(i.levels!.at(-1)![1], i.id).toBe('owns');
  });
});

describe('club kits: the checks catch broken kits', () => {
  const broken = (change: (k: KitConfig) => KitConfig) => kitProblems(change(structuredClone(november)));

  it('slug, month and QR', () => {
    expect(broken((k) => ({ ...k, slug: 'november' })).join()).toMatch(/slug/);
    expect(broken((k) => ({ ...k, month: '2026-12' })).join()).toMatch(/slug month/);
    expect(broken((k) => ({ ...k, mailer: { ...k.mailer, qrPath: '/club' } })).join()).toMatch(/qrPath/);
    expect(broken((k) => ({ ...k, engineVersion: 0 })).join()).toMatch(/engineVersion/);
  });

  it('items', () => {
    expect(broken((k) => ({ ...k, items: [...k.items, k.items[0]] })).join()).toMatch(/duplicate id/);
    expect(broken((k) => ({ ...k, items: k.items.map((i, n) => (n === 0 ? { ...i, levels: [[6, 'owns'], [4, 'learning']] } : i)) })).join()).toMatch(/levels must/);
    expect(broken((k) => ({ ...k, items: k.items.map((i, n) => (n === 0 ? { ...i, illustration: 'unicorn' } : i)) })).join()).toMatch(/illustration unicorn/);
    expect(broken((k) => ({ ...k, items: k.items.map((i) => (i.for === 'adult' ? { ...i, minAge: 18 } : i)) })).join()).toMatch(/adult jobs have no ages/);
    expect(broken((k) => ({ ...k, items: k.items.map((i, n) => (n === 0 ? { ...i, excludes: ['ghost'] } : i)) })).join()).toMatch(/excludes unknown ghost/);
    expect(broken((k) => ({ ...k, items: k.items.map((i, n) => (n === 0 ? { ...i, doneMeans: ' ' } : i)) })).join()).toMatch(/doneMeans/);
  });

  it('printables', () => {
    expect(broken((k) => ({ ...k, printables: k.printables.map((p) => ({ ...p, kind: 'worksheet' as const })) })).join()).toMatch(/one flagship/);
    expect(broken((k) => ({ ...k, reset: undefined })).join()).toMatch(/uses the reset/);
  });
});

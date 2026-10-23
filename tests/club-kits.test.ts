import { describe, expect, it } from 'vitest';
import { monthlyDeepClean } from '../src/data/cleaning';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { ownershipBuilder as november } from '../src/data/club/libraries/family-ownership-builder';
import { ownershipJobs } from '../src/data/club/libraries/ownership-jobs';
import type { KitConfig } from '../src/data/club/types';
import { responsibilities } from '../src/data/responsibilities';
import { routes } from '../src/routes';

describe('club kits: every kit is sound', () => {
  it('passes every check', () => {
    for (const k of kits) expect(kitProblems(k), k.slug).toEqual([]);
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
      'close-the-kitchen', 'cook-one-dinner', 'clean-the-bathroom', 'floors', 'dinner-two-nights', 'groceries', 'family-laundry', 'school-paperwork', 'bills',
    ]);
  });

  it('leaves the weekly plan to September: the library keeps its calendar, appointment and party jobs, November skips them', () => {
    const weekly = ['family-calendar', 'appointments', 'birthday-parties'];
    expect(ownershipJobs().filter((i) => weekly.includes(i.id))).toHaveLength(3);
    expect(november.items.filter((i) => weekly.includes(i.id))).toEqual([]);
    expect(november.printables.find((p) => p.id === 'ownership-chart')!.perPerson).toBe(1);
  });

  it('gives adults whole jobs and children jobs with a path to owning them', () => {
    const adults = november.items.filter((i) => i.for === 'adult');
    expect(adults.length).toBeGreaterThanOrEqual(5);
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

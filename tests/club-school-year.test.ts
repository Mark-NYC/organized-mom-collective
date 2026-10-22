/**
 * The school-year item sets kept from August's first draft (src/data/club/libraries/school-year.ts): the launch plan
 * with a per-child school setup, its short list of first actions, and the command center. Not in any kit today; tested
 * so they stay sound for a later one.
 */
import { describe, expect, it } from 'vitest';
import { schoolCommand as command, schoolLaunch as launch } from '../src/data/club/libraries/school-year';
import type { SchoolType } from '../src/data/club/types';
import { initialEdits, resolveDocument, addRow, readEdits, type ChartRow } from '../src/lib/club/edits';
import { eligible, generateOwnership } from '../src/lib/club/engines/responsibilities';
import { topActions } from '../src/lib/club/overview';
import { planMembers, type Household } from '../src/lib/club/profile';
import { defaultSchool, dueLabel, earliestStart, readSetup, schoolSetupFor, withSchool, type SchoolSetup } from '../src/lib/club/school';
import { adult, families, family, kid } from './club/fixtures';

const MONTH = '2027-08';
const overview = { minActions: 5, maxActions: 8 };
const launchOpts = { personal: 'all' as const };

/** A family with each child's school set (defaults otherwise). */
const school = (h: Household, types: Record<string, SchoolType> = {}, start?: string) => {
  const setup: SchoolSetup = {};
  for (const [id, c] of Object.entries(schoolSetupFor(h, MONTH))) setup[id] = { type: types[id] ?? c.type, ...(start ? { start } : {}) };
  return { h: withSchool(h, setup), setup };
};
const launchRows = (h: Household) => resolveDocument(h, launch, MONTH, initialEdits(h, launch, MONTH, launchOpts), launchOpts).rows;
const commandRows = (h: Household) => resolveDocument(h, command, MONTH, initialEdits(h, command, MONTH)).rows;
const itemOf = (r: ChartRow) => [...launch, ...command].find((i) => i.id === r.itemId)!;

describe('school-year library: sound item sets', () => {
  it('has no helping-Mom wording and no id shared between the two sets', () => {
    for (const i of [...launch, ...command]) expect(i.title, i.id).not.toMatch(/\bhelp/i);
    const ids = [...launch, ...command].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('school-year library: school setup', () => {
  it('guesses schools from age and never assumes everyone is in school', () => {
    expect(defaultSchool(2, {})).toBe('none');
    expect(defaultSchool(3, {})).toBe('preschool');
    expect(defaultSchool(5, {})).toBe('public');
    expect(defaultSchool(10, { school: 'homeschool' })).toBe('homeschool');
    expect(defaultSchool(18, {})).toBe('none');
  });

  it('keeps her choices and each child’s own first day', () => {
    const h = families.A;
    const setup = schoolSetupFor(h, MONTH, { ava: { type: 'private', start: '2027-09-02' } });
    expect(setup.ava).toEqual({ type: 'private', start: '2027-09-02' });
    expect(setup.ben.type).toBe('public');
    expect(Object.keys(setup)).toEqual(['ava', 'ben', 'cal']);
    expect(earliestStart({ a: { type: 'public', start: '2027-08-26' }, b: { type: 'preschool', start: '2027-08-19' }, c: { type: 'none', start: '2027-08-01' } })).toBe('2027-08-19');
  });

  it('counts due dates back from the first day', () => {
    expect(dueLabel('2027-08-26', 'two-weeks')).toBe('Aug 12');
    expect(dueLabel('2027-08-26', 'night-before')).toBe('Aug 25');
    expect(dueLabel('2027-09-01', 'one-week')).toBe('Aug 25');
    expect(dueLabel(undefined, 'one-week')).toBeNull();
  });

  it('reads saved setups safely', () => {
    expect(readSetup({ children: { a: { type: 'homeschool', start: '2027-08-30' }, b: { type: 'boarding' }, c: { type: 'public', start: 'soon' } } })).toEqual({
      a: { type: 'homeschool', start: '2027-08-30' },
      c: { type: 'public' },
    });
    expect(readSetup(null)).toEqual({});
  });
});

describe('school-year library: launch plan', () => {
  for (const [name, base] of Object.entries(families)) {
    it(`${name}: every task fits its owner’s age and school, and every child in school has their own list`, () => {
      const { h, setup } = school(base);
      const rows = launchRows(h);
      const people = new Map(planMembers(h, MONTH).map((p) => [p.id, p]));
      for (const r of rows) {
        if (!r.ownerId || r.needsOwner) continue;
        const p = people.get(r.ownerId)!;
        expect(eligible(itemOf(r), p, h.preferences), `${r.rowId} → ${p.id}`).toBe(true);
      }
      for (const [id, c] of Object.entries(setup)) {
        const own = rows.filter((r) => r.ownerId === id && itemOf(r).scope === 'each');
        const age = people.get(id)!.age!;
        if (c.type === 'none') expect(own, id).toEqual([]);
        else if (age >= 3) {
          expect(own.length, id).toBeGreaterThanOrEqual(2);
          expect(own.length, id).toBeLessThanOrEqual(7);
        }
      }
    });
  }

  it('gives a homeschooler no backpack or supply-list tasks, and a homeschool plan to an adult', () => {
    const h0 = family('hh-home', [adult('mom', true), adult('dad'), kid('kit', 8)], { school: 'homeschool' });
    const { h } = school(h0);
    const rows = launchRows(h);
    const ids = rows.map((r) => r.itemId);
    expect(ids).toContain('homeschool-week');
    expect(ids).toContain('my-school-spot');
    for (const x of ['supply-lists', 'school-forms', 'pack-the-night-before', 'label-my-things']) expect(ids).not.toContain(x);
  });

  it('a preschooler gets drop-off practice; a toddler not in school gets nothing', () => {
    // Fixture ages are for November 2026: 3 and 1 then are 4 and 2 by August 2027.
    const { h } = school(family('hh-pre', [adult('a', true), adult('b'), kid('p', 3), kid('t', 1)]));
    const rows = launchRows(h);
    expect(rows.filter((r) => r.ownerId === 'p').map((r) => r.itemId)).toContain('practice-drop-off');
    expect(rows.filter((r) => r.ownerId === 't')).toEqual([]);
  });

  it('mixes schools in one family (private and public, different first days) without assuming a shared start', () => {
    const { h } = school(families.A, { ava: 'private' });
    const rows = launchRows(h);
    expect(rows.filter((r) => r.ownerId === 'ava').length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.ownerId === 'cal').length).toBeGreaterThan(0);
  });

  it('a family with nobody in school gets no school prep at all', () => {
    const { h } = school(families.noKids);
    expect(launchRows(h)).toEqual([]);
    const { h: tots } = school(families.toddlers, { t1: 'none', t2: 'none' });
    expect(launchRows(tots)).toEqual([]);
  });

  it('shares the prep: the account holder never owns most of the shared tasks when there’s another adult', () => {
    for (const base of [families.A, families.D, families.teens, families.grandparent]) {
      const { h } = school(base);
      const shared = launchRows(h).filter((r) => itemOf(r).scope === 'household' && !r.needsOwner);
      const holder = h.members.find((m) => m.isAccountHolder)!.id;
      expect(shared.filter((r) => r.ownerId === holder).length, base.id).toBeLessThanOrEqual(Math.ceil(shared.length / 2));
    }
  });
});

describe('school-year library: overview', () => {
  for (const [name, base] of Object.entries(families)) {
    it(`${name}: 5–8 first actions when anyone is in school, every child in school represented`, () => {
      const { h, setup } = school(base);
      const rows = launchRows(h);
      const top = topActions(rows, launch, overview);
      const inSchool = Object.entries(setup).filter(([, c]) => c.type !== 'none').map(([id]) => id);
      if (!inSchool.length) return expect(top).toEqual([]);
      expect(top.length).toBeGreaterThanOrEqual(Math.min(5, rows.length));
      expect(top.length).toBeLessThanOrEqual(8);
      // Every child with a prioritized task of their own is on it, up to the five child slots (three go to shared prep).
      const owners = new Set(top.map((r) => r.ownerId));
      const withOwn = inSchool.filter((id) => rows.some((r) => r.ownerId === id && itemOf(r).scope === 'each' && itemOf(r).priority !== undefined));
      expect(withOwn.filter((id) => owners.has(id)).length).toBe(Math.min(withOwn.length, 5));
      expect(new Set(top.map((r) => r.rowId)).size).toBe(top.length);
    });
  }

  it('leads with getting the dates on the family calendar', () => {
    const { h } = school(families.A);
    expect(topActions(launchRows(h), launch, overview)[0].itemId).toBe('school-calendar');
  });

  it('follows her edits: a removed task leaves the overview', () => {
    const { h } = school(families.A);
    const e = initialEdits(h, launch, MONTH, launchOpts);
    const before = topActions(resolveDocument(h, launch, MONTH, e, launchOpts).rows, launch, overview);
    const hidden = { ...e, hidden: [before[0].rowId] };
    const after = topActions(resolveDocument(h, launch, MONTH, hidden, launchOpts).rows, launch, overview);
    expect(after.map((r) => r.rowId)).not.toContain(before[0].rowId);
  });
});

describe('school-year library: command center', () => {
  it('names an owner for rides, school email, lunches and papers, shared across the grown-ups', () => {
    const { h } = school(families.A);
    const rows = commandRows(h);
    for (const id of ['morning-drop-off', 'afternoon-pick-up', 'school-messages', 'school-lunches', 'school-papers']) {
      expect(rows.find((r) => r.itemId === id)?.ownerId, id).toBeTruthy();
    }
    const owners = new Set(rows.filter((r) => !r.needsOwner).map((r) => r.ownerId));
    expect(owners.has('mom') && owners.has('dad')).toBe(true);
  });

  it('a one-parent home leaves what doesn’t fit open instead of piling it on her', () => {
    const { h } = school(families.B);
    const rows = commandRows(h);
    const plan = generateOwnership(h, command, MONTH);
    const holder = plan.people.find((p) => p.isAccountHolder)!;
    expect(holder.load).toBeLessThanOrEqual(holder.capacity);
    expect(rows.some((r) => r.needsOwner)).toBe(true);
  });

  it('keeps her recurring commitments beside the jobs, without an owner being required', () => {
    const { h } = school(families.A);
    let e = initialEdits(h, command, MONTH);
    e = addRow(e, h, { title: 'Soccer practice, Tue & Thu 5:30', ownerId: 'ben', section: 'commitment', frequency: 'twice-weekly' });
    e = addRow(e, h, { title: 'Library day, Saturday', ownerId: null, section: 'commitment', frequency: 'weekly' });
    const rows = resolveDocument(h, command, MONTH, readEdits(JSON.parse(JSON.stringify(e)))).rows.filter((r) => r.section === 'commitment');
    expect(rows.map((r) => r.title)).toEqual(['Soccer practice, Tue & Thu 5:30', 'Library day, Saturday']);
  });

  it('a homeschool family gets the lesson plan job and no drop-off', () => {
    const { h } = school(family('hh-home3', [adult('a', true), adult('b'), kid('k', 9)], { school: 'homeschool' }));
    const ids = commandRows(h).map((r) => r.itemId);
    expect(ids).toContain('homeschool-plan');
    expect(ids).not.toContain('morning-drop-off');
  });
});

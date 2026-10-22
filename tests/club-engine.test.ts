import { describe, expect, it } from 'vitest';
import { kit } from '../src/data/club/kits/2026-11-family-ownership';
import { ownershipJobs } from '../src/data/club/libraries/ownership-jobs';
import type { KitItem } from '../src/data/club/types';
import { responsibilities, type Responsibility } from '../src/data/responsibilities';
import { balanceSuggestions, BALANCE_GAP, capacityFor, COACH_FROM_AGE, eligible, generateOwnership, levelFor, STRETCH, type OwnershipPlan } from '../src/lib/club/engines/responsibilities';
import { planMembers, type Household } from '../src/lib/club/profile';
import { adult, families, family, kid, MONTH } from './club/fixtures';

const items = kit.items;
const itemById = new Map(items.map((i) => [i.id, i]));
const plan = (h: Household, list: readonly KitItem[] = items) => generateOwnership(h, list, MONTH);
const people = (h: Household) => new Map(planMembers(h, MONTH).map((p) => [p.id, p]));
const rowsOf = (p: OwnershipPlan, id: string) => p.rows.filter((r) => r.ownerId === id);
const familyLoad = (p: OwnershipPlan, id: string) => p.people.find((x) => x.id === id)!.load;
const all = Object.entries(families);

describe('responsibilities engine: deterministic', () => {
  it('gives the same chart for the same family, every time', () => {
    for (const [name, h] of all) expect(JSON.stringify(plan(h)), name).toBe(JSON.stringify(plan(structuredClone(h))));
  });

  it('picks the same owners whatever order the family was entered in', () => {
    for (const [name, h] of all) {
      const shuffled = { ...h, members: [...h.members].reverse() };
      const owners = (p: OwnershipPlan) => Object.fromEntries(p.rows.map((r) => [r.rowId, r.ownerId]));
      expect(owners(plan(shuffled)), name).toEqual(owners(plan(h)));
    }
  });

  it('breaks ties per family, so two families with the same shape can differ', () => {
    const shape = (id: string) => family(id, [adult('a'), adult('b'), kid('k', 10)]);
    const owners = new Set(Array.from({ length: 12 }, (_, n) => JSON.stringify(plan(shape(`hh-${n}`)).rows.map((r) => [r.rowId, r.ownerId]).sort())));
    expect(owners.size).toBeGreaterThan(1);
  });
});

describe('responsibilities engine: age-appropriate', () => {
  for (const [name, h] of all) {
    it(`${name}: every owner is old enough, adults never get children's jobs and children never get adults'`, () => {
      const ps = people(h);
      for (const r of plan(h).rows) {
        if (!r.ownerId) continue;
        const p = ps.get(r.ownerId)!;
        const item = itemById.get(r.itemId)!;
        expect(eligible(item, p, h.preferences), `${r.rowId} → ${p.id}`).toBe(true);
        if (p.stage === 'adult') {
          expect(item.for, r.rowId).not.toBe('child');
          expect(r.level).toBe('owns');
        } else {
          expect(item.for, r.rowId).not.toBe('adult');
          expect(p.age!).toBeGreaterThanOrEqual(item.minAge ?? 0);
          expect(p.age!).toBeLessThanOrEqual(item.maxAge ?? Infinity);
        }
      }
    });
  }

  it('gives a 3-year-old only small, learning-level jobs', () => {
    const p = plan(families.C);
    const tot = rowsOf(p, 'tot');
    expect(tot.length).toBeGreaterThan(0);
    for (const r of tot) expect(itemById.get(r.itemId)!.minAge ?? 0).toBeLessThanOrEqual(3);
    expect(tot.filter((r) => r.scope === 'household').every((r) => r.level === 'learning')).toBe(true);
  });

  it('gives teens whole jobs they own, and older kids more than younger ones', () => {
    const p = plan(families.teens);
    for (const id of ['flo', 'gil']) {
      const big = rowsOf(p, id).filter((r) => r.scope === 'household' && r.effort >= 3);
      expect(big.length, id).toBeGreaterThan(0);
    }
    const d = plan(families.D);
    const load = (id: string) => familyLoad(d, id);
    expect(load('ivy')).toBeGreaterThan(load('fin'));
    expect(load('hal')).toBeGreaterThan(load('fin'));
  });

  it('treats an 18-year-old still listed as a child like a teen, with no little-kid jobs', () => {
    const p = plan(families.youngAdultAtHome);
    const ty = rowsOf(p, 'ty');
    expect(ty.some((r) => r.effort >= 3)).toBe(true);
    expect(ty.some((r) => r.section === 'self' && itemById.get(r.itemId)!.maxAge! <= 8)).toBe(false);
  });

  it('only gives pets a feeder when the family has pets', () => {
    expect(plan(families.A).rows.some((r) => r.itemId === 'feed-the-pet')).toBe(true);
    expect(plan(families.B).rows.some((r) => r.itemId === 'feed-the-pet')).toBe(false);
  });

  it('honors household requirements on any item', () => {
    const faith: KitItem = { id: 'grace', title: 'Lead grace at dinner', doneMeans: 'Before dinner.', for: 'anyone', minAge: 5, frequency: 'daily', effort: 1, section: 'family', scope: 'household', requires: { faith_content: true } };
    const homeschool: KitItem = { id: 'school-room', title: 'Set up the school table', doneMeans: 'Before lessons.', for: 'anyone', minAge: 6, frequency: 'weekdays', effort: 1, section: 'family', scope: 'household', requires: { school: 'homeschool' } };
    const list = [...items, faith, homeschool];
    const ids = (h: Household) => plan(h, list).rows.map((r) => r.itemId);
    expect(ids(families.D)).not.toContain('grace');
    expect(ids({ ...families.D, preferences: { faith_content: true } })).toContain('grace');
    expect(ids({ ...families.D, preferences: { school: 'homeschool' } })).toContain('school-room');
    expect(ids({ ...families.D, preferences: { school: 'mixed' } })).toContain('school-room');
    expect(ids({ ...families.D, preferences: { school: 'public' } })).not.toContain('school-room');
  });
});

describe('responsibilities engine: ownership, not helping', () => {
  it('words every job as owned, never as helping', () => {
    for (const i of [...items, ...kit.reset!.items]) expect(i.title, i.id).not.toMatch(/\bhelp/i);
    for (const i of items) expect(i.doneMeans.trim().length, i.id).toBeGreaterThan(5);
  });

  for (const [name, h] of all) {
    it(`${name}: one owner per household job, never two of the same job, never two jobs that overlap`, () => {
      const p = plan(h);
      const household = p.rows.filter((r) => r.scope === 'household');
      expect(new Set(household.map((r) => r.itemId)).size).toBe(household.length);
      const on = new Set(household.map((r) => r.itemId));
      for (const r of household) for (const x of itemById.get(r.itemId)!.excludes ?? []) expect(on.has(x), `${r.itemId} and ${x}`).toBe(false);
      const personal = p.rows.filter((r) => r.scope === 'each');
      expect(new Set(personal.map((r) => r.rowId)).size).toBe(personal.length);
      for (const r of personal) expect(r.rowId).toBe(`${r.itemId}~${r.ownerId}`);
    });

    it(`${name}: capacity is guidance: only core jobs stretch a teen or adult past it, a little, never a child or the account holder`, () => {
      const p = plan(h);
      for (const x of p.people) {
        if (x.isAccountHolder || x.stage === 'child') expect(x.load, x.id).toBeLessThanOrEqual(x.capacity);
        else expect(x.load, x.id).toBeLessThanOrEqual(x.capacity * STRETCH);
        expect(x.over).toBe(x.load > x.capacity);
      }
      for (const x of p.people.filter((y) => y.over)) {
        // Whatever took them past guidance was a core job.
        const extras = p.rows.filter((r) => r.ownerId === x.id && r.scope === 'household' && !r.core);
        const coreLoad = x.load - extras.reduce((t, r) => t + r.effort, 0);
        expect(coreLoad, x.id).toBeGreaterThan(x.capacity - Math.max(0, ...extras.map((r) => r.effort)) - 1);
      }
    });

    it(`${name}: the account holder isn't the default catch-all, and coaches no more than any other adult`, () => {
      const p = plan(h);
      const adults = p.people.filter((x) => x.stage === 'adult');
      const holder = adults.find((x) => x.isAccountHolder);
      if (!holder) return;
      const open = p.rows.filter((r) => r.ownerId === null);
      const holderRows = p.rows.filter((r) => r.ownerId === holder.id && r.scope === 'household');
      // Never everything: either others own household jobs too, or what's left is honestly open.
      const othersOwn = p.rows.some((r) => r.ownerId && r.ownerId !== holder.id && r.scope === 'household');
      expect(othersOwn || open.length > 0 || holderRows.length === 0).toBe(true);
      for (const o of adults.filter((x) => x !== holder)) expect(holder.coaching, o.id).toBeLessThanOrEqual(o.coaching);
    });

    it(`${name}: core jobs are never dropped: each has an owner or says it needs one`, () => {
      const p = plan(h);
      const ps = [...people(h).values()];
      const on = new Set(p.rows.map((r) => r.itemId));
      for (const i of items) {
        if (!i.core || i.scope !== 'household' || !ps.some((x) => eligible(i, x, h.preferences))) continue;
        const excludedBy = p.rows.some((r) => itemById.get(r.itemId)!.excludes?.includes(i.id)) || (i.excludes ?? []).some((x) => on.has(x));
        expect(on.has(i.id) || excludedBy, i.id).toBe(true);
      }
    });

    it(`${name}: a coach is never the owner, and is an adult or a teen old enough`, () => {
      const ps = people(h);
      for (const r of plan(h).rows) {
        if (!r.coachId) continue;
        expect(r.coachId).not.toBe(r.ownerId);
        const c = ps.get(r.coachId)!;
        const o = ps.get(r.ownerId!)!;
        expect(c.stage === 'adult' || (c.age! >= COACH_FROM_AGE && c.age! - o.age! >= 3), r.rowId).toBe(true);
        expect(r.level).not.toBe('owns');
      }
    });
  }

  it('gives every child old enough at least one job for the family, not just their own room', () => {
    for (const h of [families.A, families.B, families.D, families.bigSolo, families.grandparent]) {
      for (const x of planMembers(h, MONTH).filter((m) => m.stage !== 'adult' && m.age! >= 4)) {
        expect(plan(h).rows.some((r) => r.ownerId === x.id && r.section === 'family'), `${h.id} ${x.id}`).toBe(true);
      }
    }
  });

  it('gives adults whole jobs and both adults real ones', () => {
    for (const h of [families.A, families.C, families.D, families.noKids, families.teens]) {
      const p = plan(h);
      for (const a of p.people.filter((x) => x.stage === 'adult')) {
        expect(rowsOf(p, a.id).some((r) => itemById.get(r.itemId)!.for === 'adult'), `${h.id} ${a.id}`).toBe(true);
        expect(a.load, `${h.id} ${a.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('balances two adults with no account holder flag too', () => {
    const p = plan(families.noHolderFlag);
    const [u, v] = ['uma', 'val'].map((id) => familyLoad(p, id));
    expect(Math.abs(u - v)).toBeLessThanOrEqual(5);
  });

  it('shares the work with a grandparent at home', () => {
    const p = plan(families.grandparent);
    expect(familyLoad(p, 'nan')).toBeGreaterThan(0);
    expect(familyLoad(p, 'liz')).toBeLessThanOrEqual(Math.max(familyLoad(p, 'max'), familyLoad(p, 'nan')));
  });
});

describe('responsibilities engine: leftovers never fall to the parent by default', () => {
  it('a single adult with no children gets a full week, and the rest says "Needs an owner"', () => {
    const p = plan(families.soloNoKids);
    expect(familyLoad(p, 'cy')).toBeLessThanOrEqual(capacityFor({ stage: 'adult', age: null }));
    const open = p.rows.filter((r) => r.ownerId === null);
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((r) => r.core && r.level === null && r.coachId === null)).toBe(true);
  });

  it('a single parent with six children shares it out, and kids own more', () => {
    const p = plan(families.bigSolo);
    expect(familyLoad(p, 'hen')).toBeLessThanOrEqual(16);
    const kidsLoad = p.people.filter((x) => x.stage !== 'adult').reduce((s, x) => s + x.load, 0);
    expect(kidsLoad).toBeGreaterThan(familyLoad(p, 'hen'));
  });

  it('moves children up a level when one adult runs the house (never their eligibility)', () => {
    const ps = new Map(planMembers(families.B, MONTH).map((p) => [p.id, p]));
    const setTable = itemById.get('set-the-table')!;
    expect(levelFor(setTable, ps.get('dee')!, 1)).toBe('owns'); // 6 → treated as 7 for the level
    expect(levelFor(setTable, ps.get('dee')!, 0)).toBe('with-check');
    const solo = plan(families.B);
    const twoAdults = plan({ ...families.B, members: [...families.B.members, adult('co')] });
    const rank = { learning: 0, 'with-check': 1, owns: 2 } as const;
    for (const r of solo.rows.filter((x) => x.ownerId === 'dee')) {
      const same = twoAdults.rows.find((x) => x.rowId === r.rowId && x.ownerId === 'dee');
      if (same) expect(rank[r.level!]).toBeGreaterThanOrEqual(rank[same.level!]);
      expect(eligible(itemById.get(r.itemId)!, ps.get('dee')!, {})).toBe(true);
    }
  });

  it('extras only go to someone with room; they never become "Needs an owner"', () => {
    for (const [, h] of all) for (const r of plan(h).rows.filter((x) => x.ownerId === null)) expect(r.core).toBe(true);
  });
});

describe('responsibilities engine: capacity as guidance', () => {
  const big = (id: string, effort: KitItem['effort'], forWho: KitItem['for'] = 'adult'): KitItem => ({
    id, title: `Whole job ${id}`, doneMeans: 'Done.', for: forWho, frequency: 'weekly', effort, section: 'family', scope: 'household', core: true,
  });

  it('stretches someone other than the account holder for a core job nobody has room for', () => {
    // 4 × 5 = 20 points of adult-only core work for two adults with 16 each: everyone has room until the end.
    const list = [big('a1', 5), big('a2', 5), big('a3', 5), big('a4', 5), big('a5', 5), big('a6', 5), big('a7', 4)];
    const h = family('hh-stretch', [adult('hold', true), adult('part')]);
    const p = plan(h, list);
    const part = p.people.find((x) => x.id === 'part')!;
    const hold = p.people.find((x) => x.id === 'hold')!;
    expect(hold.load).toBeLessThanOrEqual(hold.capacity);
    expect(part.load).toBeGreaterThan(part.capacity);
    expect(part.load).toBeLessThanOrEqual(part.capacity * STRETCH);
    expect(part.over).toBe(true);
  });

  it('leaves core work open rather than stretching the account holder', () => {
    const list = [big('a1', 5), big('a2', 5), big('a3', 5), big('a4', 5)];
    const p = plan(family('hh-solo-stretch', [adult('hold', true)]), list);
    expect(p.people[0].load).toBeLessThanOrEqual(16);
    expect(p.rows.filter((r) => r.ownerId === null).map((r) => r.itemId)).toEqual(['a4']);
  });

  it('never stretches anyone for an extra', () => {
    const list = [big('a1', 5), big('a2', 5), big('a3', 5), { ...big('extra', 3), core: false }];
    const p = plan(family('hh-extra', [adult('hold', true)]), list);
    expect(p.rows.map((r) => r.itemId)).not.toContain('extra');
  });

  it('doesn’t force equal adult counts: the lean is a preference, not a rule', () => {
    // One adult-only big job and one small job anyone can do: no reason to split them evenly.
    const list = [big('dinner', 5), { ...big('plants', 1, 'anyone'), core: false }];
    const p = plan(family('hh-lean', [adult('hold', true), adult('part')]), list);
    const owners = Object.fromEntries(p.rows.map((r) => [r.itemId, r.ownerId]));
    expect(owners.dinner).toBe('part');
    expect(new Set(Object.values(owners)).size).toBeGreaterThanOrEqual(1);
  });
});

describe('responsibilities engine: workload balance suggestions', () => {
  const asRows = (p: OwnershipPlan, locked: string[] = []) => p.rows.map((r) => ({ rowId: r.rowId, itemId: r.itemId, ownerId: r.ownerId, locked: locked.includes(r.rowId) }));

  it('suggests moving jobs to a partner who joins a chart one parent was running', () => {
    const solo = family('hh-bal', [adult('mom', true), kid('ben', 9)]);
    const chart = asRows(plan(solo));
    const withPartner = { ...solo, members: [...solo.members, adult('dad')] };
    const moves = balanceSuggestions(withPartner, items, MONTH, chart);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.fromId === 'mom' && m.toId === 'dad')).toBe(true);
    for (const m of moves) expect(m.to.after).toBeLessThanOrEqual(capacityFor({ stage: 'adult', age: null }));
    // Each move narrows the gap.
    for (const m of moves) expect(Math.abs(m.from.after - m.to.after)).toBeLessThan(m.from.before - m.to.before);
  });

  it('never suggests moving a job she assigned herself', () => {
    const solo = family('hh-bal2', [adult('mom', true), kid('ben', 9)]);
    const p = plan(solo);
    const momRows = p.rows.filter((r) => r.ownerId === 'mom').map((r) => r.rowId);
    const withPartner = { ...solo, members: [...solo.members, adult('dad')] };
    expect(balanceSuggestions(withPartner, items, MONTH, asRows(p, momRows))).toEqual([]);
  });

  it('suggests nothing on a chart that’s already even', () => {
    for (const h of [families.A, families.D, families.noKids]) {
      const p = plan(h);
      const adults = p.people.filter((x) => x.stage === 'adult');
      const gap = Math.max(...adults.map((x) => x.load)) - Math.min(...adults.map((x) => x.load));
      const moves = balanceSuggestions(h, items, MONTH, asRows(p));
      if (gap < BALANCE_GAP && !p.people.some((x) => x.over)) expect(moves, h.id).toEqual([]);
    }
  });

  it('never suggests moving work onto the account holder', () => {
    for (const [, h] of all) {
      const p = plan(h);
      const holder = p.people.find((x) => x.isAccountHolder)?.id;
      for (const m of balanceSuggestions(h, items, MONTH, asRows(p))) expect(m.toId).not.toBe(holder);
    }
    // Even when she's carrying far less than a partner.
    const h = family('hh-light', [adult('mom', true), adult('dad')]);
    const rows = plan(h).rows.map((r) => ({ rowId: r.rowId, itemId: r.itemId, ownerId: 'dad', locked: false }));
    expect(balanceSuggestions(h, items, MONTH, rows).every((m) => m.toId !== 'mom')).toBe(true);
  });

  it('is deterministic and capped', () => {
    const solo = family('hh-bal3', [adult('mom', true), kid('k', 10), kid('l', 12)]);
    const chart = asRows(plan(solo));
    const h = { ...solo, members: [...solo.members, adult('dad')] };
    expect(balanceSuggestions(h, items, MONTH, chart)).toEqual(balanceSuggestions(structuredClone(h), items, MONTH, chart));
    expect(balanceSuggestions(h, items, MONTH, chart, 1)).toHaveLength(1);
  });

  it('moves work off anyone past guidance onto someone with room', () => {
    const h = family('hh-over', [adult('mom', true), adult('dad'), adult('gran', false, 'grandparent'), kid('teen', 15)]);
    const p = plan(h);
    // Put every adult whole job on dad by hand-built chart (not locked), as if the family had been edited that way.
    const rows = p.rows.map((r) => ({ rowId: r.rowId, itemId: r.itemId, ownerId: itemById.get(r.itemId)!.for === 'adult' ? 'dad' : r.ownerId, locked: false }));
    const moves = balanceSuggestions(h, items, MONTH, rows);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0].fromId).toBe('dad');
    expect(moves.every((m) => m.toId === 'gran')).toBe(true);
  });
});

describe('responsibilities engine: the responsibility library', () => {
  it('uses every illustrated card somewhere across our test families', () => {
    const used = new Set(all.flatMap(([, h]) => plan(h).rows.map((r) => r.illustration).filter(Boolean)));
    for (const card of responsibilities) expect(used.has(card.id), card.id).toBe(true);
  });

  it('turns a card added to the library later into a recommendation, with sensible defaults', () => {
    const card: Responsibility = { id: 'sweep-the-porch', title: 'Sweep the Porch', category: 'home', image: true, routines: ['weekend'], minAge: 8 };
    const list = ownershipJobs([...responsibilities, card]);
    const item = list.find((i) => i.id === 'sweep-the-porch')!;
    expect(item).toMatchObject({ illustration: 'sweep-the-porch', section: 'family', scope: 'household', for: 'anyone', minAge: 8 });
    expect(item.levels![0]).toEqual([8, 'learning']);
    const roomCard: Responsibility = { id: 'water-my-plant', title: 'Water My Plant', category: 'room', image: true, routines: [], minAge: 4 };
    const roomItem = ownershipJobs([...responsibilities, roomCard]).find((i) => i.id === 'water-my-plant')!;
    expect(roomItem).toMatchObject({ section: 'space', scope: 'each', for: 'child' });
    // A family with older kids who have room picks the new household job up.
    const h = family('hh-new', [adult('a', true), adult('b'), kid('k', 9), kid('l', 10), kid('m', 11)]);
    expect(plan(h, list).rows.some((r) => r.itemId === 'sweep-the-porch')).toBe(true);
  });

  it('shows each card’s own illustration and keeps chart wording separate from the card title where it matters', () => {
    for (const card of responsibilities) expect(items.find((i) => i.id === card.id)?.illustration).toBe(card.id);
    expect(items.find((i) => i.id === 'help-with-laundry')!.title).not.toMatch(/help/i);
  });
});

describe('responsibilities engine: pinned rows (what she already has)', () => {
  it('keeps pinned owners, counts their load and places everything else around them', () => {
    const h = families.A;
    const pinned = [{ rowId: 'dinner-two-nights', itemId: 'dinner-two-nights', ownerId: 'mom' }];
    const p = generateOwnership(h, items, MONTH, pinned);
    const row = p.rows.find((r) => r.rowId === 'dinner-two-nights')!;
    expect(row).toMatchObject({ ownerId: 'mom', pinned: true });
    expect(p.rows.filter((r) => r.itemId === 'dinner-two-nights')).toHaveLength(1);
    expect(familyLoad(p, 'mom')).toBeGreaterThanOrEqual(5);
  });

  it('offers an owner for a pinned job that has none, under the same row id', () => {
    const p = generateOwnership(families.A, items, MONTH, [{ rowId: 'set-the-table', itemId: 'set-the-table', ownerId: null }]);
    const row = p.rows.find((r) => r.rowId === 'set-the-table')!;
    expect(row.pinned).toBe(false);
    expect(row.ownerId).not.toBeNull();
  });

  it('runs the team reset from the companion’s November project the same way', () => {
    const p = generateOwnership(families.A, kit.reset!.items, MONTH);
    expect(p.rows.map((r) => r.itemId).sort()).toEqual(kit.reset!.items.map((i) => i.id).sort());
    expect(p.rows.some((r) => r.ownerId === 'cal')).toBe(true);
  });
});

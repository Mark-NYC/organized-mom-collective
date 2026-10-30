import { describe, expect, it, beforeEach } from 'vitest';
import {
  activitiesToDb, emptyProfile, markStep, nextOpenStep, profileFromDb, responsibilitiesToDb, scopeOf, SETUP_STEPS, stepNumber,
  validateActivities, validateResponsibilities, type DbProfile,
} from '../src/lib/club/family-profile';
import { ACTIVITY_CATEGORIES, CHALLENGES, GROWTH_ITEMS, PRIORITIES, RESPONSIBILITY_CATEGORIES } from '../src/data/club/family-profile';
import { resetSample, sampleStore } from '../src/lib/club/store';
import { clock, summary } from '../src/components/club/FamilySetup';
import { readFileSync, existsSync } from 'node:fs';

const people = new Set(['a', 'b', 'k']);

describe('family profile: setup steps', () => {
  it('starts at the first open step and resumes where she stopped', () => {
    expect(nextOpenStep(emptyProfile())).toBe('week');
    expect(nextOpenStep({ setupDone: ['week', 'responsibilities'], setupCompleted: false })).toBe('growth');
    expect(nextOpenStep({ setupDone: ['week', 'growth'], setupCompleted: false })).toBe('responsibilities');
  });

  it('is complete only when every step was answered or skipped', () => {
    let p = emptyProfile();
    for (const s of SETUP_STEPS.slice(0, -1)) p = markStep(p, s);
    expect(p.setupCompleted).toBe(false);
    p = markStep(p, 'priority');
    expect(p.setupCompleted).toBe(true);
    expect(nextOpenStep(p)).toBeNull();
    expect(markStep(p, 'week').setupDone).toHaveLength(5);
  });

  it('numbers the steps after the family form', () => {
    expect(stepNumber('family')).toBe(1);
    expect(stepNumber('week')).toBe(2);
    expect(stepNumber('priority')).toBe(6);
  });
});

describe('family profile: owners, helpers and scope', () => {
  it('one owner is individual, two or more shared, none unassigned', () => {
    expect(scopeOf([])).toBeUndefined();
    expect(scopeOf(['a'])).toBe('individual');
    expect(scopeOf(['a', 'b'])).toBe('shared');
  });

  it('refuses someone who both owns and helps, and strangers', () => {
    expect(validateResponsibilities([{ status: 'existing', category: 'meals', ownerIds: ['a'], helperIds: ['a'] }], people).join()).toMatch(/both owns and helps/);
    expect(validateResponsibilities([{ status: 'existing', category: 'meals', ownerIds: ['zed'], helperIds: [] }], people).join()).toMatch(/unknown person/);
    expect(validateResponsibilities([{ status: 'suggested', category: 'meals', ownerIds: [], helperIds: [] }], people).join()).toMatch(/only existing or desired/);
  });

  it('never sends a helper who is also an owner', () => {
    expect(responsibilitiesToDb([{ status: 'existing', category: 'meals', ownerIds: ['a'], helperIds: ['a', 'b'] }])[0].helper_ids).toEqual(['b']);
  });
});

describe('family profile: activities', () => {
  it('everything but the category is optional', () => {
    expect(validateActivities([{ category: 'school', memberIds: [], days: [] }], people)).toEqual([]);
    expect(activitiesToDb([{ category: 'school', memberIds: [], days: [] }])[0]).toEqual({ category: 'school', name: null, member_ids: [], days: [], starts_at: null });
  });

  it('checks days, times, names and people', () => {
    expect(validateActivities([{ category: 'sports', memberIds: [], days: [7] }], people).join()).toMatch(/day/);
    expect(validateActivities([{ category: 'sports', memberIds: [], days: [], startsAt: '25:00' }], people).join()).toMatch(/time/);
    expect(validateActivities([{ category: 'sports', memberIds: [], days: [], name: ' ' }], people).join()).toMatch(/name/);
    expect(validateActivities([{ category: 'sports', memberIds: ['zed'], days: [] }], people).join()).toMatch(/unknown person/);
  });

  it('reads back what she told us on one line', () => {
    const members = [{ id: 'k', firstName: 'Ava', kind: 'child' as const, role: 'child' as const, birthYear: 2018 }];
    expect(summary({ category: 'sports', name: 'Soccer', memberIds: ['k'], days: [4, 2], startsAt: '17:30' }, members)).toBe('Soccer · Ava · Tue, Thu · 5:30 PM');
    expect(summary({ category: 'school', memberIds: [], days: [] }, members)).toBe('');
    expect(clock('00:05')).toBe('12:05 AM');
    expect(clock('12:00')).toBe('12:00 PM');
  });
});

describe('family profile: database shape', () => {
  it('round-trips the database answer', () => {
    const db: DbProfile = {
      setup_done: ['week'], setup_completed: false, challenges: ['routines'], challenge_note: null, priority: 'mornings', priority_note: 'Shoes!',
      activities: [{ id: 'x', category: 'sports', name: 'Soccer', member_ids: ['k'], days: [2], starts_at: '17:30' }],
      responsibilities: [{ id: 'r', status: 'existing', category: 'meals', item: null, label: null, owner_ids: ['a', 'b'], helper_ids: [], scope: 'shared' }],
    };
    const p = profileFromDb(db);
    expect(p).toMatchObject({ setupDone: ['week'], priority: 'mornings', priorityNote: 'Shoes!', challenges: ['routines'] });
    expect(p.responsibilities[0]).toEqual({ id: 'r', status: 'existing', category: 'meals', ownerIds: ['a', 'b'], helperIds: [], scope: 'shared' });
    expect(activitiesToDb(p.activities)[0]).toEqual({ id: 'x', category: 'sports', name: 'Soccer', member_ids: ['k'], days: [2], starts_at: '17:30' });
  });

  it('uses only the categories the database accepts', () => {
    const sql = readFileSync('supabase/migrations/20261109000000_club_family_profile.sql', 'utf8');
    for (const c of ACTIVITY_CATEGORIES) expect(sql).toContain(`'${c.id}'`);
    for (const c of [...RESPONSIBILITY_CATEGORIES, ...GROWTH_ITEMS.map((g) => ({ id: g.category }))]) expect(sql).toContain(`'${c.id}'`);
    for (const c of [...CHALLENGES, ...PRIORITIES, ...GROWTH_ITEMS]) expect(c.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('every icon the choices name exists', () => {
    for (const c of [...ACTIVITY_CATEGORIES, ...RESPONSIBILITY_CATEGORIES]) if (c.icon) expect(existsSync(`public${c.icon}`), c.icon).toBe(true);
  });
});

describe('family profile: the sample store behaves like the database', () => {
  beforeEach(() => resetSample('rivera'));

  it('saves each step, keeps existing and desired apart, and completes', async () => {
    const store = sampleStore('rivera')!;
    const h = (await store.household())!;
    const [ana, , sofia] = h.members;
    expect((await store.profile())!.setupDone).toEqual([]);
    await store.saveActivities([{ category: 'school', memberIds: [sofia.id], days: [1, 2, 3, 4, 5] }]);
    await store.saveResponsibilities('existing', [{ status: 'existing', category: 'laundry', ownerIds: [ana.id], helperIds: [ana.id, sofia.id] }]);
    let p = await store.saveResponsibilities('desired', [{ status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: [sofia.id], helperIds: [] }]);
    expect(p.responsibilities.find((r) => r.status === 'existing')).toMatchObject({ scope: 'individual', helperIds: [sofia.id] });
    p = await store.saveResponsibilities('desired', []);
    expect(p.responsibilities.map((r) => r.status)).toEqual(['existing']);
    await store.saveFocus('challenges', { challenges: ['routines', 'routines'] });
    p = await store.saveFocus('priority', { challenges: ['routines'], priority: 'mornings', priorityNote: '  out the door ' });
    expect(p).toMatchObject({ setupCompleted: true, challenges: ['routines'], priority: 'mornings', priorityNote: 'out the door' });
    // Saving the family again leaves the profile alone.
    await store.saveHousehold({ preferences: {}, members: h.members.filter((m) => !m.archived).map((m) => ({ id: m.id, firstName: m.firstName, kind: m.kind, role: m.role, birthYear: m.birthYear, birthMonth: m.birthMonth, isAccountHolder: m.isAccountHolder })) });
    expect((await store.profile())!.activities).toHaveLength(1);
  });
});

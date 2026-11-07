import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { assignTasks, canDo, type PlanTask } from './assign';
import { isTaskEdits, ownerLabel, pruneTaskEdits, setTaskOwners, setTaskSkip, setTaskTitle, toggleTaskOwner, withEdits } from './edits';
import { activitiesOf, existingFor, familyContext, familySnapshot, isFamilySnapshot, nameList, schoolStartFor, settledSnapshot, wishedFor } from './family';

const sample = (id: string) => sampleHouseholds.find((s) => s.id === id)!;
const ctxOf = (id: string, month = '2027-08') => {
  const s = sample(id);
  return familyContext(s.household.members, s.household.preferences, month, familySnapshot(s.profile));
};

describe('shared family personalization: the family', () => {
  it('people by stable member id, ages for the month, January’s stages, archived left out', () => {
    const ctx = ctxOf('rivera');
    expect(ctx.people.map((p) => [p.id, p.name, p.age, p.stage])).toEqual([
      ['sample-rivera-ana', 'Ana', null, 'adult'], ['sample-rivera-luis', 'Luis', null, 'adult'],
      ['sample-rivera-sofia', 'Sofia', 11, 'middle'], ['sample-rivera-mateo', 'Mateo', 8, 'early'], ['sample-rivera-elena', 'Elena', 5, 'preschool'],
    ]);
    expect(ctx.people.find((p) => p.holder)!.name).toBe('Ana');
    const s = sample('rivera');
    const gone = familyContext(s.household.members.map((m) => (m.firstName === 'Mateo' ? { ...m, archived: true } : m)), {}, '2027-08');
    expect(gone.children.map((c) => c.name)).toEqual(['Sofia', 'Elena']);
  });

  it('reads her answers: who owns what, wishes, activities, school start', () => {
    const ctx = ctxOf('rivera');
    expect(existingFor(ctx, 'transportation').owners).toEqual(['sample-rivera-luis']);
    expect(existingFor(ctx, 'meals').helpers).toEqual(['sample-rivera-sofia']);
    expect(wishedFor(ctx, ['pack-school-bag']).ids).toEqual(['sample-rivera-sofia']);
    expect(wishedFor(ctx, ['put-away-laundry']).anyone).toBe(true);
    expect(activitiesOf(ctx, 'sample-rivera-sofia', 'sports').map((a) => a.name)).toEqual(['Soccer']);
    expect(schoolStartFor(ctx, 'sample-rivera-mateo')).toBe('08:00');
    expect(schoolStartFor(ctx, 'sample-rivera-elena')).toBeUndefined();
    expect(ctx.pets).toBe(true);
  });

  it('handles missing and limited profiles: nothing known, nothing invented', () => {
    const b = familyContext(sample('brooks').household.members, {}, '2027-08');
    expect(b.snapshot).toBeUndefined();
    expect(existingFor(b, 'meals')).toEqual({ owners: [], helpers: [] });
    expect(wishedFor(b, ['pack-school-bag'])).toEqual({ ids: [], anyone: false });
    expect(familySnapshot(null)).toBeUndefined();
    expect(familySnapshot({ setupDone: [], setupCompleted: false, challenges: [], activities: [], responsibilities: [] })).toBeUndefined();
    // A child with no birth year has no age and January's 'child' stage.
    const noAge = familyContext([{ id: 'k', firstName: 'Kit', kind: 'child' }, { id: 'a', firstName: 'Al', kind: 'adult' }], {}, '2027-08');
    expect(noAge.children[0]).toMatchObject({ age: null, stage: 'child' });
  });

  it('a snapshot is checked, settled once saved, and names nobody who has left', () => {
    const snap = familySnapshot(sample('rivera').profile)!;
    expect(isFamilySnapshot(JSON.parse(JSON.stringify(snap)))).toBe(true);
    expect(isFamilySnapshot({ v: 1, activities: [{ category: 'x', memberIds: [], days: [], startsAt: '25:00' }], responsibilities: [] })).toBe(false);
    const newer = { ...snap, activities: [] };
    expect(settledSnapshot(snap, newer)).toBe(snap);
    expect(settledSnapshot(undefined, newer)).toBe(newer);
    const s = sample('rivera');
    const without = familyContext(s.household.members.filter((m) => m.firstName !== 'Luis'), {}, '2027-08', snap);
    expect(existingFor(without, 'transportation').owners).toEqual([]);
  });

  it('names read naturally', () => {
    expect(nameList(['Sofia'])).toBe('Sofia');
    expect(nameList(['Sofia', 'Mateo'])).toBe('Sofia and Mateo');
    expect(nameList(['Sofia', 'Mateo', 'Elena'])).toBe('Sofia, Mateo and Elena');
    const ctx = ctxOf('rivera');
    expect(ownerLabel(ctx, ctx.people.map((p) => p.id))).toBe('Everyone');
  });
});

describe('shared family personalization: who does what', () => {
  const tasks: PlanTask[] = [
    { id: 'drive', title: 'Drive', mode: 'one', who: 'adult', areas: ['transportation'] },
    { id: 'a', title: 'A', mode: 'one', who: 'adult' },
    { id: 'b', title: 'B', mode: 'one', who: 'adult' },
    { id: 'c', title: 'C', mode: 'one', who: 'adult' },
    { id: 'bag', title: 'Bag', mode: 'one', who: 'child', minAge: 5, wishes: ['pack-school-bag'] },
    { id: 'beds', title: 'Beds', mode: 'each', who: 'child', minAge: 4 },
    { id: 'lunch', title: 'Lunch', mode: 'one', who: 'any', minAge: 10 },
    { id: 'old', title: 'Old', mode: 'one', who: 'child', minAge: 30 },
  ];
  it('keeps existing owners and wishes, spreads the rest, and never defaults to the account holder', () => {
    const ctx = ctxOf('rivera');
    const out = Object.fromEntries(assignTasks(tasks, ctx).map((a) => [a.id, a]));
    expect(out.drive).toMatchObject({ ownerIds: ['sample-rivera-luis'], why: 'existing' });
    expect(out.bag).toMatchObject({ ownerIds: ['sample-rivera-sofia'], why: 'wished' });
    expect(out.beds.ownerIds).toEqual(['sample-rivera-sofia', 'sample-rivera-mateo', 'sample-rivera-elena']);
    // 'any' prefers a child who can: Sofia (11) makes lunch.
    expect(out.lunch.ownerIds).toEqual(['sample-rivera-sofia']);
    expect(out.old).toMatchObject({ ownerIds: [], why: 'none' });
    const adultJobs = ['drive', 'a', 'b', 'c'].map((k) => out[k].ownerIds[0]);
    expect(adultJobs.filter((i) => i === 'sample-rivera-ana').length).toBeLessThanOrEqual(adultJobs.filter((i) => i === 'sample-rivera-luis').length);
  });

  it('is deterministic, and a single parent still has every grown-up job covered', () => {
    const ctx = ctxOf('rivera');
    expect(JSON.stringify(assignTasks(tasks, ctx))).toBe(JSON.stringify(assignTasks(tasks, ctx)));
    const solo = familyContext(sample('brooks').household.members, {}, '2027-08');
    for (const a of assignTasks(tasks.filter((t) => t.who === 'adult'), solo)) expect(a.ownerIds).toEqual(['sample-brooks-jess']);
  });

  it('ages gate children; grown-ups can do grown-up and any jobs', () => {
    const ctx = ctxOf('rivera');
    const elena = ctx.people.find((p) => p.name === 'Elena')!;
    expect(canDo({ who: 'child', minAge: 6 }, elena)).toBe(false);
    expect(canDo({ who: 'child', minAge: 5 }, elena)).toBe(true);
    expect(canDo({ who: 'adult' }, elena)).toBe(false);
    expect(canDo({ who: 'child' }, ctx.adults[0])).toBe(false);
    expect(canDo({ who: 'any', minAge: 14 }, ctx.adults[0])).toBe(true);
  });

  it('her edits: owners, wording, skip; people who leave drop out', () => {
    const ctx = ctxOf('rivera');
    const prepared = assignTasks(tasks, ctx);
    const edits = {};
    setTaskOwners(edits, 'a', ['sample-rivera-sofia', 'sample-rivera-luis']);
    toggleTaskOwner(edits, 'b', ['sample-rivera-ana'], 'sample-rivera-ana'); // never the last one
    setTaskTitle(edits, 'c', '  Call   the school ', 'C');
    setTaskTitle(edits, 'drive', 'Drive', 'Drive');
    setTaskSkip(edits, 'lunch', true);
    expect(isTaskEdits(edits)).toBe(true);
    const planned = Object.fromEntries(withEdits(prepared, edits, ctx).map((t) => [t.id, t]));
    expect(planned.a).toMatchObject({ who: 'Sofia and Luis', changed: true });
    expect(planned.b.changed).toBe(false);
    expect(planned.c.label).toBe('Call the school');
    expect(planned.drive.changed).toBe(false);
    expect(planned.lunch.skipped).toBe(true);
    const fewer = familyContext(sample('rivera').household.members.filter((m) => m.firstName !== 'Luis'), {}, '2027-08');
    pruneTaskEdits(edits, fewer);
    expect(edits).toMatchObject({ a: { owners: ['sample-rivera-sofia'] } });
    expect(isTaskEdits({ a: { owners: [1] } })).toBe(false);
    expect(isTaskEdits([])).toBe(false);
  });
});

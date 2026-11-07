import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  addCustom, addStep, applyFamily, augFingerprint, augView, freshState, fromLegacy, isAugState, leaveFor, move, planEdited, preparedRoutine, restorePlan, restoreRoutine,
  routineChanged, setChild, setFooter, setLabel, setMode, setRemoved, setTime, type AugMember, type AugState,
} from './august-school-routines';
import { familySnapshot } from '../personalize/family';
import { setTaskOwners, setTaskSkip, setTaskTitle } from '../personalize/edits';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as AugMember[];
const rivera = family('rivera');
const id = (n: string) => rivera.find((m) => m.firstName === n)!.id;
const labels = (s: AugState, g: 'morning' | 'after', members = rivera) => augView(s, members).groups[g].map((x) => x.label);

describe('August school routines', () => {
  it('starts on the first child’s routine, prepared for their age in August 2027', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const v = augView(s, rivera);
    expect(v.title).toBe('Sofia\'s morning & after-school routines');
    expect(v.age).toBe(11);
    expect(labels(s, 'morning')).toContain('Check bag & school supplies');
    expect(labels(s, 'after').at(-1)).toBe('Homework & study time');
    expect(v.groups.morning.map((x) => x.clock)).toEqual(['7:00 AM', '7:15 AM', '7:25 AM', '7:45 AM', '7:48 AM', '7:49 AM', '7:50 AM']);
  });

  it('a five-year-old gets little-kid wording; an eight-year-old the prepared routine', () => {
    const s = setChild(freshState(rivera), id('Elena'), rivera);
    expect(augView(s, rivera).age).toBe(5);
    expect(labels(s, 'after').at(-1)).toBe('Look at a book');
    expect(labels(s, 'morning')).toContain('Get my school bag');
    setChild(s, id('Mateo'), rivera);
    expect(augView(s, rivera).age).toBe(8);
    expect(labels(s, 'after').at(-1)).toBe('Homework & reading');
  });

  it('each child keeps their own routine', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setLabel(s, 'eat', 'Eat breakfast at the table', rivera);
    setChild(s, id('Mateo'), rivera);
    expect(labels(s, 'morning')).toContain('Eat breakfast');
    setChild(s, id('Sofia'), rivera);
    expect(labels(s, 'morning')).toContain('Eat breakfast at the table');
  });

  it('retimes, reorders, removes and restores steps', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setTime(s, 'wake', '06:45', rivera);
    setTime(s, 'wake', '25:00', rivera);
    expect(augView(s, rivera).groups.morning[0].clock).toBe('6:45 AM');
    move(s, 'dress', 1, rivera);
    expect(labels(s, 'morning').slice(1, 3)).toEqual(['Eat breakfast', 'Get dressed']);
    setRemoved(s, 'teeth', true, rivera);
    expect(labels(s, 'morning')).not.toContain('Brush teeth');
    setRemoved(s, 'teeth', false, rivera);
    expect(labels(s, 'morning')).toContain('Brush teeth');
    expect(routineChanged(s, rivera)).toBe(true);
    restoreRoutine(s, rivera);
    expect(routineChanged(s, rivera)).toBe(false);
  });

  it('keeps one lunch step and one water step; adds and custom steps go at the end', () => {
    const s = applyFamily(freshState(rivera), rivera);
    addStep(s, 'morning', 'pack-lunch', rivera);
    const m = labels(s, 'morning');
    expect(m).toContain('Pack My Lunch');
    expect(m).not.toContain('Grab My Lunch Box');
    addStep(s, 'morning', 'lunch', rivera);
    expect(labels(s, 'morning').filter((x) => /lunch/i.test(x))).toEqual(['Grab My Lunch Box']);
    addCustom(s, 'after', '  Feed the dog  ', 'custom-1', rivera);
    expect(labels(s, 'after').at(-1)).toBe('Feed the dog');
    addStep(s, 'after', 'nope', rivera);
    expect(labels(s, 'after')).toHaveLength(6);
  });

  it('the shorter routine hides wake-up and hand-washing without deleting them', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setMode(s, true, rivera);
    expect(labels(s, 'morning')).not.toContain('Wake up & stretch');
    expect(labels(s, 'after')).not.toContain('Wash hands');
    setMode(s, false, rivera);
    expect(labels(s, 'morning')[0]).toBe('Wake up & stretch');
  });

  it('labels and the footer are trimmed and capped; blank keeps the original', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setLabel(s, 'eat', '   ', rivera);
    expect(labels(s, 'morning')).toContain('Eat breakfast');
    setLabel(s, 'eat', 'x'.repeat(80), rivera);
    expect(labels(s, 'morning')[2]).toHaveLength(55);
    setFooter(s, 'Ready, set, go!', rivera);
    expect(augView(s, rivera).footer).toBe('Ready, set, go!');
    setFooter(s, '', rivera);
    expect(augView(s, rivera).footer).toBe("Check my routine. Do my part. Then I'm ready!");
  });

  it('archived and removed children never print; another family starts fresh', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const archived = rivera.map((m) => (m.firstName === 'Sofia' ? { ...m, archived: true } : m));
    applyFamily(s, archived);
    expect(augView(s, archived).childName).toBe('Mateo');
    expect(Object.keys(s.boards)).not.toContain(id('Sofia'));
    const brooks = family('brooks');
    const b = applyFamily(freshState(brooks), brooks);
    expect(augView(b, brooks).kids.map((k) => k.name)).toEqual(['Max', 'Lily']);
    expect(JSON.stringify(b)).not.toContain('rivera');
  });

  it('a family with no children gets the family routine', () => {
    const hughes = family('hughes');
    const s = applyFamily(freshState(hughes), hughes);
    expect(augView(s, hughes).title).toBe('Our morning & after-school routines');
    expect(augView(s, hughes).age).toBe(8);
  });

  it('the fingerprint changes with anything that prints', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const before = augFingerprint(s, rivera);
    setTime(s, 'snack', '15:50', rivera);
    expect(augFingerprint(s, rivera)).not.toBe(before);
  });

  it('reads the earlier page’s saved routines once, for the same family only', () => {
    const old = { profile: 'rivera:sample-rivera', active: id('Mateo'), boards: { [id('Mateo')]: { ...preparedRoutine(8), footer: 'Go Mateo!', child: id('Mateo') }, 'gone-kid': preparedRoutine(8) } };
    old.boards[id('Mateo')].steps[0].label = 'Up and at it';
    const s = fromLegacy(JSON.stringify(old), 'rivera:sample-rivera', rivera)!;
    expect(isAugState(s)).toBe(true);
    expect(augView(s, rivera).childName).toBe('Mateo');
    expect(labels(s, 'morning')[0]).toBe('Up and at it');
    expect(augView(s, rivera).footer).toBe('Go Mateo!');
    expect(Object.keys(s.boards)).not.toContain('gone-kid');
    expect(fromLegacy(JSON.stringify(old), 'brooks:sample-brooks', rivera)).toBeNull();
    expect(fromLegacy('not json', 'rivera:sample-rivera', rivera)).toBeNull();
    expect(isAugState({ child: 'x', boards: { x: { steps: [{ id: 1 }], mode: 'standard' } } })).toBe(false);
  });
});

const sample = (sid: string) => sampleHouseholds.find((x) => x.id === sid)!;
const withProfile = (sid: string) => {
  const m = family(sid);
  return { m, s: applyFamily({ ...freshState(m), profile: familySnapshot(sample(sid).profile) }, m) };
};
const task = (s: AugState, m: AugMember[], tid: string) => augView(s, m).plan.sections.flatMap((x) => x.tasks).find((t) => t.id === tid);
const plan = (s: AugState, m: AugMember[]) => augView(s, m).plan.sections.flatMap((x) => x.tasks);

describe('August: Back to School Without the Scramble (the family plan)', () => {
  it('prints the family plan first, then a routine for every school-aged child', () => {
    const { m, s } = withProfile('rivera');
    const v = augView(s, m);
    expect(v.plan.active).toBe(true);
    expect(v.routines.map((r) => r.name)).toEqual(['Sofia', 'Mateo', 'Elena']);
    expect(v.plan.sections.map((x) => x.title)).toEqual(['Before the First Day', 'The Night Before', 'School Mornings', 'After School']);
  });

  it('times the morning back from the school start she gave, for every child leaving together', () => {
    const { m, s } = withProfile('rivera');
    const v = augView(s, m);
    // School starts 8:00 for Sofia and Mateo: out the door 20 minutes before, Elena with them.
    expect(v.plan.leaveClock).toBe('7:40 AM');
    for (const r of v.routines) expect(r.groups.morning.at(-1)!.clock).toBe('7:40 AM');
    expect(leaveFor('08:45')).toBe('08:25');
    expect(leaveFor(undefined)).toBe('07:50');
  });

  it('uses real names, every child’s own part by age, and the grown-up jobs between the grown-ups', () => {
    const { m, s } = withProfile('rivera');
    expect(task(s, m, 'pack-bag')!.who).toBe('Sofia, Mateo and Elena');
    expect(task(s, m, 'own-lunch')!.who).toBe('Sofia');
    expect(task(s, m, 'homework')!.who).toBe('Sofia and Mateo');
    // Luis already drives: drop-off and pickup stay his. Ana (the account holder) isn't the default.
    expect(task(s, m, 'dropoff')!.who).toBe('Luis');
    expect(task(s, m, 'pickup')!.who).toBe('Luis');
    const grownUp = plan(s, m).filter((t) => t.ownerIds.length === 1 && ['sample-rivera-ana', 'sample-rivera-luis'].includes(t.ownerIds[0]));
    const ana = grownUp.filter((t) => t.ownerIds[0] === 'sample-rivera-ana').length;
    expect(ana).toBeGreaterThan(0);
    expect(ana).toBeLessThanOrEqual(grownUp.length - ana);
    // Practice is everyone's, toddlers included.
    expect(task(s, m, 'practice')!.who).toBe('Everyone');
  });

  it('one child, two school-aged children, several grown-ups and a limited profile', () => {
    // One child (a four-year-old in preschool): their own small parts; nothing a preschooler can't do.
    const ok = family('okafor');
    const o = applyFamily(freshState(ok), ok);
    expect(augView(o, ok).routines.map((r) => r.name)).toEqual(['Zara']);
    expect(task(o, ok, 'pack-bag')).toBeUndefined();
    expect(task(o, ok, 'own-lunch')).toBeUndefined();
    expect(augView(o, ok).routines[0].groups.morning.map((x) => x.label)).not.toContain('Wake up & stretch');
    // Two school-aged children, one grown-up, no profile answers: a complete plan anyway.
    const br = family('brooks');
    const b = applyFamily(freshState(br), br);
    expect(plan(b, br).every((t) => t.who)).toBe(true);
    expect(task(b, br, 'lunches')!.label).toBe('Pack school lunches');
    expect(task(b, br, 'bag-spot')!.who).toBe('Max');
    // Three grown-ups: the jobs spread across them, teens take the calendar.
    const { m: ch, s: c } = withProfile('chen');
    const owners = new Set(plan(c, ch).filter((t) => t.ownerIds.length === 1).map((t) => t.ownerIds[0]));
    for (const a of ['sample-chen-mei', 'sample-chen-david', 'sample-chen-lin']) expect(owners.has(a)).toBe(true);
    expect(['Owen', 'Grace']).toContain(task(c, ch, 'calendar')!.who);
    // Nobody in school: no family plan prints, the family routine does.
    const hu = family('hughes');
    expect(augView(applyFamily(freshState(hu), hu), hu).plan.active).toBe(false);
  });

  it('keeps her changes: who, wording and leaving a job off, and they print', () => {
    const { m, s } = withProfile('rivera');
    const before = augFingerprint(s, m);
    s.plan = {};
    setTaskOwners(s.plan, 'pickup', ['sample-rivera-ana']);
    setTaskTitle(s.plan, 'rinse', 'Wash lunch boxes', 'Rinse the lunch boxes');
    setTaskSkip(s.plan, 'calendar', true);
    expect(task(s, m, 'pickup')!.who).toBe('Ana');
    expect(task(s, m, 'rinse')!.label).toBe('Wash lunch boxes');
    expect(task(s, m, 'calendar')!.skipped).toBe(true);
    expect(planEdited(s)).toBe(true);
    expect(augFingerprint(s, m)).not.toBe(before);
    expect(isAugState(JSON.parse(JSON.stringify(s)))).toBe(true);
    // Someone who leaves the family drops out of her changes; the job goes back to the prepared owner.
    const gone = m.filter((x) => x.firstName !== 'Ana');
    applyFamily(s, gone);
    expect(s.plan?.pickup).toBeUndefined();
    restorePlan(s);
    expect(s.plan).toBeUndefined();
    expect(s.profile).toBeUndefined();
  });

  it('saved means settled: the snapshot it was prepared from prints the same without her profile', () => {
    const { m, s } = withProfile('rivera');
    const saved = JSON.parse(JSON.stringify(s)) as AugState;
    // The owner's print view: the household only, her saved state, no profile.
    expect(augFingerprint(saved, m)).toBe(augFingerprint(s, m));
    expect(isAugState({ ...saved, plan: { x: { owners: 'nope' } } })).toBe(false);
    expect(isAugState({ ...saved, profile: { v: 2 } })).toBe(false);
  });
});

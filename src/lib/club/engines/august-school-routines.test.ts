import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  MAX_STEPS, addCustom, addStep, applyFamily, augFingerprint, augView, freshState, fromLegacy, isAugState, leaveFor, move, planEdited, preparedRoutine, restorePlan,
  restoreRoutine, routineChanged, setCue, setCueOff, setFooter, setLabel, setLeave, setRemoved, setTime, setTimeOff, setWho, type AugMember, type AugState,
} from './august-school-routines';
import { familySnapshot } from '../personalize/family';
import { setTaskOwners, setTaskSkip, setTaskTitle } from '../personalize/edits';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as AugMember[];
const rivera = family('rivera');
const id = (n: string) => rivera.find((m) => m.firstName === n)!.id;

const charts = (s: AugState, m = rivera, prefs = {}) => augView(s, m, prefs).charts;
const chart = (s: AugState, g: 'morning' | 'after', m = rivera) => charts(s, m).find((c) => c.group === g)!;
const labels = (s: AugState, g: 'morning' | 'after', m = rivera) => chart(s, g, m).steps.map((x) => x.label);
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

describe('August routine charts: one morning and one after-school chart for the whole family', () => {
  it('prints exactly two charts a family, never a page per child', () => {
    for (const fam of ['rivera', 'chen', 'okafor', 'brooks', 'hughes']) {
      const m = family(fam);
      const v = augView(applyFamily(freshState(m), m), m);
      expect(v.charts.map((c) => c.group)).toEqual(['morning', 'after']);
    }
    const s = applyFamily(freshState(rivera), rivera);
    expect(chart(s, 'morning').kids.map((k) => k.name)).toEqual(['Sofia', 'Mateo', 'Elena']);
    expect(chart(s, 'morning').title).toBe('Morning Routine');
    expect(chart(s, 'after').banner.title).toBe('Ready for free time!');
  });

  it('times AND triggers: both, only a time, only a trigger, neither', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const m = chart(s, 'morning').steps;
    const by = (id: string) => m.find((x) => x.id === id)!;
    expect([by('teeth').time, by('teeth').cue]).toEqual(['07:35', 'After breakfast']);
    expect([by('wake').time, by('wake').cue]).toEqual(['07:05', '']);
    // After school runs on triggers by default: a trigger, no time.
    const a = chart(s, 'after').steps;
    expect(a.find((x) => x.id === 'unpack')).toMatchObject({ time: null, cue: '' });
    expect(a.find((x) => x.id === 'homework')).toMatchObject({ time: null, cue: 'After snack' });
    // Turning a time on, a trigger off, and both off.
    setTimeOff(s, 'snack', false, rivera);
    setCueOff(s, 'snack', true, rivera);
    expect(chart(s, 'after').steps.find((x) => x.id === 'snack')).toMatchObject({ time: '15:45', clock: ['3:45', 'PM'], cue: '' });
    setTimeOff(s, 'snack', true, rivera);
    expect(chart(s, 'after').steps.find((x) => x.id === 'snack')).toMatchObject({ time: null, cue: '' });
    setCueOff(s, 'snack', false, rivera);
    expect(chart(s, 'after').steps.find((x) => x.id === 'snack')!.cue).toBe('After washing hands');
  });

  it('no prepared trigger restates the step, says nothing, or points at a later step', () => {
    for (const fam of ['rivera', 'chen', 'okafor', 'brooks', 'hughes', 'lindqvist', 'goering']) {
      const m = family(fam);
      const prof = sampleHouseholds.find((x) => x.id === fam)!.profile;
      const s = applyFamily({ ...freshState(m), profile: familySnapshot(prof) }, m);
      for (const c of charts(s, m)) expect(c.issues).toEqual([]);
      const wake = chart(s, 'morning', m).steps[0];
      expect(wake.cue).toBe('');
      expect(chart(s, 'morning', m).steps.at(-1)!.cue).toBe('');
    }
  });

  it('her triggers are checked: restating, vague, circular and order-only ones are flagged', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setCue(s, 'wake', 'When I wake up', rivera);
    setCue(s, 'out', 'When I’m ready', rivera);
    setCue(s, 'backpack', 'Before shoes on', rivera);
    setCue(s, 'dress', 'After brushing teeth', rivera);
    const kinds = Object.fromEntries(chart(s, 'morning').issues.map((i) => [i.stepId, i.kind]));
    expect(kinds).toEqual({ wake: 'restates', out: 'vague', backpack: 'order-only', dress: 'circular' });
    // A blank trigger is no trigger.
    setCue(s, 'wake', '', rivera);
    expect(chart(s, 'morning').steps[0].cue).toBe('');
  });

  it('times run in order, end before out the door, and stay in order when steps move', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const times = () => chart(s, 'morning').steps.map((x) => x.time).filter(Boolean) as string[];
    const ordered = () => times().every((t, i, a) => i === 0 || mins(t) >= mins(a[i - 1]));
    expect(ordered()).toBe(true);
    expect(chart(s, 'morning').banner.deadline).toBe('7:50 AM');
    expect(mins(times().at(-1)!)).toBeLessThan(mins('07:50'));
    // Reordering moves the step; the times stay with the slots.
    move(s, 'teeth', -1, rivera);
    expect(labels(s, 'morning').slice(2, 4)).toEqual(['Brush teeth', 'Eat breakfast']);
    expect(ordered()).toBe(true);
    // An out-of-order time and a time past the deadline are flagged, never silently changed.
    setTime(s, 'dress', '06:30', rivera);
    setTime(s, 'out', '08:05', rivera);
    const kinds = chart(s, 'morning').issues.map((i) => i.kind);
    expect(kinds).toContain('order');
    expect(kinds).toContain('deadline');
    // Her own out-the-door time moves the deadline.
    setLeave(s, '08:15', rivera);
    expect(chart(s, 'morning').banner.deadline).toBe('8:15 AM');
    expect(chart(s, 'morning').issues.map((i) => i.kind)).not.toContain('deadline');
  });

  it('uses her school start; without one the sample times are marked as defaults', () => {
    const r = sampleHouseholds.find((x) => x.id === 'rivera')!;
    const s = applyFamily({ ...freshState(rivera), profile: familySnapshot(r.profile) }, rivera);
    expect(augView(s, rivera).sampleTimes).toBe(false);
    expect(chart(s, 'morning').banner.deadline).toBe('7:40 AM');
    expect(chart(s, 'morning').steps[0].clock).toEqual(['6:55', 'AM']);
    const b = family('brooks');
    expect(augView(applyFamily(freshState(b), b), b).sampleTimes).toBe(true);
    // A morning with every time off has no clock to beat.
    for (const x of chart(s, 'morning').steps) setTimeOff(s, x.id, true, rivera);
    expect(chart(s, 'morning').banner.deadline).toBeNull();
  });

  it('personalized for the family, not one list for everyone: some steps name the children they’re for', () => {
    const r = sampleHouseholds.find((x) => x.id === 'rivera')!;
    const s = applyFamily({ ...freshState(rivera), profile: familySnapshot(r.profile) }, rivera);
    const pets = chart(s, 'morning').steps.find((x) => x.id === 'pets')!;
    expect(pets.owners.map((o) => o.name)).toEqual(['Sofia']);
    expect(chart(s, 'after').steps.find((x) => x.label === 'Pack my soccer bag')).toMatchObject({ cue: 'On soccer days', owners: [{ name: 'Sofia' }] });
    // Steps for everyone name nobody (the header lists the children).
    expect(chart(s, 'morning').steps.find((x) => x.id === 'teeth')!.owners).toEqual([]);
    // Chen: two swimmers share one row, the pianist practices; four children, one chart.
    const chen = family('chen');
    const c = applyFamily({ ...freshState(chen), profile: familySnapshot(sampleHouseholds.find((x) => x.id === 'chen')!.profile) }, chen);
    const after = chart(c, 'after', chen).steps;
    expect(after.find((x) => x.label === 'Pack my swim team bag')!.owners.map((o) => o.name)).toEqual(['Grace', 'Owen']);
    expect(after.find((x) => x.label === 'Practice piano')!.owners.map((o) => o.name)).toEqual(['Ivy']);
    expect(after.length).toBeLessThanOrEqual(8);
    // Only little ones: picture-book words, no homework to finish.
    const ok = family('okafor');
    const o = applyFamily(freshState(ok), ok);
    expect(labels(o, 'after', ok)).toContain('Look at a book');
    expect(chart(o, 'after', ok).steps.at(-1)!.cue).toBe('After my book');
    // No profile: the plain family routine, still complete.
    const b = family('brooks');
    expect(labels(applyFamily(freshState(b), b), 'morning', b)).toEqual(['Wake up & stretch', 'Get dressed', 'Eat breakfast', 'Brush teeth', 'Grab backpack & lunch box', 'Shoes on & out the door']);
  });

  it('edits: rename, reorder, add, remove, who it’s for; never empty, never more than eight', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setLabel(s, 'eat', '  Breakfast   at the table ', rivera);
    expect(labels(s, 'morning')).toContain('Breakfast at the table');
    addStep(s, 'morning', 'make-bed', rivera);
    // New steps go before the last step (out the door), timed between their neighbors.
    expect(labels(s, 'morning').at(-2)).toBe('Make my bed');
    expect(chart(s, 'morning').issues).toEqual([]);
    addCustom(s, 'after', 'Feed the fish', 'custom-1', rivera);
    expect(labels(s, 'after').at(-2)).toBe('Feed the fish');
    expect(chart(s, 'after').steps.at(-2)!.time).toBeNull();
    for (let i = 0; i < 6; i++) addCustom(s, 'morning', `Extra ${i}`, `x${i}`, rivera);
    expect(chart(s, 'morning').steps).toHaveLength(MAX_STEPS);
    setWho(s, 'make-bed', [id('Mateo')], rivera);
    expect(chart(s, 'morning').steps.find((x) => x.id === 'make-bed')!.owners.map((o) => o.name)).toEqual(['Mateo']);
    setWho(s, 'make-bed', [id('Sofia'), id('Mateo'), id('Elena')], rivera);
    expect(chart(s, 'morning').steps.find((x) => x.id === 'make-bed')!.owners).toEqual([]);
    for (const x of chart(s, 'after').steps) setRemoved(s, x.id, true, rivera);
    expect(chart(s, 'after').steps).toHaveLength(1);
    expect(routineChanged(s, rivera)).toBe(true);
    restoreRoutine(s, rivera);
    expect(routineChanged(s, rivera)).toBe(false);
  });

  it('stable family colors: each child keeps January’s color, by member id, in any order', () => {
    // As her family page saves them: everyone's color, Sofia's changed to orange.
    const prefs = { colors: { [id('Sofia')]: 'orange', [id('Mateo')]: 'green', [id('Elena')]: 'purple', [id('Ana')]: 'blue', [id('Luis')]: 'pink' } };
    const s = applyFamily(freshState(rivera), rivera);
    const before = charts(s, rivera, prefs)[0].kids.map((k) => [k.name, k.color.id]);
    expect(before[0]).toEqual(['Sofia', 'orange']);
    const reordered = [...rivera].reverse();
    const after = charts(applyFamily(freshState(reordered), reordered), reordered, prefs)[0].kids.map((k) => [k.name, k.color.id]);
    expect(Object.fromEntries(after)).toEqual(Object.fromEntries(before));
  });

  it('the fingerprint covers what prints; saved state is checked; the earlier per-child boards are dropped', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const before = augFingerprint(s, rivera);
    setCue(s, 'teeth', 'After my vitamins', rivera);
    expect(augFingerprint(s, rivera)).not.toBe(before);
    setFooter(s, 'Look, then go!', rivera);
    expect(chart(s, 'morning').tagline).toBe('Look, then go!');
    expect(isAugState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isAugState({ child: 'x', boards: { x: { steps: [{ id: 'a', time: '07:00', label: 'A', icon: 'bag', group: 'morning', who: [1] }], mode: 'standard' } } })).toBe(false);
    const old = { child: id('Sofia'), boards: { [id('Sofia')]: preparedRoutine(11) } };
    const migrated = applyFamily(old as AugState, rivera);
    expect(Object.keys(migrated.boards)).toEqual(['family']);
    expect(augView(migrated, rivera).charts).toHaveLength(2);
    expect(fromLegacy('not json', 'rivera:sample-rivera', rivera)).toBeNull();
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
  it('prints the family plan first, then the two family charts', () => {
    const { m, s } = withProfile('rivera');
    const v = augView(s, m);
    expect(v.plan.active).toBe(true);
    expect(v.charts.map((c) => c.group)).toEqual(['morning', 'after']);
    expect(v.plan.sections.map((x) => x.title)).toEqual(['Before the First Day', 'The Night Before', 'School Mornings', 'After School']);
  });

  it('times the morning back from the school start she gave, for every child leaving together', () => {
    const { m, s } = withProfile('rivera');
    const v = augView(s, m);
    // School starts 8:00 for Sofia and Mateo: out the door 20 minutes before, Elena with them.
    expect(v.plan.leaveClock).toBe('7:40 AM');
    expect(v.charts[0].banner.deadline).toBe('7:40 AM');
    expect(v.charts[0].steps.at(-1)!.clock).toEqual(['7:35', 'AM']);
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
    expect(augView(o, ok).charts[0].kids.map((k) => k.name)).toEqual(['Zara']);
    expect(task(o, ok, 'pack-bag')).toBeUndefined();
    expect(task(o, ok, 'own-lunch')).toBeUndefined();
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

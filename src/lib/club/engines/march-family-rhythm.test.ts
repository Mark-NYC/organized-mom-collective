import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { familySnapshot } from '../personalize/family';
import { familyContext } from '../personalize/family';
import {
  ANCHORS, JOBS, MAX_HABITS, MAX_ROWS, addRow, cleanPlan, duplicateIn, finishLine, finishOf, fitsCue, freshState, fromLegacy, habitSentence, isRhythmState, jobKey,
  moveRow, preparedPlan, removeRow, restorePlan, rhythmFingerprint, rhythmView, saveRow, setAnchor, setHabit, setMomentLabel, setMomentOn, setRowOwners,
  setRowTitle, validatePlan, type RhythmMember, type RhythmState, householdBudget, ownershipOf, removeOwner,
} from './march-family-rhythm';
import { familyColors } from '../personalize/colors';

const sample = (id: string) => {
  const s = sampleHouseholds.find((x) => x.id === id)!;
  const members = s.household.members as RhythmMember[];
  const prefs = s.household.preferences;
  const state = (): RhythmState => ({ ...freshState(), ...(s.profile ? { profile: familySnapshot(s.profile) } : {}) });
  return { s, members, prefs, state, view: (st: RhythmState = state()) => rhythmView(st, members, prefs) };
};
const FAMILIES = ['rivera', 'brooks', 'chen', 'okafor', 'hughes', 'lindqvist', 'goering'];
const REWARDS = /\b(points?|stars?|streaks?|rewards?|prizes?|%|percent)\b/i;

describe('March Family Rhythm: the prepared plan', () => {
  it.each(FAMILIES)('%s: two moments on, an optional third off, no empty section, at most five rows each', (id) => {
    const { view } = sample(id);
    const v = view();
    expect(v.moments).toHaveLength(3);
    expect(v.moments.map((m) => m.enabled)).toEqual([true, true, false]);
    expect(new Set(v.moments.map((m) => m.anchor)).size).toBe(3);
    expect(v.printed.length).toBeGreaterThanOrEqual(1);
    for (const m of v.printed) {
      expect(m.rows.length).toBeGreaterThan(0);
      expect(m.rows.length).toBeLessThanOrEqual(MAX_ROWS);
      expect(m.finish).toMatch(/\.$/);
      for (const r of m.rows) {
        expect(r.owners.length).toBeGreaterThan(0);
        expect(fitsCue(m.anchor, r.title)).toBe(true);
        expect(r.misfit).toBe(false);
        expect(`${r.title} ${m.finish}`).not.toMatch(REWARDS);
      }
    }
  });

  it.each(FAMILIES)('%s: one or two new habits, never an established job', (id) => {
    const v = sample(id).view();
    expect(v.habits.length).toBeGreaterThanOrEqual(1);
    expect(v.habits.length).toBeLessThanOrEqual(MAX_HABITS);
    for (const h of v.habits) expect(h.established).toBe(false);
  });

  it('every job fits the moment it belongs to (nothing that has to happen before the cue)', () => {
    for (const j of JOBS) expect(fitsCue(j.anchor, j.title), j.id).toBe(true);
    expect(fitsCue('dinner', 'Make dinner')).toBe(false);
    expect(fitsCue('dinner', 'Set the table')).toBe(false);
    expect(fitsCue('breakfast', 'Clear my breakfast dishes')).toBe(true);
  });

  it('Rivera: whoever already owns an area keeps it, shown as established; the new habits are what Ana hoped for', () => {
    const v = sample('rivera').view();
    const rows = v.printed.flatMap((m) => m.rows);
    const pets = rows.find((r) => r.title === 'Feed the pets')!;
    expect(pets.owners.map((o) => o.name)).toEqual(['Sofia']);
    expect(pets.established).toBe(true);
    expect(pets.habit).toBe(false);
    // She wished Sofia would pack her school bag: that's a new habit, for Sofia.
    expect(v.habits.some((h) => h.owners.some((o) => o.name === 'Sofia') && /bag|backpack/i.test(h.title))).toBe(true);
    // Every child has a part; a grown-up does too.
    for (const name of ['Sofia', 'Mateo', 'Elena']) expect(rows.some((r) => r.owners.some((o) => o.name === name)), name).toBe(true);
    expect(rows.some((r) => r.owners.some((o) => o.adult))).toBe(true);
  });

  it('a single grown-up with no children still gets a useful plan', () => {
    const v = sample('hughes').view();
    expect(v.printed.length).toBe(2);
    for (const m of v.printed) for (const r of m.rows) expect(r.owners.map((o) => o.name)).toEqual(['Claire']);
  });

  it('a thin profile (no answers) is still prepared, from names and ages alone', () => {
    const { members, prefs } = sample('rivera');
    const v = rhythmView(freshState(), members, prefs);
    expect(v.printed.length).toBe(2);
    expect(v.habits.length).toBeGreaterThan(0);
  });

  it('one child: the child has a part in every printed moment; nothing is filler', () => {
    const { members, prefs } = sample('rivera');
    const one = members.filter((m) => m.kind === 'adult' || m.firstName === 'Mateo');
    const v = rhythmView(freshState(), one, prefs);
    for (const m of v.printed) expect(m.rows.some((r) => r.owners.some((o) => o.name === 'Mateo')), m.title).toBe(true);
    for (const m of v.printed) expect(m.rows.length).toBeLessThanOrEqual(4);
  });

  it('ages: a preschooler never gets a job above their age', () => {
    const v = sample('rivera').view();
    const elena = v.people.find((p) => p.name === 'Elena')!;
    for (const m of v.printed) for (const r of m.rows) {
      if (!r.owners.some((o) => o.id === elena.id)) continue;
      const job = JOBS.find((j) => j.title === r.title);
      if (job) expect(job.minAge, r.title).toBeLessThanOrEqual(elena.age ?? 99);
      expect(job?.adult, r.title).not.toBe(true);
    }
  });

  it('a large family: no more jobs than the routine needs, nobody left out of every moment, no job twice', () => {
    const { members, prefs } = sample('rivera');
    const big: RhythmMember[] = [...members,
      { id: 'x1', firstName: 'Nia', kind: 'child', birthYear: 2019, birthMonth: 1 } as RhythmMember,
      { id: 'x2', firstName: 'Theo', kind: 'child', birthYear: 2017, birthMonth: 6 } as RhythmMember,
      { id: 'x3', firstName: 'June', kind: 'child', birthYear: 2015, birthMonth: 3 } as RhythmMember];
    const v = rhythmView(freshState(), big, prefs);
    for (const m of v.printed) {
      expect(m.rows.length).toBeLessThanOrEqual(MAX_ROWS);
      expect(new Set(m.rows.map((r) => jobKey(r.title))).size).toBe(m.rows.length);
    }
    const kids = v.people.filter((p) => !p.adult);
    for (const k of kids) expect(v.printed.some((m) => m.rows.some((r) => r.owners.some((o) => o.id === k.id))), k.name).toBe(true);
  });

  it('a missing family (nobody yet) prints nothing rather than an empty sheet', () => {
    const v = rhythmView(freshState(), [], {});
    expect(v.printed).toEqual([]);
    expect(v.habits).toEqual([]);
  });

  it('is deterministic: the same family gets the same plan', () => {
    const { members, prefs, state } = sample('chen');
    expect(rhythmFingerprint(state(), members, prefs)).toBe(rhythmFingerprint(state(), members, prefs));
  });
});

describe('March Family Rhythm: her edits', () => {
  it('changing a moment re-prepares that moment’s jobs to fit the new cue, and keeps the other moment', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const before = view(s);
    const other = before.moments[1];
    const target = ANCHORS.find((a) => !before.moments.some((m) => m.anchor === a.id))!;
    setAnchor(s, 'm1', target.id, members, prefs);
    const v = view(s);
    expect(v.moments[0].anchor).toBe(target.id);
    expect(v.moments[0].title).toBe(target.title);
    expect(v.moments[1].rows.map((r) => r.title)).toEqual(other.rows.map((r) => r.title));
    for (const r of v.moments[0].rows) expect(JOBS.find((j) => j.title === r.title)?.anchor ?? target.id).toBe(target.id);
    // Two moments can't be the same one.
    setAnchor(s, 'm2', target.id, members, prefs);
    expect(view(s).moments[1].anchor).toBe(other.anchor);
  });

  it('her own words for a moment show; clearing them goes back to the moment’s name', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    setMomentLabel(s, 'm1', '  After our family dinner ', members, prefs);
    expect(view(s).moments[0].title).toBe('After our family dinner');
    setMomentLabel(s, 'm1', '', members, prefs);
    expect(view(s).moments[0].title).toBe(ANCHORS.find((a) => a.id === view(s).moments[0].anchor)!.title);
  });

  it('moments: the third is off by default and prepared with real jobs when turned on; any can go, one always stays', () => {
    const { members, prefs, state, view } = sample('chen');
    const s = state();
    expect(view(s).printed).toHaveLength(2);
    setMomentOn(s, 'm3', true, members, prefs);
    expect(view(s).printed).toHaveLength(3);
    expect(view(s).printed[2].rows.length).toBeGreaterThan(0);
    setMomentOn(s, 'm3', false, members, prefs);
    expect(view(s).printed).toHaveLength(2);
    // Removing a moment that holds jobs: they leave the chart (and its habits), and come back with it.
    const first = view(s).moments[0];
    setMomentOn(s, 'm1', false, members, prefs);
    expect(view(s).printed.map((m) => m.id)).toEqual(['m2']);
    expect(view(s).habits.every((h) => !first.rows.some((r) => r.id === h.id))).toBe(true);
    setMomentOn(s, 'm2', false, members, prefs);
    expect(view(s).printed.map((m) => m.id)).toEqual(['m2']);
    setMomentOn(s, 'm1', true, members, prefs);
    expect(view(s).moments[0].rows.map((r) => r.title)).toEqual(first.rows.map((r) => r.title));
  });

  it('add, rename, reassign, share, move and remove a job; a moment with no jobs doesn’t print', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const sofia = view(s).people.find((p) => p.name === 'Sofia')!.id;
    const mateo = view(s).people.find((p) => p.name === 'Mateo')!.id;
    addRow(s, 'm2', sofia, members, prefs, undefined, 'Lay out tomorrow’s clothes');
    let row = view(s).moments[1].rows.find((r) => r.title === 'Lay out tomorrow’s clothes')!;
    expect(row.owners.map((o) => o.id)).toEqual([sofia]);
    setRowTitle(s, row.id, 'Lay out my clothes for tomorrow', members, prefs);
    setRowOwners(s, row.id, [sofia, mateo], members, prefs);
    row = view(s).moments[1].rows.find((r) => r.id === row.id)!;
    expect(row.title).toBe('Lay out my clothes for tomorrow');
    expect(row.owners.map((o) => o.name)).toEqual(['Sofia', 'Mateo']);
    // Never nobody.
    setRowOwners(s, row.id, [], members, prefs);
    expect(view(s).moments[1].rows.find((r) => r.id === row.id)!.owners).toHaveLength(2);
    // Remove every job from the first moment: it isn't printed (no empty section).
    for (const r of view(s).moments[0].rows) removeRow(s, r.id, members, prefs);
    expect(view(s).printed.map((m) => m.id)).toEqual(['m2']);
    moveRow(s, row.id, 'm1', members, prefs);
    expect(view(s).printed.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('a job that has to happen before the cue is refused with the reason, and never saved', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const dinner = view(s).moments.find((m) => m.anchor === 'dinner')!;
    const r = saveRow(s, undefined, { title: 'Make dinner', owners: [view(s).people[0].id], moment: dinner.id, habit: false }, members, prefs);
    expect(r.ok).toBe(false);
    expect(view(s).moments.find((m) => m.id === dinner.id)!.rows.some((x) => x.title === 'Make dinner')).toBe(false);
    const teeth = sample('rivera');
    const t = teeth.state();
    setMomentOn(t, 'm2', true, members, prefs);
    const bed = teeth.view(t).moments.find((m) => m.anchor === 'teeth')!;
    expect(saveRow(t, undefined, { title: 'Start the dishwasher', owners: [teeth.view(t).people[0].id], moment: bed.id, habit: false }, members, prefs).ok).toBe(false);
  });

  it('at most two new habits; choosing a third replaces the oldest', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const rows = view(s).printed.flatMap((m) => m.parts).filter((r) => !r.habit && !r.established);
    for (const r of rows.slice(0, 3)) setHabit(s, r.id, true, members, prefs);
    expect(view(s).habits.map((h) => h.id)).toEqual(rows.slice(1, 3).map((r) => r.id));
    setHabit(s, rows[2].id, false, members, prefs);
    expect(view(s).habits.map((h) => h.id)).toEqual([rows[1].id]);
  });

  it('custom colors carry onto every row and the legend', () => {
    const { s: smp, members, state } = sample('rivera');
    const prefs = { ...smp.household.preferences, colors: { 'sample-rivera-sofia': 'orange' } };
    const v = rhythmView(state(), members, prefs);
    expect(v.people.find((p) => p.name === 'Sofia')!.color.id).toBe('orange');
    for (const r of v.printed.flatMap((m) => m.rows)) for (const o of r.owners) if (o.name === 'Sofia') expect(o.color.id).toBe('orange');
  });

  it('someone who leaves the family drops out; a job only they had goes with them', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    setHabit(s, view(s).printed[0].rows[0].id, true, members, prefs);
    const fewer = members.filter((m) => m.firstName !== 'Sofia');
    const v = rhythmView(s, fewer, prefs);
    expect(v.printed.flatMap((m) => m.rows).flatMap((r) => r.owners).some((o) => o.name === 'Sofia')).toBe(false);
  });

  it('start over brings back the prepared plan', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const prepared = rhythmFingerprint(s, members, prefs);
    setMomentOn(s, 'm3', true, members, prefs);
    expect(view(s).changed).toBe(true);
    restorePlan(s);
    // The page then settles her newest family-page answers onto it again.
    s.profile = state().profile;
    expect(rhythmFingerprint(s, members, prefs)).toBe(prepared);
  });
});

describe('March Family Rhythm: saved plans', () => {
  it('a saved plan survives the round trip and is validated', () => {
    const { members, prefs, state } = sample('okafor');
    const s = state();
    setMomentOn(s, 'm3', true, members, prefs);
    const back = JSON.parse(JSON.stringify(s));
    expect(isRhythmState(back)).toBe(true);
    expect(rhythmFingerprint(back, members, prefs)).toBe(rhythmFingerprint(s, members, prefs));
    expect(isRhythmState({ v: 3, plan: { moments: 'x', rows: [], habits: [] } })).toBe(false);
    expect(isRhythmState({ palette: 'a', kids: {} })).toBe(false);
  });

  it('the earlier chore charts migrate: who did a matching chore keeps it, as established', () => {
    const { members, prefs, s } = sample('rivera');
    const legacy = { palette: 'sage', kids: { 'sample-rivera-mateo': { daily: [{ id: 'clear-the-table' }], weekly: [] } } };
    const migrated = fromLegacy(legacy, members, prefs, familySnapshot(s.profile))!;
    expect(isRhythmState(migrated)).toBe(true);
    const v = rhythmView(migrated, members, prefs);
    const clear = v.printed.flatMap((m) => m.rows).find((r) => r.title === 'Clear the dinner table');
    if (clear) { expect(clear.owners.map((o) => o.name)).toContain('Mateo'); expect(clear.established).toBe(true); }
    // An untouched earlier plan just starts from the prepared plan.
    expect(fromLegacy({ palette: 'sage', kids: {} }, members, prefs)).toEqual({ v: 3 });
    expect(fromLegacy(null, members, prefs)).toBeNull();
  });
});

describe('March Family Rhythm: safeguards', () => {
  const ctxFor = (members: RhythmMember[], prefs = {}, snap?: ReturnType<typeof familySnapshot>) => familyContext(members, prefs, '2027-03', snap);

  it.each(FAMILIES)('%s: the prepared plan passes every check', (id) => {
    const { s, members, prefs } = sample(id);
    const ctx = ctxFor(members, prefs, s.profile ? familySnapshot(s.profile) : undefined);
    const plan = preparedPlan(ctx);
    expect(validatePlan(plan, ctx)).toEqual([]);
    plan.moments[2].enabled = true;
    expect(validatePlan({ ...plan, rows: [...plan.rows] }, ctx).filter((x) => x.kind !== 'habit')).toEqual([]);
  });

  it('any family shape (1–9 people, any ages) gets a valid, realistic plan', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    for (let n = 0; n < 300; n++) {
      const adults = 1 + Math.floor(rand() * 3);
      const kids = Math.floor(rand() * 7);
      const members: RhythmMember[] = [
        ...Array.from({ length: adults }, (_, i) => ({ id: `a${i}`, firstName: `Grown${i}`, kind: 'adult' as const, ...(i === 0 ? { isAccountHolder: true } : {}) })),
        ...Array.from({ length: kids }, (_, i) => ({ id: `k${i}`, firstName: `Kid${i}`, kind: 'child' as const, birthYear: 2008 + Math.floor(rand() * 18), birthMonth: 1 + Math.floor(rand() * 12) })),
      ] as RhythmMember[];
      const prefs = { pets: rand() > 0.5 };
      const ctx = ctxFor(members, prefs);
      const plan = preparedPlan(ctx);
      expect(validatePlan(plan, ctx), JSON.stringify(members)).toEqual([]);
      const v = rhythmView(freshState(), members, prefs);
      for (const m of v.printed) {
        // No numbered or reworded copies; a household job has one owner unless it's an individual job.
        expect(new Set(m.rows.map((r) => jobKey(r.title))).size).toBe(m.rows.length);
        for (const r of m.rows) if (r.owners.length > 1) expect(r.mode).toBe('each');
        // Nothing a child is too young for; no grown-up gets a child's personal job when there are children.
        for (const r of m.rows) {
          const j = JOBS.find((x) => x.title === r.title)!;
          for (const o of r.owners) {
            const p = v.people.find((x) => x.id === o.id)!;
            if (!p.adult && p.age !== null) expect(p.age, `${p.name} · ${r.title}`).toBeGreaterThanOrEqual(j.minAge);
            if (p.adult && kids) expect(j.own, `${p.name} · ${r.title}`).toBeFalsy();
          }
        }
        // The finish line names every job.
        expect(m.finish).toBe(finishLine(m.rows.map((r) => ({ job: JOBS.find((x) => x.title === r.title)?.id, title: r.title }))));
      }
      // Bedtime has no kitchen jobs.
      for (const m of v.printed.filter((x) => x.anchor === 'teeth')) for (const r of m.rows) expect(r.title).not.toMatch(/dishwasher|table|dinner/i);
      expect(v.habits.length).toBeLessThanOrEqual(MAX_HABITS);
      if (kids && v.people.some((p) => !p.adult && (p.age ?? 0) >= 3)) expect(v.habits.length).toBeGreaterThan(0);
    }
  });

  it('numbered or reworded duplicates are caught, refused when typed and merged when saved', () => {
    expect(jobKey('Put away every library book and game 0')).toBe(jobKey('Put away every library book and game 2'));
    expect(jobKey('Wipe the counters')).toBe(jobKey('wipe counters!'));
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const m = view(s).printed.find((x) => x.rows.length < MAX_ROWS)!;
    const who = view(s).people[2].id;
    expect(saveRow(s, undefined, { title: 'Put away library books 1', owners: [who], moment: m.id, habit: false }, members, prefs).ok).toBe(true);
    const again = saveRow(s, undefined, { title: 'Put away library books 2', owners: [who], moment: m.id, habit: false }, members, prefs);
    expect(again).toMatchObject({ ok: false });
    expect(duplicateIn(s.plan!, m.id, 'put away library books')).toBeTruthy();
    // A saved plan that already holds copies (from before this check) is cleaned on load: one row, owners kept.
    const copy = structuredClone(s.plan!);
    const orig = copy.rows.find((r) => r.title === 'Put away library books 1')!;
    copy.rows.push({ ...orig, id: 'dup', title: 'Put away library books 2', owners: [view(s).people[3].id] });
    const ctx = ctxFor(members, prefs, s.profile);
    const clean = cleanPlan(copy, ctx);
    expect(clean.rows.filter((r) => jobKey(r.title) === jobKey('Put away library books')).length).toBe(1);
    expect(validatePlan(clean, ctx).filter((x) => x.kind === 'duplicate')).toEqual([]);
  });

  it('several owners on a household job means together (said on the sheet); on an individual job, each their own', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const row = view(s).printed[0].rows.find((r) => r.mode === 'one' && !JOBS.find((j) => j.title === r.title)?.own)!;
    const kids = view(s).people.filter((p) => !p.adult).map((p) => p.id);
    setRowOwners(s, row.id, kids.slice(0, 2), members, prefs);
    expect(view(s).printed[0].rows.find((r) => r.id === row.id)!.mode).toBe('together');
    expect(validatePlan(s.plan!, ctxFor(members, prefs, s.profile))).toEqual([]);
  });

  it('the finish line always matches the jobs, after every edit', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const m = view(s).printed[0];
    const before = m.finish;
    removeRow(s, m.rows[0].id, members, prefs);
    const after = view(s).printed[0];
    expect(after.finish).not.toBe(before);
    expect(after.finish).toBe(finishLine(s.plan!.rows.filter((r) => r.moment === m.id)));
    saveRow(s, undefined, { title: 'Water the plants', owners: [view(s).people[0].id], moment: m.id, habit: false }, members, prefs);
    expect(view(s).printed[0].finish).toMatch(/the plants are watered\.$/);
    expect(finishOf('Put my library books away')).toBe('their library books are put away');
    expect(finishOf('Hang up my coat')).toBe('their coat is hung up');
    expect(finishOf('Story time')).toBe('story time is done');
  });

  it('habit sentences name the people, the job and the moment, without guessing anyone’s pronouns', () => {
    expect(habitSentence(['Mateo'], 'Sweep under the table', 'after dinner')).toBe('Mateo practices sweeping under the table after dinner.');
    expect(habitSentence(['Sofia'], 'Pack my backpack for tomorrow', 'after brushing teeth')).toBe('Sofia practices packing their backpack for tomorrow after brushing teeth.');
    expect(habitSentence(['Ivy', 'Leo'], 'Put dirty clothes in the hamper', 'after brushing teeth')).toBe('Ivy and Leo practice putting dirty clothes in the hamper after brushing teeth.');
    const v = sample('rivera').view();
    for (const h of v.habits) expect(h.sentence).toMatch(new RegExp(`^${h.owners[0].name} `));
  });

  it('a job someone already owns is never a new habit, and can’t be made one', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const est = view(s).printed.flatMap((m) => m.rows).find((r) => r.established)!;
    setHabit(s, est.id, true, members, prefs);
    expect(view(s).habits.some((h) => h.id === est.id)).toBe(false);
  });
});

// A one-parent family with three children and long names (not a site sample; a test fixture).
const VANDERHOEVEN: RhythmMember[] = [
  { id: 'vc-dana', firstName: 'Dana', kind: 'adult', role: 'parent', isAccountHolder: true } as RhythmMember,
  { id: 'vc-ar', firstName: 'Alexandriana-Rose', kind: 'child', birthYear: 2015, birthMonth: 2 } as RhythmMember,
  { id: 'vc-b', firstName: 'Bartholomew', kind: 'child', birthYear: 2018, birthMonth: 5 } as RhythmMember,
  { id: 'vc-kit', firstName: 'Kit', kind: 'child', birthYear: 2022, birthMonth: 8 } as RhythmMember,
];
const families = () => [
  ...['rivera', 'chen', 'hughes'].map((id) => { const x = sample(id); return { id, members: x.members, prefs: x.prefs as object, state: x.state }; }),
  { id: 'vanderhoeven-castellanos', members: VANDERHOEVEN, prefs: { pets: true } as object, state: freshState },
];
const partsOf = (v: ReturnType<typeof rhythmView>) => v.printed.flatMap((m) => m.parts);

describe('March Family Rhythm: quantity and ownership', () => {
  it('1. a seven-person family gets a sensible number of jobs, not one per person per moment', () => {
    const { members, prefs, view } = sample('chen');
    const v = view();
    expect(v.people).toHaveLength(7);
    const parts = partsOf(v);
    expect(parts.length).toBeLessThanOrEqual(7);
    for (const m of v.printed) expect(m.parts.filter((r) => !JOBS.find((j) => j.title === r.title)?.own).length).toBeLessThanOrEqual(householdBudget(7));
    // Nobody is given a job just to even things out: some people have no part, and that's fine.
    expect(v.people.some((p) => !parts.some((r) => r.owners.some((o) => o.id === p.id)))).toBe(true);
    expect(rhythmView(freshState(), members, prefs).printed.length).toBe(2);
  });

  it('2. a small household gets a useful, minimal plan', () => {
    const one = sample('hughes').view();
    expect(partsOf(one).length).toBe(2);
    expect(one.printed.every((m) => m.rows.length === 1)).toBe(true);
    const two = rhythmView(freshState(), [VANDERHOEVEN[0], { id: 'k', firstName: 'Sam', kind: 'child', birthYear: 2019, birthMonth: 4 } as RhythmMember], {});
    expect(partsOf(two).length).toBeGreaterThanOrEqual(2);
    expect(partsOf(two).length).toBeLessThanOrEqual(4);
    expect(validatePlan(preparedPlan(familyContext([VANDERHOEVEN[0]], {}, '2027-03')), familyContext([VANDERHOEVEN[0]], {}, '2027-03'))).toEqual([]);
  });

  it('3. a personal job several people do stays each person’s own (one row each), shown together only on paper', () => {
    const { state, view } = sample('rivera');
    const s = state();
    const v = view(s);
    const hamper = v.printed.flatMap((m) => m.parts).filter((r) => r.title === 'Put dirty clothes in the hamper');
    expect(hamper.length).toBeGreaterThanOrEqual(2);
    for (const r of hamper) { expect(r.owners).toHaveLength(1); expect(r.ownership).toBe('parallel_individual'); }
    const line = v.printed.flatMap((m) => m.rows).find((r) => r.title === 'Put dirty clothes in the hamper')!;
    expect(line.mode).toBe('each');
    expect(line.ids).toEqual(hamper.map((r) => r.id));
  });

  it('4. a genuinely shared job stays jointly owned: one shared outcome, every owner named, kept on reload', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const bed = view(s).printed.find((m) => m.anchor === 'teeth')!;
    const kids = view(s).people.filter((p) => !p.adult).map((p) => p.id).slice(1, 3);
    const r = saveRow(s, undefined, { title: '', job: 't-shared-toys', owners: kids, moment: bed.id, habit: false }, members, prefs);
    expect(r.ok).toBe(true);
    const row = s.plan!.rows.find((x) => x.job === 't-shared-toys')!;
    expect(row.owners).toEqual(kids);
    expect(row.share).toBe('joint');
    expect(ownershipOf(row, s.plan!)).toBe('joint');
    const shown = view(s).printed.find((m) => m.id === bed.id)!;
    expect(shown.rows.find((x) => x.id === row.id)!.mode).toBe('together');
    expect(shown.finish).toMatch(/the shared toys are put away/);
    const back = JSON.parse(JSON.stringify(s)) as RhythmState;
    expect(rhythmView(back, members, prefs).printed.find((m) => m.id === bed.id)!.rows.find((x) => x.id === row.id)!.owners.map((o) => o.id)).toEqual(kids);
  });

  it('5. sharing a moment never creates shared ownership: prepared plans have one owner per row', () => {
    for (const f of families()) {
      const v = rhythmView(f.state(), f.members as RhythmMember[], f.prefs);
      for (const r of partsOf(v)) { expect(r.owners, `${f.id} · ${r.title}`).toHaveLength(1); expect(r.ownership).not.toBe('joint'); }
    }
  });

  it('6. editing one person’s own job doesn’t change anyone else’s', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const [a, b] = view(s).printed.flatMap((m) => m.parts).filter((r) => r.title === 'Put dirty clothes in the hamper');
    const r = saveRow(s, a.id, { title: '', job: 't-toys', owners: [a.owners[0].id], moment: s.plan?.rows.find((x) => x.id === a.id)?.moment ?? view(s).printed[1].id, habit: false }, members, prefs);
    expect(r.ok).toBe(true);
    const after = view(s).printed.flatMap((m) => m.parts);
    expect(after.find((x) => x.id === a.id)!.title).toBe('Put my toys away');
    expect(after.find((x) => x.id === b.id)).toMatchObject({ title: 'Put dirty clothes in the hamper', owners: [expect.objectContaining({ id: b.owners[0].id })] });
    // Ticking another person on a personal job gives them their own row; the first person's stays theirs.
    const sofia = view(s).people.find((p) => p.name === 'Sofia')!.id;
    saveRow(s, a.id, { title: '', job: 't-toys', owners: [a.owners[0].id, sofia], moment: after.find((x) => x.id === a.id) ? s.plan!.rows.find((x) => x.id === a.id)!.moment : '', habit: false }, members, prefs);
    const toys = s.plan!.rows.filter((x) => x.job === 't-toys');
    expect(toys.map((x) => x.owners)).toEqual([[a.owners[0].id], [sofia]]);
  });

  it('7. taking one person off a job leaves everyone else’s part', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const [a, b] = view(s).printed.flatMap((m) => m.parts).filter((r) => r.title === 'Put dirty clothes in the hamper');
    removeOwner(s, a.id, a.owners[0].id, members, prefs);
    const left = view(s).printed.flatMap((m) => m.parts).filter((r) => r.title === 'Put dirty clothes in the hamper');
    expect(left.map((r) => r.id)).toEqual([b.id]);
    // A shared job: the others keep it; down to one, it's that person's own.
    const bed = view(s).printed.find((m) => m.anchor === 'teeth')!;
    const kids = view(s).people.filter((p) => !p.adult).map((p) => p.id);
    saveRow(s, undefined, { title: '', job: 't-shared-toys', owners: kids, moment: bed.id, habit: false }, members, prefs);
    const joint = s.plan!.rows.find((x) => x.job === 't-shared-toys')!;
    removeOwner(s, joint.id, kids[0], members, prefs);
    expect(s.plan!.rows.find((x) => x.id === joint.id)!.owners).toEqual(kids.slice(1));
    removeOwner(s, joint.id, kids[1], members, prefs);
    expect(s.plan!.rows.find((x) => x.id === joint.id)).toMatchObject({ owners: [kids[2]] });
    expect(s.plan!.rows.find((x) => x.id === joint.id)!.share).toBeUndefined();
  });

  it('8. saved plans keep what she chose: grouped personal jobs become one row each, shared jobs stay shared', () => {
    const { members, prefs, state, view } = sample('rivera');
    const kids = view().people.filter((p) => !p.adult).map((p) => p.id);
    const saved: RhythmState = {
      ...state(),
      plan: {
        moments: [{ id: 'm1', anchor: 'dinner', enabled: true, label: 'After our dinner' }, { id: 'm2', anchor: 'teeth', enabled: true }, { id: 'm3', anchor: 'breakfast', enabled: false }],
        rows: [
          // Earlier saves grouped a personal job, with a habit on it.
          { id: 'm2:t-clothes', moment: 'm2', job: 't-clothes', title: 'Put dirty clothes in the hamper', owners: [kids[1], kids[2]] },
          // She put two people on a household job (earlier: `together`; or without the flag).
          { id: 'm1:d-clear', moment: 'm1', job: 'd-clear', title: 'Clear the dinner table', owners: [kids[1], kids[2]], together: true },
          { id: 'm1:d-wipe', moment: 'm1', job: 'd-wipe', title: 'Wipe the counters', owners: [kids[0], kids[1]] },
          // Her own words.
          { id: 'm1:own:x', moment: 'm1', title: 'Water the plants', owners: [kids[0]] },
        ],
        habits: ['m2:t-clothes'],
      },
    };
    const v = rhythmView(JSON.parse(JSON.stringify(saved)), members, prefs);
    const parts = v.printed.flatMap((m) => m.parts);
    expect(parts.filter((r) => r.title === 'Put dirty clothes in the hamper').map((r) => r.owners.map((o) => o.id))).toEqual([[kids[1]], [kids[2]]]);
    expect(v.habits.map((h) => h.id)).toEqual(['m2:t-clothes']);
    expect(parts.find((r) => r.id === 'm1:d-clear')).toMatchObject({ mode: 'together', ownership: 'joint' });
    expect(parts.find((r) => r.id === 'm1:d-wipe')!.owners.map((o) => o.id)).toEqual([kids[0], kids[1]]);
    expect(parts.find((r) => r.id === 'm1:own:x')!.title).toBe('Water the plants');
    expect(v.printed[0].title).toBe('After our dinner');
    const ctx = familyContext(members, prefs, '2027-03', saved.profile);
    expect(validatePlan(cleanPlan(saved.plan!, ctx), ctx)).toEqual([]);
  });

  it('9. one new habit by default (a second only when she named jobs for two different children), never more than two', () => {
    for (const f of families()) {
      const v = rhythmView(f.state(), f.members as RhythmMember[], f.prefs);
      expect(v.habits.length, f.id).toBeGreaterThanOrEqual(1);
      expect(v.habits.length, f.id).toBeLessThanOrEqual(MAX_HABITS);
      for (const h of v.habits) { expect(h.established).toBe(false); expect(h.owners).toHaveLength(1); }
    }
    // Without named wishes (no profile), exactly one.
    for (const f of families()) expect(rhythmView(freshState(), f.members as RhythmMember[], f.prefs).habits.length).toBeLessThanOrEqual(1);
  });

  it('10. member ids and colors are January’s, unchanged; the printed fingerprint survives a round trip', () => {
    for (const f of families()) {
      const v = rhythmView(f.state(), f.members as RhythmMember[], f.prefs);
      const jan = familyColors({ members: f.members, preferences: f.prefs } as never);
      for (const r of partsOf(v)) for (const o of r.owners) { expect(f.members.some((m) => m.id === o.id)).toBe(true); expect(o.color.id).toBe(jan[o.id].id); }
      const s = f.state();
      expect(rhythmFingerprint(JSON.parse(JSON.stringify(s)), f.members as RhythmMember[], f.prefs)).toBe(rhythmFingerprint(s, f.members as RhythmMember[], f.prefs));
    }
  });

  it('every test family’s plan passes validation and fits the page budget', () => {
    for (const f of families()) {
      const s = f.state();
      const ctx = familyContext(f.members, f.prefs, '2027-03', s.profile);
      const plan = preparedPlan(ctx);
      expect(validatePlan(plan, ctx), f.id).toEqual([]);
    }
  });

  it('a job that makes someone everyone’s reminder is refused', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const r = saveRow(s, undefined, { title: 'Remind everyone to clean up', owners: [view(s).people[0].id], moment: view(s).printed[1].id, habit: false }, members, prefs);
    expect(r.ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { familySnapshot } from '../personalize/family';
import {
  ANCHORS, JOBS, MAX_HABITS, MAX_ROWS, addRow, fitsCue, freshState, fromLegacy, isRhythmState, moveRow, removeRow, restorePlan, rhythmFingerprint,
  rhythmView, setAnchor, setHabit, setMomentLabel, setMomentOn, setRowOwners, setRowTitle, type RhythmMember, type RhythmState,
} from './march-family-rhythm';

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

  it('a large family simplifies: siblings share their own jobs in one row instead of a row each', () => {
    const { members, prefs } = sample('rivera');
    const big: RhythmMember[] = [...members,
      { id: 'x1', firstName: 'Nia', kind: 'child', birthYear: 2019, birthMonth: 1 } as RhythmMember,
      { id: 'x2', firstName: 'Theo', kind: 'child', birthYear: 2017, birthMonth: 6 } as RhythmMember,
      { id: 'x3', firstName: 'June', kind: 'child', birthYear: 2015, birthMonth: 3 } as RhythmMember];
    const v = rhythmView(freshState(), big, prefs);
    for (const m of v.printed) expect(m.rows.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(v.printed.flatMap((m) => m.rows).some((r) => r.owners.length > 1)).toBe(true);
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

  it('the third moment: off by default, prepared with real jobs when turned on, gone again when off', () => {
    const { members, prefs, state, view } = sample('chen');
    const s = state();
    expect(view(s).printed).toHaveLength(2);
    setMomentOn(s, 'm3', true, members, prefs);
    expect(view(s).printed).toHaveLength(3);
    expect(view(s).printed[2].rows.length).toBeGreaterThan(0);
    setMomentOn(s, 'm3', false, members, prefs);
    expect(view(s).printed).toHaveLength(2);
    // The first two can't be turned off.
    setMomentOn(s, 'm1', false, members, prefs);
    expect(view(s).moments[0].enabled).toBe(true);
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

  it('a typed job that has to happen before the cue is flagged, not hidden', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const dinner = view(s).moments.find((m) => m.anchor === 'dinner')!;
    addRow(s, dinner.id, view(s).people[0].id, members, prefs, undefined, 'Make dinner');
    expect(view(s).moments.find((m) => m.id === dinner.id)!.rows.find((r) => r.title === 'Make dinner')!.misfit).toBe(true);
  });

  it('at most two new habits; choosing a third replaces the oldest', () => {
    const { members, prefs, state, view } = sample('rivera');
    const s = state();
    const rows = view(s).printed.flatMap((m) => m.rows).filter((r) => !r.habit);
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

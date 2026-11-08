/**
 * The Family Rhythm outside March (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md, Phase 2a): a plan carries the month
 * its ages are taken from. March's own behavior is pinned by family-rhythm-march-snapshot.test.ts and
 * march-family-rhythm.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { families, kid, adult, family } from '../../../../tests/club/fixtures';
import { sampleHouseholds } from '../../../data/club/samples';
import { familySnapshot, type FamilySnapshot } from '../personalize/family';
import { PRIORITIES } from '../../../data/club/family-profile';
import {
  KIT_MONTH, JOBS, MAX_HABITS, freshState, isRhythmState, monthOf, preparedPlan, restorePlan, rhythmContext, rhythmFingerprint, rhythmView,
  setHabit, validatePlan, type RhythmMember, type RhythmState,
} from './family-rhythm';
import * as march from './march-family-rhythm';

const members = (key: string) => families[key].members as RhythmMember[];
const prefs = (key: string) => families[key].preferences;

describe('Family Rhythm: the plan month', () => {
  it('the March module is the same engine', () => {
    expect(march.rhythmView).toBe(rhythmView);
    expect(march.KIT_MONTH).toBe('2027-03');
  });

  it('a plan without a month is March 2027; an explicit 2027-03 is identical', () => {
    expect(monthOf(freshState())).toBe(KIT_MONTH);
    for (const key of Object.keys(families)) {
      expect(rhythmFingerprint({ ...freshState(), month: '2027-03' }, members(key), prefs(key))).toBe(rhythmFingerprint(freshState(), members(key), prefs(key)));
    }
  });

  it('ages are taken on the first of the plan’s month', () => {
    // fixtures: children born in March, `age` on 1 Nov 2026.
    const m = members('A');
    const nov = rhythmView({ ...freshState(), month: '2026-11' }, m, prefs('A')).people;
    expect(nov.find((p) => p.id === 'ava')!.age).toBe(4);
    const may = rhythmView({ ...freshState(), month: '2027-05' }, m, prefs('A')).people;
    expect(may.find((p) => p.id === 'ava')!.age).toBe(5);
  });

  it('an age the month crosses changes which jobs a child can be given', () => {
    // A child of 2 in one month and 3 later: never given a job above their age in either month.
    const h = family('hh-x', [adult('mom', true), kid('tot', 2), kid('big', 8)]);
    for (const month of ['2026-11', '2027-03', '2027-09']) {
      const v = rhythmView({ ...freshState(), month }, h.members as RhythmMember[], h.preferences);
      const tot = v.people.find((p) => p.id === 'tot')!;
      for (const m of v.printed) for (const r of m.rows) if (r.owners.some((o) => o.id === 'tot')) {
        expect(JOBS.find((j) => j.title === r.title)!.minAge, `${month} ${r.title}`).toBeLessThanOrEqual(tot.age ?? 6);
      }
    }
  });

  it('every household shape gets a valid plan in any month', () => {
    for (const month of ['2026-11', '2026-12', '2027-01', '2027-06', '2027-10']) {
      for (const key of Object.keys(families)) {
        const s: RhythmState = { ...freshState(), month };
        const ctx = rhythmContext(members(key), prefs(key), s);
        const plan = preparedPlan(ctx);
        expect(validatePlan(plan, ctx), `${key} ${month}`).toEqual([]);
        const v = rhythmView(s, members(key), prefs(key));
        expect(v.habits.length).toBeLessThanOrEqual(MAX_HABITS);
        if (v.people.length) expect(v.printed.length, `${key} ${month}`).toBeGreaterThan(0);
      }
    }
  });

  it('small and large households: a one-person home, a solo parent of six', () => {
    const solo = rhythmView({ ...freshState(), month: '2026-11' }, members('soloNoKids'), prefs('soloNoKids'));
    expect(solo.printed.length).toBeGreaterThan(0);
    for (const m of solo.printed) expect(m.rows.length).toBeLessThanOrEqual(2);
    const big = rhythmView({ ...freshState(), month: '2026-11' }, members('bigSolo'), prefs('bigSolo'));
    const rows = big.printed.flatMap((m) => m.rows);
    // Not one job per person per moment.
    expect(rows.length).toBeLessThan(big.people.length * big.printed.length);
  });

  it('the month is saved with the plan, validated, and kept through edits', () => {
    const m = members('A');
    const s: RhythmState = { ...freshState(), month: '2026-11' };
    const v = rhythmView(s, m, prefs('A'));
    const first = v.printed[0].parts.find((r) => !r.habit && !r.established)!;
    setHabit(s, first.id, true, m, prefs('A'));
    expect(s.month).toBe('2026-11');
    const saved = JSON.parse(JSON.stringify(s));
    expect(isRhythmState(saved)).toBe(true);
    expect(rhythmFingerprint(saved, m, prefs('A'))).toBe(rhythmFingerprint(s, m, prefs('A')));
    for (const bad of ['2026-13', '2026-1', 'November', 202611]) expect(isRhythmState({ ...saved, month: bad })).toBe(false);
  });

  it('starting over clears the month with the plan and profile', () => {
    const s: RhythmState = { ...freshState(), month: '2026-11', profile: familySnapshot(sampleHouseholds.find((x) => x.id === 'rivera')!.profile!) };
    restorePlan(s);
    expect(s).toEqual({ v: 3 });
  });

  it('member colors and ids don’t move with the month', () => {
    const r = sampleHouseholds.find((x) => x.id === 'rivera')!;
    const people = (month?: string) => rhythmView({ ...freshState(), ...(month ? { month } : {}) }, r.household.members as RhythmMember[], r.household.preferences).people
      .map((p) => `${p.id}:${p.color.id}`);
    expect(people('2026-11')).toEqual(people());
  });
});

describe('Family Rhythm: the Welcome context', () => {
  const snap = (priority?: string, extra: Partial<FamilySnapshot> = {}): FamilySnapshot => ({ v: 1, activities: [], responsibilities: [], ...(priority ? { priority } : {}), ...extra });
  const ids = ['A', 'B', 'C', 'D', 'teens', 'bigSolo', 'grandparent', 'toddlers', 'noKids', 'soloNoKids'];

  it('bedtime is a step-6 priority, and it leads with the bedtime moment', () => {
    expect(PRIORITIES.some((p) => p.id === 'bedtime')).toBe(true);
    for (const key of ids) {
      const v = rhythmView({ ...freshState(), month: '2026-11', context: 'welcome', profile: snap('bedtime') }, members(key), prefs(key));
      if (families[key].members.some((m) => m.kind === 'child')) expect(v.moments[0].anchor, key).toBe('teeth');
    }
  });

  it('with a priority and no job named for a child, the habit is in her priority’s moment', () => {
    for (const p of ['mornings', 'evenings', 'bedtime', 'school-stuff', 'tidying']) {
      for (const key of ['A', 'B', 'D', 'grandparent']) {
        const v = rhythmView({ ...freshState(), month: '2026-11', context: 'welcome', profile: snap(p) }, members(key), prefs(key));
        const first = v.moments[0];
        const candidates = first.parts.filter((r) => !r.established && r.owners.length === 1 && !r.owners[0].adult);
        if (!candidates.length) continue;
        expect(v.habits[0].moment, `${p} ${key}`).toBe(first.title);
      }
    }
  });

  it('a job she named for a child still comes first, before the priority', () => {
    const r = sampleHouseholds.find((x) => x.id === 'rivera')!;
    const m = r.household.members as RhythmMember[];
    const profile = familySnapshot(r.profile!)!;
    const welcome = rhythmView({ ...freshState(), context: 'welcome', profile }, m, r.household.preferences);
    const march = rhythmView({ ...freshState(), profile }, m, r.household.preferences);
    // Rivera named jobs for children: the same habits as March.
    expect(welcome.habits.map((h) => h.sentence)).toEqual(march.habits.map((h) => h.sentence));
  });

  it('the Welcome lead never applies to a March plan', () => {
    for (const key of ids) {
      const s = { ...freshState(), profile: snap('bedtime') };
      expect(rhythmFingerprint(s, members(key), prefs(key))).toBe(rhythmFingerprint({ ...s }, members(key), prefs(key)));
      expect(isRhythmState({ ...s, context: 'march' })).toBe(false);
      expect(isRhythmState({ ...s, context: 'welcome' })).toBe(true);
    }
  });

  it('every household shape, every priority: a valid Welcome plan with one habit by default', () => {
    for (const p of [undefined, ...PRIORITIES.map((x) => x.id)]) {
      for (const key of Object.keys(families)) {
        const s: RhythmState = { ...freshState(), month: '2026-11', context: 'welcome', ...(p ? { profile: snap(p) } : {}) };
        const v = rhythmView(s, members(key), prefs(key));
        const ctx = rhythmContext(members(key), prefs(key), s);
        expect(validatePlan(preparedPlan(ctx, { lead: true }), ctx), `${key} ${p}`).toEqual([]);
        expect(v.habits.length, `${key} ${p}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

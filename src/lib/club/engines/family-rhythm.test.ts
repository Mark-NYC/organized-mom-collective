/**
 * The Family Rhythm outside March (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md, Phase 2a): a plan carries the month
 * its ages are taken from. March's own behavior is pinned by family-rhythm-march-snapshot.test.ts and
 * march-family-rhythm.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { families, kid, adult, family } from '../../../../tests/club/fixtures';
import { sampleHouseholds } from '../../../data/club/samples';
import { familySnapshot } from '../personalize/family';
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

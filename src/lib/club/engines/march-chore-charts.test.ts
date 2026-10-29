import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { weeklySchedule } from '../../../data/cleaning';
import {
  DAILY_MAX, addDaily, applyFamily, choreFingerprint, choreView, freshState, isChoreState, planChanged, removeDaily, renameJob, restoreAll,
  restoreKid, setPalette, setReward, setRewards, setWeekly, type ChoreMember,
} from './march-chore-charts';

const fam = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household;
const rivera = fam('rivera').members as ChoreMember[];
const id = (n: string, m = rivera) => m.find((x) => x.firstName === n)!.id;
const chart = (s: ReturnType<typeof freshState>, n: string, m = rivera, pets = true) => choreView(s, m, pets).charts.find((c) => c.name === n)!;

describe('March family chore charts', () => {
  it('one chart per child, none for grown-ups or archived children', () => {
    expect(choreView(freshState(), rivera, true).charts.map((c) => [c.name, c.age])).toEqual([['Sofia', 11], ['Mateo', 7], ['Elena', 5]]);
    const archived = rivera.map((m) => (m.firstName === 'Mateo' ? { ...m, archived: true } : m));
    expect(choreView(freshState(), archived, true).charts.map((c) => c.name)).toEqual(['Sofia', 'Elena']);
  });

  it('daily chores fit the age, a few more as children grow, never more than the chart’s rows', () => {
    const s = freshState();
    expect(chart(s, 'Elena').daily.map((j) => j.title)).toEqual(['Feed the pets', 'Put Toys Away', 'Make My Bed', 'Set the Table']);
    expect(chart(s, 'Elena', rivera, false).daily.map((j) => j.title)).not.toContain('Feed the pets');
    expect(chart(s, 'Sofia').daily).toHaveLength(6);
    expect(chart(s, 'Sofia').daily.map((j) => j.title)).not.toContain('Put Toys Away');
    for (const c of choreView(s, rivera, true).charts) expect(c.daily.length).toBeLessThanOrEqual(DAILY_MAX);
  });

  it('weekly chores: one a day, Monday first, from that day’s cleaning zone on the calendar', () => {
    const v = chart(freshState(), 'Mateo');
    expect(v.weekly.map((w) => w.label)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(v.weekly.slice(0, 4).map((w) => w.zone)).toEqual(weeklySchedule.map((d) => d.zone));
    expect(v.weekly.find((w) => w.label === 'Wednesday')!.job!.title).toBe('Empty bathroom trash');
    expect(chart(freshState(), 'Elena').weekly.find((w) => w.label === 'Wednesday')!.job!.title).toBe('Put shoes away');
  });

  it('library chores carry their illustration, typed ones none', () => {
    const s = freshState();
    expect(chart(s, 'Elena').daily.find((j) => j.title === 'Make My Bed')!.image?.src).toBeTruthy();
    addDaily(s, id('Elena'), 'own-x', rivera, true, 'Water the plants');
    expect(chart(s, 'Elena').daily.at(-1)).toMatchObject({ title: 'Water the plants', image: null });
  });

  it('add, rename and remove daily chores, up to the chart’s rows', () => {
    const s = freshState();
    renameJob(s, id('Mateo'), { daily: 0 }, '  Feed   Biscuit ', rivera, true);
    expect(chart(s, 'Mateo').daily[0].title).toBe('Feed Biscuit');
    removeDaily(s, id('Mateo'), 0, rivera, true);
    expect(chart(s, 'Mateo').daily.map((j) => j.title)).not.toContain('Feed Biscuit');
    for (let i = 0; i < 12; i++) addDaily(s, id('Mateo'), `own-${i}`, rivera, true, `Job ${i}`);
    expect(chart(s, 'Mateo').daily).toHaveLength(DAILY_MAX);
    expect(chart(s, 'Sofia').changed).toBe(false);
  });

  it('weekly choice and a day off', () => {
    const s = freshState();
    setWeekly(s, id('Sofia'), 3, 'sink', rivera, true);
    setWeekly(s, id('Sofia'), 6, null, rivera, true);
    const v = chart(s, 'Sofia');
    expect(v.weekly.find((w) => w.day === 3)!.job!.title).toBe('Wipe the bathroom sink');
    expect(v.weekly.find((w) => w.day === 6)!.job).toBeNull();
    setWeekly(s, id('Sofia'), 3, 'not-a-job', rivera, true);
    expect(chart(s, 'Sofia').weekly.find((w) => w.day === 3)!.job!.title).toBe('Wipe the bathroom sink');
  });

  it('rewards, colors, fingerprint and restore', () => {
    const s = freshState();
    const before = choreFingerprint(s, rivera, true);
    setReward(s, id('Elena'), 2, 'Park picnic', rivera, true);
    expect(chart(s, 'Elena').rewardLines[2]).toBe('Park picnic');
    setRewards(s, false);
    setPalette(s, 'blue-green');
    expect(choreFingerprint(s, rivera, true)).not.toBe(before);
    setPalette(s, 'nope');
    expect(s.palette).not.toBe('nope');
    restoreKid(s, id('Elena'));
    expect(chart(s, 'Elena').changed).toBe(false);
    restoreAll(s);
    expect(planChanged(s)).toBe(false);
    expect(choreFingerprint(s, rivera, true)).toBe(before);
  });

  it('keeps the plan to this family and checks stored state', () => {
    const s = freshState();
    setReward(s, id('Elena'), 0, 'Hi', rivera, true);
    s.kids['someone-else'] = {};
    applyFamily(s, rivera);
    expect(Object.keys(s.kids)).toEqual([id('Elena')]);
    expect(isChoreState(s)).toBe(true);
    expect(isChoreState({ palette: 'x', rewards: true })).toBe(false);
    expect(isChoreState({ ...s, kids: { a: { daily: [{ title: 1 }] } } })).toBe(false);
  });
});

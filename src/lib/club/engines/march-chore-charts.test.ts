import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { weeklySchedule } from '../../../data/cleaning';
import {
  DAILY_MAX, addDaily, applyFamily, choreFingerprint, choreView, freshState, isChoreState, planChanged, removeDaily, renameJob, restoreAll,
  restoreKid, setDailyLevel, setPalette, setReward, setRewards, setWeekly, toggleTurn, type ChoreMember,
} from './march-chore-charts';

const fam = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household;
const rivera = fam('rivera').members as ChoreMember[];
const brooks = fam('brooks').members as ChoreMember[];
const id = (n: string, m = rivera) => m.find((x) => x.firstName === n)!.id;
const chart = (s: ReturnType<typeof freshState>, n: string, m = rivera, pets = true) => choreView(s, m, pets).charts.find((c) => c.name === n)!;

describe('March family chore charts', () => {
  it('one chart per child, none for grown-ups or archived children', () => {
    expect(choreView(freshState(), rivera, true).charts.map((c) => [c.name, c.age])).toEqual([['Sofia', 11], ['Mateo', 7], ['Elena', 5]]);
    const archived = rivera.map((m) => (m.firstName === 'Mateo' ? { ...m, archived: true } : m));
    expect(choreView(freshState(), archived, true).charts.map((c) => c.name)).toEqual(['Sofia', 'Elena']);
  });

  it('daily jobs fit the age: more and harder as children grow, toys away only for younger ones', () => {
    const s = freshState();
    expect(chart(s, 'Elena').daily.map((j) => j.title)).toEqual(['Put Toys Away', 'Make My Bed', 'Set the Table']);
    expect(chart(s, 'Sofia').daily).toHaveLength(5);
    expect(chart(s, 'Sofia').daily.map((j) => j.title)).not.toContain('Put Toys Away');
    const chen = fam('chen').members as ChoreMember[];
    expect(chart(s, 'Grace', chen).daily.map((j) => j.title)).toContain('Kitchen cleanup after dinner');
  });

  it('weekly jobs follow the wall calendar’s cleaning zones, Monday first', () => {
    const v = chart(freshState(), 'Mateo');
    expect(v.weekly.map((w) => w.label)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(v.weekly.slice(0, 4).map((w) => w.zone)).toEqual(weeklySchedule.map((d) => d.zone));
    expect(v.weekly.find((w) => w.label === 'Wednesday')!.job!.title).toBe('Empty the bathroom trash');
    expect(chart(freshState(), 'Elena').weekly.find((w) => w.label === 'Wednesday')!.job!.title).toBe('Put my shoes and coat away');
  });

  it('levels: age suggests, Mom changes', () => {
    const s = freshState();
    expect(chart(s, 'Elena').daily.map((j) => j.level)).toEqual(['owns', 'with-check', 'with-check']);
    setDailyLevel(s, id('Elena'), 0, 'learning', rivera, true);
    expect(chart(s, 'Elena').daily[0].level).toBe('learning');
    expect(planChanged(s)).toBe(true);
    restoreKid(s, id('Elena'));
    expect(chart(s, 'Elena').daily[0].level).toBe('owns');
  });

  it('siblings take turns week by week; each chart shows the turns it shares', () => {
    const s = freshState();
    expect(chart(s, 'Sofia').turns.map((t) => [t.title, t.line])).toEqual([
      ['Clear the Table', 'Sofia: weeks 1 & 4 · Mateo: weeks 2 & 5 · Elena: week 3'],
      ['Take Out the Trash', 'Sofia: weeks 1, 3 & 5 · Mateo: weeks 2 & 4'],
      ['Feed the pets', 'Sofia: weeks 1 & 4 · Mateo: weeks 2 & 5 · Elena: week 3'],
    ]);
    expect(chart(s, 'Elena').turns.map((t) => t.title)).toEqual(['Clear the Table', 'Feed the pets']);
    toggleTurn(s, 'take-out-the-trash', id('Mateo'), rivera, true);
    expect(chart(s, 'Sofia').turns.map((t) => t.title)).not.toContain('Take Out the Trash');
    toggleTurn(s, 'take-out-the-trash', id('Elena'), rivera, true);
    expect(s.turns['take-out-the-trash']).toEqual([id('Sofia')]);
  });

  it('no pets, no pet job; one child, no turns', () => {
    expect(choreView(freshState(), brooks, false).sharedOptions.map((o) => o.id)).toEqual(['clear-the-table', 'take-out-the-trash']);
    const okafor = fam('okafor').members as ChoreMember[];
    expect(choreView(freshState(), okafor, false).charts[0].turns).toEqual([]);
  });

  it('add, rename, remove daily jobs; at most five', () => {
    const s = freshState();
    addDaily(s, id('Elena'), 'own-1', rivera, true, '  Water the plants ');
    expect(chart(s, 'Elena').daily.at(-1)!.title).toBe('Water the plants');
    renameJob(s, id('Elena'), { daily: 0 }, 'Toys back in the bin', rivera, true);
    expect(chart(s, 'Elena').daily[0]).toMatchObject({ title: 'Toys back in the bin' });
    expect(chart(s, 'Elena').daily[0].lib).toBeUndefined();
    addDaily(s, id('Elena'), 'tidy-my-desk', rivera, true);
    addDaily(s, id('Elena'), 'wipe-the-counters', rivera, true);
    expect(chart(s, 'Elena').daily).toHaveLength(DAILY_MAX);
    removeDaily(s, id('Elena'), 0, rivera, true);
    expect(chart(s, 'Elena').daily).toHaveLength(4);
  });

  it('weekly job choice and a day off', () => {
    const s = freshState();
    setWeekly(s, id('Mateo'), 3, 'sink', rivera, true);
    setWeekly(s, id('Mateo'), 5, null, rivera, true);
    setWeekly(s, id('Mateo'), 2, 'not-a-job', rivera, true);
    const v = chart(s, 'Mateo');
    expect(v.weekly.find((w) => w.day === 3)!.job!.title).toBe('Wipe the bathroom sink');
    expect(v.weekly.find((w) => w.day === 5)!.job).toBeNull();
    expect(v.weekly.find((w) => w.day === 2)!.job!.title).toBe('Clean My Floor');
  });

  it('rewards on or off, colors, fingerprint, restore', () => {
    const s = freshState();
    const before = choreFingerprint(s, rivera, true);
    setReward(s, id('Sofia'), 0, 'Pick Friday’s movie', rivera, true);
    expect(chart(s, 'Sofia').rewardLines[0]).toBe('Pick Friday’s movie');
    setRewards(s, false);
    setPalette(s, 'blue-green');
    setPalette(s, 'neon');
    expect(s.palette).toBe('warm-neutrals');
    expect(choreFingerprint(s, rivera, true)).not.toBe(before);
    restoreAll(s);
    expect(planChanged(s)).toBe(false);
  });

  it('another family keeps nothing from this one', () => {
    const s = freshState();
    setDailyLevel(s, id('Sofia'), 0, 'learning', rivera, true);
    toggleTurn(s, 'clear-the-table', id('Elena'), rivera, true);
    applyFamily(s, brooks);
    expect(s.kids).toEqual({});
    expect(JSON.stringify(choreView(s, brooks, false))).not.toMatch(/Sofia|Mateo|Elena/);
    expect(isChoreState(s)).toBe(true);
    expect(isChoreState({ palette: 'x', rewards: true, kids: { a: { daily: [{ id: 1 }] } }, turns: {} })).toBe(false);
  });
});

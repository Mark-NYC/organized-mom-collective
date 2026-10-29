import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { weeklySchedule } from '../../../data/cleaning';
import { MARCH_CHORE_ICONS, MARCH_ICONS } from '../../../data/club/march-chore-icons';
import {
  DAILY_MAX, DAILY_CHORES, ZONE_CHORES, addDaily, applyFamily, choreFingerprint, choreView, freshState, isChoreState, planChanged,
  removeDaily, renameJob, restoreAll, restoreKid, setPalette, setWeekly, type ChoreMember, type ChoreState,
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

  it('daily chores fit the age, a few more as children grow, never more than eight', () => {
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

  it('every listed chore, daily and weekly, has a March icon; icons are the 24 March files', () => {
    const ids = new Set([...DAILY_CHORES, ...Object.values(ZONE_CHORES).flat()].map((d) => d.id));
    expect([...ids].filter((i) => !MARCH_CHORE_ICONS[i])).toEqual([]);
    expect(new Set(Object.values(MARCH_CHORE_ICONS))).toEqual(new Set(MARCH_ICONS));
    expect(MARCH_ICONS).toHaveLength(24);
    expect([MARCH_CHORE_ICONS['clear-the-table'], MARCH_CHORE_ICONS['my-dishes']]).toEqual(['clear-dishes', 'clear-dishes']);
    expect([MARCH_CHORE_ICONS['dust-living'], MARCH_CHORE_ICONS['dust-room']]).toEqual(['dust', 'dust']);
    expect([MARCH_CHORE_ICONS['vacuum-living'], MARCH_CHORE_ICONS['vacuum-room']]).toEqual(['vacuum', 'vacuum']);
    expect([MARCH_CHORE_ICONS['clean-my-floor'], MARCH_CHORE_ICONS['sweep-kitchen']]).toEqual(['clean-floor', 'clean-floor']);
  });

  it('a missing March file falls back to existing art, or to no picture at all', () => {
    const s = freshState();
    // No March files are in the repo yet: listed library chores show their responsibility illustration.
    expect(chart(s, 'Elena').daily.find((j) => j.title === 'Make My Bed')!.icon).toMatchObject({ name: 'make-bed', final: false, src: '/images/responsibilities/make-my-bed-256.webp' });
    expect(chart(s, 'Elena').daily.find((j) => j.title === 'Feed the pets')!.icon).toBeNull();
    expect(chart(s, 'Sofia').weekly.find((w) => w.label === 'Wednesday')!.job!.icon).toBeNull();
    addDaily(s, id('Elena'), 'own-x', rivera, true, 'Water the plants');
    expect(chart(s, 'Elena').daily.at(-1)).toMatchObject({ title: 'Water the plants', icon: null });
    renameJob(s, id('Elena'), { daily: 1 }, 'Pick up the blocks', rivera, true);
    expect(chart(s, 'Elena').daily[1]).toMatchObject({ title: 'Pick up the blocks', icon: null });
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

  it('colors, fingerprint and restore', () => {
    const s = freshState();
    const before = choreFingerprint(s, rivera, true);
    setWeekly(s, id('Elena'), 0, null, rivera, true);
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
    removeDaily(s, id('Elena'), 0, rivera, true);
    s.kids['someone-else'] = { daily: [] };
    applyFamily(s, rivera);
    expect(Object.keys(s.kids)).toEqual([id('Elena')]);
    expect(isChoreState(s)).toBe(true);
    expect(isChoreState({ palette: 'x' })).toBe(false);
    expect(isChoreState({ ...s, kids: { a: { daily: [{ title: 1 }] } } })).toBe(false);
  });

  it('charts saved with rewards keep their chores and lose the rewards', () => {
    const saved = JSON.parse(JSON.stringify({
      palette: 'blue-green', rewards: true,
      kids: {
        [id('Mateo')]: { daily: [{ id: 'feed-pets', title: 'Feed Biscuit' }, { id: 'make-my-bed', title: 'Make My Bed', lib: 'make-my-bed' }], weekly: { 3: null }, rewards: ['Pick a movie', 'Park trip', 'Pizza night'] },
        [id('Elena')]: { rewards: ['A', 'B', 'C'] },
      },
    }));
    expect(isChoreState(saved)).toBe(true);
    const s = applyFamily(saved as ChoreState, rivera);
    expect(s).toEqual({ palette: 'blue-green', kids: { [id('Mateo')]: { daily: saved.kids[id('Mateo')].daily, weekly: { 3: null } } } });
    const v = chart(s, 'Mateo');
    expect(v.daily.map((j) => [j.title, j.icon?.name ?? null])).toEqual([['Feed Biscuit', null], ['Make My Bed', 'make-bed']]);
    expect(v.weekly.find((w) => w.day === 3)!.job).toBeNull();
    expect(JSON.stringify(choreView(s, rivera, true))).not.toMatch(/reward/i);
    expect(chart(s, 'Elena').changed).toBe(false);
  });
});

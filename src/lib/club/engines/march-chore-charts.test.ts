import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { weeklySchedule } from '../../../data/cleaning';
import { MARCH_CHORE_ICONS, MARCH_ICONS, NO_ICON_YET } from '../../../data/club/march-chore-icons';
import { familySnapshot } from '../personalize/family';
import {
  ADULT_DAILY, DAILY_MAX, DAILY_CHORES, ZONE_CHORES, addDaily, applyFamily, choreFingerprint, choreView, freshState, isChoreState, planChanged,
  removeDaily, renameJob, restoreAll, restoreKid, setChartOn, setPalette, setWeekly, type ChoreMember, type ChoreState,
} from './march-chore-charts';

const fam = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household;
const rivera = fam('rivera').members as ChoreMember[];
const id = (n: string, m = rivera) => m.find((x) => x.firstName === n)!.id;
const chen = fam('chen').members as ChoreMember[];
const brooks = fam('brooks').members as ChoreMember[];
const okafor = fam('okafor').members as ChoreMember[];
const hughes = fam('hughes').members as ChoreMember[];
const chart = (s: ReturnType<typeof freshState>, n: string, m = rivera, pets = true) => choreView(s, m, pets).charts.find((c) => c.name === n)!;

describe('March family chore charts', () => {
  it('a chart for every child, then every grown-up; archived members never', () => {
    expect(choreView(freshState(), rivera, true).charts.map((c) => [c.name, c.age])).toEqual([['Sofia', 11], ['Mateo', 7], ['Elena', 5], ['Ana', null], ['Luis', null]]);
    const archived = rivera.map((m) => (m.firstName === 'Mateo' ? { ...m, archived: true } : m));
    expect(choreView(freshState(), archived, true).charts.map((c) => c.name)).toEqual(['Sofia', 'Elena', 'Ana', 'Luis']);
  });

  it('daily chores fit the age, a few more as children grow, never more than eight', () => {
    const s = freshState();
    const elena = chart(s, 'Elena').daily.map((j) => j.id);
    expect(elena.slice(0, 2)).toEqual(['put-toys-away', 'make-my-bed']);
    expect(elena).toHaveLength(4);
    expect(chart(s, 'Elena', rivera, false).daily.map((j) => j.title)).not.toContain('Feed the pets');
    expect(chart(s, 'Sofia').daily).toHaveLength(6);
    expect(chart(s, 'Sofia').daily.map((j) => j.title)).not.toContain('Put Toys Away');
    for (const c of choreView(s, rivera, true).charts) expect(c.daily.length).toBeLessThanOrEqual(DAILY_MAX);
    // Age-fit: nothing a child is too young for.
    const min = new Map([...DAILY_CHORES, ...ADULT_DAILY].map((d) => [d.id, d.minAge]));
    for (const c of choreView(s, rivera, true).charts.filter((x) => !x.adult)) for (const j of c.daily) expect(min.get(j.id)!).toBeLessThanOrEqual(c.age!);
  });

  it('household jobs are shared out: each on one chart, the grown-ups’ jobs on theirs', () => {
    for (const fam of [rivera, chen, brooks]) {
      const v = choreView(freshState(), fam, true);
      const household = v.charts.flatMap((c) => c.daily).filter((j) => DAILY_CHORES.find((d) => d.id === j.id)?.share === 'household' || ADULT_DAILY.some((d) => d.id === j.id));
      expect(new Set(household.map((j) => j.id)).size).toBe(household.length);
      for (const c of v.charts.filter((x) => x.adult)) expect(c.daily.length).toBeGreaterThan(0);
      // Children's charts never carry the grown-up jobs.
      for (const c of v.charts.filter((x) => !x.adult)) expect(c.daily.some((j) => ADULT_DAILY.some((d) => d.id === j.id))).toBe(false);
    }
  });

  it('the account holder is never the default: she leans last and carries no more than an even share', () => {
    const v = choreView(freshState(), rivera, true);
    const ana = v.charts.find((c) => c.name === 'Ana')!, luis = v.charts.find((c) => c.name === 'Luis')!;
    expect(ana.daily.length).toBeLessThanOrEqual(luis.daily.length);
    const weeklyCount = (c: typeof ana) => c.weekly.filter((w) => w.job).length;
    expect(weeklyCount(ana)).toBeLessThanOrEqual(weeklyCount(luis));
  });

  it('her profile answers lead: who owns meals and pets keeps them, as far as a fair share allows', () => {
    const r = sampleHouseholds.find((x) => x.id === 'rivera')!;
    const s = { ...freshState(), profile: familySnapshot(r.profile) };
    // Sofia already takes care of the dog: she feeds the pets. Luis and Ana own meals: dinner is a grown-up's.
    expect(chart(s, 'Sofia').daily.map((j) => j.id)).toContain('feed-pets');
    expect([...chart(s, 'Ana').daily, ...chart(s, 'Luis').daily].map((j) => j.id)).toContain('cook-dinner');
    // A snapshot naming someone who left doesn't break anything.
    const gone = { ...s, profile: { ...s.profile!, responsibilities: [{ status: 'existing' as const, category: 'pet-care', ownerIds: ['nobody'], helperIds: [] }] } };
    expect(choreView(gone, rivera, true).charts).toHaveLength(5);
  });

  it('weekly chores: one a day, Monday first, from that day’s cleaning zone, distinct household jobs that day', () => {
    const v = chart(freshState(), 'Mateo');
    expect(v.weekly.map((w) => w.label)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(v.weekly.slice(0, 4).map((w) => w.zone)).toEqual(weeklySchedule.map((d) => d.zone));
    for (const fam of [rivera, chen]) {
      const charts = choreView(freshState(), fam, true).charts;
      for (const day of [1, 2, 3, 4, 5, 6, 0]) {
        const jobs = charts.map((c) => c.weekly.find((w) => w.day === day)!.job).filter(Boolean);
        const household = jobs.filter((j) => ZONE_CHORES[day].find((d) => d.id === j!.id)?.share !== 'own');
        expect(new Set(household.map((j) => j!.id)).size).toBe(household.length);
        for (const c of charts) {
          const j = c.weekly.find((w) => w.day === day)!.job;
          if (j && !c.adult) expect(ZONE_CHORES[day].find((d) => d.id === j.id)!.minAge).toBeLessThanOrEqual(c.age!);
        }
      }
    }
    // The hardest job of the day is a grown-up's, not a child's.
    expect(chart(freshState(), 'Elena').weekly.find((w) => w.label === 'Wednesday')!.job!.title).toBe('Put shoes away');
    const wed = choreView(freshState(), rivera, true).charts.filter((c) => c.adult).map((c) => c.weekly.find((w) => w.day === 3)!.job!.id);
    expect(wed).toEqual(expect.arrayContaining(['bathroom', 'mop-bath']));
  });

  it('one child, two school-aged children, a toddler and limited profiles all get complete charts', () => {
    const one = [rivera[0], { ...rivera[2] }];
    expect(choreView(freshState(), one, false).charts.map((c) => [c.name, c.daily.length > 0])).toEqual([['Sofia', true], ['Ana', true]]);
    const b = choreView(freshState(), brooks, false).charts;
    expect(b.map((c) => c.name)).toEqual(['Max', 'Lily', 'Jess']);
    for (const c of b) expect(c.weekly.every((w) => w.job)).toBe(true);
    // A toddler: one or two little jobs, the rest with the grown-ups.
    const z = choreView(freshState(), okafor, false).charts;
    expect(z[0].daily.map((j) => j.id)).toEqual(['put-toys-away']);
    // No children yet: the grown-up's chart still prints.
    expect(choreView(freshState(), hughes, false).charts.map((c) => c.name)).toEqual(['Claire']);
    // A child with no birth year: planned at the chart's default age, never above it.
    const noAge = [rivera[0], { ...rivera[2], birthYear: undefined }];
    expect(choreView(freshState(), noAge, false).charts[0].age).toBe(8);
  });

  it('a grown-up’s chart can be left off; their jobs go to the other grown-ups', () => {
    const s = freshState();
    setChartOn(s, id('Luis'), false, rivera);
    const v = choreView(s, rivera, true);
    expect(v.charts.map((c) => c.name)).toEqual(['Sofia', 'Mateo', 'Elena', 'Ana']);
    expect(v.adults).toEqual([{ id: id('Ana'), name: 'Ana', on: true }, { id: id('Luis'), name: 'Luis', on: false }]);
    expect(v.charts.find((c) => c.name === 'Ana')!.daily.map((j) => j.id)).toContain('cook-dinner');
    setChartOn(s, id('Luis'), true, rivera);
    expect(s.off).toBeUndefined();
    setChartOn(s, id('Sofia'), false, rivera);
    expect(s.off).toBeUndefined();
  });

  it('every listed chore, daily and weekly, has a March icon or is on the no-icon-yet list; icons are the 24 March files', () => {
    const ids = new Set([...DAILY_CHORES, ...ADULT_DAILY, ...Object.values(ZONE_CHORES).flat()].map((d) => d.id));
    expect([...ids].filter((i) => !MARCH_CHORE_ICONS[i] && !(NO_ICON_YET as readonly string[]).includes(i))).toEqual([]);
    expect(new Set(Object.values(MARCH_CHORE_ICONS))).toEqual(new Set(MARCH_ICONS));
    expect(MARCH_ICONS).toHaveLength(24);
    expect([MARCH_CHORE_ICONS['clear-the-table'], MARCH_CHORE_ICONS['my-dishes']]).toEqual(['clear-dishes', 'clear-dishes']);
    expect([MARCH_CHORE_ICONS['dust-living'], MARCH_CHORE_ICONS['dust-room']]).toEqual(['dust', 'dust']);
    expect([MARCH_CHORE_ICONS['vacuum-living'], MARCH_CHORE_ICONS['vacuum-room']]).toEqual(['vacuum', 'vacuum']);
    expect([MARCH_CHORE_ICONS['clean-my-floor'], MARCH_CHORE_ICONS['sweep-kitchen']]).toEqual(['clean-floor', 'clean-floor']);
  });

  it('a missing March file falls back to existing art, or to no picture at all', () => {
    const s = freshState();
    expect(chart(s, 'Elena').daily.find((j) => j.title === 'Make My Bed')!.icon).toMatchObject({ name: 'make-bed' });
    // A chore on the no-icon-yet list prints words only.
    expect(chart(s, 'Luis').daily.concat(chart(s, 'Ana').daily).find((j) => j.id === 'laundry-load')!.icon).toBeNull();
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
    expect(s.profile).toBeUndefined();
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
    expect(isChoreState({ ...s, off: [1] })).toBe(false);
    expect(isChoreState({ ...s, profile: { v: 9 } })).toBe(false);
    const v = chart(s, 'Mateo');
    expect(v.daily.map((j) => [j.title, j.icon?.name ?? null])).toEqual([['Feed Biscuit', null], ['Make My Bed', 'make-bed']]);
    expect(v.weekly.find((w) => w.day === 3)!.job).toBeNull();
    expect(JSON.stringify(choreView(s, rivera, true))).not.toMatch(/reward/i);
    expect(chart(s, 'Elena').changed).toBe(false);
  });
});

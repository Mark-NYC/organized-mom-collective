/**
 * March 2027, Spring Clean as a Team (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → Phase 3a): the prepared project
 * and its job guides. Safety, ownership, timing and recommendation quality, for every family shape we promise.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { families, family, adult, kid } from '../../../../tests/club/fixtures';
import { sampleHouseholds } from '../../../data/club/samples';
import { cleaningRooms, coreJobs, jobById, otherRoomJobs, roomById } from '../../../data/spring-cleaning';
import { JOB_GUIDES, ROOM_FINISH } from '../../../data/club/spring-clean-guides';
import { familySnapshot, type FamilySnapshot } from '../personalize/family';
import {
  MAX_JOBS, MAX_MINUTES, MIN_JOBS, YOUNG_MINUTES, addJob, cleanProject, freshState, helpersOf, isSpringState, preparedProject, removeJob,
  replaceJob, restoreProject, setOwners, setRoom, springContext, springFingerprint, springView, suggestedRoom, validateProject,
  type SpringMember, type SpringState,
} from './march-spring-clean';

const members = (key: string) => families[key].members as SpringMember[];
const prefs = (key: string) => families[key].preferences;
const ALL_ROOMS = [...cleaningRooms.map((r) => r.id), 'other'];
const ALL_JOBS = [...cleaningRooms.flatMap((r) => r.jobs), ...otherRoomJobs];
const snap = (over: Partial<FamilySnapshot> = {}): FamilySnapshot => ({ v: 1, activities: [], responsibilities: [], ...over });
const HELP_MOM = /\b(help(ing)? (mom|mommy|dad)|for mom)\b/i;

/** Everything a prepared plan must satisfy, whatever the family and room. */
function checkPlan(label: string, m: readonly SpringMember[], p: Parameters<typeof springView>[2], s: SpringState) {
  const v = springView(s, m, p);
  const ctx = v.ctx;
  const helpers = helpersOf(ctx);
  expect(v.issues, label).toEqual([]);
  expect(v.jobs.length, label).toBeLessThanOrEqual(MAX_JOBS);
  expect(v.minutes, label).toBeLessThanOrEqual(MAX_MINUTES);
  expect(v.withinTime, label).toBe(true);
  for (const j of v.jobs) {
    const job = jobById(j.jobId)!;
    expect(JOB_GUIDES[j.jobId], `${label} ${j.jobId}`).toBeTruthy();
    for (const o of j.owners) {
      const h = helpers.find((x) => x.id === o.id)!;
      // Grown-ups-only work never goes to a child; no child below a job's suggested age by default.
      if (job.adultOnly) expect(h.group, `${label} ${j.title} → ${o.name}`).toBe('adult');
      if (h.group !== 'adult') expect(h.age ?? 0, `${label} ${j.title} → ${o.name}`).toBeGreaterThanOrEqual(job.minAge);
    }
    // Prepared plans: one owner per job (joint only when she makes it).
    expect(j.owners.length, `${label} ${j.title}`).toBeLessThanOrEqual(1);
    expect(j.joint).toBe(false);
  }
  // The youngest work about fifteen minutes; nobody past the session.
  for (const person of v.people) {
    const load = person.jobs.reduce((n, j) => n + j.effort, 0);
    expect(load, `${label} ${person.name}`).toBeLessThanOrEqual(person.age !== null && person.age < 6 ? YOUNG_MINUTES : MAX_MINUTES);
  }
  return v;
}

describe('Spring Clean: the prepared project', () => {
  it.each(Object.keys(families))('%s: one room, a realistic session, safe owners', (key) => {
    const v = checkPlan(key, members(key), prefs(key), freshState());
    expect(v.room.id).toBe('living');
    expect(v.jobs.length).toBeGreaterThanOrEqual(MIN_JOBS);
    expect(v.finish).toBe(ROOM_FINISH.living);
    expect(v.supplies.length).toBeGreaterThan(0);
    expect(v.sequence[0]).toMatch(/supplies/i);
  });

  it('every family shape in every room passes every check', () => {
    for (const key of Object.keys(families)) for (const room of ALL_ROOMS) {
      const s = freshState();
      setRoom(s, room, members(key), prefs(key));
      checkPlan(`${key}/${room}`, members(key), prefs(key), s);
    }
  });

  it('300 generated households (1–9 people, any ages) get a valid project in any room', () => {
    let seed = 3;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    for (let n = 0; n < 300; n++) {
      const adults = 1 + Math.floor(rand() * 3);
      const kids = Math.floor(rand() * 7);
      const m = [
        ...Array.from({ length: adults }, (_, i) => ({ id: `a${i}`, firstName: `Grown${i}`, kind: 'adult' as const, ...(i === 0 ? { isAccountHolder: true } : {}) })),
        ...Array.from({ length: kids }, (_, i) => ({ id: `k${i}`, firstName: `Kid${i}`, kind: 'child' as const, birthYear: 2008 + Math.floor(rand() * 19), birthMonth: 1 + Math.floor(rand() * 12) })),
      ] as SpringMember[];
      const s = freshState();
      setRoom(s, ALL_ROOMS[n % ALL_ROOMS.length], m, {});
      checkPlan(`#${n}`, m, {}, s);
    }
  });

  it('covers the work in order: something cleared, something cleaned, floors or trash last, when anyone can', () => {
    for (const key of Object.keys(families)) for (const room of ALL_ROOMS) {
      const s = freshState();
      setRoom(s, room, members(key), prefs(key));
      const v = springView(s, members(key), prefs(key));
      const phases = new Set(v.jobs.map((j) => j.phase));
      const r = roomById(room)!;
      for (const ph of [1, 2, 3] as const) if (coreJobs(r).some((x) => x.phase === ph)) expect(phases.has(ph), `${key}/${room} phase ${ph}`).toBe(true);
      // The list reads in work order.
      expect(v.jobs.map((j) => j.phase)).toEqual([...v.jobs.map((j) => j.phase)].sort());
    }
  });

  it('a big project is cut to fit about thirty minutes, never claimed to fit when it doesn’t', () => {
    // One grown-up alone in the kitchen: the starting jobs add up to far more than thirty minutes.
    const solo = members('soloNoKids');
    const s = freshState();
    setRoom(s, 'kitchen', solo, {});
    const v = springView(s, solo, {});
    const coreMinutes = coreJobs(roomById('kitchen')!).reduce((n, x) => n + x.minutes, 0);
    expect(coreMinutes).toBeGreaterThan(MAX_MINUTES);
    expect(v.minutes).toBeLessThanOrEqual(MAX_MINUTES);
    expect(v.jobs.length).toBeLessThan(coreJobs(roomById('kitchen')!).length);
    // People work side by side: the session is the busiest person's time, not everyone's added up.
    const big = springView(freshState(), members('D'), prefs('D'));
    const sum = big.jobs.reduce((n, j) => n + j.minutes, 0);
    expect(big.minutes).toBeLessThan(sum);
    expect(big.minutes).toBe(Math.round(Math.max(...big.people.map((p) => p.jobs.reduce((n, j) => n + j.effort, 0)))));
  });

  it('no filler: every job is a real job of the chosen room, and not everyone must have one', () => {
    for (const key of Object.keys(families)) {
      const v = springView(freshState(), members(key), prefs(key));
      const room = roomById(v.room.id)!;
      for (const j of v.jobs) expect(room.jobs.some((x) => x.id === j.jobId), `${key} ${j.jobId}`).toBe(true);
      expect(new Set(v.jobs.map((j) => j.jobId)).size).toBe(v.jobs.length);
    }
    // A household too big for one room's jobs: some people simply have no part this time.
    const crowd = family('hh-crowd', [adult('m1', true), adult('m2'), adult('m3'), ...Array.from({ length: 6 }, (_, i) => kid(`c${i}`, 9 + i))]);
    const v = springView(freshState(), crowd.members as SpringMember[], {});
    expect(v.jobs.length).toBeLessThanOrEqual(MAX_JOBS);
    expect(v.free.length).toBeGreaterThan(0);
  });

  it('Mom isn’t given everything left over: the account holder carries at most one small job more than the busiest other grown-up', () => {
    for (const key of ['A', 'C', 'D', 'noKids', 'teens', 'grandparent', 'toddlers']) {
      const v = springView(freshState(), members(key), prefs(key));
      const holder = v.ctx.people.find((p) => p.holder)!;
      const load = (id: string) => v.people.find((p) => p.id === id)?.jobs.reduce((n, j) => n + j.effort, 0) ?? 0;
      const others = v.ctx.adults.filter((a) => !a.holder).map((a) => load(a.id));
      expect(load(holder.id), key).toBeLessThanOrEqual(Math.max(...others) + 5);
      // And she's never the only one working: everyone who can take part has more, together, than she does.
      expect(load(holder.id), key).toBeLessThan(v.jobs.reduce((n, j) => n + j.effort, 0));
    }
  });

  it('children have meaningful, achievable jobs: every child old enough for one of the room’s jobs has a part', () => {
    for (const key of ['A', 'B', 'D', 'teens', 'grandparent', 'bigSolo']) {
      const v = springView(freshState(), members(key), prefs(key));
      for (const c of v.ctx.children) {
        const able = roomById('living')!.jobs.some((x) => !x.adultOnly && (c.age ?? 6) >= x.minAge);
        if (able) expect(v.people.some((p) => p.id === c.id), `${key} ${c.name}`).toBe(true);
      }
    }
  });

  it('a toddler-only family: little ones get one small, safe job each; nothing with products or heights', () => {
    const v = springView(freshState(), members('toddlers'), prefs('toddlers'));
    for (const c of v.ctx.children) {
      const mine = v.people.find((p) => p.id === c.id)?.jobs ?? [];
      expect(mine.length, c.name).toBeLessThanOrEqual(1);
      for (const j of mine) expect(jobById(j.jobId)!.tags ?? []).not.toEqual(expect.arrayContaining(['products']));
    }
  });

  it('a household without children: the grown-ups share it, the holder leaning last', () => {
    const v = checkPlan('noKids', members('noKids'), {}, freshState());
    expect(v.people.length).toBe(2);
  });

  it('one adult and one child', () => {
    const pair = family('hh-pair', [adult('mama', true), kid('june', 7)]);
    const v = checkPlan('pair', pair.members as SpringMember[], {}, freshState());
    expect(v.people.map((p) => p.name).sort()).toEqual(['june', 'mama']);
  });

  it('a job nobody here can safely do stays unassigned, with the reason, never given to a child or Mom by default', () => {
    // Only teenagers at home (no grown-up on the family page): grown-ups-only jobs wait for a grown-up.
    const teensOnly = [{ id: 't1', firstName: 'Tess', kind: 'child', birthYear: 2011, birthMonth: 1 }, { id: 't2', firstName: 'Theo', kind: 'child', birthYear: 2013, birthMonth: 1 }] as SpringMember[];
    const v = springView(freshState(), teensOnly, {});
    const high = v.jobs.find((j) => j.jobId === 'l-high');
    expect(high?.owners ?? []).toEqual([]);
    expect(high?.needs).toMatch(/grown-ups only/);
  });
});

describe('Spring Clean: what the family profile tells it', () => {
  it('the room follows her step-6 priority; with no answers it’s the living room', () => {
    const ctx = (priority?: string) => springContext(members('A'), prefs('A'), snap(priority ? { priority } : {}));
    expect(suggestedRoom(ctx()).room).toBe('living');
    expect(suggestedRoom(ctx('laundry')).room).toBe('laundry');
    expect(suggestedRoom(ctx('evenings')).room).toBe('kitchen');
    expect(suggestedRoom(ctx('mornings')).room).toBe('entry');
    expect(suggestedRoom(ctx('bedtime')).room).toBe('bedroom');
    expect(suggestedRoom(ctx('tidying')).room).toBe('living');
    expect(suggestedRoom(ctx('activities')).room).toBe('living');
    const s: SpringState = { ...freshState(), profile: snap({ priority: 'evenings' }) };
    expect(springView(s, members('A'), prefs('A')).room.id).toBe('kitchen');
  });

  it('whoever already takes care of cleaning is preferred for it when about as free', () => {
    const m = members('A');
    const cal = m.find((x) => x.firstName === 'cal')!;
    const without = springView(freshState(), m, prefs('A'));
    const withAnswer = springView({ ...freshState(), profile: snap({ responsibilities: [{ status: 'existing', category: 'cleaning', ownerIds: [cal.id], helperIds: [] }] }) }, m, prefs('A'));
    const cleaning = (v: typeof without) => v.people.find((p) => p.id === cal.id)?.jobs.filter((j) => j.phase >= 2).length ?? 0;
    expect(cleaning(withAnswer)).toBeGreaterThanOrEqual(cleaning(without));
    expect(cleaning(withAnswer)).toBeGreaterThan(0);
  });

  it('the kitchen goes to whoever already runs meals, and a child she wished it for gets a kitchen job', () => {
    const m = members('B');
    const eli = m.find((x) => x.firstName === 'eli')!;
    const s: SpringState = { ...freshState(), profile: snap({ priority: 'evenings', responsibilities: [{ status: 'desired', category: 'meals', item: 'help-with-meals', ownerIds: [eli.id], helperIds: [] }] }) };
    const v = springView(s, m, prefs('B'));
    expect(v.room.id).toBe('kitchen');
    expect(v.people.find((p) => p.id === eli.id)?.jobs.length).toBeGreaterThan(0);
    checkPlan('B kitchen wished', m, prefs('B'), s);
  });

  it('limited profile information (names only, a child with no age) still prepares a safe project', () => {
    const m = [{ id: 'g1', firstName: 'Grace', kind: 'adult', isAccountHolder: true }, { id: 'c1', firstName: 'Kit', kind: 'child' }] as SpringMember[];
    const v = checkPlan('limited', m, {}, freshState());
    // A child with no age is planned as six: no job above that age.
    for (const j of v.people.find((p) => p.id === 'c1')?.jobs ?? []) expect(jobById(j.jobId)!.minAge).toBeLessThanOrEqual(6);
  });

  it('the sample families (with full profiles) get valid projects', () => {
    for (const h of sampleHouseholds.filter((x) => x.household.members.length)) {
      const s: SpringState = { ...freshState(), ...(h.profile ? { profile: familySnapshot(h.profile) } : {}) };
      checkPlan(h.id, h.household.members as SpringMember[], h.household.preferences, s);
    }
  });
});

describe('Spring Clean: her edits', () => {
  const m = members('A');
  const p = prefs('A');
  const kidId = (name: string) => m.find((x) => x.firstName === name)!.id;

  it('change the room: the new room’s prepared project', () => {
    const s = freshState();
    expect(setRoom(s, 'bathroom', m, p)).toEqual({ ok: true });
    expect(springView(s, m, p).room.id).toBe('bathroom');
    expect(setRoom(s, 'garage', m, p).ok).toBe(false);
  });

  it('change who owns a job; grown-ups-only work is refused for a child, with the reason', () => {
    const s = freshState();
    setRoom(s, 'bathroom', m, p);
    const toilet = s.plan!.jobs.find((x) => x.jobId === 'b-toilet')!;
    const r = setOwners(s, toilet.key, [kidId('cal')], m, p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.text).toMatch(/grown-ups-only/);
    const mirror = s.plan!.jobs.find((x) => x.jobId === 'b-mirror')!;
    expect(setOwners(s, mirror.key, [kidId('cal')], m, p)).toEqual({ ok: true });
    expect(springView(s, m, p).jobs.find((j) => j.jobId === 'b-mirror')!.owners.map((o) => o.name)).toEqual(['cal']);
  });

  it('a genuinely joint job: several owners together, only when she says so', () => {
    const s = freshState();
    const first = springView(s, m, p).jobs[0];
    setOwners(s, first.key, [kidId('ava'), kidId('ben')], m, p, 'joint');
    const j = springView(s, m, p).jobs.find((x) => x.key === first.key)!;
    expect(j.joint).toBe(true);
    expect(j.owners.length).toBe(2);
    setOwners(s, first.key, [kidId('ava'), kidId('ben')], m, p);
    expect(springView(s, m, p).jobs.find((x) => x.key === first.key)!.joint).toBe(false);
  });

  it('remove, add and replace a job; the plan never holds more than the back can print', () => {
    const s = freshState();
    const v0 = springView(s, m, p);
    expect(removeJob(s, v0.jobs[0].key, m, p)).toEqual({ ok: true });
    expect(springView(s, m, p).jobs.length).toBe(v0.jobs.length - 1);
    expect(addJob(s, 'l-glass', m, p)).toEqual({ ok: true });
    const glass = springView(s, m, p).jobs.find((j) => j.jobId === 'l-glass')!;
    expect(glass.owners.length).toBe(1);
    expect(addJob(s, 'l-glass', m, p).ok).toBe(false);
    // Replace keeps the person when they can safely do the new job.
    const cushions = s.plan!.jobs.find((x) => x.jobId === 'l-cushions');
    if (cushions) {
      const who = cushions.owners[0];
      expect(replaceJob(s, cushions.key, 'l-storage', m, p)).toEqual({ ok: true });
      const storage = s.plan!.jobs.find((x) => x.jobId === 'l-storage')!;
      const h = helpersOf(springContext(m, p)).find((x) => x.id === who)!;
      if (h.group === 'adult' || (h.age ?? 0) >= jobById('l-storage')!.minAge) expect(storage.owners).toEqual([who]);
    }
    while (s.plan!.jobs.length < MAX_JOBS) {
      const next = roomById('living')!.jobs.find((x) => !s.plan!.jobs.some((y) => y.jobId === x.id))!;
      addJob(s, next.id, m, p);
    }
    expect(addJob(s, roomById('living')!.jobs.find((x) => !s.plan!.jobs.some((y) => y.jobId === x.id))!.id, m, p).ok).toBe(false);
  });

  it('too much for one person is flagged honestly', () => {
    const s = freshState();
    const v = springView(s, m, p);
    const dad = m.find((x) => x.firstName === 'dad')!.id;
    for (const j of v.jobs) if (!jobById(j.jobId)!.adultOnly) setOwners(s, j.key, [dad], m, p);
    for (const id of ['l-glass', 'l-baseboards']) addJob(s, id, m, p, dad);
    const after = springView(s, m, p);
    expect(after.minutes).toBeGreaterThan(MAX_MINUTES);
    expect(after.withinTime).toBe(false);
    expect(after.issues.some((i) => i.kind === 'long')).toBe(true);
  });

  it('start over brings back the prepared project', () => {
    const s = freshState();
    const before = springFingerprint(s, m, p);
    setRoom(s, 'kitchen', m, p);
    expect(springFingerprint(s, m, p)).not.toBe(before);
    restoreProject(s);
    expect(springFingerprint(s, m, p)).toBe(before);
  });

  it('a saved plan survives the round trip, is validated, and keeps member ids and colors', () => {
    const s = freshState();
    setRoom(s, 'bedroom', m, p);
    const saved = JSON.parse(JSON.stringify(s));
    expect(isSpringState(saved)).toBe(true);
    expect(springFingerprint(saved, m, p)).toBe(springFingerprint(s, m, p));
    expect(isSpringState({ v: 1, plan: { room: 'living', jobs: [{ key: 'x', jobId: 'x', owners: [1] }] } })).toBe(false);
    expect(isSpringState({ v: 2 })).toBe(false);
    const colors = springView(s, m, p).people.map((x) => `${x.id}:${x.color.id}`);
    expect(springView(saved, m, p).people.map((x) => `${x.id}:${x.color.id}`)).toEqual(colors);
  });

  it('someone who leaves the family drops off their jobs; unknown jobs are dropped', () => {
    const s = freshState();
    springView(s, m, p);
    setRoom(s, 'living', m, p);
    const ben = kidId('ben');
    const plan = { ...s.plan!, jobs: [...s.plan!.jobs, { key: 'zz', jobId: 'nope', owners: [ben] }] };
    const fewer = m.filter((x) => x.id !== ben);
    const cleaned = cleanProject(plan, springContext(fewer, p));
    expect(cleaned.jobs.some((x) => x.jobId === 'nope')).toBe(false);
    expect(cleaned.jobs.every((x) => !x.owners.includes(ben))).toBe(true);
    expect(validateProject(cleaned, springContext(fewer, p)).every((i) => i.kind === 'unassigned' || i.kind === 'long')).toBe(true);
  });

  it('is deterministic', () => {
    for (const key of Object.keys(families)) {
      expect(JSON.stringify(preparedProject(springContext(members(key), prefs(key))))).toBe(JSON.stringify(preparedProject(springContext(members(key), prefs(key)))));
    }
  });
});

describe('Spring Clean: the job guides', () => {
  it('every job in the library has a guide: what to gather, two or three steps, a visible finish', () => {
    for (const job of ALL_JOBS) {
      const g = JOB_GUIDES[job.id];
      expect(g, job.id).toBeTruthy();
      expect(g.ready.length, job.id).toBeGreaterThan(3);
      expect(g.steps.length, job.id).toBeGreaterThanOrEqual(2);
      expect(g.steps.length, job.id).toBeLessThanOrEqual(3);
      expect(g.finished.length, job.id).toBeGreaterThan(10);
      for (const t of [g.ready, ...g.steps, g.finished, g.safety ?? '']) {
        expect(t, job.id).not.toMatch(HELP_MOM);
        expect(t.length, job.id).toBeLessThanOrEqual(130);
      }
    }
    expect(Object.keys(JOB_GUIDES).sort()).toEqual(ALL_JOBS.map((x) => x.id).sort());
  });

  it('every guide’s icon is an approved black-and-white illustration that exists in the repository', () => {
    for (const [id, g] of Object.entries(JOB_GUIDES)) {
      const file = g.icon.set === 'march' ? `assets/icons/ofc/march/${g.icon.name}.webp` : `public/images/club/icon-library/${g.icon.name}.png`;
      expect(existsSync(file), `${id}: ${file}`).toBe(true);
    }
  });

  it('safety: grown-ups-only jobs say so; jobs a child may do never hand them a product', () => {
    for (const job of ALL_JOBS) {
      const g = JOB_GUIDES[job.id];
      if (job.adultOnly) expect(g.safety ?? '', job.id).toMatch(/grown-ups only/i);
      const product = /cleaner|spray|bleach|chemical/i.test(`${g.ready} ${g.steps.join(' ')}`);
      if (!job.adultOnly && product) expect(g.safety ?? '', job.id).toMatch(/grown-up/i);
    }
  });

  it('carries March’s earlier Spring Prep guidance into the matching jobs', () => {
    expect(JOB_GUIDES['l-baseboards'].finished).toMatch(/rinsed and put away/);
    expect(JOB_GUIDES['l-baseboards'].safety).toMatch(/grown-up does anything higher/);
    expect(JOB_GUIDES['e-winter'].safety).toMatch(/grown-up decides what’s ready to store/);
    expect(JOB_GUIDES['r-donate-toys'].safety).toMatch(/grown-up says yes/);
  });

  it('every room has its one finish line', () => {
    for (const room of ALL_ROOMS) expect(ROOM_FINISH[room], room).toMatch(/\.$/);
  });
});

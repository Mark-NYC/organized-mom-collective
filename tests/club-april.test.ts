/**
 * The April 2027 kit, Everybody Helps at Mealtime: one letter, one action (the five-step Family Dinner Team), one
 * optional tool (the Family Meal Responsibility Planner, a site tool opened inside the Club). Above all: the
 * planner's plans are safe for children and share the work, the thinking included.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as april } from '../src/data/club/kits/2027-04-everybody-helps-at-mealtime';
import { clubTools } from '../src/data/club/tools';
import {
  assignMealJobs, canDoMeal, cannotDoMeal, mealJobById, mealJobs, mealJobsFor, mealShares, rotateMealJobs, type Meal, type MealLimit, type PlanJob,
} from '../src/data/mealtime-jobs';
import { groupFor, type Helper } from '../src/lib/household-helpers';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = april.action!;
const people = (xs: [string, number | null, (MealLimit[] | boolean)?][]): Helper[] =>
  xs.map(([name, age, more], i) => ({ id: `p${i}`, name, group: groupFor(age), age, limits: Array.isArray(more) ? more : [], ...(more === true ? { holder: true } : {}) }));
const rivera = people([['Ana', null, true], ['Luis', null], ['Sofia', 11], ['Mateo', 8], ['Elena', 5]]);
const brooks = people([['Jess', null, true], ['Max', 9], ['Lily', 6]]);
const chen = people([['Mei', null, true], ['David', null], ['Lin', null, ['seated', 'no-lift']], ['Grace', 16], ['Owen', 14], ['Ivy', 8], ['Leo', 5]]);
const okafor = people([['Ada', null, true], ['Tunde', null], ['Zara', 3]]);
const hughes = people([['Claire', null, true]]);
const families = { rivera, brooks, chen, okafor, hughes };
const plan = (fam: Helper[], meals: Meal[] = ['dinner'], allergy = false) => assignMealJobs(mealJobsFor(meals, fam, allergy), fam, allergy);
const ownersOf = (p: PlanJob[], id: string) => p.filter((x) => x.owner === id);

describe('April: one letter, one meal, one optional responsibility plan', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(april)).toEqual([]);
    expect(april.theme).toBe('Everybody Helps at Mealtime');
    expect(april.subtitle).toBe('Less on Mom’s plate. Everyone has a place at the table.');
    expect(kitBySlug('2027-04-everybody-helps-at-mealtime')).toBe(april);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has exactly the five steps, the meal written above them, optional helpers, and nothing scheduled', () => {
    expect(action.title).toBe('Our Family Dinner Team');
    expect(action.intro).toBe('One meal. Everyone has a part.');
    expect(action.items.map((i) => i.text)).toEqual([
      'Choose a meal together.',
      'Share the preparation.',
      'Get the table ready.',
      'Enjoy the meal together.',
      'Share the cleanup.',
    ]);
    expect(action.helperLabel).toBe('Who’s helping?');
    expect(action.focus).toMatchObject({ label: 'Which meal?', printLabel: 'The meal we’re making' });
    expect(action.focus!.suggestions.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(april)).not.toMatch(/streak|score|points|badge|deadline|recipe/i);
    expect(april.mailer.accent).toBe('table');
    expect(april.printables.map((p) => [p.id, p.component])).toEqual([['dinner-team', 'Action'], ['letter', 'Letter']]);
  });
});

describe('April: the letter and the mailer', () => {
  const letter = april.mailer.letter!;
  it('is a 150–200 word draft for Megan, with the question, and no guilt or two-parent assumption', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('Dinner Is Everyone’s Job');
    expect(letter.draft).toBe(true);
    expect(letter.signoff).toBe('Megan');
    expect(schedulable(april)).toBe(false);
    expect(letter.body).toContain('What’s one part of mealtime you could take responsibility for this week?');
    expect(letter.body).not.toMatch(/\b(dad|husband|both parents|healthy|picky)\b/i);
    expect(letter.body).not.toMatch(/\b(I|my|me)\b/);
  });

  it('puts before, during and after, the kitchen jobs by age, the pantry check, the question, the planner and the calendar note on the back', () => {
    expect(april.mailer.fieldGuide.title).toBe('Everyone Has a Place at the Table');
    expect(april.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Before the meal.', 'During the meal.', 'After the meal.']);
    expect(april.mailer.ageGuide!.rows.map((r) => r.ages)).toEqual(['3–5', '6–9', '10–12', '13+']);
    expect(april.mailer.ageGuide!.note).toMatch(/Suggestions, not rules/);
    expect(april.mailer.tip).toEqual({ title: 'A five-minute pantry check', body: 'Before writing this week’s grocery list, check what you already have and add only what’s missing.' });
    expect(april.mailer.conversation!.question).toBe('What’s one part of mealtime you could take responsibility for this week?');
    expect(april.mailer.invite?.title).toBe('Make Your Family Meal Responsibility Plan');
    expect(april.mailer.invite?.body).toMatch(/^Choose who’s helping and which meals you want to share\. We’ll help divide the jobs\./);
    expect(april.mailer.calendarNote).toBe('Use the meal-planning and grocery-list sections of your wall calendar to keep the plan visible. Let your family’s responsibility chart show who handles each part.');
  });

  it('points its QR code at this kit’s own page, and is seeded as a draft', () => {
    expect(qrUrl(april.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-04-everybody-helps-at-mealtime?source=mailer');
    expect(readableUrl(april.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-04-everybody-helps-at-mealtime');
    expect(qrMatrix(qrUrl(april.mailer.qrPath)).length).toBeGreaterThan(0);
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-04-everybody-helps-at-mealtime', '2027-04-01', 'Everybody Helps at Mealtime', 'draft', '2027-04-01/);
  });
});

describe('April: the Family Meal Responsibility Planner', () => {
  it('is a site tool the Club hosts with the family’s names and ages, separate from the month’s copy', () => {
    expect(april.tool).toMatchObject({ tool: 'meal-team', cta: 'Build Our Mealtime Plan' });
    expect(april.tool!.blurb).toBe('Tell us who’s helping and which meals you want to share. We’ll create a simple responsibility plan for your family.');
    expect(clubTools['meal-team']).toMatchObject({ path: routes.clubTool('meal-team'), perChild: false, familyPeople: true });
    expect(readFileSync('src/components/site/meal-team-planner.ts', 'utf8')).not.toMatch(/club\/kits|April|2027/);
    expect(new Set(mealJobs.map((j) => j.id)).size).toBe(mealJobs.length);
  });

  it('never gives a child the stove, sharp knives, the shopping or heavy pots before they’re ready', () => {
    for (const [name, fam] of Object.entries(families)) for (const meals of [['dinner'], ['breakfast'], ['lunch'], ['breakfast', 'lunch', 'dinner']] as Meal[][]) {
      for (const x of plan(fam, meals)) {
        const h = fam.find((p) => p.id === x.owner);
        if (!h) continue;
        const j = mealJobById(x.jobId!)!;
        expect(canDoMeal(j, h), `${name} ${meals} ${x.title} → ${h.name}`).toBe(true);
        if (h.group !== 'adult') expect((j.tags ?? []).some((t) => t === 'stove' || t === 'knife') && h.group !== 'teen', `${x.title} → ${h.name}`).toBe(false);
      }
    }
    for (const j of mealJobs.filter((x) => (x.tags ?? []).some((t) => t === 'stove' || t === 'knife'))) {
      expect(j.minAge, j.id).toBeGreaterThanOrEqual(13);
      expect(j.supervised, j.id).toBe(true);
    }
    expect(cannotDoMeal(mealJobById('shopping')!, okafor[2])).toBe('grown-ups only');
  });

  it('respects personal limits and the allergy setting as rules', () => {
    for (const x of plan(chen)) if (x.owner === 'p2') {
      const j = mealJobById(x.jobId!)!;
      expect(j.seated, x.title).toBe(true);
      expect(j.tags ?? [], x.title).not.toContain('lift');
    }
    for (const x of plan(rivera, ['dinner'], true)) if ((mealJobById(x.jobId!)!.tags ?? []).includes('food') && x.owner) {
      expect(rivera.find((p) => p.id === x.owner)!.group, x.title).toBe('adult');
    }
  });

  it('covers planning, prep, serving and cleanup, and gives everyone who can help a part', () => {
    for (const [name, fam] of Object.entries(families)) {
      const p = plan(fam);
      for (const part of ['week', 'before', 'during', 'after']) expect(p.some((x) => x.part === part), `${name} ${part}`).toBe(true);
      for (const h of fam) expect(p.some((x) => x.owner === h.id), `${name} ${h.name}`).toBe(true);
      expect(p.filter((x) => !x.owner), name).toEqual([]);
    }
  });

  it('shares the thinking: not all to Mom, and not all to the first adult listed', () => {
    for (const fam of [rivera, okafor, chen]) {
      const thinking = plan(fam).filter((x) => x.meal === 'week');
      const adults = fam.filter((h) => h.group === 'adult');
      for (const a of adults) expect(thinking.every((x) => x.owner === a.id), a.name).toBe(false);
      expect(thinking.filter((x) => x.owner === fam[0].id).length).toBeLessThan(thinking.length);
    }
    // With the holder listed second, she still doesn't carry it all.
    const swapped = [rivera[1], rivera[0], ...rivera.slice(2)];
    const t2 = plan(swapped).filter((x) => x.meal === 'week');
    expect(t2.every((x) => x.owner === 'p1')).toBe(false);
    expect(t2.every((x) => x.owner === 'p0')).toBe(false);
  });

  it('keeps a single parent realistic: the children carry real parts and she isn’t given everything', () => {
    const p = plan(brooks);
    const mine = ownersOf(p, 'p0').length;
    const kids = p.filter((x) => x.owner === 'p1' || x.owner === 'p2').length;
    expect(kids).toBeGreaterThanOrEqual(4);
    expect(p.filter((x) => x.meal === 'week' && x.owner === 'p1').length).toBeGreaterThanOrEqual(1);
    expect(mine).toBeLessThan(p.length);
    const alone = plan(hughes);
    expect(alone.length).toBeLessThanOrEqual(12);
    expect(alone.every((x) => x.owner === 'p0' || x.owner === 'everyone')).toBe(true);
  });

  it('doesn’t overload young children at one meal', () => {
    for (const fam of [rivera, okafor, chen, brooks]) {
      const p = plan(fam, ['breakfast', 'lunch', 'dinner']);
      for (const h of fam.filter((x) => x.group === 'young')) for (const m of ['breakfast', 'lunch', 'dinner']) {
        expect(p.filter((x) => x.owner === h.id && x.meal === m).length, `${h.name} ${m}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('plans breakfast differently from dinner, and several meals together', () => {
    const b = plan(rivera, ['breakfast']).map((x) => x.jobId);
    const d = plan(rivera, ['dinner']).map((x) => x.jobId);
    expect(b).toContain('breakfast-out');
    expect(b).not.toContain('cook-main');
    expect(d).toContain('cook-main');
    const all = plan(rivera, ['breakfast', 'lunch', 'dinner']);
    expect(new Set(all.map((x) => x.meal))).toEqual(new Set(['week', 'breakfast', 'lunch', 'dinner']));
    expect(all.length).toBeGreaterThan(d.length);
  });

  it('keeps her pinned owners when re-planning', () => {
    const p = plan(rivera);
    const wipe = p.find((x) => x.part === 'after' && x.owner !== 'everyone' && x.owner !== 'p1')!;
    const pinned = p.map((x) => (x === wipe ? { ...x, owner: 'p1', pinned: true } : x));
    expect(assignMealJobs(pinned, rivera).find((x) => x.key === wipe.key)!.owner).toBe('p1');
  });

  it('rotates meal jobs day by day, safely, while the thinking stays put', () => {
    const p = plan(rivera);
    const days = [0, 1, 2, 3, 4];
    const rot = rotateMealJobs(p, rivera, days);
    expect([...rot.keys()]).toEqual(days);
    const table = p.find((x) => x.jobId === 'set-table')!;
    const owners = new Set(days.map((d) => rot.get(d)!.get(table.key)));
    expect(owners.size).toBeGreaterThan(1);
    for (const d of days) for (const [k, owner] of rot.get(d)!) {
      const x = p.find((y) => y.key === k)!;
      expect(x.meal).not.toBe('week');
      const h = rivera.find((r) => r.id === owner);
      if (h) expect(canDoMeal(mealJobById(x.jobId!)!, h), `${DAYSTR[d]} ${x.title} → ${h.name}`).toBe(true);
    }
  });

  it('keeps everyone who can help busy every day of a rotation, and keeps stove work with the grown-ups', () => {
    for (const fam of [rivera, brooks, okafor, chen]) {
      const p = plan(fam);
      const rot = rotateMealJobs(p, fam, [0, 1, 2, 3, 4, 5, 6]);
      for (const [d, day] of rot) {
        for (const h of fam.filter((x) => [...day.values()].includes(x.id) || x.group !== 'adult')) {
          if (p.some((x) => x.meal !== 'week' && x.owner !== 'everyone' && canDoMeal(mealJobById(x.jobId!)!, h))) expect([...day.values()], `${h.name} on day ${d}`).toContain(h.id);
        }
        const cook = p.find((x) => x.jobId === 'cook-main');
        if (cook) expect(fam.find((h) => h.id === day.get(cook.key))!.group, `cook on day ${d}`).toBe('adult');
      }
    }
  });

  it('weighs the shares so grown-ups carry more than children', () => {
    const shares = mealShares(plan(chen), chen);
    const adultLoad = shares.filter((s) => s.helper.group === 'adult').reduce((n, s) => n + s.load, 0);
    const youngLoad = shares.filter((s) => s.helper.group === 'young').reduce((n, s) => n + s.load, 0);
    expect(adultLoad).toBeGreaterThan(youngLoad);
  });
});

const DAYSTR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

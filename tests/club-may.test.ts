/**
 * The May 2027 kit, Finish the School Year Well: one letter, one action (the five-step School Year Wrap-Up), one
 * optional tool (the School Year Wrap-Up Builder, a site tool opened inside the Club). Above all: the builder's
 * dates are August's (whole calendar days, never overdue, never a school deadline), children own their own closeout,
 * and grown-up tasks are shared.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as may } from '../src/data/club/kits/2027-05-finish-the-school-year';
import { clubTools } from '../src/data/club/tools';
import {
  assignWrapTasks, cannotOwn, isStudentAge, PICKS, resolveLastDay, shownDate, sortWrap, timingFor, wrapTasksFor, type Pick, type Student, type WrapTask,
} from '../src/data/school-wrapup';
import { addDays, daysBetween } from '../src/lib/club/countdown';
import { groupFor, type Helper } from '../src/lib/household-helpers';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = may.action!;
const people = (xs: [string, number | null, boolean?][]): Helper[] =>
  xs.map(([name, age, h], i) => ({ id: `p${i}`, name, group: groupFor(age), age, limits: [], ...(h ? { holder: true } : {}) }));
const rivera = people([['Ana', null, true], ['Luis', null], ['Sofia', 11], ['Mateo', 8], ['Elena', 5]]);
const brooks = people([['Jess', null, true], ['Max', 9], ['Lily', 6]]);
const chen = people([['Mei', null, true], ['David', null], ['Lin', null], ['Grace', 16], ['Owen', 14], ['Ivy', 8], ['Leo', 5]]);
const okafor = people([['Ada', null, true], ['Tunde', null], ['Zara', 3]]);
const kids = (fam: Helper[], day: string, own: Record<string, string> = {}): Student[] => fam.filter(isStudentAge).map((h) => ({ helper: h, lastDay: own[h.id] ?? day }));
const plan = (fam: Helper[], day: string, today: string, own: Record<string, string> = {}, picks: readonly Pick[] = PICKS) =>
  sortWrap(assignWrapTasks(wrapTasksFor(kids(fam, day, own), picks, today), fam));
const forChild = (p: WrapTask[], id: string) => p.filter((x) => x.children.includes(id));

describe('May: one letter, five closeout steps, one optional plan', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(may)).toEqual([]);
    expect(may.theme).toBe('Finish the School Year Well');
    expect(may.subtitle).toBe('Less end-of-year chaos. More ready for summer.');
    expect(kitBySlug('2027-05-finish-the-school-year')).toBe(may);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has exactly the five steps with their sentences, optional helpers, no dates, and a start-anywhere note', () => {
    expect(action.title).toBe('Our School Year Wrap-Up');
    expect(action.intro).toBe('Five little things to finish the year together.');
    expect(action.kind).toBe('checklist');
    expect(action.items.map((i) => i.text)).toEqual(['Check the calendar.', 'Handle the loose ends.', 'Sort school papers.', 'Reset school gear.', 'Celebrate the year.']);
    expect(action.items.map((i) => i.detail)).toEqual([
      'Add remaining school events, celebrations, and important dates.',
      'Check library books, forms, borrowed supplies, and anything that needs to be returned.',
      'Choose a few favorite pieces of artwork or schoolwork to keep, and recycle what isn’t needed.',
      'Empty backpacks and lunchboxes, sort reusable supplies, and put things away.',
      'Have each child share something they learned, enjoyed, or accomplished.',
    ]);
    expect(action.items.every((i) => i.daysBefore === undefined)).toBe(true);
    expect(action.helperLabel).toBe('Who’s helping?');
    expect(action.note).toMatch(/Start wherever you are.*May.*June/);
    expect(JSON.stringify(may)).not.toMatch(/streak|score|points|badge|summer plan|graduation|first day/i);
  });
});

describe('May: the letter and the mailer', () => {
  const letter = may.mailer.letter!;
  it('is a 150–200 word draft for Megan, with the question, and no guilt, blame or invented story', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('You Don’t Have to Wrap Up Everything Yourself');
    expect(letter.namedGreeting).toBe('Hi {name},');
    expect(letter.draft).toBe(true);
    expect(schedulable(may)).toBe(false);
    expect(letter.body).toContain('The school year belongs to your kids, too. They can help finish it well.');
    expect(letter.body).toContain('What’s one thing you’re proud of from this school year?');
    expect(letter.body).not.toMatch(/\b(dad|husband|both parents|should have|every memory|scrapbook)\b/i);
    expect(letter.body).not.toMatch(/\b(I|my|me)\b/);
  });

  it('puts the three principles, the Five Favorites Rule, the reflection keepsake, the builder and the calendar note on the back', () => {
    expect(may.mailer.fieldGuide.title).toBe('Close the Year, Keep What Matters');
    expect(may.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Finish the loose ends.', 'Let your child help sort.', 'Celebrate their growth.']);
    expect(may.mailer.tip!.title).toBe('The Five Favorites Rule');
    expect(may.mailer.tip!.body).toMatch(/choose five favorites worth keeping.*suggestion, not a strict limit/);
    expect(may.mailer.reflection!.prompts).toEqual(['My favorite memory this year was…', 'Something new I learned was…', 'Something I’m proud of is…']);
    expect(may.mailer.invite?.title).toBe('Build Your School Year Wrap-Up Plan');
    expect(may.mailer.invite?.body).toMatch(/^Tell us when school ends, and we’ll help you figure out what to finish, when to do it, and who can help\./);
    expect(may.mailer.calendarNote).toBe('Add the remaining school events and your closeout dates to the family calendar so everyone can see the plan.');
    expect(may.mailer.accent).toBe('school');
  });

  it('points its QR code at this kit’s own page, and is seeded as a draft', () => {
    expect(qrUrl(may.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-05-finish-the-school-year?source=mailer');
    expect(readableUrl(may.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-05-finish-the-school-year');
    expect(qrMatrix(qrUrl(may.mailer.qrPath)).length).toBeGreaterThan(0);
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-05-finish-the-school-year', '2027-05-01', 'Finish the School Year Well', 'draft', '2027-05-01/);
  });
});

describe('May: the School Year Wrap-Up Builder', () => {
  it('is a site tool the Club hosts with the family’s names and ages, using August’s date logic', () => {
    expect(may.tool).toMatchObject({ tool: 'school-wrap-up', title: 'Make Your School Year Closeout Plan', cta: 'Build Our School Year Plan' });
    expect(may.tool!.blurb).toBe('Enter your child’s last day of school, and we’ll help you figure out what needs to happen before and after.');
    expect(clubTools['school-wrap-up']).toMatchObject({ path: routes.clubTool('school-wrap-up'), perChild: false, familyPeople: true });
    expect(readFileSync('src/components/site/wrap-up-builder.ts', 'utf8')).not.toMatch(/club\/kits|May|2027/);
    const data = readFileSync('src/data/school-wrapup.ts', 'utf8');
    expect(data).toMatch(/from '\.\.\/lib\/club\/countdown'/);
    expect(data).not.toMatch(/new Date\(|Date\.UTC/);
  });

  it('suggests the brief’s days, counted from the last day, as real dates', () => {
    const p = plan(rivera, '2027-06-15', '2027-05-01');
    const at = (template: string, child = 'p3') => shownDate(p.find((x) => x.template === template && (x.children.includes(child) || x.children.length > 1))!);
    expect(at('calendar')).toBe('2027-06-01');
    expect(at('returns')).toBe('2027-06-05');
    expect(at('forms')).toBe('2027-06-08');
    expect(at('belongings')).toBe('2027-06-12');
    expect(at('celebrate')).toBe('2027-06-15');
    expect(at('backpack')).toBe('2027-06-16');
    expect(at('papers')).toBe('2027-06-18');
    expect(at('supplies')).toBe('2027-06-20');
  });

  it('crosses month, year and leap-day boundaries by whole days', () => {
    expect(addDays('2027-06-01', -14)).toBe('2027-05-18');
    expect(addDays('2027-12-30', 5)).toBe('2028-01-04');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    const p = plan(brooks, '2028-03-03', '2028-01-10');
    expect(shownDate(p.find((x) => x.template === 'returns')!)).toBe('2028-02-22');
    expect(shownDate(p.find((x) => x.template === 'forms')!)).toBe('2028-02-25');
    expect(shownDate(p.find((x) => x.template === 'calendar')!)).toBe('2028-02-18');
  });

  it('gives a late-May child and a late-June child their own plans, 5–8 tasks each, and merges siblings doing the same thing', () => {
    for (const [day, today] of [['2027-05-27', '2027-05-01'], ['2027-06-24', '2027-05-01']]) {
      const p = plan(rivera, day, today);
      for (const id of ['p2', 'p3', 'p4']) {
        const n = forChild(p, id).length;
        expect(n, `${id} ${day}`).toBeGreaterThanOrEqual(5);
        expect(n, `${id} ${day}`).toBeLessThanOrEqual(10);
      }
      const titles = p.map((x) => `${x.title}|${shownDate(x)}`);
      expect(new Set(titles).size, 'a line repeats').toBe(titles.length);
      expect(p.find((x) => x.template === 'backpack' && x.children.length === 2)!.owner).toBe('each');
      expect(p.filter((x) => x.template === 'calendar').length).toBe(1);
      expect(p.filter((x) => x.template === 'celebrate').length).toBe(1);
    }
  });

  it('handles children with different last days: family tasks count from the first, each child’s from their own', () => {
    const p = plan(rivera, '2027-06-18', '2027-05-03', { p4: '2027-06-04' });
    expect(shownDate(p.find((x) => x.template === 'forms')!)).toBe('2027-05-28');
    expect(shownDate(forChild(p, 'p4').find((x) => x.template === 'backpack')!)).toBe('2027-06-05');
    expect(shownDate(forChild(p, 'p2').find((x) => x.template === 'backpack')!)).toBe('2027-06-19');
    expect(p.filter((x) => x.template === 'celebrate').length).toBe(2);
  });

  it('never shows an overdue avalanche: three days out, everything is today or later and the trips combine', () => {
    const today = '2027-05-25';
    const p = plan(brooks, '2027-05-28', today);
    for (const x of p) expect(daysBetween(today, shownDate(x)!), x.title).toBeGreaterThanOrEqual(0);
    expect(p.filter((x) => x.phase === 'before' && x.template === 'returns')).toEqual([]);
    expect(p.some((x) => /return library books/.test(x.title))).toBe(true);
    expect(p.filter((x) => x.phase === 'before').length).toBeLessThanOrEqual(5);
    // A day or two out: only the essentials before the last day.
    const close = plan(brooks, '2027-05-27', today).filter((x) => x.phase === 'before').map((x) => x.template);
    expect(close).not.toContain('calendar');
    expect(close).toEqual(expect.arrayContaining(['forms', 'belongings']));
  });

  it('once school is out, plans only the after-school closeout, starting today, a couple a day per child', () => {
    const today = '2027-06-02';
    const p = plan(chen, '2027-05-20', today);
    expect(p.filter((x) => x.phase === 'before')).toEqual([]);
    for (const x of p) expect(daysBetween(today, shownDate(x)!), x.title).toBeGreaterThanOrEqual(0);
    expect(p.map((x) => x.template)).toEqual(expect.arrayContaining(['backpack', 'papers', 'supplies', 'celebrate']));
    expect(timingFor('2027-05-20', today)).toBe('over');
    expect(timingFor('2027-05-28', '2027-05-25')).toBe('tight');
    expect(timingFor('2027-06-02', today)).toBe('today');
  });

  it('only plans what she chose', () => {
    const p = plan(rivera, '2027-06-15', '2027-05-01', {}, ['papers']);
    expect([...new Set(p.map((x) => x.template))].sort()).toEqual(['calendar', 'celebrate', 'papers']);
  });

  it('lets children own their closeout, in words for their age, and keeps signatures and payments with grown-ups', () => {
    const p = plan(chen, '2027-06-15', '2027-05-01');
    const owner = (x: WrapTask) => chen.find((h) => h.id === x.owner);
    for (const x of p.filter((y) => y.template === 'forms' || y.template === 'messages')) expect(owner(x)?.group, x.title).toBe('adult');
    for (const x of p) for (const h of chen) if (x.owner === h.id) expect(cannotOwn(x, h), `${x.title} → ${h.name}`).toBeNull();
    const leo = forChild(p, 'p6');
    expect(leo.every((x) => x.template === 'celebrate' || x.template === 'calendar' || x.template === 'forms' || x.template === 'messages' || x.withGrownUp || owner(x)?.group === 'adult')).toBe(true);
    expect(leo.find((x) => x.template === 'returns')!.title).toMatch(/Leo’s backpack/);
    expect(p.some((x) => x.template === 'teen-forms' && x.children.includes('p3'))).toBe(true);
    expect(p.some((x) => x.template === 'teen-forms' && x.children.includes('p5'))).toBe(false);
    expect(forChild(p, 'p3').find((x) => x.template === 'belongings')!.title).toMatch(/locker/);
    expect(cannotOwn(p.find((x) => x.template === 'forms')!, chen[3])).toBe('needs a grown-up');
  });

  it('shares grown-up tasks: not all to Mom, not all to the first adult listed', () => {
    for (const fam of [rivera, okafor, chen]) {
      const p = plan(fam, '2027-06-15', '2027-05-01');
      const grown = p.filter((x) => fam.find((h) => h.id === x.owner)?.group === 'adult');
      expect(grown.length).toBeGreaterThan(1);
      expect(grown.every((x) => x.owner === fam[0].id), 'all to Mom').toBe(false);
      expect(grown.every((x) => x.owner === fam[1].id), 'all to the other adult').toBe(false);
    }
  });

  it('keeps a single parent realistic: the children carry their own closeout', () => {
    const p = plan(brooks, '2027-06-15', '2027-05-01');
    const mine = p.filter((x) => x.owner === 'p0').length;
    const theirs = p.filter((x) => x.owner === 'p1' || x.owner === 'p2' || x.owner === 'each').length;
    expect(theirs).toBeGreaterThan(mine);
  });

  it('a child with no last day yet still gets a plan, undated; a child not in school gets none', () => {
    const p = plan(okafor, '', '2027-05-01');
    expect(p.length).toBeGreaterThan(3);
    expect(p.every((x) => shownDate(x) === null)).toBe(true);
    expect(resolveLastDay('2027-06-15', { kind: 'none' })).toBeNull();
    expect(resolveLastDay('2027-06-15', { kind: 'own', date: '2027-06-01' })).toBe('2027-06-01');
    expect(resolveLastDay('2027-06-15', undefined)).toBe('2027-06-15');
    expect(isStudentAge({ id: 'b', name: 'Baby', group: 'young', age: 2, limits: [] })).toBe(false);
  });

  it('never calls a suggestion a deadline', () => {
    const src = readFileSync('src/data/school-wrapup.ts', 'utf8') + readFileSync('src/components/site/wrap-up-builder.ts', 'utf8') + readFileSync('src/components/site/WrapUpBuilder.astro', 'utf8');
    expect(src).toMatch(/not school deadlines/);
    expect(src).not.toMatch(/overdue!|due by|is due/i);
  });
});

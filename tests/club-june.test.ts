/**
 * The June 2027 kit, Summer With a Plan: one letter, one action (the four-decision Summer Family Agreement) and, as
 * an intentional exception, two optional tools that are the site's own: the routine chart's Summer type (the Summer
 * Rhythm Builder) and the screen time tool's family agreement. Above all: no Club copies of either tool, rhythms that
 * aren't hourly schedules unless asked, and agreements that are collaborative, by age, with the grown-ups' side.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as june } from '../src/data/club/kits/2027-06-summer-with-a-plan';
import { kit as august } from '../src/data/club/kits/2027-08-school-year';
import { clubTools } from '../src/data/club/tools';
import { routineTypes, ROUTINE_ROWS } from '../src/data/routines';
import { ageStage, ANCHORS, FOCI, summerRhythm, type SummerInput } from '../src/data/summer-rhythm';
import { earnIdeas, screenAgeFor, screenStarters } from '../src/data/screen-time';
import { matchResponsibility, responsibilityById } from '../src/data/responsibilities';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = june.action!;
const rhythm = (o: Partial<SummerInput> = {}) => summerRhythm({ stage: 'school', days: 'home', structure: 'balanced', focus: [], ...o });

describe('June: one letter, four decisions, two optional tools', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(june)).toEqual([]);
    expect(june.theme).toBe('Summer With a Plan');
    expect(june.subtitle).toBe('More freedom for the kids. Less managing for Mom.');
    expect(kitBySlug('2027-06-summer-with-a-plan')).toBe(june);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has the four decisions, each with a line to write the family’s answer, and nothing scheduled', () => {
    expect(action.title).toBe('Our Summer Family Agreement');
    expect(action.intro).toBe('Four little decisions for a summer everyone can enjoy.');
    expect(action.items.map((i) => i.text)).toEqual(['Choose our daily anchors.', 'Agree on screen-time expectations.', 'Share summer responsibilities.', 'Choose something fun.']);
    expect(action.items.every((i) => i.detail && i.daysBefore === undefined)).toBe(true);
    expect(action.helperPlacement).toBe('below');
    expect(action.helperLabel).toBe('We decided');
    expect(JSON.stringify(june)).not.toMatch(/streak|score|points|badge|dashboard|hour-by-hour|punish/i);
  });

  it('offers two independent tools, the site’s own, with the June names and buttons', () => {
    expect(june.tool).toBeUndefined();
    expect(june.toolkit!.title).toBe('Your Summer Toolkit');
    expect(june.toolkit!.tools.map((t) => [t.tool, t.title, t.cta, t.start])).toEqual([
      ['routine-chart', 'Summer Rhythm Builder', 'Build Our Summer Rhythm', 'summer'],
      ['screen-time', 'Family Screen Time Agreement', 'Make Our Screen Agreement', 'agreement'],
    ]);
    expect(june.toolkit!.tools[0].blurb).toBe('Create a simple daily rhythm that helps your kids know what to expect.');
    expect(june.toolkit!.tools[1].blurb).toBe('Set clear expectations together so screens don’t become a daily argument.');
    // Each opens the public tool's own component: no Club version.
    expect(clubTools['routine-chart'].publicPath).toBe(routes.routineChart);
    expect(clubTools['screen-time']).toMatchObject({ path: routes.clubTool('screen-time'), publicPath: routes.screenTime, perChild: true });
    expect(readFileSync('src/pages/club/tools/screen-time.astro', 'utf8')).toMatch(/components\/site\/ScreenTimeContract\.astro/);
    expect(readFileSync('src/pages/screen-time-contract.astro', 'utf8')).toMatch(/components\/site\/ScreenTimeContract\.astro/);
    expect(kitProblems({ ...june, tool: august.tool })).toContain('a kit has one tool or a toolkit, not both');
  });
});

describe('June: the letter and the mailer', () => {
  const letter = june.mailer.letter!;
  it('is a 150–200 word draft for Megan, with the question, and no guilt, anti-screen talk or stay-at-home assumption', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('Summer Doesn’t Need a Schedule for Every Hour');
    expect(letter.namedGreeting).toBe('Hi {name},');
    expect(letter.draft).toBe(true);
    expect(schedulable(june)).toBe(false);
    expect(letter.body).toContain('What would make this summer really good for each of us?');
    expect(letter.body).toMatch(/home all day or fitting it around work/);
    expect(letter.body).not.toMatch(/\b(dad|husband|addict|toxic|rot|stay-at-home|should be ashamed)\b/i);
    expect(letter.body).not.toMatch(/\b(I|my|me)\b/);
  });

  it('puts the principles, the boredom card, the gear tip, both tools under one QR code and the calendar note on the back', () => {
    expect(june.mailer.fieldGuide.title).toBe('A Little Structure. A Lot of Summer.');
    expect(june.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Keep a few predictable anchors.', 'Agree before the argument.', 'Leave room for boredom.']);
    expect(june.mailer.card).toEqual({ title: 'When I’m Bored…', ideas: ['Read something', 'Make or draw something', 'Play outside', 'Build something', 'Help someone', 'Invite someone to play'] });
    expect(june.mailer.tip!.body).toBe('Check water bottles, sunscreen, swim gear, and the supplies your family regularly takes outdoors.');
    expect(june.mailer.invite!.tools).toEqual([
      { title: 'Build Your Summer Rhythm', body: 'A simple daily flow that fits your family’s summer.' },
      { title: 'Make Your Family Screen Agreement', body: 'Agree on screen-time expectations before the daily negotiations begin.' },
    ]);
    expect(june.mailer.calendarNote).toBe('Add camps, activities, trips, and family plans to your calendar. Let the summer rhythm handle the ordinary days in between.');
    expect(june.mailer.accent).toBe('summer');
  });

  it('points its one QR code at this kit’s own page, and is seeded as a draft', () => {
    expect(qrUrl(june.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-06-summer-with-a-plan?source=mailer');
    expect(readableUrl(june.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-06-summer-with-a-plan');
    expect(qrMatrix(qrUrl(june.mailer.qrPath)).length).toBeGreaterThan(0);
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-06-summer-with-a-plan', '2027-06-01', 'Summer With a Plan', 'draft', '2027-06-01/);
  });
});

describe('June: the Summer Rhythm Builder (the routine chart’s Summer type)', () => {
  it('is a routine type like the others, and leaves them as they were', () => {
    expect(Object.keys(routineTypes)).toEqual(['morning', 'afterschool', 'bedtime', 'weekend', 'summer', 'custom']);
    expect(routineTypes.summer.title).toBe('Our Summer Rhythm');
    expect(routineTypes.morning.anchors).toBeUndefined();
    expect(routineTypes.morning.steps[0]).toEqual(['07:00', 'Wake up & stretch', 'Three deep breaths before you get up']);
  });

  it('builds the day around anchors, morning to evening, without clock times unless she wants more structure', () => {
    for (const stage of ['young', 'school', 'teen'] as const) for (const days of ['home', 'camp'] as const) for (const structure of ['relaxed', 'balanced', 'structured'] as const) {
      const r = rhythm({ stage, days, structure });
      expect(r.steps.length, `${stage} ${days} ${structure}`).toBeLessThanOrEqual(ROUTINE_ROWS);
      expect(new Set(r.anchors)).toEqual(new Set(ANCHORS));
      expect(r.anchors.map((a) => ANCHORS.indexOf(a))).toEqual([...r.anchors.map((a) => ANCHORS.indexOf(a))].sort());
      const times = r.steps.map((s) => s[0]);
      if (structure === 'structured') {
        expect(times.every(Boolean)).toBe(true);
        expect(times).toEqual([...times].sort());
      } else expect(times.every((t) => !t)).toBe(true);
    }
  });

  it('changes with the structure, the child’s days, their age and what needs attention', () => {
    expect(rhythm({ structure: 'relaxed' }).steps.length).toBeLessThan(rhythm({ structure: 'balanced' }).steps.length);
    const camp = rhythm({ days: 'camp' }).steps.map((s) => s[1]);
    expect(camp).toContain('Camp or program');
    expect(camp).not.toContain('Lunch');
    expect(rhythm({ stage: 'young' }).steps.map((s) => s[1])).toContain('Rest or quiet time');
    expect(rhythm({ stage: 'teen' }).steps.map((s) => s[1])).toContain('Wind down: devices to charge');
    expect(rhythm().steps.map((s) => s[1])).not.toContain('Screen time (our agreement)');
    expect(rhythm({ focus: ['screens'] }).steps.map((s) => s[1])).toContain('Screen time (our agreement)');
    expect(rhythm({ focus: ['reading'] }).steps.map((s) => s[1]).join()).toMatch(/[Rr]ead/);
    expect(rhythm({ stage: 'young', structure: 'structured' }).endTime).toBe('19:30');
    expect(rhythm({ stage: 'teen', structure: 'structured' }).endTime).toBe('22:00');
    expect(ageStage(4)).toBe('young');
    expect(ageStage(9)).toBe('school');
    expect(ageStage(15)).toBe('teen');
    expect(FOCI.length).toBe(7);
  });

  it('keeps household responsibilities in a balanced day and uses the illustration library', () => {
    for (const stage of ['young', 'school', 'teen'] as const) {
      const steps = rhythm({ stage }).steps.map((s) => s[1]).join('|');
      expect(steps, stage).toMatch(/job|Set the table|Help with dinner/);
    }
    const r = rhythm({ stage: 'young', structure: 'structured' });
    for (const id of r.icons) if (id) expect(responsibilityById(id)?.image, id).toBe(true);
    expect(r.icons.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(matchResponsibility('Get dressed')).toBe('get-dressed');
  });
});

describe('June: the Family Screen Time Agreement (the screen time tool’s agreement format)', () => {
  it('has starter wording for each age, always with what grown-ups agree to, and never fills in how much', () => {
    for (const [age, s] of Object.entries(screenStarters)) {
      expect(s.adults.filter(Boolean).length, age).toBe(3);
      expect(s.end.filter(Boolean).length, age).toBe(3);
      expect(s.before.filter(Boolean).length, age).toBeGreaterThanOrEqual(3);
      expect(s.amountHint, age).toMatch(/^(e\.g\.|our|what we)/);
      expect(JSON.stringify(s), age).not.toMatch(/punish|lose|taken away|banned|consequence|or else/i);
    }
    expect(screenStarters.young.where.join()).toMatch(/grown-up can see/);
    expect(screenStarters.teen.end.join()).toMatch(/on my own/);
    expect(screenStarters.teen.adults.join()).toMatch(/[Tt]rust/);
    expect(screenAgeFor(4)).toBe('young');
    expect(screenAgeFor(10)).toBe('school');
    expect(screenAgeFor(14)).toBe('teen');
  });

  it('keeps the earn-it contract the public page has always had', () => {
    expect(earnIdeas.taskStart).toEqual(['Finish my homework', 'Clean my room', 'Make my bed', 'Brush my teeth']);
    expect(earnIdeas.activityStart).toEqual(['Read a book', 'Play outside', 'Do art or crafts', 'Help cook dinner']);
    const page = readFileSync('src/pages/screen-time-contract.astro', 'utf8');
    expect(page).toMatch(/storageKey="omc:screen-time:v1"/);
    expect(page).toMatch(/Screen Time They Earn, Not Argue For\./);
    expect(page).not.toMatch(/format="agreement"/);
    const sheet = readFileSync('src/components/site/ScreenTimeContract.astro', 'utf8');
    for (const f of ['name', 'task-${i}', 'activity-${i}', 'minutes', 'earn', 'earned', 'sign-child', 'sign-parent', 'date']) expect(sheet, f).toContain(`data-field=${f.includes('$') ? `{\`${f}\`}` : `"${f}"`}`);
  });
});

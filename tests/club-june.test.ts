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


describe('June: the letter and the mailer', () => {
  const letter = june.mailer.letter!;

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

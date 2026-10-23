/**
 * The October 2027 kit, A Home That Works Together: one letter, one action (a five-line Fall Home Reset, no dates),
 * one optional tool (the site's chore chart, opened inside the Club). August and November stay as they were.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, schedulable } from '../src/data/club/kits';
import { kit as october } from '../src/data/club/kits/2027-10-home-works-together';
import { ownershipBuilder as november } from '../src/data/club/libraries/family-ownership-builder';
import { kit as august } from '../src/data/club/kits/2027-08-school-year';
import { clubTools } from '../src/data/club/tools';
import { adultOneJob, ageGroupFor, choreSets, oneJobs } from '../src/data/chore-chart';
import { matchResponsibility, responsibilities } from '../src/data/responsibilities';
import { countdownText, lineText, planCountdown, readCountdown } from '../src/lib/club/countdown';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const items = october.action!.items;

describe('October: one letter, one reset, one optional chore chart', () => {
  it('passes every kit check and is the newest kit', () => {
    expect(kitProblems(october)).toEqual([]);
    expect(october.theme).toBe('A Home That Works Together');
    expect(october.subtitle).toBe('Little jobs. Shared responsibility. A home ready for the season ahead.');
    expect(kitBySlug('2027-10-home-works-together')).toBe(october);
  });

  it('has exactly the five reset lines, no dates, a helper blank each, and wording she can change', () => {
    expect(october.action!.kind).toBe('checklist');
    expect(october.action!.title).toBe('Our Fall Home Reset');
    expect(october.action!.intro).toBe('Five little things to make home work better before the busy season.');
    expect(items.map((i) => i.text)).toEqual([
      'Clear outgrown coats, shoes, and seasonal clothes.',
      'Get the entryway ready for jackets, backpacks, and shoes.',
      'Restock household essentials before colder weather.',
      'Choose one cluttered area and reset it together.',
      'Give each family member one job they can own this season.',
    ]);
    expect(items.every((i) => i.daysBefore === undefined && !i.essential)).toBe(true);
    expect(october.action!.helperLabel).toBe('Who’s helping?');
    expect(october.action!.editable).toBe(true);
  });

  it('never schedules anything: no dates even with a date around', () => {
    const plan = planCountdown(items, '', '2027-10-02');
    expect(plan.status).toBe('undated');
    expect(plan.lines.every((l) => l.date === null && !l.later)).toBe(true);
    const s = { ...readCountdown(null, 5), done: [true, false, false, false, false], helpers: ['Luis', '', '', '', 'Everyone'] };
    expect(countdownText(october.action!.title, items, plan, s).split('\n')).toEqual([
      'Our Fall Home Reset',
      '',
      '[x] Clear outgrown coats, shoes, and seasonal clothes. (Luis)',
      '[ ] Get the entryway ready for jackets, backpacks, and shoes.',
      '[ ] Restock household essentials before colder weather.',
      '[ ] Choose one cluttered area and reset it together.',
      '[ ] Give each family member one job they can own this season. (Everyone)',
    ]);
  });

  it('keeps her wording, checks and helpers through a save, and falls back to ours when she clears it', () => {
    const s = { ...readCountdown(null, 5), texts: [null, 'Set up the mudroom for coats and boots.', null, null, null] };
    const back = readCountdown(JSON.parse(JSON.stringify({ ...s, done: [false, true], helpers: ['', 'Ana'] })), 5);
    expect(lineText(items, back, 1)).toBe('Set up the mudroom for coats and boots.');
    expect(lineText(items, back, 0)).toBe(items[0].text);
    expect(back.done.slice(0, 2)).toEqual([false, true]);
    expect(back.helpers[1]).toBe('Ana');
    expect(readCountdown({ texts: ['   ', 'x'.repeat(200)] }, 5).texts.slice(0, 2)).toEqual([null, 'x'.repeat(90)]);
  });

  it('prints the countdown and the letter, like August, with no date pieces', () => {
    expect(october.printables.map((p) => [p.id, p.component])).toEqual([['fall-reset', 'Action'], ['letter', 'Letter']]);
    expect(october.setup).toBeUndefined();
    expect(october.items).toEqual([]);
  });
});

describe('October: the letter and the mailer', () => {
  const letter = october.mailer.letter!;
  it('is a 150–200 word draft for Megan, greets by name when known, and asks the family question', () => {
    expect(words([letter.greeting, letter.body].join(' '))).toBeGreaterThanOrEqual(150);
    expect(words([letter.greeting, letter.body].join(' '))).toBeLessThanOrEqual(200);
    expect(letter.namedGreeting).toBe('Hi {name},');
    expect(letter.signoff).toBe('Megan');
    expect(letter.draft).toBe(true);
    expect(schedulable(october)).toBe(false);
    expect(letter.body).toContain('What’s one thing around our home you think you could take care of without being reminded?');
    expect(letter.body).toMatch(/family calendar/);
  });

  it('puts the ownership idea, three principles, an example, the question, the QR code and one calendar note on the back', () => {
    expect(october.mailer.fieldGuide.title).toBe('From Helping Mom to Owning a Job');
    expect(october.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Start small.', 'Make it clear.', 'Let them own it.']);
    expect(october.mailer.story?.body).toBeTruthy();
    expect(october.mailer.conversation).toMatchObject({ question: 'What’s one thing around our home you think you could take care of without being reminded?', placement: 'after-example' });
    expect(october.mailer.calendarNote).toBe('Choose a time this month for your family reset. Put it on the wall calendar so everyone knows the plan.');
  });

  it('points its QR code at this kit’s own page, which exists', () => {
    expect(october.mailer.qrPath).toBe(`${routes.clubKit(october.slug)}?source=mailer`);
    expect(qrUrl(october.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-10-home-works-together?source=mailer');
    expect(readableUrl(october.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-10-home-works-together');
    expect(qrMatrix(qrUrl(october.mailer.qrPath)).length).toBe(41);
  });

  it('is seeded as a draft in the migrations', () => {
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-10-home-works-together'[^;]*'draft'/);
  });
});

describe('October: the tool is the site’s chore chart', () => {
  it('opens the public chore chart inside the Club, never a Club copy', () => {
    expect(october.tool).toMatchObject({ tool: 'chore-chart', title: 'Give everyone a job they can own', cta: 'Make a Family Chore Chart' });
    expect(clubTools['chore-chart']).toMatchObject({ path: routes.clubTool('chore-chart'), publicPath: routes.choreChart, perChild: true });
  });

  it('opens one job per person, grown-ups included, never a full week of chores', () => {
    expect(october.tool!.start).toBe('one-job');
    expect(clubTools['chore-chart'].people).toBe('everyone');
  });

  it('suggests one age-fit job each, with its picture for children up to 13, and a whole job for a grown-up', () => {
    for (const [group, job] of Object.entries(oneJobs)) {
      expect(job, group).not.toMatch(/\bhelp/i);
      const pic = matchResponsibility(job);
      if (['2-3', '4-5', '6-7', '8-10', '11-13'].includes(group)) {
        expect(pic, group).toBeTruthy();
        const min = responsibilities.find((r) => r.id === pic)!.minAge;
        expect(min, group).toBeLessThanOrEqual(Number(group.split('-')[0]) + 1);
      }
    }
    expect(adultOneJob).not.toMatch(/\bhelp/i);
  });

  it('prints ownership, not helping, on every chore chart', () => {
    const chart = readFileSync('src/components/site/ChoreChart.astro', 'utf8');
    expect(chart).toContain('My jobs, start to finish.');
    expect(chart).not.toMatch(/helping hand/i);
  });

  it('maps every child’s age to one of the chart’s own age groups', () => {
    for (let age = 0; age <= 19; age++) expect(choreSets[ageGroupFor(age)], `age ${age}`).toBeDefined();
    expect([2, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14, 16, 17].map(ageGroupFor)).toEqual(['2-3', '2-3', '4-5', '4-5', '6-7', '6-7', '8-10', '8-10', '11-13', '11-13', '14-16', '14-16', '17+']);
  });
});

describe('October doesn’t change August or November', () => {
  it('keeps their shapes', () => {
    expect(august.action!.kind).toBe('countdown');
    expect(august.tool!.tool).toBe('routine-chart');
    expect(november.action).toBeUndefined();
    expect(november.printables.map((p) => p.id)).toEqual(['ownership-chart', 'kitchen-pantry-reset', 'who-owns-what', 'handing-over']);
  });
});

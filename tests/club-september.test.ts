/**
 * The September 2027 kit, A Week Everyone Can See: one letter, one action (the first 15-minute family meeting around
 * the wall calendar), one optional tool (the Family Weekly Reset Builder, a site tool opened inside the Club). Above
 * all: the guide shapes a conversation, never a second calendar; everyone takes part at their age; Mom isn't the
 * default leader.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as september } from '../src/data/club/kits/2027-09-a-week-everyone-can-see';
import { clubTools } from '../src/data/club/tools';
import { bandOf, leaderNote, meetLabel, resetAgenda, resetMinutes, resetQuestion, type Concern } from '../src/data/family-reset';
import { groupFor, type Helper } from '../src/lib/household-helpers';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = september.action!;
const people = (xs: [string, number | null, boolean?][]): Helper[] =>
  xs.map(([name, age, h], i) => ({ id: `p${i}`, name, group: groupFor(age), age, limits: [], ...(h ? { holder: true } : {}) }));
const rivera = people([['Ana', null, true], ['Luis', null], ['Sofia', 11], ['Mateo', 8], ['Elena', 5]]);
const brooks = people([['Jess', null, true], ['Max', 9], ['Lily', 6]]);
const chen = people([['Mei', null, true], ['David', null], ['Lin', null], ['Grace', 16], ['Owen', 14], ['Ivy', 8], ['Leo', 6]]);
const agenda = (p: Helper[], concerns: Concern[] = [], other = '') => resetAgenda({ people: p, concerns, other });
const text = (p: Helper[], c: Concern[] = []) => JSON.stringify(agenda(p, c));

describe('September: one letter, one meeting, one optional guide', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(september)).toEqual([]);
    expect(september.theme).toBe('A Week Everyone Can See');
    expect(september.subtitle).toBe('One family. One calendar. Everyone knows the plan.');
    expect(kitBySlug('2027-09-a-week-everyone-can-see')).toBe(september);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has the five meeting steps with their minutes, 15 in all, and a line for the meeting day and time', () => {
    expect(action.title).toBe('Our First 15-Minute Family Meeting');
    expect(action.intro).toBe('One short conversation. One shared plan.');
    expect(action.items.map((i) => i.text)).toEqual([
      'Gather around the calendar. (3 min)', 'Look at the week ahead. (4 min)', 'Decide who’s doing what. (3 min)', 'Make the week easier. (3 min)', 'Ask who needs help. (2 min)',
    ]);
    const minutes = action.items.map((i) => Number(/\((\d+) min\)/.exec(i.text)![1]));
    expect(minutes.reduce((a, b) => a + b, 0)).toBe(15);
    expect(action.focus!.printLabel).toBe('Our family meeting day and time');
    expect(action.items[3].detail).toMatch(/meal plan.*grocery list/);
    expect(JSON.stringify(september)).not.toMatch(/attendance|minutes of the meeting|streak|score|dashboard|agenda item/i);
  });
});

describe('September: the letter and the mailer', () => {
  const letter = september.mailer.letter!;
  it('is a 150–200 word draft for Megan, with the question, and no guilt, blame or two-parent assumption', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('You Don’t Have to Remember Everything');
    expect(letter.draft).toBe(true);
    expect(schedulable(september)).toBe(false);
    expect(letter.body).toContain('What’s one thing happening this week that everyone needs to know about?');
    expect(letter.body).toMatch(/walking calendar/);
    expect(letter.body).not.toMatch(/\b(dad|husband|both parents|your partner|lazy)\b/i);
    expect(letter.body).not.toMatch(/\b(I|my|me)\b/);
  });

  it('points its QR code at this kit’s own page, and is seeded as a draft', () => {
    expect(qrUrl(september.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-09-a-week-everyone-can-see?source=mailer');
    expect(readableUrl(september.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-09-a-week-everyone-can-see');
    expect(qrMatrix(qrUrl(september.mailer.qrPath)).length).toBeGreaterThan(0);
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-09-a-week-everyone-can-see', '2027-09-01', 'A Week Everyone Can See', 'draft', '2027-09-01/);
  });
});

describe('September: the Family Weekly Reset Builder', () => {
  it('is a site tool the Club hosts with the family, separate from the month’s copy and from the paid Weekly Reset System', () => {
    expect(september.tool).toMatchObject({ tool: 'family-reset' });
    expect(clubTools['family-reset']).toMatchObject({ path: routes.clubTool('family-reset'), perChild: false, familyPeople: true });
    expect(routes.clubTool('family-reset')).not.toBe('/weekly-reset');
    expect(readFileSync('src/components/site/family-reset-builder.ts', 'utf8')).not.toMatch(/club\/kits|September|2027/);
  });

  it('makes five steps, about 15 minutes, around the calendar’s own sections, with no planning grid', () => {
    for (const fam of [rivera, brooks, chen]) {
      const a = agenda(fam, ['school', 'meals', 'transport']);
      expect(a.length).toBe(5);
      expect(a.reduce((n, x) => n + x.minutes, 0)).toBe(15);
      expect(JSON.stringify(a)).toMatch(/daily schedule/);
      expect(JSON.stringify(a)).toMatch(/meal plan.*grocery list/);
    }
    expect(resetMinutes(rivera).note).toMatch(/little ones/);
    expect(resetMinutes(chen).note).toMatch(/twenty minutes/);
  });

  it('changes the questions with what makes the week complicated, and nothing else', () => {
    expect(text(brooks, ['meals'])).toMatch(/What about meals\?/);
    expect(text(brooks, [])).not.toMatch(/What about meals\?/);
    expect(text(brooks, ['school', 'activities'])).toMatch(/school events.*practices/);
    expect(text(brooks, ['work'])).toMatch(/work shifts/);
    expect(text(brooks, ['chores'])).toMatch(/to-do list/);
    expect(JSON.stringify(agenda(brooks, ['other'], 'Shared custody weeks'))).toMatch(/shared custody weeks/);
    expect(text(brooks, ['transport'])).toMatch(/ride and pickup/);
  });

  it('lets everyone take part at their age, and assumes no second adult', () => {
    expect(text(rivera)).toMatch(/Little ones point to one thing on the calendar/);
    expect(text(chen)).toMatch(/Teens share their own plans/);
    expect(text(chen)).toMatch(/Teens write their own commitments/);
    expect(text(brooks)).not.toMatch(/Each adult|other adult|partner/);
    expect(text(brooks, ['transport'])).toMatch(/a carpool, a grandparent or a friend/);
    expect(text(rivera)).toMatch(/Each adult brings updates/);
    expect(text(people([['Sam', null], ['Alex', null]]))).not.toMatch(/Kids|Little ones|Teens/);
    expect(resetQuestion(rivera)).toBe('What are you looking forward to this week?');
    expect(resetQuestion(people([['Sam', null], ['Teen', 15]]))).toMatch(/clashes/);
    expect(bandOf(chen[3])).toBe('teen');
  });

  it('describes leading by age: a young child asks the first question, adults keep the grown-up calls', () => {
    expect(leaderNote(rivera[4])).toMatch(/asking the first question/);
    expect(leaderNote(chen[3])).toMatch(/guides the meeting. Grown-ups make the calls/);
    expect(meetLabel('sunday', '', '6:30 pm')).toBe('Sundays at 6:30 pm');
    expect(meetLabel('other', 'Thursday', '')).toBe('Thursdays');
    expect(meetLabel('friday', '', '')).toBe('Fridays');
  });
});

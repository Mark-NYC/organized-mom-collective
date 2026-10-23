/**
 * The August 2027 kit, Ready for the School Year, in the three-part shape: one letter, one action (the six-line
 * countdown), one optional tool: the site's own routine chart, opened inside the Club. November stays as it was.
 */
import { describe, expect, it } from 'vitest';
import { kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as august } from '../src/data/club/kits/2027-08-school-year';
import { kit as november } from '../src/data/club/kits/2026-11-family-ownership';
import { clubTools } from '../src/data/club/tools';
import { matchResponsibility } from '../src/data/responsibilities';
import { routineTypes } from '../src/data/routines';
import { routes } from '../src/routes';
import { qrMatrix } from '../src/lib/club/qr';
import { exampleRoutine, qrUrl, readableUrl } from '../src/lib/club/routines';
import { readFileSync, readdirSync } from 'node:fs';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe('August: one letter, one action, one tool', () => {
  it('passes every kit check, beside November', () => {
    expect(kitProblems(august)).toEqual([]);
    expect(kits.map((k) => k.slug)).toEqual(['2026-11-family-ownership', '2027-01-fresh-start-together', '2027-02-better-together', '2027-03-spring-clean-together', '2027-08-school-year', '2027-10-home-works-together', '2027-12-christmas-family-affair']);
  });

  it('keeps November exactly as it was', () => {
    expect(november.action).toBeUndefined();
    expect(november.tool).toBeUndefined();
    expect(november.setup).toBeUndefined();
    expect(november.mailer.activity?.steps.length).toBeGreaterThan(0);
    expect(november.printables.map((p) => [p.id, p.component])).toEqual([
      ['ownership-chart', 'ResponsibilityChart'], ['kitchen-pantry-reset', 'ResetChecklist'], ['who-owns-what', 'ConversationCard'], ['handing-over', 'Checklist'],
    ]);
  });

  it('is the theme and subtitle the owner set', () => {
    expect(august.theme).toBe('Ready for the School Year');
    expect(august.subtitle).toBe('One calmer start. Everyone has a part.');
  });

  it('has exactly the six countdown lines, with an optional helper blank instead of assignments', () => {
    expect(august.action!.title).toBe('Our Back-to-School Countdown');
    expect(august.action!.items.map((i) => [i.text, i.daysBefore])).toEqual([
      ['Add school dates and activities to the family calendar.', 14],
      ['Check clothes, shoes and school supplies.', 10],
      ['Set up a place for backpacks and school papers.', 7],
      ['Decide who’s handling drop-off and pick-up.', 7],
      ['Practice morning and after-school routines.', 5],
      ['Pack bags and get everything ready the night before.', 1],
    ]);
    expect(august.action!.helperLabel).toBe('Who’s helping?');
  });

  it('prints the countdown and the letter, and nothing from the first draft: no launch plan, command center, overview or item sets', () => {
    expect(august.printables.map((p) => [p.id, p.component])).toEqual([['countdown', 'Action'], ['letter', 'Letter']]);
    expect(august.overview).toBeUndefined();
    expect(august.itemSets).toBeUndefined();
    expect(august.printables.some((p) => p.secondary || p.editor)).toBe(false);
  });

  it('has a 150–200 word letter, still a draft for Megan, so the kit can’t be scheduled yet', () => {
    const letter = august.mailer.letter!;
    expect(words([letter.greeting, letter.body].join(' '))).toBeGreaterThanOrEqual(150);
    expect(words([letter.greeting, letter.body].join(' '))).toBeLessThanOrEqual(200);
    expect(letter.draft).toBe(true);
    expect(schedulable(august)).toBe(false);
    expect(letter.body).toMatch(/family calendar/);
    expect(letter.body).toContain('You don’t have to tackle all six at once. Start with what matters most, and share the jobs.');
    expect(letter.namedGreeting).toBe('Hi {name},');
  });

  it('asks one family question on the back of the letter', () => {
    expect(august.mailer.conversation?.question).toBe('What’s one thing you want to be able to do by yourself before school starts?');
  });

  it('puts the QR code, a readable address and one calendar reminder on the back', () => {
    expect(qrUrl(august.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-08-school-year?source=mailer');
    expect(readableUrl(august.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-08-school-year');
    expect(august.mailer.calendarNote).toMatch(/family calendar/);
    expect(august.mailer.fieldGuide.sections.length).toBeLessThanOrEqual(4);
  });

  it('is seeded (as a draft) in the migrations, like every kit', () => {
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    for (const k of kits) expect(sql, k.slug).toMatch(new RegExp(`'${k.slug}'[^;]*'draft'`));
  });
});

describe('August: the tool is the site’s routine chart', () => {
  it('opens the site’s own routine chart inside the Club, never a Club copy', () => {
    expect(august.tool!.tool).toBe('routine-chart');
    expect(clubTools['routine-chart']).toMatchObject({ path: routes.clubTool('routine-chart'), publicPath: routes.routineChart, perChild: true });
    expect(clubTools['routine-chart'].variants.map((v) => v.id).every((id) => id in routineTypes)).toBe(true);
    expect(august.items).toEqual([]);
  });

  it('the letter’s example is the routine chart’s own morning starter, with its illustrations', () => {
    expect(exampleRoutine(august).map((s) => s.title)).toEqual(routineTypes.morning.steps.map(([, t]) => t));
    for (const s of exampleRoutine(august)) expect(s.illustration).toBe(matchResponsibility(s.title));
  });
});

describe('August: the QR code', () => {
  it('encodes the kit address as a version 5 code with its three finder patterns', () => {
    const m = qrMatrix(qrUrl(august.mailer.qrPath));
    expect(m.length).toBe(37);
    for (const [x, y] of [[0, 0], [30, 0], [0, 30]]) {
      expect(m[y][x] && m[y + 6][x + 6] && m[y + 3][x + 3] && !m[y + 1][x + 1]).toBe(true);
    }
    expect(() => qrMatrix('x'.repeat(200))).toThrow('qr_too_long');
  });
});


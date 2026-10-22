/**
 * The August 2027 kit, Ready for the School Year, in the three-part shape: one letter, one action (the six-line
 * countdown), one optional tool (a school-day routine chart per child). November stays exactly as it was.
 */
import { describe, expect, it } from 'vitest';
import { kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as august } from '../src/data/club/kits/2027-08-school-year';
import { kit as november } from '../src/data/club/kits/2026-11-family-ownership';
import { readAction } from '../src/lib/club/action';
import { addRow, initialEdits, move, readEdits, remove, resolveDocument, type DocumentEdits } from '../src/lib/club/edits';
import { eligible, ROUTINE_MAX_STEPS, type GenerateOptions } from '../src/lib/club/engines/responsibilities';
import { planMembers, type Household } from '../src/lib/club/profile';
import { qrMatrix } from '../src/lib/club/qr';
import { exampleRoutine, qrUrl, readableUrl } from '../src/lib/club/routines';
import { schoolSetupFor, withSchool } from '../src/lib/club/school';
import { placementFor } from '../src/components/club/ChartEditor';
import { readFileSync, readdirSync } from 'node:fs';
import { adult, families, family, kid } from './club/fixtures';

const MONTH = august.month;
const routines = august.items;
const tool = august.printables.find((p) => p.id === august.tool!.printable)!;
const opts: GenerateOptions = placementFor(tool);
/** As the kit page does it: schools guessed from age and the homeschool preference, no setup step. */
const schooled = (h: Household) => withSchool(h, schoolSetupFor(h, MONTH));
const routineRows = (h: Household, e?: DocumentEdits) => resolveDocument(h, routines, MONTH, e ?? initialEdits(h, routines, MONTH, opts), opts);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe('August: one letter, one action, one tool', () => {
  it('passes every kit check, beside November', () => {
    expect(kitProblems(august)).toEqual([]);
    expect(kits.map((k) => k.slug)).toEqual(['2026-11-family-ownership', '2027-08-school-year']);
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
    expect(august.action!.items).toEqual([
      'Add school dates and activities to the family calendar.',
      'Check clothes, shoes and school supplies.',
      'Set up a place for backpacks and school papers.',
      'Decide who’s handling drop-off and pick-up.',
      'Practice morning and after-school routines.',
      'Pack bags and get everything ready the night before.',
    ]);
    expect(august.action!.helperLabel).toBe('Who’s helping?');
  });

  it('has three printables and nothing from the first draft: no launch plan, command center, overview, setup step or item sets', () => {
    expect(august.printables.map((p) => [p.id, p.component])).toEqual([['school-routines', 'RoutineChart'], ['countdown', 'Countdown'], ['letter', 'Letter']]);
    expect(august.overview).toBeUndefined();
    expect(august.itemSets).toBeUndefined();
    expect(august.printables.some((p) => p.secondary || p.editor === 'command')).toBe(false);
    expect(new Set(routines.map((i) => i.section))).toEqual(new Set(['morning', 'after-school']));
    for (const i of routines) expect(i.title, i.id).not.toMatch(/\bhelp/i);
  });

  it('has a 150–200 word letter, still a draft for Megan, so the kit can’t be scheduled yet', () => {
    const letter = august.mailer.letter!;
    expect(words([letter.greeting, letter.body].join(' '))).toBeGreaterThanOrEqual(150);
    expect(words([letter.greeting, letter.body].join(' '))).toBeLessThanOrEqual(200);
    expect(letter.draft).toBe(true);
    expect(schedulable(august)).toBe(false);
    expect(letter.body).toMatch(/family calendar/);
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

describe('August: the routine tool', () => {
  it('suggests four to six steps for every age it serves, at school, preschool or home', () => {
    for (const prefs of [{}, { school: 'homeschool' as const }]) {
      for (let age = 3; age <= 17; age++) {
        const h = schooled(family(`hh-${age}`, [adult('a', true), kid('k', age - 1)], prefs)); // fixture ages are for Nov 2026
        const rows = routineRows(h).rows;
        for (const part of ['morning', 'after-school']) {
          const n = rows.filter((r) => r.section === part).length;
          expect(n, `${JSON.stringify(prefs)} age ${age} ${part}`).toBeGreaterThanOrEqual(4);
          expect(n, `${JSON.stringify(prefs)} age ${age} ${part}`).toBeLessThanOrEqual(ROUTINE_MAX_STEPS);
        }
      }
    }
  });

  it('works for every sample shape: fitting steps only, no coaches, nothing for toddlers or adults', () => {
    for (const [name, base] of Object.entries(families)) {
      const h = schooled(base);
      const people = new Map(planMembers(h, MONTH).map((p) => [p.id, p]));
      const { rows, suggestions } = routineRows(h);
      for (const r of rows) {
        const p = people.get(r.ownerId!)!;
        expect(p.stage, `${name} ${r.rowId}`).not.toBe('adult');
        expect(eligible(routines.find((i) => i.id === r.itemId)!, p, h.preferences), `${name} ${r.rowId}`).toBe(true);
        expect(r.coachId).toBeNull();
      }
      for (const p of people.values()) if (p.stage !== 'adult' && (p.age ?? 0) < 3) expect(rows.filter((r) => r.ownerId === p.id), `${name} ${p.id}`).toEqual([]);
      expect(suggestions, name).toEqual([]);
    }
  });

  it('keeps the routine’s order, her reordering, her own steps and her removals', () => {
    const h = schooled(families.A);
    const ben = routineRows(h).rows.filter((r) => r.ownerId === 'ben' && r.section === 'morning');
    const order = new Map(routines.map((i, n) => [i.id, n]));
    expect(ben.map((r) => order.get(r.itemId!))).toEqual([...ben.map((r) => order.get(r.itemId!)!)].sort((a, b) => a - b));
    let e = initialEdits(h, routines, MONTH, opts);
    const all = routineRows(h, e).rows.map((r) => r.rowId);
    e = move(e, all, ben[2].rowId, all.indexOf(ben[0].rowId));
    e = addRow(e, h, { title: 'Feed the fish', ownerId: 'ben', section: 'morning', frequency: 'weekdays' });
    e = remove(e, ben[1].rowId);
    const again = routineRows(h, readEdits(JSON.parse(JSON.stringify(e))));
    const mine = again.rows.filter((r) => r.ownerId === 'ben' && r.section === 'morning');
    expect(mine[0].rowId).toBe(ben[2].rowId);
    expect(mine.map((r) => r.title)).toContain('Feed the fish');
    expect(mine.map((r) => r.rowId)).not.toContain(ben[1].rowId);
    // A removed step isn't suggested back, and nothing is balanced between children.
    expect(again.suggestions).toEqual([]);
  });

  it('homeschoolers get their school spot, never backpack-by-the-door', () => {
    const h = schooled(family('hh-home', [adult('a', true), kid('k', 7)], { school: 'homeschool' }));
    const ids = routineRows(h).rows.map((r) => r.itemId);
    expect(ids).toContain('at-school-spot');
    expect(ids).not.toContain('by-the-door');
  });

  it('prints mostly pictures for young children', () => {
    for (const age of [4, 6, 8]) {
      const h = schooled(family(`hh-p${age}`, [adult('a', true), kid('k', age - 1)]));
      const morning = routineRows(h).rows.filter((r) => r.section === 'morning');
      expect(morning.every((r) => r.illustration), `age ${age}`).toBe(true);
    }
  });

  it('the letter’s example is exactly what the tool suggests for a seven-year-old’s morning', () => {
    const h = schooled(family('hh-7', [adult('a', true), kid('k', 6)]));
    const tool7 = routineRows(h).rows.filter((r) => r.section === 'morning').map((r) => r.itemId);
    expect(exampleRoutine(august).map((i) => i.id)).toEqual(tool7);
    expect(tool7.length).toBeGreaterThanOrEqual(4);
  });
});

describe('August: the countdown’s saved state and the QR code', () => {
  it('reads saved checks and helpers safely', () => {
    expect(readAction({ done: [true, 'yes', false], helpers: ['Dad', 7, '  Ava   and   Ben '] }, 4)).toEqual({
      done: [true, false, false, false],
      helpers: ['Dad', '', ' Ava and Ben ', ''],
    });
    expect(readAction(null, 2)).toEqual({ done: [false, false], helpers: ['', ''] });
  });

  it('encodes the kit address as a version 5 code with its three finder patterns', () => {
    const m = qrMatrix(qrUrl(august.mailer.qrPath));
    expect(m.length).toBe(37);
    for (const [x, y] of [[0, 0], [30, 0], [0, 30]]) {
      expect(m[y][x] && m[y + 6][x + 6] && m[y + 3][x + 3] && !m[y + 1][x + 1]).toBe(true);
    }
    expect(() => qrMatrix('x'.repeat(200))).toThrow('qr_too_long');
  });
});


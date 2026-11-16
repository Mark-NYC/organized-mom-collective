/**
 * The January 2027 kit, A Fresh Start, Together: one letter, one action (Our One-Thing Family Reset: five steps and
 * the family's one thing), one optional tool (the Family Habit Builder, a site tool opened inside the Club).
 * The other months stay as they were.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as january } from '../src/data/club/kits/2027-01-fresh-start-together';
import { clubTools } from '../src/data/club/tools';
import {
  checkInDay, dayLabel, HABIT_REFLECTION, habitAreaById, habitAreas, habitMoments, habitStatement, habitText, practiceDays, singularVerb, whoLabel,
} from '../src/data/family-habits';
import { responsibilityById } from '../src/data/responsibilities';
import { checkInFor, countdownText, focusLines, planCountdown, readCountdown } from '../src/lib/club/countdown';
import { readToolHandoff } from '../src/lib/tool-handoff';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = january.action!;


describe('January: the letter and the mailer', () => {
  const letter = january.mailer.letter!;

  it('points its QR code at this kit’s own page', () => {
    expect(january.mailer.qrPath).toBe(`${routes.clubKit(january.slug)}?source=mailer`);
    expect(qrUrl(january.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-01-fresh-start-together?source=mailer');
    expect(readableUrl(january.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-01-fresh-start-together');
    expect(qrMatrix(qrUrl(january.mailer.qrPath)).length).toBeGreaterThan(0);
  });

  it('is seeded as a draft in the migrations, opening January 1', () => {
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-01-fresh-start-together', '2027-01-01', 'A Fresh Start, Together', 'draft', '2027-01-01/);
  });
});

describe('January: the tool is the Family Habit Builder', () => {

  it('offers the five areas plus something else, and the five moments to tie it to', () => {
    expect(habitAreas.map((a) => a.label)).toEqual(['Getting out the door', 'Keeping the kitchen tidy', 'Putting things away', 'Preparing for bedtime', 'Getting ready for tomorrow']);
    expect(habitMoments.map((m) => m.label)).toEqual(['After breakfast', 'Before leaving home', 'When we get home', 'After dinner', 'Before bedtime']);
    for (const a of habitAreas) {
      expect(habitMoments.some((m) => m.id === a.when), a.id).toBe(true);
      if (a.illustration) expect(responsibilityById(a.illustration), a.id).toBeTruthy();
      expect(a.doneMeans.trim(), a.id).toBeTruthy();
    }
  });

  it('writes one realistic sentence: when, who, what, with the verb agreeing', () => {
    expect(habitStatement('after-dinner', 'everyone', habitAreaById('kitchen')!.action)).toBe('After dinner, everyone spends five minutes resetting the kitchen.');
    expect(habitStatement('before-bed', 'children', habitAreaById('out-the-door')!.action)).toBe('Before bedtime, the kids put shoes, coats and bags by the door.');
    expect(habitStatement('home-from-school', 'some', habitAreaById('put-away')!.action, ['Sofia'])).toBe('When we get home from school, Sofia puts their own things back where they belong.');
    expect(habitStatement('after-dinner', 'some', 'wash the dishes', ['Ana', 'Luis', 'Mateo'])).toBe('After dinner, Ana, Luis and Mateo wash the dishes.');
    expect(habitStatement('Right after soccer practice', 'everyone', 'put dirty clothes in the hamper.')).toBe('Right after soccer practice, everyone puts dirty clothes in the hamper.');
    expect(habitStatement('after-dinner', 'everyone', '  ')).toBe('');
    expect(['fix', 'tidy', 'brush', 'do', 'have', 'go', 'play'].map(singularVerb)).toEqual(['fixes', 'tidies', 'brushes', 'does', 'has', 'goes', 'plays']);
    expect(whoLabel('adults')).toBe('The grown-ups');
    expect(whoLabel('some', ['Mei', 'Lin'])).toBe('Mei and Lin');
  });

  it('gives exactly seven practice days, labeled from her start day when she has one', () => {
    expect(practiceDays()).toEqual(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']);
    expect(practiceDays('2027-01-04')).toEqual(['Mon 1/4', 'Tue 1/5', 'Wed 1/6', 'Thu 1/7', 'Fri 1/8', 'Sat 1/9', 'Sun 1/10']);
    expect(practiceDays('2027-01-29').slice(-1)).toEqual(['Thu 2/4']);
    expect(checkInDay('2027-01-04')).toBe('2027-01-11');
    expect(dayLabel('2027-01-11')).toBe('Monday, January 11');
    expect(dayLabel('nope')).toBe('');
  });

  it('carries first names, her own words and a start day in the handoff, checked', () => {
    const store = new Map<string, string>();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
    store.set('omc:tool-handoff', JSON.stringify({ tool: 'habit-builder', key: 'sample-rivera-family', people: [{ name: ' Ana ', adult: true }, { name: '' }, 7], text: 'Shoes everywhere', date: '2027-01-04', variant: 'kitchen' }));
    expect(readToolHandoff('habit-builder', 'rivera')).toMatchObject({ people: [{ name: 'Ana', adult: true }], text: 'Shoes everywhere', date: '2027-01-04', variant: 'kitchen' });
    // Another sample family's handoff, or a sample's on a member's page, is ignored.
    expect(readToolHandoff('habit-builder', 'okafor')).toBeNull();
    expect(readToolHandoff('habit-builder', null)).toBeNull();
    store.set('omc:tool-handoff', JSON.stringify({ tool: 'habit-builder', key: 'k', date: 'soon' }));
    expect(readToolHandoff('habit-builder', null)!.date).toBeUndefined();
  });
});

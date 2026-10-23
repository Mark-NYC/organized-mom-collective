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

describe('January: one letter, one reset, one optional habit builder', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(january)).toEqual([]);
    expect(january.theme).toBe('A Fresh Start, Together');
    expect(january.subtitle).toBe('One small change. A better rhythm for everyone.');
    expect(kitBySlug('2027-01-fresh-start-together')).toBe(january);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has exactly the five steps, no dates, no per-step assignments', () => {
    expect(action.kind).toBe('checklist');
    expect(action.title).toBe('Our One-Thing Family Reset');
    expect(action.intro).toBe('One problem. One shared solution. One week of practice.');
    expect(action.items.map((i) => `${i.text} ${i.detail}`)).toEqual([
      'Choose one frustration. What’s one part of everyday family life that isn’t working well?',
      'Agree on a simpler plan. What would make that part of the day easier?',
      'Give everyone a part. What can each family member do to make the plan work?',
      'Put it on the calendar. Choose when you’ll start and when you’ll check in.',
      'Try it for seven days. Practice together, then decide what to keep or change.',
    ]);
    expect(action.items.every((i) => i.daysBefore === undefined && !i.essential)).toBe(true);
    expect(action.helperLabel).toBeUndefined();
  });

  it('asks for the family’s one thing, offering the habit builder’s own areas, a plan on step 2 and a start day on step 4', () => {
    expect(action.focus).toMatchObject({ label: 'What is your family’s one thing?', printLabel: 'Our one thing this month', planAt: 1, startAt: 3 });
    expect(action.focus!.suggestions.map((s) => s.id)).toEqual(habitAreas.map((a) => a.id));
  });

  it('saves the one thing, plan and start day, checks in a week later, and never schedules anything else', () => {
    const s = readCountdown({ done: [true], focus: { area: 'kitchen', text: 'Keeping the kitchen tidy', plan: 'After dinner, everyone resets the kitchen.', start: '2027-01-10' } }, 5);
    expect(s.focus).toEqual({ area: 'kitchen', text: 'Keeping the kitchen tidy', plan: 'After dinner, everyone resets the kitchen.', start: '2027-01-10' });
    expect(checkInFor('2027-01-10')).toBe('2027-01-17');
    expect(checkInFor('')).toBe('');
    expect(readCountdown({ focus: { area: 'BAD ID', start: '2027-02-30', text: 'x'.repeat(200) } }, 5).focus).toEqual({ area: null, text: 'x'.repeat(80), plan: '', start: '' });
    expect(readCountdown(null, 5).focus).toEqual({ area: null, text: '', plan: '', start: '' });
    expect(planCountdown(action.items, '', '2027-01-20').lines.every((l) => l.date === null)).toBe(true);
    expect(focusLines('Our one thing this month', s.focus)).toEqual([
      'Our one thing this month: Keeping the kitchen tidy',
      'Our plan: After dinner, everyone resets the kitchen.',
      'We start: Sunday, January 10 · We check in: Sunday, January 17',
      '',
    ]);
    expect(countdownText(action.title, action.items, planCountdown(action.items, '', '2027-01-05'), s).split('\n')[2]).toBe('[x] Choose one frustration. What’s one part of everyday family life that isn’t working well?');
  });

  it('works for a family that joins late in January, or opens it later: no date is assumed', () => {
    for (const today of ['2027-01-02', '2027-01-28', '2027-03-15', '2028-01-05']) {
      expect(planCountdown(action.items, '', today).status).toBe('undated');
    }
    expect(JSON.stringify(january)).not.toMatch(/streak|points|badge|reward|30-day|thirty/i);
  });

  it('prints the plan and the letter, like the other three-part kits', () => {
    expect(january.printables.map((p) => [p.id, p.component])).toEqual([['one-thing-plan', 'Action'], ['letter', 'Letter']]);
    expect(january.mailer.accent).toBeUndefined();
  });
});

describe('January: the letter and the mailer', () => {
  const letter = january.mailer.letter!;
  it('is a 150–200 word draft for Megan, greets by name when known, asks the family question, and picks one thing', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('You Don’t Need a Whole New Routine');
    expect(letter.namedGreeting).toBe('Hi {name},');
    expect(letter.signoff).toBe('Megan');
    expect(letter.draft).toBe(true);
    expect(schedulable(january)).toBe(false);
    expect(letter.body).toContain('What’s one part of our day that we could make easier for everyone?');
    expect(letter.body).toMatch(/Just one\./);
    expect(letter.body).not.toMatch(/resolution|new year, new you|30 days|productiv/i);
  });

  it('puts the three principles, one example, the question, the QR code and the calendar note on the back', () => {
    expect(january.mailer.fieldGuide.title).toBe('Small Changes That Stick');
    expect(january.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Start with something small.', 'Connect it to something you already do.', 'Let everyone play a part.']);
    expect(january.mailer.story?.body).toMatch(/seven days/);
    expect(january.mailer.conversation).toMatchObject({ question: 'What’s one part of our day that we could make easier for everyone?', placement: 'after-example' });
    expect(january.mailer.calendarNote).toBe('Choose your start day and a day to check in together. Write both on your family calendar.');
  });

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
  it('is a site tool the Club hosts for the whole family, with its first names', () => {
    expect(january.tool).toMatchObject({ tool: 'habit-builder', title: 'Build Your Family Habit', cta: 'Build Our Family Habit' });
    expect(january.tool!.blurb).toBe('Turn one small change into a habit everyone can practice together.');
    expect(clubTools['habit-builder']).toMatchObject({ path: routes.clubTool('habit-builder'), perChild: false, familyPeople: true });
    expect(readFileSync('src/pages/club/tools/habit-builder.astro', 'utf8')).toContain("import HabitBuilder from '../../../components/site/HabitBuilder.astro'");
    // Shared logic stays out of the month's copy.
    expect(readFileSync('src/components/site/habit-builder.ts', 'utf8')).not.toMatch(/club\/kits|January|2027/);
  });

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

  it('copies one habit as plain text with the reflection, and its card has no scoring', () => {
    const t = habitText({ statement: 'After dinner, everyone spends five minutes resetting the kitchen.', when: 'After dinner', who: 'The whole family', doneMeans: 'Counters wiped.', start: 'Monday, January 4', checkIn: 'Monday, January 11' });
    expect(t.split('\n')).toEqual([
      'Our family’s new rhythm', '', 'After dinner, everyone spends five minutes resetting the kitchen.', '',
      'When: After dinner', 'Who: The whole family', 'Done means: Counters wiped.', 'We start: Monday, January 4 · We check in: Monday, January 11', '',
      `Try it for seven days, then ask: ${HABIT_REFLECTION}`,
    ]);
    expect(HABIT_REFLECTION).toBe('Did this make our day easier? What should we change?');
    // What a family sees and what the code does, not the comments that say what it leaves out.
    const markup = (readFileSync('src/components/site/HabitBuilder.astro', 'utf8') + readFileSync('src/components/site/habit-builder.ts', 'utf8')).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(markup).not.toMatch(/streak|points|badge|reward|notification|30-day/i);
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

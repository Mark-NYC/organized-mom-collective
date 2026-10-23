/**
 * The February 2027 kit, Better Together: one letter, one action (the three-part Family Connection Challenge), one
 * optional tool (the Family Connection Planner, a site tool opened inside the Club). The other months stay as they were.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as february } from '../src/data/club/kits/2027-02-better-together';
import { clubTools } from '../src/data/club/tools';
import {
  connectionById, connectionFits, connectionIdeas, connectionText, defaultConnectionPrefs as d, pickConnections, rankConnections, slotsFor, swapConnection,
  type ConnectionPrefs,
} from '../src/data/connection-ideas';
import { countdownText, planCountdown, readCountdown, MAX_HELPER, MAX_NOTE } from '../src/lib/club/countdown';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = february.action!;
const prefs = (p: Partial<ConnectionPrefs>): ConnectionPrefs => ({ ...d, ...p });
const picks = (p: Partial<ConnectionPrefs>) => pickConnections(prefs(p));

describe('February: one letter, one challenge, one optional connection planner', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(february)).toEqual([]);
    expect(february.theme).toBe('Better Together');
    expect(february.subtitle).toBe('Less managing life. More enjoying it together.');
    expect(kitBySlug('2027-02-better-together')).toBe(february);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has exactly three actions, each with a sentence and an optional "Our idea" line under it, and nothing scheduled', () => {
    expect(action.kind).toBe('checklist');
    expect(action.title).toBe('Our Family Connection Challenge');
    expect(action.intro).toBe('Three little ways to enjoy each other more this month.');
    expect(action.items.map((i) => i.text)).toEqual(['Do something together.', 'Make time for one-on-one.', 'Make a shared space more inviting.']);
    expect(action.items.every((i) => i.detail && i.daysBefore === undefined && !i.essential)).toBe(true);
    expect(action.helperLabel).toBe('Our idea');
    expect(action.helperPlacement).toBe('below');
    expect(action.items[1].detail).toMatch(/not just Mom/);
    expect(action.items[2].detail).toMatch(/cleaning-zone day/);
    expect(JSON.stringify(february)).not.toMatch(/streak|score|points|badge|reminder|30-day|every day this month/i);
  });

  it('saves an idea per line (longer than a name) and copies it with the line', () => {
    expect(MAX_NOTE).toBeGreaterThan(MAX_HELPER);
    const s = { ...readCountdown({ done: [true], helpers: ['Friday pizza and board games'] }, 3) };
    expect(s.helpers[0]).toBe('Friday pizza and board games');
    expect(readCountdown({ helpers: ['x'.repeat(100)] }, 3).helpers[0]).toHaveLength(MAX_NOTE);
    expect(countdownText(action.title, action.items, planCountdown(action.items, '', '2027-02-03'), s).split('\n')[2])
      .toBe('[x] Do something together. Choose one simple activity the whole family can enjoy, like a board game, a walk or cooking dinner. It can be free. (Friday pizza and board games)');
  });

  it('prints the challenge and the letter, with a soft blush touch', () => {
    expect(february.printables.map((p) => [p.id, p.component])).toEqual([['connection-challenge', 'Action'], ['letter', 'Letter']]);
    expect(february.mailer.accent).toBe('blush');
  });
});

describe('February: the letter and the mailer', () => {
  const letter = february.mailer.letter!;
  it('is a 150–200 word draft for Megan, greets by name when known, and asks the family question', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('Make Room for Each Other');
    expect(letter.namedGreeting).toBe('Hi {name},');
    expect(letter.signoff).toBe('Megan');
    expect(letter.draft).toBe(true);
    expect(schedulable(february)).toBe(false);
    expect(letter.body).toContain('What’s something you’d love for us to do together more often?');
    expect(letter.body).toMatch(/entertainment director/);
    // No first-person story attributed to Megan.
    expect(letter.body).not.toMatch(/\b(I|my|me)\b/);
  });

  it('puts three principles, three prompts (the letter’s question once), the planner and the calendar note on the back', () => {
    expect(february.mailer.fieldGuide.title).toBe('Make Room for Connection');
    expect(february.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Make ordinary moments count.', 'Let everyone contribute.', 'Keep it simple enough to repeat.']);
    expect(february.mailer.conversation!.prompts).toEqual([
      'What’s something that made you laugh this week?',
      'What’s something you’d love for us to do together more often?',
      'What’s one thing you appreciate about someone in our family?',
    ]);
    expect(february.mailer.invite?.title).toBe('Family Connection Planner');
    expect(february.mailer.invite?.body).toMatch(/^Find simple activities that fit your family’s ages, time, and budget\./);
    expect(february.mailer.calendarNote).toBe('Choose one moment to enjoy together this month. Put it on the calendar and let everyone help make it happen.');
  });

  it('points its QR code at this kit’s own page', () => {
    expect(february.mailer.qrPath).toBe(`${routes.clubKit(february.slug)}?source=mailer`);
    expect(qrUrl(february.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-02-better-together?source=mailer');
    expect(readableUrl(february.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-02-better-together');
    expect(qrMatrix(qrUrl(february.mailer.qrPath)).length).toBeGreaterThan(0);
  });

  it('is seeded as a draft in the migrations, opening February 1', () => {
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-02-better-together', '2027-02-01', 'Better Together', 'draft', '2027-02-01/);
  });
});

describe('February: the tool is the Family Connection Planner', () => {
  it('is a site tool the Club hosts for the whole family, with ages and first names', () => {
    expect(february.tool).toMatchObject({ tool: 'connection-planner', title: 'Find Your Family’s Connection Moment', cta: 'Find Something to Do Together' });
    expect(clubTools['connection-planner']).toMatchObject({ path: routes.clubTool('connection-planner'), perChild: false, familyAges: true, familyPeople: true });
    expect(readFileSync('src/pages/club/tools/connection-planner.astro', 'utf8')).toContain("import ConnectionPlanner from '../../../components/site/ConnectionPlanner.astro'");
    // Shared logic stays out of the month's copy, and uses the same idea rules as the traditions picker.
    expect(readFileSync('src/components/site/connection-planner.ts', 'utf8')).not.toMatch(/club\/kits|February|2027/);
    expect(readFileSync('src/data/connection-ideas.ts', 'utf8')).toContain("from '../lib/idea-picker'");
    expect(readFileSync('src/data/christmas-traditions.ts', 'utf8')).toContain("from '../lib/idea-picker'");
  });

  it('has ordinary ideas, each with a time, a way to share it and a question, and never assumes who’s in the family', () => {
    expect(new Set(connectionIdeas.map((t) => t.id)).size).toBe(connectionIdeas.length);
    for (const t of connectionIdeas) {
      expect(t.about.split(/(?<=[.?!])\s/).length, t.id).toBeLessThanOrEqual(2);
      expect(t.share.trim(), t.id).toBeTruthy();
      expect(t.question.trim().endsWith('?'), t.id).toBe(true);
      const text = `${t.title} ${t.about} ${t.share} ${t.prep}`;
      expect(text, t.id).not.toMatch(/\b(dad|mom|mother|father|husband|wife|partner|both parents)\b/i);
      if (/park|trail|path/i.test(t.about)) expect(t.about, t.id).toMatch(/already (know|like)|nearby/);
    }
    for (const slot of ['family', 'one-on-one', 'rhythm'] as const) expect(connectionIdeas.filter((t) => t.slot === slot).length).toBeGreaterThanOrEqual(6);
  });

  it('opens with a family moment, a one-on-one moment and a rhythm, with no answers at all', () => {
    expect(pickConnections(d).map((t) => t.slot)).toEqual(['family', 'one-on-one', 'rhythm']);
    expect(slotsFor('family')).toEqual(['family', 'family', 'rhythm']);
    expect(picks({ kind: 'one-on-one' }).filter((t) => t.slot === 'one-on-one')).toHaveLength(2);
  });

  it('suits young children and teens differently, and nothing childish for teens', () => {
    const young = picks({ ages: [3, 6], time: 'hour', cost: 'under-25' });
    const teens = picks({ ages: [14, 16], time: 'hour', cost: 'under-25' });
    expect(young.map((t) => t.id)).toEqual(['pizza-night', 'bake-together', 'good-thing']);
    expect(teens.map((t) => t.id)).not.toEqual(young.map((t) => t.id));
    for (const time of ['15', '30', 'hour', 'more'] as const) {
      expect(rankConnections(prefs({ ages: [14, 16], time, cost: 'flexible' })).some((t) => t.young), time).toBe(false);
      expect(rankConnections(prefs({ ages: [2], time, cost: 'flexible' })).some((t) => (t.minAge ?? 0) > 2), time).toBe(false);
    }
  });

  it('stays within time, budget and setting, and always offers something', () => {
    for (const time of ['15', '30', 'hour', 'more'] as const) for (const cost of ['free', 'under-25', 'flexible'] as const) for (const setting of ['home', 'out', 'either'] as const) for (const kind of ['family', 'one-on-one', 'both'] as const) {
      const p = prefs({ time, cost, setting, kind });
      const got = pickConnections(p);
      expect(got.length, `${time} ${cost} ${setting} ${kind}`).toBeGreaterThanOrEqual(2);
      expect(got.every((t) => connectionFits(t, p))).toBe(true);
      expect(new Set(got.map((t) => t.id)).size).toBe(got.length);
    }
    expect(picks({ cost: 'free', time: 'more' }).every((t) => t.cost === 'free')).toBe(true);
    expect(picks({ time: '15' }).every((t) => t.time === '15')).toBe(true);
  });

  it('swaps an idea for another of the same kind, and keeps the chosen one when answers change', () => {
    const p = prefs({ ages: [5, 9] });
    const shown = pickConnections(p).map((t) => t.id);
    const next = swapConnection(p, shown, 1, [])!;
    expect(next.slot).toBe('one-on-one');
    expect(shown).not.toContain(next.id);
    const kept = pickConnections(prefs({ ages: [5, 9], time: 'hour' }), [null, shown[1], null]);
    expect(kept[1].id).toBe(shown[1]);
  });

  it('copies one plan as plain text, pointing to the calendar’s family and friends section', () => {
    const t = connectionById('pizza-night')!;
    const text = connectionText({ title: t.title, about: t.about, who: 'The whole family', when: 'Friday after dinner', prep: t.prep, question: t.question, share: t.share }, 'The Okafors');
    expect(text.split('\n').slice(0, 5)).toEqual(['The Okafors: Our Family Connection Plan', '', 'Make-your-own pizza night', t.about, '']);
    expect(text).toContain('When: Friday after dinner');
    expect(text.trim().endsWith('Write it in the family and friends section of the wall calendar, or on the day you chose.')).toBe(true);
    const markup = (readFileSync('src/components/site/ConnectionPlanner.astro', 'utf8') + readFileSync('src/components/site/connection-planner.ts', 'utf8')).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(markup).not.toMatch(/streak|points|badge|score|reminder|notification/i);
  });
});

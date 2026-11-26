/**
 * V20 household notifications (docs/ios/V20_BASELINE.md → Notification rules). Facts are simulated; every
 * notification, its recipient and its delivery status come from the real rules.
 */
import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { ANA, LUIS, mondayOf, type V16State } from '../src/lib/v16/model';
import { DEMO_PEOPLE } from '../src/lib/v19/scenarios';
import { SCENARIOS_V20, seedV20, demoToday, type ScenarioV20 } from '../src/lib/v20/scenarios';
import { DAILY_ALERTS, gotIt, markSent, notTonight, outbox, type PushNote } from '../src/lib/v20/notify';
import { buildTodayV19 } from '../src/lib/v19/engine';
import { applyChoices } from '../src/lib/v19/resolve';
import { BADGE_COLOR, badgeFor } from '../src/components/v20/Badge';
import { monthColors } from '../src/theme';

const monday = mondayOf('2026-11-26');
const today = demoToday(monday);
const at = (id: ScenarioV20) => seedV20(id, { club: true, monday });
const box = (s: V16State, now = s.intel!.clock ?? '14:30') => outbox({ s, monday, today, people: DEMO_PEOPLE, now });
const to = (notes: PushNote[], id: string) => notes.filter((n) => n.to === id && n.status !== 'off');
const as = (s: V16State, viewer: string) => ({ ...s, intel: { ...s.intel!, viewer } });

describe('three purposes, and nothing else', () => {
  test('a quiet day sends nothing', () => {
    expect(box(at('quiet')).filter((n) => n.status !== 'off')).toEqual([]);
  });

  test('no notification ever comes from suggestions, chores, cleaning or completions nobody was carrying', () => {
    const kinds = new Set(SCENARIOS_V20.flatMap(([id]) => box(at(id)).map((n) => n.kind)));
    expect([...kinds].every((k) => ['help', 'handoff', 'conflict', 'agreement', 'handled', 'declined', 'meeting'].includes(k))).toBe(true);
    for (const id of ['prep', 'consolidated', 'friction', 'ownership', 'season', 'intention', 'lighter', 'all-done', 'transport'] as ScenarioV20[]) {
      expect(box(at(id)).filter((n) => n.status !== 'off')).toEqual([]);
    }
  });

  test('every notification has one of the three purposes (or the opt-in meeting reminder)', () => {
    for (const [id] of SCENARIOS_V20) for (const n of box(at(id))) expect(['needs-you', 'changed', 'handled', 'meeting']).toContain(n.purpose);
  });
});

describe('someone needs you → "I’ve got it" → handled for the person carrying it', () => {
  test('Ana asks; only Luis is notified; never the person who asked', () => {
    const notes = box(at('n-help'));
    expect(to(notes, LUIS).map((n) => [n.kind, n.title, n.body, n.actions])).toEqual([['help', 'Ana asked for a hand', 'Make dinner tonight · Start at 5:30 PM', ['got-it', 'not-tonight']]]);
    expect(to(notes, ANA)).toEqual([]);
  });

  test('I’ve got it: Luis’s agreement updates the shared plan; Ana hears it’s handled; Luis’s request is gone', () => {
    let s = at('n-help');
    const n = to(box(s), LUIS)[0];
    s = markSent(s, box(s), today, '14:30');
    s = gotIt(s, n, { today, people: DEMO_PEOPLE });
    expect(s.parts.find((p) => p.id === n.partId)).toMatchObject({ ownerId: LUIS, status: 'agreed' });
    const after = box(s);
    expect(to(after, LUIS).filter((x) => x.kind === 'help')).toEqual([]);
    expect(to(after, ANA).map((x) => [x.kind, x.title, x.purpose])).toEqual([['handled', 'Luis has it ✓', 'handled']]);
    // Both devices read the same plan: Luis's Today no longer asks, Ana's no longer offers backup.
    expect(buildTodayV19({ s: as(s, LUIS), monday, today, people: DEMO_PEOPLE }).card).toBeNull();
    expect(buildTodayV19({ s: as(s, ANA), monday, today, people: DEMO_PEOPLE }).card).toBeNull();
  });

  test('Not this time: Ana hears it still needs someone', () => {
    const s = at('n-help');
    const after = box(notTonight(s, to(box(s), LUIS)[0]));
    expect(to(after, ANA).map((x) => [x.kind, x.title])).toEqual([['declined', 'Luis can’t take it']]);
  });

  test('a handoff with no owner reaches every other adult, and "I’ve got it" makes it theirs', () => {
    let s = at('cascade');
    const c = buildTodayV19({ s, monday, today, people: DEMO_PEOPLE }).card!;
    const dinner = c.affected.find((a) => a.kind === 'dinner')!;
    s = applyChoices(s, c, { [dinner.id]: 'someone' }, { today, monday, viewer: ANA }).state;
    const handoff = to(box(s), LUIS).find((n) => n.kind === 'handoff')!;
    expect(handoff.body).toBe('Who can take “Help make dinner tonight”?');
    expect(to(box(s), ANA).some((n) => n.kind === 'handoff')).toBe(false);
    s = gotIt(s, handoff, { today, people: DEMO_PEOPLE });
    expect(s.parts.find((p) => p.id === handoff.partId)).toMatchObject({ ownerId: LUIS, status: 'agreed' });
  });
});

describe('something important changed', () => {
  test('an imminent conflict reaches the adult whose plan it is, in their own words', () => {
    const notes = box(at('n-conflict'));
    expect(to(notes, LUIS).map((n) => [n.kind, n.title, n.body])).toEqual([['conflict', 'Soccer starts an hour earlier.', 'Practice now starts when school ends. Your transportation plan needs adjusting.']]);
    expect(to(notes, ANA)).toEqual([]);
  });

  test('I’ve got it on a conflict: resolved for the household on both devices', () => {
    let s = at('n-conflict');
    s = markSent(s, box(s), today, '13:30');
    s = gotIt(s, to(box(s), LUIS)[0], { today, people: DEMO_PEOPLE });
    expect(to(box(s), LUIS).filter((n) => n.kind === 'conflict' && n.status !== 'sent')).toEqual([]);
    expect(buildTodayV19({ s: as(s, ANA), monday, today, people: DEMO_PEOPLE }).card).toBeNull();
    expect(buildTodayV19({ s: as(s, LUIS), monday, today, people: DEMO_PEOPLE }).card).toBeNull();
  });

  test('a shared agreement someone updated reaches the other adult, never the one who changed it', () => {
    const notes = box(at('n-changed'));
    expect(to(notes, ANA).map((n) => [n.title, n.body])).toEqual([['Luis updated a shared plan', 'Luis · Drive to soccer · Leave at 3:30 PM']]);
    expect(to(notes, LUIS)).toEqual([]);
  });

  test('updating a plan from Today records who changed it, so the other adult hears', () => {
    let s = at('change');
    const c = buildTodayV19({ s, monday, today, people: DEMO_PEOPLE }).card!;
    s = applyChoices(s, c, { [c.affected[0].id]: 'school' }, { today, monday, viewer: ANA }).state;
    expect(to(box(s), LUIS).map((n) => n.title)).toContain('Ana updated a shared plan');
  });
});

describe('privacy, targeting, dedupe, quiet hours, preferences', () => {
  test('Ana’s private work call never becomes a notification for Luis', () => {
    const notes = box(at('two-adults'));
    expect(JSON.stringify(to(notes, LUIS))).not.toMatch(/Client call|work meeting|backup/i);
  });

  test('the same facts never alert twice', () => {
    let s = at('n-help');
    s = markSent(s, box(s), today, '14:30');
    expect(to(box(s), LUIS)[0].status).toBe('sent');
  });

  test('quiet hours hold a request until morning (never drop it)', () => {
    const n = to(box(at('n-quiet')), LUIS)[0];
    expect(n).toMatchObject({ status: 'held', at: { time: '07:00' } });
    expect(n.body).toContain('tomorrow');
  });

  test('turning a purpose off is respected', () => {
    const s = at('n-help');
    const off = { ...s, intel: { ...s.intel!, notifyPrefs: { [LUIS]: { needsYou: false } } } };
    expect(to(box(off), LUIS)).toEqual([]);
  });

  test('Family Meeting reminder: off by default; when on, an hour before', () => {
    expect(box(at('quiet')).some((n) => n.kind === 'meeting')).toBe(false);
    const notes = box(at('n-meeting'));
    expect(notes.filter((n) => n.kind === 'meeting').map((n) => [n.to, n.status, n.at.time])).toEqual([[ANA, 'scheduled', '16:00'], [LUIS, 'scheduled', '16:00']]);
  });

  test('beyond the daily alert budget, non-urgent notices arrive without sound; urgent ones never wait', () => {
    let s = at('n-changed');
    const sent = Object.fromEntries(Array.from({ length: DAILY_ALERTS }, (_, i) => [`x${i}`, { to: ANA, date: today, time: '09:00', urgent: false }]));
    s = { ...s, intel: { ...s.intel!, sent } };
    expect(to(box(s), ANA)[0].status).toBe('quiet');
    let h = at('n-help');
    h = { ...h, intel: { ...h.intel!, sent: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`y${i}`, { to: LUIS, date: today, time: '09:00', urgent: false }])) } };
    expect(to(box(h), LUIS)[0].status).toBe('deliver');
  });

  test('computing notifications never changes the plan', () => {
    for (const [id] of SCENARIOS_V20) {
      const s = at(id);
      const before = JSON.stringify(s);
      box(s);
      expect(JSON.stringify(s)).toBe(before);
    }
  });
});

describe('illustration treatment', () => {
  test('every badge is a generated hand-drawn icon with a white interior, colored by meaning from the calendar palette', () => {
    const files = readdirSync('public/assets/icons/ofc/badges').filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', ''));
    expect(files.sort()).toEqual(Object.keys(BADGE_COLOR).sort());
    const palette = new Set<string>(monthColors.map((m) => m.hex));
    expect(Object.values(BADGE_COLOR).every((c) => palette.has(c))).toBe(true);
    for (const f of files) expect(readFileSync(`assets/icons/ofc/updatedicons/svg/${f}.svg`, 'utf8')).toContain('<path');
  });

  test('activities map to their illustration', () => {
    expect([badgeFor('Soccer practice'), badgeFor('School field trip'), badgeFor('Parent-teacher conference'), badgeFor('Dentist'), badgeFor('Zoe’s birthday party'), badgeFor('Piano lesson')])
      .toEqual(['move-play', 'school-bus', 'conversation-bubbles', 'toothbrush', 'wrapped-gift', 'calendar']);
  });
});

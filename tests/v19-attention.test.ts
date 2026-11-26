/**
 * V19 Today (docs/ios/V19_ATTENTION.md): maximum intelligence, minimum interruption. Scenario facts are simulated;
 * everything asserted here is computed by the real engine.
 */
import { describe, expect, test } from 'vitest';
import { addDays } from '../src/lib/calendar/recurrence';
import { ANA, LUIS, MATEO, SOFIA, agreedParts, mondayOf, signature, type Part, type V16State } from '../src/lib/v16/model';
import { SCENARIOS_V19, seedV19, demoToday, DEMO_PEOPLE, type ScenarioV19 } from '../src/lib/v19/scenarios';
import { buildTodayV19, matterRowsV19, cueTime, shortTitle } from '../src/lib/v19/engine';
import { WINDOW, agendaOf, pickCard, windowFor, type SmartInsight } from '../src/lib/v19/attention';
import { addFeedback, applyChoices, giveFeedback, markShown, talked } from '../src/lib/v19/resolve';
import { seedScenario as seedV18 } from '../src/lib/v18/scenarios';
import { buildToday } from '../src/lib/v18/engine';

const monday = mondayOf('2026-11-26');
const today = demoToday(monday);
const at = (id: ScenarioV19) => seedV19(id, { club: true, monday });
const run = (s: V16State, day = today) => buildTodayV19({ s, monday, today: day, people: DEMO_PEOPLE });
const as = (s: V16State, viewer: string) => ({ ...s, intel: { ...s.intel!, viewer } });
const words = (h: string) => h.replace(/[.’']/g, '').split(/\s+/).length;

describe('every scenario: a short headline, one card at most', () => {
  test.each(SCENARIOS_V19.map(([id]) => id))('%s', (id) => {
    const m = run(at(id));
    expect(words(m.headline)).toBeLessThanOrEqual(6);
    expect(m.headline).not.toMatch(/partway/);
    // The card is never repeated by the subline.
    if (m.card) expect(m.sub).toBeUndefined();
  });

  const EXPECT: Record<ScenarioV19, [string, string | null]> = {
    quiet: ['You’re on track.', null],
    change: ['A change of plans.', 'Soccer starts an hour earlier.'],
    cascade: ['A change of plans.', 'Thursday needs a little reshuffling.'],
    prep: ['A little preparation will help.', 'Tomorrow’s school field trip runs through lunch.'],
    handled: ['You’re on track.', null],
    transport: ['A little preparation will help.', 'Who’s driving to Saturday’s soccer game?'],
    backup: ['A little backup will help.', 'You could use some backup tonight.'],
    lighter: ['A change of plans.', 'Keep today simple.'],
    friction: ['You’re on track.', null],
    ownership: ['You’re on track.', null],
    intention: ['You’re on track.', 'Saturday might be a good day for this.'],
    season: ['You’re on track.', null],
    dismissed: ['You’re on track.', null],
    postponed: ['You’re on track.', null],
    'two-adults': ['A few things need attention.', 'You could use some backup tonight.'],
    consolidated: ['A little preparation will help.', 'Zoe’s birthday party on Saturday needs a few things.'],
    'low-value': ['You’re on track.', null],
    secondary: ['A few things need attention.', 'Soccer starts an hour earlier.'],
    meeting: ['Pick up where you left off.', null],
    'all-done': ['All set for today.', null],
    'ai-down': ['A little preparation will help.', 'Zoe’s party on Saturday may need an RSVP and a ride.'],
  };
  test.each(Object.entries(EXPECT))('%s: headline and card', (id, [h, card]) => {
    const m = run(at(id as ScenarioV19));
    expect(m.headline).toBe(h);
    expect(m.card?.title ?? null).toBe(card);
  });
});

describe('the heads-up card: each layer adds something', () => {
  test('a change: implication, not repetition', () => {
    const m = run(at('change'));
    expect(m.card).toMatchObject({ eyebrow: 'Changed since your meeting', body: 'Practice now starts when school ends. Luis’s transportation plan needs adjusting.', actionLabel: 'Adjust the plan' });
    expect(m.sub).toBeUndefined();
  });

  test('the resolution isolates the affected agreement; what’s done is reassurance only', () => {
    const c = run(at('change')).card!;
    expect(c.affected).toHaveLength(1);
    expect(c.affected[0]).toMatchObject({ question: 'How will Sofia get to soccer?', facts: ['School ends at 3 PM. Soccer practice now starts at 3 PM.'], current: { ownerId: LUIS, title: 'Drive to soccer', detail: 'Planned departure: 3:40 PM' } });
    expect(c.affected[0].options.map((o) => o.label)).toEqual(['Luis picks Sofia up from school and goes straight there', 'Let the coach know Sofia will be a few minutes late', 'Make another plan']);
    expect(c.reassurance).toEqual(['Sofia’s soccer bag is already packed ✓']);
  });

  test('options never assume an adult is free: nothing offers Ana for the drive', () => {
    const c = run(at('change')).card!;
    expect(c.affected.flatMap((a) => a.options.map((o) => o.label)).join(' ')).not.toMatch(/Ana/);
  });

  test('one category per state of the same card (eyebrows)', () => {
    const eyebrows = new Set(SCENARIOS_V19.map(([id]) => run(at(id)).card?.eyebrow).filter(Boolean));
    expect([...eyebrows].every((e) => ['A little heads-up', 'Changed since your meeting', 'One loose end', 'Looking ahead', 'Helping each other', 'Something we’ve noticed', 'A good opportunity', 'Worth celebrating', 'Looking a little further ahead'].includes(e!))).toBe(true);
  });
});

describe('A · cascading consequences: one change, one insight', () => {
  test('later practice affects the drive, dinner help and a cleaning zone, together', () => {
    const m = run(at('cascade'));
    expect(m.all.filter((i) => i.category === 'changed')).toHaveLength(1);
    expect(m.card!.body).toBe('Later soccer practice affects Luis’s drive, dinner preparation and Sofia’s cleaning zone.');
    expect(m.card!.affected.map((a) => a.kind)).toEqual(['ride', 'dinner', 'cleaning']);
    expect(m.card!.affected[0].options[0].label).toBe('Leave at 5:10 PM instead');
    expect(m.card!.actionLabel).toBe('Review what’s affected');
  });

  test('Ana’s own dinner (she isn’t at practice) is not dragged in', () => {
    expect(run(at('cascade')).card!.affected.some((a) => a.partId === 'p-dinner-thu')).toBe(false);
  });
});

describe('Level 3: resolving reduces the work, through existing workflows', () => {
  test('nothing changes until "Update our plan"', () => {
    const s = at('change');
    expect(s.parts.find((p) => p.id === 'p-drive-soccer')!.cue).toBe('Leave at 3:40 PM');
  });

  test('choosing the school pickup edits and re-agrees the same agreement, and the card is resolved', () => {
    const s = at('change');
    const c = run(s).card!;
    const { state } = applyChoices(s, c, { [c.affected[0].id]: 'school' }, { today, monday, viewer: ANA });
    const p = state.parts.find((x) => x.id === 'p-drive-soccer')!;
    expect(p).toMatchObject({ status: 'agreed', ownerId: LUIS, cue: 'Pick up at 3 PM', agreedSignature: signature(p) });
    expect(run(state).card).toBeNull();
  });

  test('moving the cleaning zone uses the cleaning companion’s one-week move', () => {
    const s = at('cascade');
    const c = run(s).card!;
    const clean = c.affected.find((a) => a.kind === 'cleaning')!;
    const { state } = applyChoices(s, c, { [clean.id]: 'move' }, { today, monday, viewer: ANA });
    expect(state.cleaning.moved[monday]).toEqual({ 4: 5 });
  });

  test('asking someone else is a Suggested part they still agree to; volunteering yourself is your own agreement', () => {
    const s = at('backup');
    const c = run(s).card!;
    const ask = applyChoices(s, c, { [c.affected[0].id]: `ask-${LUIS}` }, { today, monday, viewer: ANA });
    const handoff = ask.state.parts.find((p) => p.askedBy === ANA)!;
    expect(handoff).toMatchObject({ ownerId: LUIS, status: 'suggested', onDate: today });
    // Luis now sees one loose end: Ana's request, his to answer.
    const luis = run(as(ask.state, LUIS));
    expect(luis.card?.title).toBe('Ana asked if you can take dinner tonight.');
  });
});

describe('B · backup, from known commitments only, private stays private', () => {
  test('Ana’s private work call overlaps her dinner: Ana sees it, Luis never does', () => {
    const s = at('backup');
    expect(run(s).card?.body).toBe('Your work meeting runs through dinner preparation. Could someone else take the lead tonight?');
    const luis = run(as(s, LUIS));
    expect(luis.card).toBeNull();
    expect(JSON.stringify(luis)).not.toMatch(/Client call|work meeting/);
  });

  test('a reported "work is running late" is shared, and the other adult can offer', () => {
    let s = at('quiet');
    s = { ...s, intel: { ...s.intel!, reports: [{ date: today, kind: 'work-late', by: ANA }] } };
    const luis = run(as(s, LUIS)).card!;
    expect(luis.title).toBe('Ana could use some backup tonight.');
    expect(luis.affected[0].options[0].label).toBe('I’ll take dinner tonight');
  });
});

describe('C · "Something changed?" → keep today simple', () => {
  test('flexible things only; activities stay', () => {
    const c = run(at('lighter')).card!;
    expect(c.body).toBe('Consider postponing the kitchen zone and keeping dinner easy.');
    expect(c.reassurance).toEqual(['School and activities stay on the calendar.']);
    expect(c.affected.flatMap((a) => a.options).some((o) => o.effect.type === 'edit')).toBe(false);
  });

  test('someone sick: backup for their part today', () => {
    let s = at('quiet');
    s = { ...s, parts: s.parts.map((p) => (p.id === 'p-dinner-thu' ? p : p)), intel: { ...s.intel!, reports: [{ date: today, kind: 'sick', memberId: LUIS, by: ANA }] } };
    const c = run(s).card!;
    expect(c.title).toBe('Keep today simple.');
    expect(c.body).toContain('arranging backup for drive to soccer');
  });
});

describe('D–G · routed to the meeting, not to Today', () => {
  test('recurring friction needs three late/moved occurrences, and goes to the meeting', () => {
    const m = run(at('friction'));
    expect(m.card).toBeNull();
    expect(m.agenda.map((i) => i.title)).toEqual(['Wednesday mornings keep getting tight.']);
    expect(m.agenda[0].body).toBe('“Pack backpack” has been moved or finished late three Wednesdays in a row. Would Tuesday evening work better?');
    const two = at('friction');
    const fewer = { ...two, intel: { ...two.intel!, history: two.intel!.history!.slice(0, 2) } };
    expect(run(fewer).agenda).toHaveLength(0);
  });

  test('ownership comes from family check-ins about ownership, never from checkboxes', () => {
    const m = run(at('ownership'));
    expect(m.agenda[0]).toMatchObject({ title: 'One less thing to remember.', body: 'Sofia has handled “Pack soccer bag” without reminders for the past four weeks, according to your family check-ins.' });
    expect(m.agenda[0].body).not.toMatch(/model|assist|watch|launch|stage|score/i);
    // Performance-only check-ins never count as ownership.
    const s = at('ownership');
    const perf = { ...s, records: s.records.map((r) => ({ ...r, history: r.history.map((h) => ({ ...h, signal: 'performance' as const })) })) };
    expect(run(perf).agenda.some((i) => i.title === 'One less thing to remember.')).toBe(false);
  });

  test('seasonal transitions only from the family’s calendar', () => {
    expect(run(at('season')).agenda.map((i) => i.title)).toEqual(['Winter break is about three weeks away.']);
    expect(run(at('quiet')).agenda).toHaveLength(0);
  });

  test('preparation before its useful window goes to the meeting that precedes it', () => {
    const m = run(at('postponed'));
    expect(m.card).toBeNull();
    expect(m.agenda[0]).toMatchObject({ title: 'Lily’s birthday party next Saturday needs a few things.', category: 'looking-ahead' });
  });

  test('agenda caps: one ownership/development and one routine idea per meeting', () => {
    const fake = (k: string, kind: SmartInsight['meetingKind']) => ({ key: k, meetingKind: kind, worth: 0.5 }) as SmartInsight;
    const { agenda, over } = agendaOf([fake('a', 'development'), fake('b', 'development'), fake('c', 'routine'), fake('d', 'routine'), fake('e', 'season')], new Set());
    expect(agenda.map((i) => i.key)).toEqual(['e', 'a', 'c']);
    expect(over).toHaveLength(2);
  });

  test('talked about it at the meeting: it leaves the agenda', () => {
    const s = at('season');
    const k = run(s).agenda[0].key;
    expect(run(talked(s, k, today)).agenda).toHaveLength(0);
  });
});

describe('E · undated intentions', () => {
  test('an idea meets a real open morning: offered, never booked', () => {
    const s = at('intention');
    const c = run(s).card!;
    expect(c.body).toBe('Sofia mentioned wanting to learn to make breakfast. Saturday morning has nothing scheduled.');
    expect(s.extraEvents).toHaveLength(0);
    const { state } = applyChoices(s, c, { [c.affected[0].id]: 'plan' }, { today, monday, viewer: ANA });
    expect(state.extraEvents.map((e) => [e.title, e.starts_on, e.start_time])).toEqual([['Learn to make breakfast', addDays(monday, 5), '09:00']]);
  });

  test('a busy Saturday morning moves the opportunity, it never forces one', () => {
    const s = at('intention');
    const busy = { ...s, extraEvents: [{ id: 'x', title: 'Swim meet', starts_on: addDays(monday, 5), start_time: '08:00', end_time: '12:00', member_ids: [SOFIA], timezone: 'America/Chicago', revision: 1 }] };
    expect(run(busy).card?.title ?? '').not.toContain('Saturday');
  });
});

describe('timing: the intended weekly rhythm', () => {
  // Sunday meeting: gift (Luis, by Thursday) and ride agreed for Saturday's party.
  const party = (): V16State => {
    const s = at('quiet');
    const agree = (p: Part): Part => ({ ...p, status: 'agreed', agreedOn: addDays(monday, -1), agreedSignature: signature(p) });
    return {
      ...s, extraEvents: [{ id: 'e-party', title: 'Zoe’s birthday party', starts_on: addDays(monday, 5), start_time: '14:00', end_time: '16:00', member_ids: [MATEO], timezone: 'America/Chicago', revision: 1, source: 'manual' }],
      parts: [...s.parts, agree({ id: 'g', origin: 'prepared', title: 'Get a gift for Zoe', ownerId: LUIS, finishLine: '', eventLink: 'e-party', offsetDays: -2, need: 'gift', status: 'suggested' }),
        agree({ id: 'r', origin: 'prepared', title: 'RSVP to the party', ownerId: ANA, finishLine: '', eventLink: 'e-party', offsetDays: -3, need: 'rsvp', status: 'suggested', done: true }),
        agree({ id: 'c', origin: 'prepared', title: 'Make a birthday card', ownerId: MATEO, finishLine: '', eventLink: 'e-party', offsetDays: -1, need: 'card', status: 'suggested' }),
        agree({ id: 'd', origin: 'prepared', title: 'Drive to the party', ownerId: LUIS, finishLine: '', eventLink: 'e-party', offsetDays: 0, need: 'ride', status: 'suggested' })],
    };
  };
  const card = (s: V16State, day: string, viewer = LUIS) => run(as(s, viewer), day).card?.key ?? null;
  test('Monday and Tuesday: nothing; the family has a plan', () => {
    expect(card(party(), addDays(monday, 0))).toBeNull();
    expect(card(party(), addDays(monday, 1))).toBeNull();
  });
  test('Wednesday: the gift is due tomorrow and not done: a gentle heads-up to Luis only', () => {
    expect(card(party(), addDays(monday, 2))).toMatch(/^due:g:/);
    expect(card(party(), addDays(monday, 2), ANA)).toBeNull();
  });
  test('Thursday: gift done → quiet', () => {
    const s = party();
    expect(card({ ...s, parts: s.parts.map((p) => (p.id === 'g' ? { ...p, done: true } : p)) }, addDays(monday, 3))).toBeNull();
  });
  test('Saturday: everything ready → quiet', () => {
    const s = party();
    expect(card({ ...s, parts: s.parts.map((p) => ({ ...p, done: true })) }, addDays(monday, 5))).toBeNull();
  });
  test('preparation windows differ by need (not one reminder window)', () => {
    expect(WINDOW.lunch).toBe(0);
    expect(WINDOW.gift).toBeGreaterThan(WINDOW.card);
    expect(WINDOW.childcare).toBeGreaterThanOrEqual(14);
  });
});

describe('attention budget', () => {
  test('dismissing one never reveals another low-priority card the same day', () => {
    const m = run(at('low-value'));
    expect(m.card).toBeNull();
    expect(m.suppressed.map((x) => x.gate)).toEqual(expect.arrayContaining(['dismissed', 'budget']));
  });

  test('a family that handles a need on its own: quietly remembered, not suggested', () => {
    const m = run(at('low-value'));
    expect(m.remembered.some((x) => x.insight.key.startsWith('need:e-game') && x.why === 'You handle this on your own.')).toBe(true);
  });

  test('an unchanged non-urgent insight is a card once; the next day it is a quiet line', () => {
    const s = at('intention');
    const first = run(s).card!;
    const seen = markShown(s, first, addDays(today, -1));
    expect(run(seen).card).toBeNull();
    expect(run(seen).suppressed.find((x) => x.insight.key === first.key)?.gate).toBe('seen');
  });

  test('urgent things are never held by a number: a second urgent issue stays reachable on its row', () => {
    const m = run(at('secondary'));
    expect(m.card!.category).toBe('changed');
    expect(m.attention['fieldtrip@lincoln'].text).toBe('Lunch still needs a plan.');
  });

  test('pickCard: nothing passes → no card (comfortable saying nothing)', () => {
    const low = { key: 'x', urgent: false, actionable: true, worth: 0.3, relevance: 0.5, fingerprint: 'f' } as SmartInsight;
    expect(pickCard([low], { today, viewer: ANA, meetingDate: null, feedback: [], shown: {} }, false).card).toBeNull();
  });
});

describe('learning from dismissal and resolution', () => {
  test('plain dismiss: same facts stay dismissed; the attention line stays', () => {
    const m = run(at('dismissed'));
    expect(m.card).toBeNull();
    expect(m.attention['fieldtrip@lincoln']).toBeDefined();
  });

  test('remind us later: hidden until its useful window, then back', () => {
    const s = at('intention');
    const c = run(s).card!;
    const later = giveFeedback(s, c, 'later', today);
    const until = later.intel!.feedback!.find((f) => f.kind === 'later')!.until!;
    expect(run(later).card).toBeNull();
    expect(run(later, until).card?.key ?? run(later, until).all.find((i) => i.key === c.key)?.key).toBeTruthy();
  });

  test('don’t suggest this again: that pattern stops; a calendar change still always counts', () => {
    const s = at('prep');
    const c = run(s).card!;
    expect(run(giveFeedback(s, c, 'never', today)).card).toBeNull();
    const ch = at('change');
    const cc = run(ch).card!;
    expect(run(addFeedback(ch, cc, 'never', today)).card?.key).toBe(cc.key);
  });

  test('not relevant to our family: remembered as "not needed" for that kind of activity (correctable)', () => {
    const s = at('ai-down');
    const c = run(s).card!;
    const after = giveFeedback(s, c, 'not-relevant', today);
    expect(after.intel!.memory.confirmed.map((m) => [m.eventKind, m.need, m.effect])).toEqual(expect.arrayContaining([['party', 'rsvp', 'not-needed'], ['party', 'ride', 'not-needed']]));
  });

  test('already handled twice → that need gets a later window; accepted twice → earlier; the family’s own setting wins', () => {
    const fb = (kind: 'handled' | 'accepted') => [1, 2].map((n) => ({ key: `k${n}`, fingerprint: 'f', pattern: 'need:party:gift', kind, on: today }));
    expect(windowFor('gift', fb('handled'))).toBe(0);
    expect(windowFor('gift', fb('accepted'))).toBe(WINDOW.gift + 2);
    expect(windowFor('gift', [], 'fewer')).toBe(0);
    expect(windowFor('gift', [fb('handled')[0]])).toBe(WINDOW.gift);
  });
});

describe('What matters, ordered for today', () => {
  test('unresolved and today first; earlier this week recedes', () => {
    const s = at('secondary');
    const inp = { s, monday, today, people: DEMO_PEOPLE };
    const { rows, earlier } = matterRowsV19(inp, run(s));
    expect(rows.map((r) => [r.occ.event.title, r.group])).toEqual([['Soccer practice', 1], ['School field trip', 1]]);
    expect(earlier.map((r) => r.occ.event.title)).toEqual(['Parent-teacher conference', 'Dentist']);
  });

  test('every agreed priority stays reachable', () => {
    const s = at('quiet');
    const { rows, earlier } = matterRowsV19({ s, monday, today, people: DEMO_PEOPLE }, run(s));
    expect([...rows, ...earlier].map((r) => r.link).sort()).toEqual(['e-conf', 'e-dentist', 'fieldtrip@lincoln', 'practice@riverside-fc']);
  });
});

describe('never decides for the family; isolation; stale data; AI failure', () => {
  test('building Today changes nothing', () => {
    for (const [id] of SCENARIOS_V19) {
      const s = at(id);
      const before = JSON.stringify(s);
      run(s);
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  test('agreements and events are never edited by the engine', () => {
    const s = at('cascade');
    const before = agreedParts(s).map((p) => signature(p));
    run(s);
    expect(agreedParts(s).map((p) => signature(p))).toEqual(before);
  });

  test('stale data: no baseline, no change insights, never an error', () => {
    const s = at('change');
    expect(() => run({ ...s, intel: { ...s.intel!, baseline: null } })).not.toThrow();
    expect(run({ ...s, intel: { ...s.intel!, baseline: null } }).all.some((i) => i.category === 'changed')).toBe(false);
  });

  test('stale data: an expired insight is suppressed', () => {
    const s = at('prep');
    expect(run(s, addDays(monday, 6)).card).toBeNull();
  });

  test('V18 behaves exactly as before (no V19 state)', () => {
    const s = seedV18('changed', { club: true, monday });
    expect(s.intel!.feedback).toBeUndefined();
    expect(buildToday({ s, monday, today, people: DEMO_PEOPLE }).headline).toBe('Your plans have changed.');
  });

  test('AI unavailable: the core Today still works from the rules', () => {
    expect(run(at('ai-down')).card!.source).toBe('rules');
  });

  test('helpers', () => {
    expect(cueTime('Leave at 3:40 PM')).toBe('15:40');
    expect(cueTime('After dinner, 6:30 PM')).toBe('18:30');
    expect(cueTime('Before school')).toBeNull();
    expect(shortTitle('Soccer practice')).toBe('Soccer');
  });
});

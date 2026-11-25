// V16 experiment (docs/ios/V16_EXPERIMENT.md): the preview's rules. State honesty, agreement invalidation, event
// prep that follows its event, privacy, cleaning moves that don't fork, MAWL invisible, priorities capped.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/calendar/recurrence';
import { MAWL_STAGES } from '../src/lib/family-development/framework';
import { STAGE_SHORT } from '../src/lib/family-development/language';
import { buildFamilyMeeting } from '../src/lib/club/family-meeting';
import { ANA, LUIS, MATEO, SOFIA, colorsFor, demoHousehold, demoProfile } from '../src/lib/v16/demo';
import {
  MAX_PER_WEEK, addNotePriority, currentPriorities, decide, eventsFor, missingReason, mondayOf, moveSession, partDate, partReducer, practiceQuestions,
  seed, sessionDay, sessionsOn, sharedOccurrences, statusLabel, togglePriority, weekOccurrences, type V16State,
} from '../src/lib/v16/model';

const TODAY = '2026-11-25'; // a Wednesday
const MON = mondayOf(TODAY);
const names = { [ANA]: 'Ana', [LUIS]: 'Luis', [SOFIA]: 'Sofia', [MATEO]: 'Mateo', 'm-elena': 'Elena' };
const kids = new Set([SOFIA, MATEO, 'm-elena']);
const first = () => seed('first', { club: true, adults: 'two', today: TODAY });
const week4 = () => seed('week4', { club: true, adults: 'two', today: TODAY });
const part = (s: V16State, id: string) => s.parts.find((p) => p.id === id)!;
const apply = (s: V16State, a: Parameters<typeof partReducer>[1]): V16State => ({ ...s, parts: partReducer(s.parts, a, s.online) });

describe('first week: suggestions are not agreements', () => {
  it('a Thursday soccer practice prepares a Wednesday soccer-bag suggestion, labeled Suggested', () => {
    const s = first();
    const bag = part(s, 'p-soccer-bag');
    expect(bag.status).toBe('suggested');
    expect(statusLabel(bag)).toBe('Suggested');
    expect(partDate(s, MON, bag)).toBe(addDays(MON, 2)); // Wednesday
    expect(sharedOccurrences(s, MON).find((o) => o.event.title === 'Soccer practice')!.date).toBe(addDays(MON, 3)); // Thursday
  });
  it('Keep is not consent; only We agree makes an agreement', () => {
    let s = apply(first(), { type: 'keep', id: 'p-soccer-bag' });
    expect(part(s, 'p-soccer-bag').status).toBe('kept');
    expect(statusLabel(part(s, 'p-soccer-bag'))).toBe('Kept for discussion');
    s = apply(s, { type: 'agree', id: 'p-soccer-bag', today: TODAY });
    expect(part(s, 'p-soccer-bag').status).toBe('agreed');
    expect(part(s, 'p-soccer-bag').agreedOn).toBe(TODAY);
  });
  it('editing owner, task or finish line of an agreement invalidates it until agreed again', () => {
    let s = apply(apply(first(), { type: 'keep', id: 'p-soccer-bag' }), { type: 'agree', id: 'p-soccer-bag', today: TODAY });
    for (const patch of [{ ownerId: MATEO }, { title: 'Pack the bag' }, { finishLine: 'Bag by the door' }, { offsetDays: -2 }]) {
      const t = apply(s, { type: 'edit', id: 'p-soccer-bag', patch });
      expect(part(t, 'p-soccer-bag').status).toBe('kept');
      expect(statusLabel(part(t, 'p-soccer-bag'))).toBe('Changed · agree again');
    }
    s = apply(s, { type: 'edit', id: 'p-soccer-bag', patch: { ownerId: MATEO } });
    s = apply(s, { type: 'agree', id: 'p-soccer-bag', today: TODAY });
    expect(part(s, 'p-soccer-bag')).toMatchObject({ status: 'agreed', ownerId: MATEO, changedSinceAgreed: false });
  });
  it('an agreement needs an owner', () => {
    let s = apply(first(), { type: 'edit', id: 'p-soccer-bag', patch: { ownerId: null } });
    s = apply(s, { type: 'agree', id: 'p-soccer-bag', today: TODAY });
    expect(part(s, 'p-soccer-bag').status).not.toBe('agreed');
  });
  it('Skip never removes the calendar event', () => {
    const s = apply(first(), { type: 'skip', id: 'p-soccer-bag' });
    expect(part(s, 'p-soccer-bag').status).toBe('skipped');
    expect(weekOccurrences(s, MON).some((o) => o.event.title === 'Soccer practice')).toBe(true);
  });
  it('done exists only on agreed preparation, never on a suggestion or a standing agreement', () => {
    let s = apply(first(), { type: 'toggle-done', id: 'p-soccer-bag' });
    expect(part(s, 'p-soccer-bag').done).toBeFalsy();
    s = apply(apply(s, { type: 'agree', id: 'p-entry', today: TODAY }), { type: 'toggle-done', id: 'p-entry' });
    expect(part(s, 'p-entry').done).toBeFalsy();
    s = apply(apply(s, { type: 'agree', id: 'p-soccer-bag', today: TODAY }), { type: 'toggle-done', id: 'p-soccer-bag' });
    expect(part(s, 'p-soccer-bag').done).toBe(true);
  });
  it('offline agreements are marked as waiting to share, not silently synced', () => {
    const s = apply({ ...first(), online: false }, { type: 'agree', id: 'p-soccer-bag', today: TODAY });
    expect(statusLabel(part(s, 'p-soccer-bag'))).toBe('Agreed · waiting to share');
  });
});

describe('preparation follows its event', () => {
  it('moved to Friday → the bag moves to Thursday; cancelled → no date, reason given, agreement kept', () => {
    const moved = { ...first(), soccer: 'moved' as const };
    expect(partDate(moved, MON, part(moved, 'p-soccer-bag'))).toBe(addDays(MON, 3));
    const cancelled = { ...first(), soccer: 'cancelled' as const };
    expect(partDate(cancelled, MON, part(cancelled, 'p-soccer-bag'))).toBeNull();
    expect(missingReason(cancelled, MON, 'practice@riverside-fc')).toBe('cancelled');
    expect(part(cancelled, 'p-soccer-bag').status).toBe('suggested');
  });
  it('week four: a Friday field trip prepares a Thursday lunch, awaiting its own decision', () => {
    const s = week4();
    expect(part(s, 'p-lunch').status).toBe('suggested');
    expect(partDate(s, MON, part(s, 'p-lunch'))).toBe(addDays(MON, 3));
  });
});

describe('privacy', () => {
  it("Luis's private calendar never reaches Ana's phone; Ana's private one is never on the shared plan", () => {
    const s = first();
    expect(eventsFor(s, MON).some((e) => e.id === 'e-luis-private')).toBe(false);
    expect(weekOccurrences(s, MON).some((o) => o.event.id === 'e-ana-work')).toBe(true);
    expect(sharedOccurrences(s, MON).some((o) => o.event.id === 'e-ana-work')).toBe(false);
  });
  it('making a shared calendar private hides its preparation from the shared plan, with a reason', () => {
    const s = { ...first(), feedVisibility: { 'feed-riverside': 'private' as const } };
    expect(sharedOccurrences(s, MON).some((o) => o.event.title === 'Soccer practice')).toBe(false);
    expect(partDate(s, MON, part(s, 'p-soccer-bag'))).toBeNull();
    expect(missingReason(s, MON, 'practice@riverside-fc')).toBe('private');
  });
});

describe('Our Focus', () => {
  it('nothing is highlighted automatically; five at most', () => {
    let s = first();
    expect(currentPriorities(s)).toEqual([]);
    for (const l of ['a', 'b', 'c', 'd', 'e', 'f']) s = { ...s, priorities: togglePriority(s, l) };
    expect(s.priorities).toHaveLength(MAX_PER_WEEK);
    s = { ...s, priorities: addNotePriority(s, 'Grandma visits') };
    expect(s.priorities).toHaveLength(MAX_PER_WEEK);
  });
  it("week four carries last meeting's focus until the family chooses again", () => {
    let s = week4();
    expect(currentPriorities(s).map((p) => p.from)).toEqual(['last-meeting']);
    s = { ...s, priorities: togglePriority(s, 'e-conf') };
    expect(currentPriorities(s).map((p) => p.eventLink)).toEqual(['e-conf']);
  });
});

describe('week four: agreements carry forward', () => {
  it('earlier agreements are in force without re-approval', () => {
    const s = week4();
    for (const id of ['p-soccer-bag', 'p-entry', 'p-trash']) expect(part(s, id).status).toBe('agreed');
    expect(part(s, 'p-entry').agreedOn! < MON).toBe(true);
  });
});

describe("Let's Practice: one natural question, engine rules, no stages", () => {
  it('asks only about agreed responsibilities, and never about one a child already owns', () => {
    const qs = practiceQuestions(week4(), names, kids);
    expect(qs.map((q) => q.memberId)).toEqual([MATEO]); // Sofia owns hers: not asked
    expect(qs[0].text).toBe('Could Mateo try “Put shoes and bags away” without help?');
    expect(qs[0].choices.map((c) => c.label)).toEqual(['Let’s try', 'Keep helping']);
    expect(practiceQuestions(first(), names, kids)).toEqual([]); // nothing agreed yet
  });
  it('a decision goes through the engine and is remembered; nothing advances on its own', () => {
    const s = week4();
    const q = practiceQuestions(s, names, kids)[0];
    const stayed = decide(s, q, q.choices.find((c) => c.decision === 'stay')!, TODAY).find((r) => r.memberId === MATEO)!;
    expect(stayed.stage).toBe('assist');
    const tried = decide(s, q, q.choices.find((c) => c.decision === 'advance')!, TODAY).find((r) => r.memberId === MATEO)!;
    expect(tried.stage).toBe('watch');
    expect(tried.history.at(-1)).toMatchObject({ decision: 'advance', fromStage: 'assist', toStage: 'watch' });
  });
  it('a new agreement asks how much help, in plain words', () => {
    const s = apply(first(), { type: 'agree', id: 'p-entry', today: TODAY });
    const q = practiceQuestions(s, names, kids)[0];
    expect(q.text).toMatch(/^How much help will Mateo need/);
  });
  it('the V16 screens never import stage labels (the browser check also scans rendered text)', () => {
    for (const f of readdirSync('src/components/v16')) {
      const text = readFileSync(`src/components/v16/${f}`, 'utf8');
      expect(text, f).not.toMatch(/STAGE_SHORT|MAWL_LABEL|MAWL_STAGES/);
      for (const w of Object.values(STAGE_SHORT).filter((x) => x !== 'Together')) expect(text, f).not.toContain(`>${w}<`);
    }
    expect(MAWL_STAGES).toHaveLength(4);
  });
});

describe('cleaning: one session, one check', () => {
  it('moving Wednesday to Saturday moves the same session this week only', () => {
    const s0 = first();
    const s = { ...s0, cleaning: { ...s0.cleaning, moved: moveSession(s0, MON, 3, 6), checks: { [`zone:${MON}:3:wed-shoes`]: true as const } } };
    expect(sessionDay(s, MON, 3)).toBe(6);
    expect(sessionsOn(s, MON, 6)).toEqual([3]);
    expect(sessionsOn(s, MON, 3)).toEqual([]);
    expect(s.cleaning.checks[`zone:${MON}:3:wed-shoes`]).toBe(true); // same key wherever it happens
    expect(sessionDay(s, addDays(MON, 7), 3)).toBe(3); // next week: back to normal
  });
  it('one main cleaning day gathers every zone; off shows none', () => {
    const s0 = first();
    expect(sessionsOn({ ...s0, cleaning: { ...s0.cleaning, mode: 'one-day', mainDay: 6 } }, MON, 6)).toEqual([1, 2, 3, 4]);
    expect(sessionsOn({ ...s0, cleaning: { ...s0.cleaning, mode: 'off' } }, MON, 3)).toEqual([]);
  });
});

describe('household, colors, Club', () => {
  it('colors come from the saved household map and differ per person', () => {
    const c = colorsFor(demoHousehold('two'));
    expect(c[SOFIA].id).toBe('purple');
    expect(new Set(Object.values(c).map((x) => x.hex)).size).toBe(5);
  });
  it('a one-adult household has no partner and the adult owns adult preparation', () => {
    const s = seed('first', { club: false, adults: 'one', today: TODAY });
    expect(demoHousehold('one').members.some((m) => m.id === LUIS)).toBe(false);
    expect(part(s, 'p-pickup').ownerId).toBe(ANA);
  });
  it("the Club month's real content builds for the demo family", () => {
    const m = buildFamilyMeeting({ household: demoHousehold('two'), profile: demoProfile(), month: '2026-11' });
    expect(m.theme).toBe('Owning a complete responsibility');
    expect(m.talk.questions.length).toBeGreaterThan(0);
    expect(m.practice.steps.length).toBeGreaterThan(0);
  });
});

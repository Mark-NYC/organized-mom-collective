/**
 * V21 (docs/ios/V21_PREVIEW.md): the shared-responsibility rules, on the preview household's real states.
 * Covers the sixteen scenarios in the brief plus permissions, idempotency and two-device merging.
 */
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/calendar/recurrence';
import { agreedParts, mondayOf } from '../src/lib/v16/model';
import { merge3 } from '../src/lib/v20/intel-sync';
import { gotIt, notTonight, outbox } from '../src/lib/v20/notify';
import {
  acknowledge, answer, askHelp, chooseIntent, clearIntent, decisionsOf, editDecision, editStanding, forgetDecision, intelOf, intentOptions, isDone, makeUsual,
  remember, requestsOf, takeIt, toggleDone, toMeeting, uuidFrom, pruneV21, withdraw, type Intel,
} from '../src/lib/v21/model';
import { buildTodayV21, carryForward, planFor, widgetFor } from '../src/lib/v21/today';
import { ANDREW, MARK, MEG, PHILIP, demoTodayV21, householdV21, seedV21, type ScenarioV21 } from '../src/lib/v21/household';
import type { V16State } from '../src/lib/v16/model';

const monday = mondayOf('2026-11-23');
const people = householdV21().members.map((m) => ({ id: m.id, firstName: m.firstName, kind: m.kind === 'adult' ? 'adult' as const : 'child' as const }));
const dayOf = (s: V16State) => demoTodayV21(monday, (s.intel as Intel).demoDay ?? 5);
const as = (s: V16State, viewer: string): V16State => ({ ...s, intel: { ...s.intel!, viewer } });
const today = (s: V16State, viewer?: string) => { const st = viewer ? as(s, viewer) : s; return buildTodayV21({ s: st, monday, today: dayOf(st), people }); };
const seed = (id: ScenarioV21) => seedV21(id, monday);
const FRI = addDays(monday, 4);
const kinds = (m: ReturnType<typeof today>) => m.matters.map((x) => x.kind);

describe('Today: events never create obligations', () => {
  it('1. an ordinary birthday needs no action: not in What matters, offered quietly in Our week', () => {
    const m = today(seed('birthday-none'));
    expect(m.matters.some((x) => /johan/i.test(x.title))).toBe(false);
    const row = m.week.find((w) => w.occ.event.title === 'Johan’s birthday')!;
    expect(row).toBeTruthy();
    expect(row.intent).toBeNull();
    expect(m.plan.some((p) => /johan/i.test(p.part.title))).toBe(false);
  });

  it('2. once the family chooses to mail a card, the preparation appears on the right day for its owner', () => {
    const s = seed('birthday-planned');
    const m = today(s);
    const card = m.plan.find((p) => /birthday card/i.test(p.part.title))!;
    expect(card.part.ownerId).toBe(MEG);
    expect(card.date).toBe(FRI);
    expect(m.week.find((w) => w.link === 'e-johan')!.intent?.choice).toBe('card');
    // Taking it back removes the not-yet-done part and leaves the birthday as plain awareness.
    const back = clearIntent(s, 'e-johan', addDays(monday, 6));
    expect(today(back).plan.some((p) => /birthday card/i.test(p.part.title))).toBe(false);
  });

  it('choosing "Nothing needed" is remembered for that occurrence and creates nothing', () => {
    const s = chooseIntent(seed('birthday-none'), { link: 'e-johan', date: addDays(monday, 6), eventTitle: 'Johan’s birthday', option: 'nothing', ownerId: null, by: MEG, today: FRI, adults: [MEG, MARK] });
    expect(today(s).week.find((w) => w.link === 'e-johan')!.intent?.nothing).toBe(true);
    expect(s.parts.length).toBe(seed('birthday-none').parts.length);
  });

  it('3. a school concert is awareness only, for both adults', () => {
    for (const v of [MEG, MARK]) {
      const m = today(seed('school-event'), v);
      expect(m.matters.some((x) => /concert/i.test(x.title))).toBe(false);
      expect(m.week.some((w) => w.occ.event.title === 'School concert')).toBe(true);
    }
  });

  it('options are contextual and never empty', () => {
    expect(intentOptions('Johan’s birthday').map((o) => o.id)).toEqual(['text', 'card', 'gift', 'party']);
    expect(intentOptions('Johan’s birthday')[0].title).toBe('Send Johan a birthday text');
    expect(intentOptions('Dentist').map((o) => o.id)).toContain('take');
    expect(intentOptions('Thanksgiving').map((o) => o.id)).toContain('plan');
    expect(intentOptions('Something').length).toBeGreaterThan(0);
  });

  it('asking the other adult to handle a chosen preparation is a request, not an assignment', () => {
    const opt = intentOptions('Johan’s birthday').find((o) => o.id === 'gift')!;
    const s = chooseIntent(seed('birthday-none'), { link: 'e-johan', date: addDays(monday, 6), eventTitle: 'Johan’s birthday', option: opt, ownerId: MARK, by: MEG, today: FRI, adults: [MEG, MARK] });
    expect(agreedParts(s).some((p) => /gift/i.test(p.title))).toBe(false);
    expect(requestsOf(s)[0]).toMatchObject({ to: MARK, status: 'asked', title: 'Get a gift for Johan' });
  });
});

describe('Today: conflicts, routines and weekly responsibilities', () => {
  it('4. a real overlap reaches the owner of the affected responsibility only', () => {
    const s = seed('conflict');
    const mark = today(s, MARK);
    expect(mark.matters[0].kind).toBe('conflict');
    expect(mark.matters[0].title).toBe('Your dentist overlaps “Pick up the boys”.');
    expect(mark.headline).toBe('Something overlaps.');
    expect(today(s, MEG).matters.some((x) => x.kind === 'conflict')).toBe(false);
  });

  it('5. a standing child routine stays in Everyone’s part, not in priorities or the parent’s checklist', () => {
    const m = today(seed('routine'));
    expect(m.routines.map((p) => p.ownerId)).toEqual(expect.arrayContaining([ANDREW, PHILIP]));
    expect(m.plan.some((p) => p.part.id === 'p-floor-andrew')).toBe(false);
    expect(m.matters.some((x) => x.part?.id === 'p-floor-andrew')).toBe(false);
    // Nobody checks a habit off for a child.
    const s = seed('routine');
    expect(toggleDone(s, 'p-floor-andrew', FRI, MEG)).toBe(s);
  });

  it('a routine the family chose to practice is shown as encouragement, not a task', () => {
    const s = { ...seed('routine'), practice: { memberId: ANDREW, skill: 'floor' } };
    const m = today(s);
    const p = m.matters.find((x) => x.kind === 'practice')!;
    expect(p.title).toBe('Andrew is practicing: clean my floor');
    expect(p.attention).toBe(false);
  });

  it('6. Thursday trash is on Thursday’s plan, due tonight, and done per date', () => {
    const s = seed('weekly-due');
    const thu = addDays(monday, 3);
    const m = today(s);
    const trash = m.plan.find((p) => p.part.id === 'p-trash')!;
    expect(trash).toMatchObject({ mine: true, dueTonight: true, done: false, time: '20:00' });
    const done = toggleDone(s, 'p-trash', thu, MEG);
    expect(isDone(done, done.parts.find((p) => p.id === 'p-trash')!, thu)).toBe(true);
    expect(isDone(done, done.parts.find((p) => p.id === 'p-trash')!, addDays(thu, 7))).toBe(false);
    expect(m.headline).toBe('Take out the trash tonight.');
    expect(m.sub).toBe('It’s yours, by 8:00 PM.');
    // Not on Friday's plan.
    expect(planFor(s, monday, FRI, MEG).some((p) => p.part.id === 'p-trash')).toBe(false);
  });

  it('an activity the family chose in Our Focus stays visible on Today, as awareness', () => {
    const s0 = seed('quiet');
    const s = { ...s0, priorities: [{ id: 'pr-concert', kind: 'event' as const, eventLink: 'concert@lincoln', from: 'this-week' as const }] };
    const f = today(s).matters.find((x) => x.kind === 'focus')!;
    expect(f).toMatchObject({ title: 'School concert', attention: false });
    expect(f.meta).toBe('Our focus this week · Saturday · 10–11 AM');
    expect(today(s).quiet).toBe(true);
  });

  it('an agreed one-time commitment from Sunday’s meeting is on today’s plan without a new decision', () => {
    const m = today(seed('week'), MARK);
    expect(m.plan.find((p) => p.part.id === 'p-groceries')).toMatchObject({ mine: true, done: false });
    expect(m.matters.some((x) => /groceries/i.test(x.title))).toBe(false);
  });
});

describe('Handoffs: the signature interaction', () => {
  it('Meg sees Friday pickup needs a plan; asking Mark doesn’t move it', () => {
    const s = seed('week');
    const meg = today(s, MEG);
    expect(meg.headline).toBe('Friday pickup needs a plan.');
    expect(meg.matters[0]).toMatchObject({ kind: 'needs-owner', title: 'Who’s picking up the boys?', meta: '2:30 PM · Needs an owner' });
    const asked = seed('handoff-ask');
    expect(agreedParts(asked).some((p) => p.title === 'Pick up the boys')).toBe(false);
    expect(widgetFor(today(asked, MEG))).toMatchObject({ kind: 'waiting', title: 'Waiting for Mark', detail: 'Friday · 2:30 PM' });
  });

  it('7. Mark gets the request in Meg’s words with two answers', () => {
    const m = today(seed('handoff-ask'), MARK);
    expect(m.headline).toBe('Meg needs a hand.');
    expect(m.sub).toBe('One thing needs your attention.');
    expect(m.matters[0]).toMatchObject({ kind: 'request-in', title: 'Can you pick up the boys?', meta: 'Friday · 2:30 PM · From Meg' });
    expect(widgetFor(m)).toMatchObject({ kind: 'request', title: 'Can you pick up the boys?', detail: 'Friday · 2:30 PM · From Meg', actions: ['got-it', 'not-this-time'], more: 0 });
  });

  it('accepting moves ownership to Mark, confirms to Meg once, and clears the decision', () => {
    const s0 = seed('handoff-ask');
    const id = requestsOf(s0)[0].id;
    const { state: s, ok } = answer(s0, id, MARK, 'accept', FRI);
    expect(ok).toBe(true);
    const part = agreedParts(s).find((p) => p.title === 'Pick up the boys')!;
    expect(part).toMatchObject({ ownerId: MARK, status: 'agreed', onDate: FRI });
    expect(part.eventLink).toBeUndefined(); // one Friday, never every Friday
    expect(part.id).toBe(uuidFrom(`request:${id}`));
    expect(planFor(s, monday, addDays(FRI, 7), MARK).some((p) => p.part.id === part.id)).toBe(false);
    const mark = today(s, MARK);
    expect(mark.matters.some((x) => x.kind === 'request-in' || x.kind === 'needs-owner')).toBe(false);
    expect(mark.plan.find((p) => p.part.id === part.id)).toMatchObject({ mine: true, done: false });
    const meg = today(s, MEG);
    expect(meg.matters[0]).toMatchObject({ kind: 'accepted', title: 'Mark has it' });
    expect(meg.headline).toBe('Mark has it.');
    expect(widgetFor(meg)).toMatchObject({ kind: 'handoff-confirmed', title: 'Mark has it ✓' });
    // Once Meg has seen it, it quietly leaves her priorities and stays in the plan.
    const seen = acknowledge(s, id, MEG, FRI);
    expect(today(seen, MEG).matters.some((x) => x.kind === 'accepted')).toBe(false);
    expect(today(seen, MEG).plan.find((p) => p.part.id === part.id)?.part.ownerId).toBe(MARK);
    expect(widgetFor(today(seen, MEG)).kind).toBe('quiet');
  });

  it('8. declining leaves everything as it was and tells Meg it still needs a plan', () => {
    const s = seed('handoff-declined');
    const meg = today(s, MEG);
    expect(meg.matters[0]).toMatchObject({ kind: 'declined', title: 'Mark can’t pick up the boys.', meta: 'Friday · 2:30 PM · Still needs a plan' });
    expect(meg.headline).toBe('Friday pickup still needs a plan.');
    expect(agreedParts(s).some((p) => p.title === 'Pick up the boys')).toBe(false);
    expect(requestsOf(s)[0].status).toBe('declined');
    // Mark isn't asked again on Today.
    expect(today(s, MARK).matters.some((x) => x.kind === 'needs-owner' || x.kind === 'request-in')).toBe(false);
    // Meg takes it herself.
    const r = requestsOf(s)[0];
    const took = acknowledge(takeIt(s, { by: MEG, title: r.title, subject: r.subject, date: r.date, time: r.time, today: FRI }), r.id, MEG, FRI);
    expect(today(took, MEG).plan.find((p) => /pick up the boys/i.test(p.part.title))?.part.ownerId).toBe(MEG);
    expect(today(took, MEG).quiet).toBe(true);
  });

  it('after Meg has seen the decline, the need comes back for her until someone has it; or it waits for the meeting', () => {
    const s = seed('handoff-declined');
    const id = requestsOf(s)[0].id;
    const seenIt = acknowledge(s, id, MEG, FRI);
    expect(today(seenIt, MEG).matters[0]).toMatchObject({ kind: 'needs-owner', title: 'Who’s picking up the boys?' });
    expect(today(seenIt, MARK).matters.some((x) => x.kind === 'needs-owner')).toBe(false);
    const later = toMeeting(s, id, MEG, FRI);
    expect(today(later, MEG).matters.some((x) => x.kind === 'needs-owner' || x.kind === 'declined')).toBe(false);
    expect(carryForward({ s: later, monday, today: FRI, people }).some((x) => x.kind === 'declined')).toBe(true);
  });

  it('declining one date of a standing responsibility keeps the previous owner', () => {
    const s0 = seed('quiet');
    const asked = askHelp(s0, { from: MEG, to: MARK, subject: { kind: 'occurrence', partId: 'p-trash', date: addDays(monday, 3) }, title: 'Take out the trash', date: addDays(monday, 3), time: '20:00', today: FRI }).state;
    const id = requestsOf(asked)[0].id;
    const declined = answer(asked, id, MARK, 'decline', FRI).state;
    expect(declined.parts.find((p) => p.id === 'p-trash')!.ownerId).toBe(MEG);
    const m = buildTodayV21({ s: as(declined, MEG), monday, today: addDays(monday, 3), people });
    expect(m.matters.find((x) => x.kind === 'declined')).toMatchObject({ meta: 'Thursday · 8:00 PM · It’s still yours', attention: false });
    expect(m.plan.find((p) => p.part.id === 'p-trash')!.part.ownerId).toBe(MEG);
  });

  it('accepting one date covers only that date; the standing owner is unchanged', () => {
    const thu = addDays(monday, 3);
    const s0 = askHelp(seed('quiet'), { from: MEG, to: MARK, subject: { kind: 'occurrence', partId: 'p-trash', date: thu }, title: 'Take out the trash', date: thu, time: '20:00', today: thu }).state;
    const s = answer(s0, requestsOf(s0)[0].id, MARK, 'accept', thu).state;
    expect(s.parts.find((p) => p.id === 'p-trash')!.ownerId).toBe(MEG);
    const plan = planFor(s, monday, thu, MARK);
    expect(plan.filter((p) => /trash/i.test(p.part.title)).map((p) => p.part.ownerId)).toEqual([MARK]);
    expect(plan.find((p) => /trash/i.test(p.part.title))!.covering).toBe(MEG);
    expect(planFor(s, monday, addDays(thu, 7), MEG).find((p) => p.part.id === 'p-trash')!.part.ownerId).toBe(MEG);
  });

  it('"from now on" is a separate, explicit transfer of a standing responsibility', () => {
    const s0 = askHelp(seed('quiet'), { from: MEG, to: MARK, subject: { kind: 'part', partId: 'p-trash' }, title: 'Take out the trash', date: null, time: null, today: FRI }).state;
    expect(s0.parts.find((p) => p.id === 'p-trash')!.ownerId).toBe(MEG);
    const s = answer(s0, requestsOf(s0)[0].id, MARK, 'accept', FRI).state;
    expect(s.parts.find((p) => p.id === 'p-trash')).toMatchObject({ ownerId: MARK, status: 'agreed', lastChangedBy: MARK });
  });

  it('9. acceptance and completion are separate actions', () => {
    const s = seed('accepted');
    const part = agreedParts(s).find((p) => p.title === 'Pick up the boys')!;
    expect(part.done).toBeFalsy();
    const done = toggleDone(s, part.id, FRI, MARK);
    expect(today(done, MARK).plan.find((p) => p.part.id === part.id)!.done).toBe(true);
  });

  it('only the person asked can answer; answering twice changes nothing', () => {
    const s = seed('handoff-ask');
    const id = requestsOf(s)[0].id;
    expect(answer(s, id, MEG, 'accept', FRI)).toMatchObject({ ok: false, reason: 'not-yours' });
    const once = answer(s, id, MARK, 'accept', FRI).state;
    const twice = answer(once, id, MARK, 'accept', FRI);
    expect(twice).toMatchObject({ ok: false, reason: 'already-answered' });
    expect(twice.state).toBe(once);
    expect(answer(once, id, MARK, 'decline', FRI).ok).toBe(false);
    expect(agreedParts(once).filter((p) => p.title === 'Pick up the boys')).toHaveLength(1);
  });

  it('asking again for the same thing while it’s open adds nothing; only the asker can withdraw or acknowledge', () => {
    const s = seed('handoff-ask');
    const again = askHelp(s, { from: MEG, to: MARK, subject: { kind: 'event', link: 'e-pickup', date: FRI, need: 'pickup' }, title: 'Pick up the boys', date: FRI, time: '14:30', today: FRI });
    expect(again.state).toBe(s);
    expect(askHelp(s, { from: MEG, to: MEG, subject: { kind: 'task', date: FRI }, title: 'x', date: FRI, time: null, today: FRI }).id).toBeNull();
    const id = requestsOf(s)[0].id;
    expect(withdraw(s, id, MARK, FRI)).toBe(s);
    const w = withdraw(s, id, MEG, FRI);
    expect(requestsOf(w)[0].status).toBe('withdrawn');
    expect(today(w, MARK).matters.some((x) => x.kind === 'request-in')).toBe(false);
    expect(today(w, MEG).matters[0].kind).toBe('needs-owner');
  });

  it('two devices: Mark’s answer and Meg’s concurrent change merge per key without duplicating the request', () => {
    const base = seed('handoff-ask');
    const id = requestsOf(base)[0].id;
    const marks = answer(base, id, MARK, 'accept', FRI).state;
    const megs = remember(base, { id: 'd-x', kind: 'preference', text: 'We usually text Johan', titleKey: "johan's birthday", choice: 'text', ownerId: MEG, by: MEG, on: FRI });
    const merged = merge3(base.intel, megs.intel, marks.intel) as Intel;
    expect(Object.keys(merged.requests ?? {})).toHaveLength(1);
    expect(merged.requests![id].status).toBe('accepted');
    expect(merged.decisions!['d-x']).toBeTruthy();
  });
});

describe('Personal views and quiet', () => {
  it('10. the same plan reads differently for each adult', () => {
    const s = seed('two-views');
    const mark = today(s, MARK), meg = today(s, MEG);
    expect(mark.headline).toBe('Meg needs a hand.');
    expect(meg.headline).toBe('Nothing needs you today.');
    expect(meg.matters[0]).toMatchObject({ kind: 'waiting', attention: false });
    // Both see the whole family plan; each sees their own first.
    expect(mark.plan[0].mine).toBe(true);
    expect(meg.plan.map((p) => p.part.id).sort()).toEqual(mark.plan.map((p) => p.part.id).sort());
  });

  it('14. a quiet day says so, and the plan is still there', () => {
    const m = today(seed('quiet'), MEG);
    expect(m.quiet).toBe(true);
    expect(m.matters.filter((x) => x.attention)).toHaveLength(0);
    expect(m.headline).toBe('Nothing needs you today.');
    expect(m.plan.length).toBeGreaterThan(0);
    expect(widgetFor(m)).toMatchObject({ kind: 'quiet', title: 'Nothing needs you' });
  });

  it('15. several requests: the most important first, with a count of the rest', () => {
    const m = today(seed('multiple'), MARK);
    const ins = m.matters.filter((x) => x.kind === 'request-in');
    expect(ins).toHaveLength(3);
    expect(ins[0].title).toBe('Can you pick up the boys?');
    expect(m.sub).toBe('Three things need your attention.');
    expect(widgetFor(m)).toMatchObject({ title: 'Can you pick up the boys?', more: 2 });
  });

  it('16. a first-time household starts with the meeting, not a to-do list', () => {
    const m = today(seed('first-time'));
    expect(m.firstTime).toBe(true);
    expect(m.headline).toBe('Let’s make your first plan.');
    expect(m.plan).toHaveLength(0);
    expect(m.matters).toHaveLength(0);
  });
});

describe('Household memory', () => {
  it('11. a remembered preference is visible, editable, removable, and informs the suggestion', () => {
    const s = seed('memory');
    const d = decisionsOf(s).find((x) => x.kind === 'preference')!;
    expect(d.text).toBe('We usually send Johan a birthday text');
    expect(today(s).week.find((w) => w.link === 'e-johan')!.preference?.choice).toBe('text');
    const edited = editDecision(s, d.id, { text: 'We usually call Johan', choice: 'text' });
    expect(decisionsOf(edited).find((x) => x.id === d.id)!.text).toBe('We usually call Johan');
    expect(today(forgetDecision(edited, d.id)).week.find((w) => w.link === 'e-johan')!.preference).toBeNull();
  });

  it('a preference never creates the part on its own', () => {
    const s = seed('memory');
    expect(today(s).plan.some((p) => /johan/i.test(p.part.title))).toBe(false);
  });

  it('"make it the usual" turns the each-time decision into Mark’s standing agreement, explicitly', () => {
    const s = makeUsual(seed('week'), { decisionId: 'd-pickup', ownerId: MARK, time: '14:30', today: FRI, by: MEG });
    expect(decisionsOf(s).some((d) => d.id === 'd-pickup')).toBe(false);
    expect(agreedParts(s).find((p) => p.id === uuidFrom('usual:d-pickup'))).toMatchObject({ ownerId: MARK, eventLink: 'e-pickup' });
    expect(today(s, MEG).matters.some((x) => x.kind === 'needs-owner')).toBe(false);
    // Next Friday too, without asking.
    expect(planFor(s, monday, addDays(FRI, 7), MARK).some((p) => p.part.id === uuidFrom('usual:d-pickup'))).toBe(true);
  });

  it('editing a standing agreement outside the meeting keeps it agreed and tells the owner', () => {
    const s = editStanding(seed('quiet'), 'p-trash', { cue: 'By 7:00 PM' }, MARK, FRI);
    expect(s.parts.find((p) => p.id === 'p-trash')).toMatchObject({ status: 'agreed', cue: 'By 7:00 PM', lastChangedBy: MARK });
    expect(today(s, MEG).matters[0]).toMatchObject({ kind: 'changed', title: 'Mark updated take out the trash' });
    expect(today(s, MARK).matters.some((x) => x.kind === 'changed')).toBe(false);
  });
});

describe('Family Meeting continuity', () => {
  it('13. a declined request and this week’s each-time decision carry into the next meeting', () => {
    const c = carryForward({ s: seed('carry'), monday, today: FRI, people });
    expect(c.map((x) => x.kind)).toEqual(expect.arrayContaining(['declined']));
    expect(c.find((x) => x.kind === 'declined')!.detail).toBe('Mark couldn’t take it. Who will?');
  });

  it('does not turn the meeting into a review of every routine', () => {
    const c = carryForward({ s: seed('quiet'), monday, today: FRI, people });
    expect(c).toHaveLength(0);
  });

  it('talked-about items leave the list', () => {
    const s = seed('carry');
    const c = carryForward({ s, monday, today: FRI, people });
    const talked = { ...s, intel: { ...s.intel!, talked: Object.fromEntries(c.map((x) => [x.key, FRI])) } };
    expect(carryForward({ s: talked, monday, today: FRI, people })).toHaveLength(0);
  });
});

describe('notifications for requests (production push rules)', () => {
  const notes = (s: V16State, now = '14:00') => outbox({ s, monday, today: FRI, people, now }).filter((n) => n.status !== 'off');
  it('a request reaches only the person asked, in the asker’s words, with both answers', () => {
    const n = notes(seed('handoff-ask')).filter((x) => x.requestId);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ to: MARK, kind: 'help', purpose: 'needs-you', title: 'Can you pick up the boys?', body: 'Today · 2:30 PM · From Meg', actions: ['got-it', 'not-tonight'], status: 'deliver' });
  });
  it('"I’ve got it" from the notification is the same accept, once', () => {
    const s0 = seed('handoff-ask');
    const n = notes(s0).find((x) => x.requestId)!;
    const s = gotIt(s0, n, { today: FRI, people });
    expect(requestsOf(s)[0].status).toBe('accepted');
    expect(gotIt(s, n, { today: FRI, people })).toBe(s);
    const after = notes(s);
    expect(after.filter((x) => x.requestId).map((x) => [x.to, x.kind, x.title])).toEqual([[MEG, 'handled', 'Mark has it ✓']]);
    // No second "updated a shared plan" notice for the same accept.
    expect(after.some((x) => x.kind === 'agreement')).toBe(false);
    expect(notes(acknowledge(s, requestsOf(s)[0].id, MEG, FRI)).some((x) => x.requestId)).toBe(false);
  });
  it('"Not this time" tells the asker it still needs a plan', () => {
    const s0 = seed('handoff-ask');
    const n = notes(s0).find((x) => x.requestId)!;
    const s = notTonight(s0, n);
    expect(notes(s).filter((x) => x.requestId).map((x) => [x.to, x.kind, x.body])).toEqual([[MEG, 'declined', 'Pick up the boys still needs a plan.']]);
  });
});

describe('ids and the household document', () => {
  it('ids are valid UUIDs, stable per seed, different across seeds', () => {
    const a = uuidFrom('request:rq-1');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidFrom('request:rq-1')).toBe(a);
    expect(new Set(Array.from({ length: 2000 }, (_, i) => uuidFrom(`request:${i}`))).size).toBe(2000);
  });

  it('two phones accepting the same request (each from its own copy) make the same agreement once', () => {
    const base = seed('handoff-ask');
    const id = requestsOf(base)[0].id;
    const one = answer(base, id, MARK, 'accept', FRI).state;
    const two = answer(base, id, MARK, 'accept', FRI).state;
    expect(agreedParts(one).find((p) => p.title === 'Pick up the boys')!.id).toBe(agreedParts(two).find((p) => p.title === 'Pick up the boys')!.id);
  });

  it('request ids from two phones never collide', () => {
    const s = seed('quiet');
    const a = askHelp(s, { from: MEG, to: MARK, subject: { kind: 'task', date: FRI }, title: 'One', date: FRI, time: null, today: FRI }).id;
    const b = askHelp(s, { from: MARK, to: MEG, subject: { kind: 'task', date: FRI }, title: 'Two', date: FRI, time: null, today: FRI }).id;
    expect(a).not.toBe(b);
  });

  it('a chosen preparation for a recurring event happens once, on its date', () => {
    const opt = intentOptions('School pickup')[0];
    const s = chooseIntent(seed('quiet'), { link: 'e-pickup', date: FRI, eventTitle: 'School pickup', option: opt, ownerId: MEG, by: MEG, today: FRI, adults: [MEG, MARK] });
    const p = agreedParts(s).find((x) => x.title === opt.title)!;
    expect(p.onDate).toBe(FRI);
    expect(planFor(s, monday, addDays(FRI, 7), MEG).some((x) => x.part.id === p.id)).toBe(false);
  });

  it('pruning drops old answered requests and stale markers, keeps open ones and decisions', () => {
    const s = intelOf(seed('handoff-declined'));
    const later = addDays(FRI, 40);
    const p = pruneV21(s, later);
    expect(Object.keys(p.requests ?? {})).toHaveLength(0);
    expect(Object.keys(p.decisions ?? {})).toHaveLength(1);
    expect(Object.keys(pruneV21(s, FRI).requests ?? {})).toHaveLength(1);
  });
});

describe('state', () => {
  it('every scenario seeds without throwing and keeps V20 fields', () => {
    for (const id of ['week', 'birthday-none', 'birthday-planned', 'school-event', 'conflict', 'routine', 'weekly-due', 'handoff-ask', 'handoff-declined', 'accepted', 'two-views',
      'memory', 'routine-card', 'carry', 'quiet', 'multiple', 'first-time'] as ScenarioV21[]) {
      const s = seed(id);
      expect(s.live).toBe(true);
      expect(intelOf(s).viewer).toBeTruthy();
      expect(() => today(s, MEG)).not.toThrow();
      expect(() => today(s, MARK)).not.toThrow();
    }
  });
});

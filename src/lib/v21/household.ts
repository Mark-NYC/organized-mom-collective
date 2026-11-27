/**
 * V21 preview household (docs/ios/V21_PREVIEW.md): FICTIONAL, modeled on the approved V21 screenshots. Meg and Mark,
 * Andrew (8) and Philip (6), and a cousin's birthday on the calendar. Never a real family, never saved to a server.
 *
 * The calendar is `extraEvents` with `live: true`, exactly how production /app holds a household's own and connected
 * calendars (src/lib/v20/live.ts), so the preview runs the production code path rather than the Rivera demo week.
 * Every date is relative to the week the preview opens.
 *
 * Each scenario is a real state built through the same functions the screens call (askHelp, answer, chooseIntent…),
 * not a hand-written screen.
 */
import { memberColors } from '../../data/club/family-colors';
import type { FamilyProfile } from '../club/family-profile';
import type { Household } from '../club/profile';
import { addDays, type CalendarEvent } from '../calendar/recurrence';
import { signature, type Part, type V16State } from '../v16/model';
import { emptyIntel } from '../v18/engine';
import { answer, askHelp, chooseIntent, intentOptions, remember, type Decision, type Intel } from './model';

export const MEG = 'm-meg';
export const MARK = 'm-mark';
export const ANDREW = 'm-andrew';
export const PHILIP = 'm-philip';
/** A shared responsibility the family does together (the Friday reset). */
export const TOGETHER = 'together';

export function householdV21(): Household {
  return {
    id: 'demo-v21', displayName: 'The Family', profileVersion: 1,
    preferences: { pets: false, week_starts: 'monday', colors: { [MEG]: 'pink', [MARK]: 'green', [ANDREW]: 'blue', [PHILIP]: 'orange' } } as Household['preferences'],
    members: [
      { id: MEG, firstName: 'Meg', kind: 'adult', role: 'parent', isAccountHolder: true },
      { id: MARK, firstName: 'Mark', kind: 'adult', role: 'partner' },
      { id: ANDREW, firstName: 'Andrew', kind: 'child', role: 'child', birthYear: 2018, birthMonth: 4 },
      { id: PHILIP, firstName: 'Philip', kind: 'child', role: 'child', birthYear: 2020, birthMonth: 9 },
    ] as Household['members'],
  };
}
export const colorsV21 = (h: Household) => memberColors(h);

export function profileV21(): FamilyProfile {
  return { setupDone: [], setupCompleted: true, challenges: ['preparing'], priority: 'routines', activities: [], responsibilities: [] } as FamilyProfile;
}

export const SCENARIOS_V21 = [
  ['week', 'Our week (Meg): Friday pickup needs a plan'],
  ['birthday-none', '1. An ordinary birthday, no action needed'],
  ['birthday-planned', '2. A birthday with chosen preparation'],
  ['school-event', '3. A school event, nothing inferred'],
  ['conflict', '4. A genuine scheduling conflict'],
  ['routine', '5. A standing daily child routine'],
  ['weekly-due', '6. Thursday trash, due tonight'],
  ['handoff-ask', '7. Meg asks Mark for a hand'],
  ['handoff-declined', '8. Mark can’t: declined'],
  ['accepted', '9. Accepted, not yet done'],
  ['two-views', '10. Same plan, two adults'],
  ['memory', '11. Remembered decisions'],
  ['routine-card', '12. A routine card to print'],
  ['carry', '13. Unresolved, carried to the meeting'],
  ['quiet', '14. A quiet day'],
  ['multiple', '15. Several requests at once'],
  ['first-time', '16. A first-time household'],
] as const;
export type ScenarioV21 = (typeof SCENARIOS_V21)[number][0];

const base = { timezone: 'America/Chicago', revision: 1, source: 'manual' } as const;

/** The family's calendar (their own events; the school feed is read-only like a real connected calendar). */
export function eventsV21(monday: string, extra: { dentist?: boolean } = {}): CalendarEvent[] {
  const school = (uid: string) => ({ feed_id: 'feed-school', name: 'Lincoln Elementary', visibility: 'household' as const, mine: true, tentative: false, uid });
  const list: CalendarEvent[] = [
    { ...base, id: 'e-pickup', title: 'School pickup', starts_on: addDays(monday, -24), start_time: '14:30', end_time: '14:45', member_ids: [ANDREW, PHILIP],
      recurrence: { freq: 'weekly', by_day: [5] } },
    { ...base, id: 'e-concert', title: 'School concert', starts_on: addDays(monday, 5), start_time: '10:00', end_time: '11:00', member_ids: [ANDREW, PHILIP], external: school('concert@lincoln') },
    { ...base, id: 'e-johan', title: 'Johan’s birthday', starts_on: addDays(monday, 6), start_time: null, end_time: null, member_ids: [] },
    { ...base, id: 'e-meeting', title: 'Family Meeting', starts_on: addDays(monday, -22), start_time: '17:00', end_time: '17:15', member_ids: [], recurrence: { freq: 'weekly', by_day: [0] } },
  ] as CalendarEvent[];
  if (extra.dentist) list.push({ ...base, id: 'e-dentist-mark', title: 'Dentist', starts_on: addDays(monday, 4), start_time: '14:00', end_time: '15:00', member_ids: [MARK] } as CalendarEvent);
  return list;
}

const agreedOn = (monday: string) => addDays(monday, -15);
function agreed(p: Omit<Part, 'status' | 'origin'> & Partial<Pick<Part, 'origin'>>, on: string): Part {
  const x: Part = { origin: 'prepared', ...p, status: 'agreed' } as Part;
  return { ...x, agreedOn: on, agreedSignature: signature(x), agreedCopy: { ownerId: x.ownerId, title: x.title, finishLine: x.finishLine, offsetDays: x.offsetDays, weekday: x.weekday } };
}

/** Standing agreements the family made at earlier meetings, plus this week's one-time plan from Sunday's meeting. */
export function partsV21(monday: string, today: string): Part[] {
  const on = agreedOn(monday);
  return [
    agreed({ id: 'p-floor-andrew', title: 'Clean my floor', ownerId: ANDREW, cue: 'After I get dressed', finishLine: 'I can walk from my bed to the door without stepping over anything.', skill: 'floor' }, on),
    agreed({ id: 'p-floor-philip', title: 'Tidy my floor', ownerId: PHILIP, cue: 'Before bedtime', finishLine: 'Toys in their bins and clothes in the hamper.', skill: 'floor' }, on),
    agreed({ id: 'p-trash', title: 'Take out the trash', ownerId: MEG, weekday: 4, cue: 'By 8:00 PM', finishLine: 'Bins at the curb with new bags in.' }, on),
    agreed({ id: 'p-bathroom', title: 'Deep clean the bathroom', ownerId: MARK, weekday: 5, finishLine: 'Sink, mirror, toilet and floor done.' }, on),
    agreed({ id: 'p-reset', title: 'Friday evening reset', ownerId: TOGETHER, weekday: 5, cue: 'After dinner', finishLine: 'Counters clear and everything back in its place.' }, on),
    // Agreed at Sunday's meeting for this week only (a one-time commitment, not a standing one).
    agreed({ id: 'p-groceries', title: 'Pick up groceries', ownerId: MARK, onDate: today, finishLine: 'Everything on the list in the kitchen.' }, addDays(monday, -1)),
  ];
}

const PICKUP: Decision = { id: 'd-pickup', kind: 'each-time', text: 'We decide Friday pickup each week', eventLink: 'e-pickup', title: 'Pick up the boys', label: 'pickup', need: 'pickup', by: MEG, on: '2026-10-01' };

/** The demo day: Friday of this week, unless a scenario pins another day. */
export const demoTodayV21 = (monday: string, demoDay = 5) => addDays(monday, demoDay - 1);

function stateOf(monday: string, today: string, opts: { parts?: Part[]; events?: CalendarEvent[]; viewer?: string; demoDay?: number; finished?: boolean } = {}): V16State {
  const intel: Intel = { ...emptyIntel(opts.viewer ?? MEG), aiAvailable: false, decisions: { [PICKUP.id]: { ...PICKUP, on: addDays(monday, -40) } }, requests: {}, intents: {}, done: {}, covers: {}, cards: {}, acked: {},
    ...(opts.demoDay ? { demoDay: opts.demoDay } : {}) };
  return {
    v: 1, scenario: 'week4', club: true, adults: 'two', online: true, soccer: 'as-planned', feedVisibility: {}, live: true,
    extraEvents: opts.events ?? eventsV21(monday), priorities: [], parts: opts.parts ?? partsV21(monday, today), records: [],
    meeting: { step: 0, started: false, talkIndex: 0, ...(opts.finished === false ? {} : { finishedOn: addDays(monday, -1) }) }, practice: {}, wall: { format: 'weekly', plan: null },
    cleaning: { mode: 'printed', mainDay: 6, dailyReset: true, moved: {}, checks: {} }, intel,
  };
}

const ADULTS = [MEG, MARK];
const markUsual = (monday: string): Part => agreed({ id: 'p-usual-d-pickup', title: 'Pick up the boys', ownerId: MARK, eventLink: 'e-pickup', offsetDays: 0, need: 'pickup', cue: 'At 2:30 PM', finishLine: '' }, agreedOn(monday));

export function seedV21(id: ScenarioV21, monday: string): V16State {
  const day = id === 'weekly-due' ? 4 : 5;
  const today = demoTodayV21(monday, day);
  const viewer = (v: string) => (s: V16State): V16State => ({ ...s, intel: { ...s.intel!, viewer: v } });
  const tag = (s: V16State): V16State => ({ ...s, intel: { ...s.intel!, scenario: id, demoDay: day } as Intel });
  // Friday pickup is Mark's usual (so the each-time decision is replaced by his standing agreement).
  const settled = (s: V16State): V16State => {
    const decisions = { ...(s.intel as Intel).decisions };
    delete decisions['d-pickup'];
    return { ...s, parts: [...s.parts, markUsual(monday)], intel: { ...s.intel!, decisions } as Intel };
  };
  const ask = (s: V16State, to: string, title: string, subject: Parameters<typeof askHelp>[1]['subject'], time: string | null, date = today) =>
    askHelp(s, { from: MEG, to, subject, title, date, time, today }).state;
  const pickupAsk = (s: V16State) => ask(s, MARK, 'Pick up the boys', { kind: 'event', link: 'e-pickup', date: today, need: 'pickup' }, '14:30');
  const reqId = (s: V16State) => Object.keys((s.intel as Intel).requests ?? {})[0];

  let s = stateOf(monday, today, { demoDay: day });
  switch (id) {
    case 'week': break;
    case 'birthday-none': case 'school-event': case 'routine': case 'routine-card': case 'quiet':
      s = settled(s);
      if (id === 'school-event') s = viewer(MARK)(s);
      break;
    case 'birthday-planned': {
      s = settled(s);
      const opt = intentOptions('Johan’s birthday').find((o) => o.id === 'card')!;
      s = chooseIntent(s, { link: 'e-johan', date: addDays(monday, 6), eventTitle: 'Johan’s birthday', option: { ...opt, lead: 2 }, ownerId: MEG, by: MEG, today, adults: ADULTS });
      break;
    }
    case 'conflict':
      s = settled({ ...s, extraEvents: eventsV21(monday, { dentist: true }) });
      s = viewer(MARK)(s);
      break;
    case 'weekly-due':
      s = settled(s);
      s = { ...s, parts: s.parts.filter((p) => p.id !== 'p-groceries') };
      break;
    case 'handoff-ask': case 'two-views':
      s = viewer(MARK)(pickupAsk(s));
      break;
    case 'handoff-declined':
      s = pickupAsk(s);
      s = answer(s, reqId(s), MARK, 'decline', today).state;
      break;
    case 'accepted':
      s = pickupAsk(s);
      s = viewer(MARK)(answer(s, reqId(s), MARK, 'accept', today).state);
      break;
    case 'memory':
      s = remember(s, { id: 'd-johan', kind: 'preference', text: 'We usually send Johan a birthday text', titleKey: 'johan’s birthday'.replace(/’/g, "'"), choice: 'text', ownerId: MEG, by: MEG, on: addDays(monday, -60) });
      break;
    case 'carry':
      s = pickupAsk(s);
      s = answer(s, reqId(s), MARK, 'decline', today).state;
      s = { ...s, meeting: { ...s.meeting, finishedOn: addDays(monday, -8) } };
      break;
    case 'multiple':
      s = pickupAsk(s);
      s = ask(s, MARK, 'Drive the boys to the concert', { kind: 'event', link: 'concert@lincoln', date: addDays(monday, 5), need: 'ride' }, '09:40', addDays(monday, 5));
      s = ask(s, MARK, 'Get a gift for Johan', { kind: 'task', date: addDays(monday, 5) }, null, addDays(monday, 5));
      s = viewer(MARK)(s);
      break;
    case 'first-time':
      s = stateOf(monday, today, { parts: [], events: eventsV21(monday).filter((e) => e.id !== 'e-meeting'), demoDay: day, finished: false });
      s = { ...s, scenario: 'first', intel: { ...s.intel!, decisions: {} } as Intel };
      break;
  }
  return tag(s);
}

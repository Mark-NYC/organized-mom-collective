/**
 * The Family Rhythm & Ownership Guide's rules (November's kit; screen in src/components/club/RhythmGuide.tsx, print
 * in src/components/club/print/NextStepSheet.tsx). A short guided conversation, not an assessment: one question at a
 * time, only the ones that fit her answers, then one plan.
 *
 * Where she starts decides the path:
 * - "It's going pretty well": who carries the planning. Mom → share the meeting leadership; shared → hand off one
 *   whole job; someone else or it varies → that's working, and a handoff is offered, not pushed.
 * - "We started, but got off track": what made it hard, then one adjustment for that obstacle (never five).
 * - "We haven't started yet": when the family could gather, where the guide will live → a first-meeting plan.
 * - "I'm new to the Club": a welcome and September's kit as a bonus (a link to the real kit), then a first meeting or
 *   a handoff, her choice. September is never homework.
 *
 * Deterministic: no AI. "Something else" is matched by a few keywords; when nothing fits, it suggests one small
 * experiment rather than guessing. Household names and ages come from the family profile; the handoff uses the
 * ownership job library (src/data/club/libraries/ownership-jobs.ts) and the engine's age rules for the version of a
 * job that suits the person. Nothing here assumes two adults.
 */
import { leaderNote } from './family-reset';
import type { Group, Helper } from '../lib/household-helpers';
import type { HouseholdPreferences, PlannedMember } from '../lib/club/profile';
import { eligible, levelFor } from '../lib/club/engines/responsibilities';
import type { KitItem, OwnershipLevel } from './club/types';

export type Start = 'going-well' | 'off-track' | 'not-started' | 'new';
export type Leader = 'shared' | 'mom' | 'other' | 'varies';
export type Obstacle = 'forgetting' | 'time' | 'mom-planning' | 'kids' | 'too-long' | 'other';
export type HardPart = 'reminding' | 'standards' | 'faster' | 'follow-through' | 'other';
export type JobChoice = 'kitchen' | 'laundry' | 'school' | 'space' | 'groceries' | 'other';
export type MeetTime = 'sunday' | 'friday' | 'saturday' | 'other';
export type GuidePlace = 'calendar' | 'fridge' | 'binder' | 'other';
export type PlanKind = 'first-meeting' | 'restart' | 'leadership' | 'handoff';

const opts = <T extends string>(xs: [T, string][]) => xs.map(([id, label]) => ({ id, label }));

export const START_OPTIONS = opts<Start>([
  ['going-well', 'It’s going pretty well.'],
  ['off-track', 'We started, but got off track.'],
  ['not-started', 'We haven’t started yet.'],
  ['new', 'I’m new to the Club.'],
]);
export const LEADER_OPTIONS = opts<Leader>([
  ['shared', 'We share it pretty well.'],
  ['mom', 'Mom still leads most of it.'],
  ['other', 'Another person usually leads.'],
  ['varies', 'It varies.'],
]);
export const OBSTACLE_OPTIONS = opts<Obstacle>([
  ['forgetting', 'We kept forgetting.'],
  ['time', 'We couldn’t find a good time.'],
  ['mom-planning', 'Mom was still doing all the planning.'],
  ['kids', 'The kids weren’t participating.'],
  ['too-long', 'It took too long or felt like another chore.'],
  ['other', 'Something else.'],
]);
export const HARD_OPTIONS = opts<HardPart>([
  ['reminding', 'I don’t want to keep reminding them.'],
  ['standards', 'They might do it differently than I would.'],
  ['faster', 'It feels faster to do it myself.'],
  ['follow-through', 'I’m unsure they’ll follow through.'],
  ['other', 'Something else.'],
]);
export const JOB_OPTIONS = opts<JobChoice>([
  ['kitchen', 'Kitchen cleanup'],
  ['laundry', 'Laundry'],
  ['school', 'School preparation'],
  ['space', 'Keeping a shared space tidy'],
  ['groceries', 'Grocery preparation'],
  ['other', 'Another responsibility'],
]);
export const TIME_OPTIONS = opts<MeetTime>([
  ['sunday', 'Sunday evening'],
  ['friday', 'Friday after dinner'],
  ['saturday', 'Saturday morning'],
  ['other', 'Another time'],
]);
export const PLACE_OPTIONS = opts<GuidePlace>([
  ['calendar', 'Beside the family wall calendar'],
  ['fridge', 'On the refrigerator'],
  ['binder', 'In a family planning binder'],
  ['other', 'Another visible place'],
]);
const label = <T extends string>(list: { id: T; label: string }[], id: T | null) => list.find((x) => x.id === id)?.label ?? '';

// ------------------------------------------------------------------ the saved state

/** Her answers and her edited plan: the kit's `next-step` document. */
export interface GuideState {
  v: 1;
  start: Start | null;
  /** New members: a first meeting or a handoff. */
  newStart: 'meeting' | 'handoff' | null;
  leader: Leader | null;
  /** "Another person leads" / "It varies": a handoff now, or not now. */
  offer: 'handoff' | 'later' | null;
  /** Mom leads: who could lead next (a member id, or her words in `leadName`). */
  leadId: string | null;
  leadName: string;
  obstacle: Obstacle | null;
  obstacleOther: string;
  /** The one adjustment she picked from the obstacle's few (index). */
  fix: number | null;
  time: MeetTime | null;
  timeOther: string;
  place: GuidePlace | null;
  placeOther: string;
  job: JobChoice | null;
  jobOther: string;
  ownerId: string | null;
  ownerName: string;
  hard: HardPart | null;
  /** The handoff's three lines, once she's looked at them (prefilled, editable). */
  define: { statement: string; when: string; done: string } | null;
  /** The plan as she's edited it, and the answers it was made from (a changed answer makes a fresh one). */
  plan: Plan | null;
  planFor: string;
}

export const emptyGuide = (): GuideState => ({
  v: 1, start: null, newStart: null, leader: null, offer: null, leadId: null, leadName: '', obstacle: null, obstacleOther: '', fix: null,
  time: null, timeOther: '', place: null, placeOther: '', job: null, jobOther: '', ownerId: null, ownerName: '', hard: null, define: null,
  plan: null, planFor: '',
});

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
const pick = <T extends string>(v: unknown, list: { id: T }[]): T | null => (list.some((x) => x.id === v) ? (v as T) : null);

/** A saved document back into state, keeping only what's valid (a member who's left the family is dropped). */
export function readGuide(raw: unknown, memberIds: readonly string[]): GuideState {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const member = (v: unknown) => (typeof v === 'string' && memberIds.includes(v) ? v : null);
  const d = o.define as Record<string, unknown> | null | undefined;
  const p = o.plan as Record<string, unknown> | null | undefined;
  return {
    v: 1,
    start: pick(o.start, START_OPTIONS),
    newStart: o.newStart === 'meeting' || o.newStart === 'handoff' ? o.newStart : null,
    leader: pick(o.leader, LEADER_OPTIONS),
    offer: o.offer === 'handoff' || o.offer === 'later' ? o.offer : null,
    leadId: member(o.leadId),
    leadName: text(o.leadName, 30),
    obstacle: pick(o.obstacle, OBSTACLE_OPTIONS),
    obstacleOther: text(o.obstacleOther, 140),
    fix: Number.isInteger(o.fix) && (o.fix as number) >= 0 && (o.fix as number) < 3 ? (o.fix as number) : null,
    time: pick(o.time, TIME_OPTIONS),
    timeOther: text(o.timeOther, 60),
    place: pick(o.place, PLACE_OPTIONS),
    placeOther: text(o.placeOther, 60),
    job: pick(o.job, JOB_OPTIONS),
    jobOther: text(o.jobOther, 60),
    ownerId: member(o.ownerId),
    ownerName: text(o.ownerName, 30),
    hard: pick(o.hard, HARD_OPTIONS),
    define: d && typeof d === 'object' ? { statement: text(d.statement, 160), when: text(d.when, 100), done: text(d.done, 160) } : null,
    plan: p && typeof p === 'object' && typeof p.kind === 'string' && ['first-meeting', 'restart', 'leadership', 'handoff'].includes(p.kind) ? readPlan(p) : null,
    planFor: text(o.planFor, 2000),
  };
}

function readPlan(p: Record<string, unknown>): Plan {
  const h = p.handoff as Record<string, unknown> | undefined;
  const lines = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => text(x, max)) : []);
  return {
    kind: p.kind as PlanKind,
    title: text(p.title, 60),
    goal: text(p.goal, 120),
    ...(typeof p.obstacle === 'string' ? { obstacle: text(p.obstacle, 140) } : {}),
    step: text(p.step, 200),
    who: text(p.who, 160),
    when: text(p.when, 100),
    cue: text(p.cue, 160),
    checkIn: text(p.checkIn, 160),
    ...(p.why !== undefined ? { why: text(p.why, 240) } : {}),
    roles: lines(p.roles, 8, 120),
    ...(h && typeof h === 'object' ? {
      handoff: {
        statement: text(h.statement, 160), when: text(h.when, 100), done: text(h.done, 160), coaching: text(h.coaching, 300),
        stages: Array.isArray(h.stages) ? h.stages.slice(0, 4).map((s) => ({ word: text((s as { word?: unknown })?.word, 20), text: text((s as { text?: unknown })?.text, 160) })) : [],
      },
    } : {}),
  };
}

// ------------------------------------------------------------------ the flow

export type Screen =
  | 'start' | 'welcome' | 'leader' | 'offer' | 'lead' | 'obstacle' | 'adjust' | 'time' | 'place'
  | 'job' | 'owner' | 'hard' | 'define' | 'plan' | 'later';

/** Which path a state is on, once it's on one. */
export function pathOf(s: GuideState): 'meeting' | 'restart' | 'leadership' | 'handoff' | 'later' | null {
  if (s.start === 'not-started') return 'meeting';
  if (s.start === 'off-track') return 'restart';
  if (s.start === 'new') return s.newStart === 'meeting' ? 'meeting' : s.newStart === 'handoff' ? 'handoff' : null;
  if (s.start === 'going-well') {
    if (s.leader === 'mom') return 'leadership';
    if (s.leader === 'shared') return 'handoff';
    if (s.leader === 'other' || s.leader === 'varies') return s.offer === 'handoff' ? 'handoff' : s.offer === 'later' ? 'later' : null;
  }
  return null;
}

/** The screens her answers lead through, in order; each is answered or it's where she is. */
export function screensFor(s: GuideState): Screen[] {
  const out: Screen[] = ['start'];
  if (s.start === 'new') out.push('welcome');
  if (s.start === 'going-well') {
    out.push('leader');
    if (s.leader === 'other' || s.leader === 'varies') out.push('offer');
  }
  if (s.start === 'off-track') out.push('obstacle', 'adjust', 'time');
  const path = pathOf(s);
  if (path === 'meeting') out.push('time', 'place');
  if (path === 'leadership') out.push('lead', 'time');
  if (path === 'handoff') out.push('job', 'owner', 'hard', 'define');
  if (path === 'later') return [...out, 'later'];
  if (path) out.push('plan');
  return out;
}

/** Is this screen answered? */
export function answered(s: GuideState, screen: Screen): boolean {
  switch (screen) {
    case 'start': return s.start !== null;
    case 'welcome': return s.newStart !== null;
    case 'leader': return s.leader !== null;
    case 'offer': return s.offer !== null;
    case 'lead': return s.leadId !== null || s.leadName.trim() !== '';
    case 'obstacle': return s.obstacle !== null && (s.obstacle !== 'other' || s.obstacleOther.trim() !== '');
    case 'adjust': return s.fix !== null;
    case 'time': return s.time !== null && (s.time !== 'other' || s.timeOther.trim() !== '');
    case 'place': return s.place !== null && (s.place !== 'other' || s.placeOther.trim() !== '');
    case 'job': return s.job !== null && (s.job !== 'other' || s.jobOther.trim() !== '');
    case 'owner': return s.ownerId !== null || s.ownerName.trim() !== '';
    case 'hard': return s.hard !== null;
    case 'define': return s.define !== null;
    case 'plan': case 'later': return false;
  }
}

/** Where she is: the first screen on her path she hasn't answered. */
export const currentScreen = (s: GuideState): Screen => screensFor(s).find((x) => !answered(s, x)) ?? 'plan';

/** One step back: the answer to the screen before this one is cleared, so she sees it again. */
export function back(s: GuideState): GuideState {
  const list = screensFor(s);
  const at = list.indexOf(currentScreen(s));
  const prev = list[at - 1];
  if (!prev) return s;
  const clear: Partial<Record<Screen, Partial<GuideState>>> = {
    start: { start: null }, welcome: { newStart: null }, leader: { leader: null }, offer: { offer: null },
    lead: { leadId: null, leadName: '' }, obstacle: { obstacle: null }, adjust: { fix: null }, time: { time: null },
    place: { place: null }, job: { job: null }, owner: { ownerId: null, ownerName: '' }, hard: { hard: null }, define: { define: null },
  };
  return { ...s, ...clear[prev] };
}

// ------------------------------------------------------------------ people

/** A family member in the tools' helper shape, so September's own leader notes describe them. */
export const asHelper = (p: PlannedMember): Helper => {
  const group: Group = p.stage === 'adult' ? 'adult' : (p.age ?? 8) <= 5 ? 'young' : (p.age ?? 8) <= 12 ? 'school' : 'teen';
  return { id: p.id, name: p.firstName, group, age: p.age, limits: [] };
};

/** Who could lead the next meeting: anyone but the account holder who's 6 or older. Never chosen for her. */
export const leadCandidates = (people: readonly PlannedMember[]) => people.filter((p) => !p.isAccountHolder && (p.stage === 'adult' || (p.age ?? 0) >= 6));

/** One small meeting role per person, by age (the household's real ages; a generic set without a profile). */
export function meetingRoles(people: readonly PlannedMember[]): string[] {
  const role = (p: PlannedMember) => {
    const g = asHelper(p).group;
    if (g === 'young') return `${p.firstName}: find one activity on the calendar.`;
    if (g === 'school') return `${p.firstName}: share what they need ready this week.`;
    if (g === 'teen') return `${p.firstName}: bring schedule updates and spot any clashes.`;
    return `${p.firstName}: guide the conversation or update the calendar.`;
  };
  if (people.length < 2) {
    return [
      'A younger child: find one activity on the calendar.',
      'A school-age child: share what they need ready.',
      'A teenager: bring schedule updates or spot clashes.',
      'An adult: guide the conversation or update the calendar.',
    ];
  }
  return people.slice(0, 8).map(role);
}

// ------------------------------------------------------------------ coaching

export interface Coaching {
  title: string;
  why: string;
  /** One to three adjustments; she picks one. */
  fixes: string[];
  cue: string;
  /** Short lines the plan carries (roles, the three questions). */
  roles?: string[];
}

const THREE_QUESTIONS = ['What’s happening this week?', 'Who’s handling the important preparations?', 'Who needs help?'];

/** "Something else", matched by a few plain keywords. null: it can't be told reliably. */
export function classifyOther(words: string): Exclude<Obstacle, 'other'> | null {
  const t = words.toLowerCase();
  if (/forg|rememb|slipped|slip my mind|lost track/.test(t)) return 'forgetting';
  if (/too long|long|boring|bored|chore|tedious|drag|draggy|tired|exhaust/.test(t)) return 'too-long';
  if (/\bkids?\b|child|teen|\bson\b|daughter|phone|interest|participat|won.?t|refus|argu|whin|complain/.test(t)) return 'kids';
  if (/time|busy|schedule|sport|practice|work|shift|travel|weekend|evening|morning|night|activities/.test(t)) return 'time';
  if (/\bi (do|plan|run|end up)|myself|alone|just me|on me|all me|my job/.test(t)) return 'mom-planning';
  return null;
}

/** The response to what made it hard: one title, why it helps, a few adjustments to choose one from, a cue. */
export function coachingFor(obstacle: Obstacle, other: string, people: readonly PlannedMember[]): Coaching & { matched?: Exclude<Obstacle, 'other'> | null } {
  if (obstacle === 'other') {
    const matched = classifyOther(other);
    if (matched) return { ...coachingFor(matched, '', people), matched };
    return {
      matched: null,
      title: 'Try one small experiment',
      why: 'When it’s hard to say what got in the way, one small test this week will tell you more than a new system.',
      fixes: ['Hold one five-minute check-in at dinner this week, then ask what helped and what didn’t.'],
      cue: 'A note on the calendar: five-minute check-in',
    };
  }
  switch (obstacle) {
    case 'forgetting':
      return {
        title: 'Make the meeting visible',
        why: 'A cue everyone can see and a time tied to something you already do will do the remembering, so nobody has to.',
        fixes: [
          'Print September’s meeting guide and keep it beside the wall calendar.',
          'Write the meeting time on the calendar every week.',
          'Attach the meeting to something you already do, like Sunday dinner.',
        ],
        cue: 'The meeting guide beside the wall calendar',
      };
    case 'time':
      return {
        title: 'Make the meeting fit the family',
        why: 'A meeting at a time you’re already together is easier to keep than one that needs its own slot. Any day works.',
        fixes: [
          'Meet when you’re already together, like Friday dinner or Saturday breakfast.',
          'Start with a five-minute meeting if fifteen minutes isn’t realistic.',
          'Try a different day this week and see if it sticks.',
        ],
        cue: 'The meeting time written on the calendar',
      };
    case 'mom-planning':
      return {
        title: 'Share the leadership',
        why: 'When one person runs every meeting, the plan stays in one head. Giving others a real part in it spreads it out.',
        fixes: [
          'Invite someone else to lead the next meeting.',
          'Give each child one small part to play, for their age.',
          'Ask everyone to bring their own schedule updates.',
        ],
        cue: 'The leader’s name on the calendar beside the meeting',
      };
    case 'kids':
      return {
        title: 'Give everyone one small meeting role',
        why: 'Kids join in when they have a part of their own, sized to their age. Nobody has to lead the whole meeting.',
        fixes: ['Give everyone one small role at the next meeting.'],
        cue: 'Each person’s role written on the meeting guide',
        roles: meetingRoles(people),
      };
    case 'too-long':
      return {
        title: 'Use the five-minute family reset',
        why: 'A short meeting that happens beats a long one that doesn’t. Three questions are enough to restart the habit.',
        fixes: ['Hold a five-minute reset with three questions.'],
        cue: 'The three questions on a note by the calendar',
        roles: THREE_QUESTIONS,
      };
  }
}

/** One short, practical response to what's hard about letting go. */
export const HARD_COACHING: Record<HardPart, { title: string; body: string }> = {
  reminding: { title: 'Let a cue do the reminding', body: 'Agree on a clear trigger, like right after dinner, and a cue everyone can see, so the job doesn’t depend on you remembering for them.' },
  standards: { title: 'Agree on done, then let go of how', body: 'Write what finished looks like in one sentence. Within that, their way of doing it is fine.' },
  faster: { title: 'Teach it once, then step back', body: 'It is faster to do it yourself this week. A short teaching period, then a gradual handover, is what makes it faster later.' },
  'follow-through': { title: 'Start small and check in', body: 'Begin with a manageable version, practice it together, and check in after one week. Follow-through grows with practice.' },
  other: { title: 'Start with the smallest part', body: 'Hand over one part of the job first, practice it together, and check in after a week.' },
};

// ------------------------------------------------------------------ handoff

/** Library jobs for each choice, whole jobs first: the first one that suits the person is theirs. */
const JOB_ITEMS: Record<Exclude<JobChoice, 'other'>, { items: string[]; when: string }> = {
  kitchen: { items: ['close-the-kitchen', 'load-the-dishwasher', 'wipe-the-counters', 'clear-the-table'], when: 'After dinner, every night' },
  laundry: { items: ['family-laundry', 'help-with-laundry', 'put-clothes-away'], when: 'Once a week, on laundry day' },
  school: { items: ['school-paperwork', 'pack-my-backpack'], when: 'Every school night' },
  space: { items: ['vacuum-the-living-room', 'shoes-and-coats', 'put-toys-away'], when: 'Before dinner each day' },
  groceries: { items: ['groceries', 'put-groceries-away'], when: 'When the groceries come home' },
};

/** The version of a job that suits this person (the library's age rules), or null. */
export function jobFor(job: JobChoice | null, person: PlannedMember | undefined, items: readonly KitItem[], prefs: HouseholdPreferences): KitItem | null {
  if (!job || job === 'other' || !person) return null;
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const id of JOB_ITEMS[job].items) {
    const item = byId.get(id);
    if (item && eligible(item, person, prefs)) return item;
  }
  return null;
}

const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

/** The handoff's three lines, prefilled from the library for this person; hers to change. */
export function defineFor(s: GuideState, people: readonly PlannedMember[], items: readonly KitItem[], prefs: HouseholdPreferences) {
  const person = people.find((p) => p.id === s.ownerId);
  const name = person?.firstName ?? (s.ownerName.trim() || 'They');
  const item = jobFor(s.job, person, items, prefs);
  const what = s.job === 'other' ? s.jobOther.trim() : item ? lowerFirst(item.title) : label(JOB_OPTIONS, s.job).toLowerCase();
  return {
    statement: `${name} owns ${what}.`,
    when: s.job && s.job !== 'other' ? JOB_ITEMS[s.job].when : '',
    done: item?.doneMeans ?? '',
  };
}

const LEVEL_LINE: Record<OwnershipLevel, (name: string) => string> = {
  learning: (n) => `${n} does it with a grown-up beside them for now.`,
  'with-check': (n) => `${n} does it start to finish; a grown-up checks it’s done.`,
  owns: (n) => `${n} runs it, including noticing it needs doing.`,
};

/** How much support fits: the library's ownership level for their age, or "owns" for an adult or a job not in it. */
export function supportLine(s: GuideState, people: readonly PlannedMember[], items: readonly KitItem[], prefs: HouseholdPreferences): string {
  const person = people.find((p) => p.id === s.ownerId);
  const name = person?.firstName ?? (s.ownerName.trim() || 'They');
  const item = jobFor(s.job, person, items, prefs);
  const level: OwnershipLevel = person && item ? levelFor(item, person) : person && person.stage !== 'adult' ? 'with-check' : 'owns';
  return LEVEL_LINE[level](name);
}

// ------------------------------------------------------------------ the plan

export interface Plan {
  kind: PlanKind;
  title: string;
  goal: string;
  /** Restart: what got in the way, in her words or the option's. */
  obstacle?: string;
  /** Why this helps, in a sentence (restart). */
  why?: string;
  step: string;
  who: string;
  when: string;
  cue: string;
  checkIn: string;
  /** Short lines under the step: roles, the three questions, what a leader does. */
  roles: string[];
  handoff?: { statement: string; when: string; done: string; coaching: string; stages: { word: string; text: string }[] };
}

export const PLAN_TITLE: Record<PlanKind, string> = {
  'first-meeting': 'Our First Family Meeting Plan',
  restart: 'Our Family Restart Plan',
  leadership: 'Our Family’s Next Step',
  handoff: 'Our Ownership Handoff Plan',
};

/** The answers a plan is made from: a changed one makes a fresh plan. */
export const planKey = (s: GuideState) => JSON.stringify([pathOf(s), s.leadId, s.leadName.trim(), s.obstacle, s.obstacleOther.trim(), s.fix, s.time, s.timeOther.trim(), s.place, s.placeOther.trim(), s.job, s.jobOther.trim(), s.ownerId, s.ownerName.trim(), s.hard, s.define]);

const timeText = (s: GuideState) => (s.time === 'other' ? s.timeOther.trim() : label(TIME_OPTIONS, s.time));
const everyone = (people: readonly PlannedMember[]) => {
  const names = people.map((p) => p.firstName).filter(Boolean);
  if (names.length < 2) return 'Everyone at home';
  return names.length > 6 ? 'The whole family' : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};

/** One plan for the path she's on (never all of them). */
export function buildPlan(s: GuideState, people: readonly PlannedMember[], items: readonly KitItem[], prefs: HouseholdPreferences): Plan | null {
  const path = pathOf(s);
  if (path === 'meeting') {
    const where = s.place === 'other' ? s.placeOther.trim() : lowerFirst(label(PLACE_OPTIONS, s.place));
    return {
      kind: 'first-meeting', title: PLAN_TITLE['first-meeting'],
      goal: 'Have one short family meeting.',
      step: 'Gather around the wall calendar for 5 to 15 minutes. Talk about what’s coming this week, and let everyone add something.',
      who: everyone(people),
      when: timeText(s),
      cue: `The meeting guide, kept ${where}`,
      checkIn: 'What did everyone like about our first meeting?',
      roles: THREE_QUESTIONS,
    };
  }
  if (path === 'restart' && s.obstacle) {
    const c = coachingFor(s.obstacle, s.obstacleOther, people);
    return {
      kind: 'restart', title: PLAN_TITLE.restart,
      goal: c.title,
      obstacle: s.obstacle === 'other' ? s.obstacleOther.trim() : label(OBSTACLE_OPTIONS, s.obstacle),
      why: c.why,
      step: c.fixes[s.fix ?? 0] ?? c.fixes[0],
      who: everyone(people),
      when: timeText(s),
      cue: c.cue,
      checkIn: 'Did this make the meeting easier to keep?',
      roles: c.roles ?? [],
    };
  }
  if (path === 'leadership') {
    const lead = people.find((p) => p.id === s.leadId);
    const name = lead?.firstName ?? s.leadName.trim();
    return {
      kind: 'leadership', title: PLAN_TITLE.leadership,
      goal: 'Share the meeting leadership.',
      step: `${name} leads our next family meeting.`,
      who: `${name} leads. Everyone takes part, and Mom joins in without running it.`,
      when: timeText(s),
      cue: `${name}’s name on the calendar beside the meeting`,
      checkIn: `How did it feel to have ${name} lead?`,
      roles: [
        ...(lead ? [leaderNote(asHelper(lead))] : []),
        'Ask the questions.', 'Help update the calendar.', 'Invite everyone to share.', 'Help spot what needs preparing.',
      ],
    };
  }
  if (path === 'handoff' && s.define) {
    const person = people.find((p) => p.id === s.ownerId);
    const name = person?.firstName ?? (s.ownerName.trim() || 'They');
    const coaching = s.hard ? HARD_COACHING[s.hard] : HARD_COACHING.other;
    return {
      kind: 'handoff', title: PLAN_TITLE.handoff,
      goal: 'Hand off one whole job.',
      step: s.define.statement,
      who: person && person.stage !== 'adult' ? `${name}, with a grown-up teaching it first` : name,
      when: s.define.when,
      cue: s.hard === 'reminding' ? 'This card where the job happens, instead of reminders' : 'This card beside the wall calendar',
      checkIn: 'After a week: what’s working, and what needs adjusting?',
      roles: [],
      handoff: {
        statement: s.define.statement,
        when: s.define.when,
        done: s.define.done,
        coaching: `${coaching.title}. ${coaching.body}`,
        stages: [
          { word: 'Show it', text: `Show ${name} the job once, and what finished looks like.` },
          { word: 'Do it together', text: 'Practice it side by side, once or twice.' },
          { word: 'Hand it over', text: supportLine(s, people, items, prefs) },
          { word: 'Check in', text: 'After a week, ask what’s working and what needs adjusting.' },
        ],
      },
    };
  }
  return null;
}

/** The plan as plain text, to copy into a message or a note. */
export function planText(plan: Plan, family?: string): string {
  const out = [plan.title + (family ? ` · ${family}` : ''), '', `Goal: ${plan.goal}`];
  if (plan.obstacle) out.push(`What got in the way: ${plan.obstacle}`);
  out.push(`Our next step: ${plan.step}`);
  if (plan.roles.length) out.push(...plan.roles.map((r) => `- ${r}`));
  if (plan.handoff) {
    out.push(`When: ${plan.handoff.when}`, `Done looks like: ${plan.handoff.done}`, '');
    out.push(...plan.handoff.stages.map((st) => `${st.word}: ${st.text}`));
  }
  out.push('', `Who's involved: ${plan.who}`);
  if (!plan.handoff) out.push(`When we'll try it: ${plan.when}`);
  out.push(`Our reminder: ${plan.cue}`, `Check-in question: ${plan.checkIn}`);
  return out.join('\n');
}

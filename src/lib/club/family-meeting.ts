/**
 * The Monthly Family Meeting engine: a family profile + the month's content (src/data/club/family-meeting.ts) → a
 * prepared 10-minute meeting that introduces the month's resource. Pure and deterministic: the same family and month
 * always give the same meeting, no randomness, no AI calls. It reads; it never saves.
 *
 * Inputs are the existing models, nothing new: the household and members (src/lib/club/profile.ts) and the expanded
 * profile from onboarding (src/lib/club/family-profile.ts: activities, existing/desired/confirmed responsibilities,
 * challenges, priority), plus, optionally, what the month's own resource already prepared for each person.
 *
 * Rules it keeps (tests in tests/club-family-meeting.test.ts):
 *   - Only the family's own details: names, activity names and days come from the profile, or the meeting uses a
 *     generic question. Nothing about a child's interests or activities is invented.
 *   - Grown-ups get no "when": nothing assumes anyone is free on a given day. Children's cues come from the month's
 *     content or from the days of the family's own activity.
 *   - Children get only examples for their age; toddlers under 3 join in and get no job.
 *   - No "Mom", "Dad" or "parents": one grown-up, two or a grandparent all read right.
 *   - The account holder is never the meeting's leader when anyone else can lead, and never gets a job that makes
 *     her everyone's organizer or reminder.
 *   - Suggestions stay suggestions. Existing and confirmed come only from the profile, and nothing here writes them.
 *   - Modest: at most one new suggestion per person, none for someone who already owns this month's kind of job.
 */
import { CATEGORY_FINISHED, meetingMonth, type MeetingExample, type MeetingMonth } from '../../data/club/family-meeting';
import {
  GROWTH_ITEMS, RESPONSIBILITY_CATEGORIES, WEEK_DAYS, labelOf, type ResponsibilityCategory,
} from '../../data/club/family-profile';
import { emptyProfile, type Activity, type FamilyProfile, type Responsibility } from './family-profile';
import { ageInMonth, parseMonth, type FamilyMember, type Household } from './profile';

export const MEETING_MINUTES = { focus: 2, talk: 3, parts: 3, practice: 2 } as const;

export type PartStatus = 'existing' | 'suggested' | 'confirmed';

/** One thing a person does: already does (existing), agreed to (confirmed), or might take on (suggested). */
export interface PartRecommendation {
  memberId: string;
  description: string;
  status: PartStatus;
  /** Existing: owns it or helps when asked. Suggested and confirmed: owns. */
  involvement: 'owns' | 'helps';
  scope: 'individual' | 'shared';
  /** Only when known: the profile, the resource, or a child's cue from the month. */
  when?: string;
  finished: string;
  /** How it connects to this month's resource. */
  connection: string;
  /** Where it came from: her profile, the month's prepared resource, or the month's examples. */
  source: 'profile' | 'resource' | 'month';
  /** Profile responsibility id, resource item id, or example id: so the family can accept or adjust it later. */
  sourceId?: string;
  category?: ResponsibilityCategory;
}

export interface PersonPart {
  memberId: string;
  firstName: string;
  kind: 'adult' | 'child';
  age: number | null;
  existing: PartRecommendation[];
  confirmed: PartRecommendation[];
  suggested: PartRecommendation[];
  /** Under 3: joins in, no job. */
  joinsIn?: boolean;
}

export interface MeetingQuestion {
  text: string;
  /** What made it specific, or 'generic' when the profile didn't say. */
  basis: 'activity' | 'growth' | 'existing' | 'tool' | 'generic';
  audience: 'everyone' | 'kids' | 'grown-ups';
}

/** What the month's resource already prepared for someone (e.g. a role or a chart job). Always a suggestion here. */
export interface ResourceAssignment {
  memberId: string;
  description: string;
  when?: string;
  finished?: string;
  id?: string;
}

export interface MeetingInput {
  household: Household;
  /** The expanded profile (null or partial before she answers it). */
  profile?: FamilyProfile | null;
  /** The kit's month, 'YYYY-MM': ages are as of its first day. */
  month: string;
  resource?: ResourceAssignment[];
}

export interface FamilyMeeting {
  month: string;
  theme: string;
  resourceTitle: string;
  route: string;
  minutes: 10;
  /** Who reads the meeting from the sheet; null means anyone. Never the account holder when someone else can. */
  leaderId: string | null;
  focus: { minutes: 2; challenge: string; principle: string; why: string; forWhom: string };
  talk: { minutes: 3; questions: MeetingQuestion[] };
  parts: { minutes: 3; people: PersonPart[]; note: string };
  practice: { minutes: 2; title: string; steps: string[]; resource: string };
  /** What personalized it, and what was missing (the meeting fell back to generic content for those). */
  used: string[];
  missing: string[];
}

const active = (h: Household) => h.members.filter((m) => !m.archived && m.firstName.trim());
const nameOf = (m: FamilyMember) => m.firstName.trim();
export const joinNames = (names: readonly string[]) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

function ageOf(m: FamilyMember, month: string): number | null {
  if (m.kind !== 'child' || m.birthYear === undefined) return null;
  return ageInMonth(m.birthYear, m.birthMonth, month);
}

/** " on Tue and Thu" from her activity, or "". */
function daysText(days: readonly number[]): string {
  const names = WEEK_DAYS.filter((d) => days.includes(d.day)).map((d) => d.label.slice(0, 3));
  if (!names.length) return '';
  if (names.join() === 'Mon,Tue,Wed,Thu,Fri') return ' on weekdays';
  return ` on ${joinNames(names)}`;
}

function fill(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, k: string) => (k in tokens ? tokens[k] : all)).replace(/\s+/g, ' ').trim();
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** An activity in a sentence, when she didn't name it: "Sports practice is part of our week". */
const ACTIVITY_NOUN: Record<Activity['category'], string> = {
  school: 'School', work: 'Work', sports: 'Sports practice', lessons: 'A lesson', community: 'Church or community time',
  clubs: 'Club time', appointments: 'An appointment', other: 'A regular commitment',
};

/** "soccer" mid-sentence: her own name for it as typed, or the category in lower case. */
const activityMid = (a: Activity, homeschool: boolean) =>
  a.name?.trim() || (homeschool && a.category === 'school' ? 'homeschool' : ACTIVITY_NOUN[a.category].replace(/^(A|An) /, '').toLowerCase());

/** " on Monday evening" / " on Mon and Wed evenings" / " the evening before": before her activity's days, or "". */
function eveningBefore(days: readonly number[]): string {
  // Most days of the week: "the evening before" reads better than a list of five evenings.
  if (days.length > 3) return ' the evening before';
  const before = [...new Set(days.map((d) => (d + 6) % 7))];
  const names = WEEK_DAYS.filter((d) => before.includes(d.day));
  if (!names.length) return '';
  return names.length === 1 ? ` on ${names[0].label} evening` : ` on ${joinNames(names.map((d) => d.label.slice(0, 3)))} evenings`;
}

/** Her activities for the month, the most specific first (days and people known, a few days rather than every day). */
const detailFirst = (list: Activity[]) =>
  list.map((a, i) => ({ a, i, score: (a.days.length ? 2 : 0) + (a.memberIds.length ? 1 : 0) + (a.days.length && a.days.length <= 3 ? 1 : 0) })).sort((x, y) => y.score - x.score || x.i - y.i).map((x) => x.a);

/** Does this profile responsibility belong to the month? */
const inMonth = (m: MeetingMonth, c: ResponsibilityCategory) => m.categories === 'all' || m.categories.includes(c);

export function buildFamilyMeeting(input: MeetingInput): FamilyMeeting {
  const [, mm] = parseMonth(input.month);
  const month = meetingMonth(mm);
  if (!month) throw new Error(`no meeting content for month ${mm}`);
  const profile = input.profile ?? emptyProfile();
  const members = active(input.household);
  const ids = new Set(members.map((m) => m.id));
  const kids = members.filter((m) => m.kind === 'child');
  const adults = members.filter((m) => m.kind === 'adult');
  const holder = adults.find((m) => m.isAccountHolder);
  const age = (m: FamilyMember) => ageOf(m, input.month);
  const used = new Set<string>();
  const missing = new Set<string>();
  if (members.length) used.add('members');
  if (kids.some((k) => age(k) !== null)) used.add('ages');

  const homeschool = input.household.preferences.school === 'homeschool';
  if (input.household.preferences.school) used.add('school');
  const school = homeschool ? 'lessons' : 'school';
  const kidNames = kids.map(nameOf);
  const base = { school, kids: kidNames.length ? joinNames(kidNames) : 'the kids' };

  // ------------------------------------------------------------ the family's own data for this month
  const monthActivities = detailFirst(profile.activities.filter((a) => month.activities.includes(a.category)));
  if (!profile.activities.length) missing.add('activities');
  const related = profile.responsibilities.filter((r) => inMonth(month, r.category));
  const connection = fill(month.connection, base);
  const existing = related.filter((r) => r.status === 'existing');
  const confirmed = related.filter((r) => r.status === 'confirmed');
  const desired = profile.responsibilities.filter((r) => r.status === 'desired' && r.item && month.growth.includes(r.item));
  if (!profile.responsibilities.some((r) => r.status === 'existing')) missing.add('existing responsibilities');
  if (!profile.responsibilities.some((r) => r.status === 'desired')) missing.add('growth areas');
  if (!profile.challenges.length) missing.add('challenges');
  if (!profile.priority) missing.add('priority');

  // ------------------------------------------------------------ 1. Our Focus
  let why = fill(month.why, base);
  if (profile.priority && month.byPriority[profile.priority]) {
    why = fill(month.byPriority[profile.priority], base);
    used.add('priority');
  } else {
    const c = profile.challenges.find((x) => month.byChallenge[x]);
    if (c) {
      why = fill(month.byChallenge[c], base);
      used.add('challenges');
    } else if (desired.length) {
      why = `${labelOf(GROWTH_ITEMS, desired[0].item)} is something your family wants to grow in, and this month’s resource helps with it.`;
      used.add('growth areas');
    }
  }
  const forWhom = kids.length
    ? `For ${joinNames(kids.map((k) => (age(k) !== null ? `${nameOf(k)} (${age(k)})` : nameOf(k))))}${adults.length ? `, with ${joinNames(adults.map(nameOf))}` : ''}.`
    : `For ${joinNames(adults.map(nameOf))}.`;

  // ------------------------------------------------------------ 2. Let's Talk
  const questions: MeetingQuestion[] = [];
  const act = monthActivities[0];
  if (act) {
    const who = act.memberIds.filter((id) => ids.has(id)).map((id) => nameOf(members.find((m) => m.id === id)!));
    questions.push({
      text: fill(month.questions.schedule.withActivity, {
        ...base, activity: capitalize(act.name?.trim() || (homeschool && act.category === 'school' ? 'Homeschool' : ACTIVITY_NOUN[act.category])),
        activityMid: activityMid(act, homeschool), eveningBefore: eveningBefore(act.days),
        days: daysText(act.days), who: who.length ? joinNames(who) : 'everyone',
      }),
      basis: 'activity', audience: 'everyone',
    });
    used.add('activities');
  } else {
    questions.push({ text: fill(month.questions.schedule.generic, base), basis: 'generic', audience: 'everyone' });
  }
  const ages = kids.map(age).filter((a): a is number => a !== null);
  const youngest = ages.length ? Math.min(...ages) : null;
  questions.push(
    kids.length
      ? { text: fill(youngest !== null && youngest < 7 ? month.questions.tool.young : month.questions.tool.older, base), basis: 'tool', audience: 'kids' }
      : { text: fill(month.questions.tool.adults, base), basis: 'tool', audience: 'grown-ups' },
  );
  const growthQ = kids.length ? desired[0] : undefined;
  const ownedQ = existing.find((r) => r.ownerIds.some((id) => ids.has(id)));
  if (growthQ) {
    const targeted = growthQ.ownerIds.filter((id) => ids.has(id)).map((id) => nameOf(members.find((m) => m.id === id)!));
    questions.push({ text: fill(month.questions.ownership.withGrowth, { ...base, growth: labelOf(GROWTH_ITEMS, growthQ.item), kids: targeted.length ? joinNames(targeted) : base.kids }), basis: 'growth', audience: 'everyone' });
    used.add('growth areas');
  } else if (ownedQ) {
    const who = ownedQ.ownerIds.filter((id) => ids.has(id)).map((id) => nameOf(members.find((m) => m.id === id)!));
    questions.push({ text: fill(month.questions.ownership.withExisting, { ...base, who: joinNames(who), takes: who.length > 1 ? 'take' : 'takes', task: taskLabel(ownedQ).toLowerCase() }), basis: 'existing', audience: 'everyone' });
    used.add('existing responsibilities');
  } else {
    questions.push({ text: fill(month.questions.ownership.generic, base), basis: 'generic', audience: 'everyone' });
  }

  // ------------------------------------------------------------ 3. Everyone's Part
  const fromResource = new Map<string, ResourceAssignment>();
  for (const r of input.resource ?? []) if (ids.has(r.memberId) && r.description.trim() && !fromResource.has(r.memberId)) fromResource.set(r.memberId, r);
  if (fromResource.size) used.add('resource');

  const people: PersonPart[] = members.map((m) => {
    const a = age(m);
    const part: PersonPart = { memberId: m.id, firstName: nameOf(m), kind: m.kind, age: a, existing: [], confirmed: [], suggested: [] };
    for (const r of existing) {
      const owns = r.ownerIds.includes(m.id);
      if (!owns && !r.helperIds.includes(m.id)) continue;
      part.existing.push(fromProfile(r, m.id, owns ? 'owns' : 'helps', 'existing', connection));
    }
    for (const r of confirmed) if (r.ownerIds.includes(m.id)) part.confirmed.push(fromProfile(r, m.id, 'owns', 'confirmed', connection));
    if (part.existing.length || part.confirmed.length) used.add('existing responsibilities');

    if (m.kind === 'child' && a !== null && a < 3) {
      part.joinsIn = true;
      return part;
    }
    const res = fromResource.get(m.id);
    if (res) {
      part.suggested.push({
        memberId: m.id, description: res.description.trim(), status: 'suggested', involvement: 'owns', scope: 'individual',
        ...(res.when ? { when: res.when } : {}), finished: res.finished?.trim() || 'Done the way the resource shows.',
        connection, source: 'resource', ...(res.id ? { sourceId: res.id } : {}),
      });
      return part;
    }
    // Already owns this month's kind of job: keep it, nothing new on top.
    if (part.existing.some((e) => e.involvement === 'owns') || part.confirmed.length) return part;
    const theirs = (e: MeetingExample) => (e.forActivity ? detailFirst(profile.activities).find((x) => e.forActivity!.includes(x.category) && x.memberIds.includes(m.id)) : undefined);
    const ex = pickExample(month, m, a, m === holder, input.household.preferences.pets === true || profile.responsibilities.some((r) => r.category === 'pet-care'), desired, (e) => Boolean(theirs(e)));
    if (ex) {
      const own = theirs(ex);
      const tokens = own ? { ...base, activity: activityMid(own, homeschool) } : base;
      part.suggested.push({
        memberId: m.id, description: fill(ex.description, tokens), status: 'suggested', involvement: 'owns', scope: 'individual',
        ...(m.kind !== 'child' ? {} : own ? { when: capitalize(eveningBefore(own.days).trim().replace(/^on /, '')) || 'The evening before' } : whenFor(ex, profile.activities, m.id, base)),
        finished: fill(ex.finished, tokens), connection, source: 'month', sourceId: ex.id, category: ex.category,
      });
      if (own) used.add('activities');
    }
    return part;
  });

  // ------------------------------------------------------------ 4. Let's Practice
  const practiceKid = [...kids].filter((k) => (age(k) ?? 3) >= 3).sort((x, y) => (age(x) ?? 99) - (age(y) ?? 99))[0];
  const steps = (practiceKid ? month.practice.steps : month.practice.noKids).map((s) => fill(s, { ...base, kid: practiceKid ? nameOf(practiceKid) : '' }));

  return {
    month: input.month,
    theme: month.theme,
    resourceTitle: month.resourceTitle,
    route: month.route,
    minutes: 10,
    leaderId: leaderFor(members, holder, mm, age),
    focus: { minutes: 2, challenge: fill(month.challenge, base), principle: fill(month.principle, base), why, forWhom },
    talk: { minutes: 3, questions },
    parts: {
      minutes: 3, people,
      note: 'Suggestions are ideas to talk about. Keep, change or skip any of them; nothing is agreed until your family says so.',
    },
    practice: { minutes: 2, title: month.practice.title, steps, resource: month.resourceTitle },
    used: [...used].sort(),
    missing: [...missing].sort(),
  };
}

function taskLabel(r: Responsibility): string {
  return r.label?.trim() || labelOf(RESPONSIBILITY_CATEGORIES, r.category) || labelOf(GROWTH_ITEMS, r.item);
}

function fromProfile(r: Responsibility, memberId: string, involvement: 'owns' | 'helps', status: 'existing' | 'confirmed', connection: string): PartRecommendation {
  const task = taskLabel(r);
  return {
    memberId,
    description: involvement === 'owns' ? `Takes care of ${task.toLowerCase()}` : `Helps with ${task.toLowerCase()} when asked`,
    status, involvement,
    scope: r.ownerIds.length > 1 ? 'shared' : 'individual',
    finished: CATEGORY_FINISHED[r.category],
    connection,
    source: 'profile', ...(r.id ? { sourceId: r.id } : {}), category: r.category,
  };
}

/**
 * The one example for this person: a growth item the family picked (for this child, or for the kids generally) if an
 * example fits their age, then one tied to an activity she said this child takes part in, else the first that fits. Grown-ups: 'any' examples, or 'other' for those who don't hold
 * the account. Never a pet job for a family that didn't mention a pet.
 */
function pickExample(month: MeetingMonth, m: FamilyMember, age: number | null, isHolder: boolean, pets: boolean, desired: Responsibility[], hasActivity: (e: MeetingExample) => boolean): MeetingExample | undefined {
  const fits = (e: MeetingExample) => {
    if (e.requiresPets && !pets) return false;
    if (e.forActivity && !hasActivity(e)) return false;
    if (m.kind === 'adult') return e.adult === 'any' || (e.adult === 'other' && !isHolder);
    if (e.adult || age === null || e.minAge === undefined) return false;
    return age >= e.minAge && (e.maxAge === undefined || age <= e.maxAge);
  };
  const options = month.examples.filter(fits);
  if (m.kind === 'child') {
    const wanted = desired.filter((d) => !d.ownerIds.length || d.ownerIds.includes(m.id)).map((d) => d.item);
    const match = options.find((e) => e.growth && wanted.includes(e.growth));
    if (match) return match;
    const own = options.find((e) => e.forActivity);
    if (own) return own;
  }
  if (m.kind === 'adult' && !isHolder) return options.find((e) => e.adult === 'other') ?? options[0];
  return options[0];
}

/** A child's cue: the days of their own activity in this category, if she entered them; else the month's cue. */
function whenFor(ex: MeetingExample, activities: Activity[], memberId: string, base: Record<string, string>): { when?: string } {
  if (ex.whenFrom) {
    const a = activities.find((x) => x.category === ex.whenFrom && x.days.length && (!x.memberIds.length || x.memberIds.includes(memberId)));
    if (a) return { when: ex.when ? `${fill(ex.when, base)},${daysText(a.days)}` : capitalize(daysText(a.days).trim()) };
  }
  return ex.when ? { when: fill(ex.when, base) } : {};
}

/**
 * Who reads the meeting: rotating month to month among grown-ups who don't hold the account and children 9 and up;
 * the account holder only when nobody else can.
 */
function leaderFor(members: FamilyMember[], holder: FamilyMember | undefined, month: number, age: (m: FamilyMember) => number | null): string | null {
  const able = members.filter((m) => m !== holder && (m.kind === 'adult' || (age(m) ?? 0) >= 9));
  if (able.length) return able[(month - 1) % able.length].id;
  return holder?.id ?? members.find((m) => m.kind === 'adult')?.id ?? null;
}

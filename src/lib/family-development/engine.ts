/**
 * The Organized Family development engine: one useful next step per child for the weekly Family Meeting.
 *
 * Pure and deterministic. No AI, no network, no randomness, no clock: the caller passes `today`. It reads the
 * household, the family profile and the family's development records; it never writes anything and never decides
 * for the family. docs/product/FAMILY_DEVELOPMENT_ENGINE.md has the full rules; tests in
 * tests/family-development-engine.test.ts.
 *
 * Order of preference for each child (at most ONE step per child):
 *   1. An active record that needs attention (last answer "not yet" or "partly").
 *   2. An active record due for its weekly check-in (a launched one every four weeks).
 *   3. Nothing, when the child already has a record in Model or Assist, two responsibilities in progress (active
 *      records plus other current agreements), or an agreement made this past week: adult time is the limit, and a
 *      new skill on top would be administration, not coaching. Existing agreements come first.
 *   4. A new skill from the curated library, at most two per meeting for the whole household.
 *
 * Never: a stage change, a skill the family paused or dismissed (until they reopen it), a skill the child already
 * owns, a supervised task below its typical starting age, or anything that assumes facts the family didn't give
 * (pets, a yard, a dishwasher, school attendance for a homeschool family).
 */
import type { MawlStage } from './framework';
import { HAND_OVER_LABEL } from './language';
import { SKILLS_LIBRARY_VERSION, skillById, skills, type CuratedSkill, type SkillCategory } from './skills';
import { availableDecisions, type CheckSignal, type CheckValue, type DevelopmentDecision, type DevelopmentRecord } from './records';
import { CHALLENGES, GROWTH_ITEMS, PRIORITIES, labelOf, type ResponsibilityCategory } from '../../data/club/family-profile';
import type { FamilyProfile } from '../club/family-profile';
import { ageInMonth, type FamilyMember, type Household } from '../club/profile';
import type { SeasonContext } from './framework';

export const ENGINE_VERSION = 1 as const;
/** New skills offered in one meeting, for the whole household: start with one or two, not an assessment. */
export const MAX_NEW_PER_MEETING = 2;
/** A child with this many active records gets no new skill. */
export const MAX_ACTIVE_PER_CHILD = 2;
export const CHECK_IN_DAYS = 6;
export const LAUNCHED_CHECK_IN_DAYS = 28;

// ------------------------------------------------------------------ season

const SEASON_LABEL: Record<Exclude<SeasonContext, 'everyday'>, string> = {
  'summer-transition': 'The change of rhythm into summer',
  'school-start': 'The start of the school year',
  'new-year': 'A new year',
};

/**
 * The season by date (Northern Hemisphere US school calendar as a default; it only reorders ideas, never resets a
 * child's records): May 15–Jul 15 summer transition, Jul 16–Sep 15 school start, Dec 15–Jan 31 new year.
 */
export function seasonOf(today: string): SeasonContext {
  const [, m, d] = today.split('-').map(Number);
  const md = m * 100 + d;
  if (md >= 515 && md <= 715) return 'summer-transition';
  if (md >= 716 && md <= 915) return 'school-start';
  if (md >= 1215 || md <= 131) return 'new-year';
  return 'everyday';
}

// ------------------------------------------------------------------ crosswalks (reviewed, not inferred from names)

/** The family profile's growth items (onboarding "Growing responsibility") → canonical skill, by age where it matters. */
export function skillForGrowthItem(item: string, age: number | null): string | null {
  const a = age ?? 0;
  switch (item) {
    case 'morning-routine': return 'morning-rhythm';
    case 'bedtime-routine': return 'evening-rhythm';
    case 'pack-school-bag': return 'school-bag';
    case 'tidy-room': return a >= 11 ? 'room' : 'floor';
    case 'put-away-laundry': return a >= 7 ? 'fold' : 'sort';
    case 'help-with-meals': return a >= 7 ? 'dinner-help' : 'table';
    case 'own-belongings': return 'entryway';
    case 'pet-care': return a >= 12 ? 'pet-care' : 'pet';
    default: return null; // 'homework-start' has no curated skill yet: never forced onto a near match.
  }
}

/** The agreement source key for a skill: what "We agreed" saves in club_responsibilities.agreed_source. */
export const skillAgreementSource = (skillId: string) => `skill:${skillId}`;
export const skillFromAgreementSource = (source: string | undefined) =>
  source?.startsWith('skill:') ? source.slice(6) : null;

/** The responsibility category an agreement for this skill is filed under (club_responsibilities.category). */
export function responsibilityCategoryOf(skill: Pick<CuratedSkill, 'id' | 'category'>): ResponsibilityCategory {
  const byId: Record<string, ResponsibilityCategory> = {
    hamper: 'laundry', pet: 'pet-care', 'pet-care': 'pet-care', 'after-school': 'belongings', entryway: 'belongings',
    desk: 'homework', teeth: 'routines', dressed: 'routines', hands: 'routines',
  };
  if (byId[skill.id]) return byId[skill.id];
  const byCategory: Record<SkillCategory, ResponsibilityCategory> = {
    'self-care': 'cleaning', 'personal-space': 'cleaning', 'school-prep': 'school-prep', 'home-care': 'cleaning',
    meals: 'meals', laundry: 'laundry', 'food-independence': 'meals', initiative: 'other', routines: 'routines',
    caring: 'other', 'family-team': 'other',
  };
  return byCategory[skill.category];
}

/** Earlier skill → the next one it builds toward. A successor waits until the family launches its foundation. */
export const PROGRESSIONS: Readonly<Record<string, string>> = Object.freeze({
  'bed-help': 'bed', toys: 'floor', floor: 'room', sort: 'fold', fold: 'load', load: 'own-laundry',
  'trash-small': 'trash', 'bath-sink': 'bath', 'dinner-help': 'dinner', pet: 'pet-care', 'school-bag': 'school-day-prep',
  table: 'dishes', dishes: 'kitchen', counters: 'kitchen',
});
const FOUNDATIONS = new Map<string, string[]>();
for (const [from, to] of Object.entries(PROGRESSIONS)) FOUNDATIONS.set(to, [...(FOUNDATIONS.get(to) ?? []), from]);

/** Skills that assume something about the home. Offered only when the family said so. */
const NEEDS_FACT: Readonly<Record<string, 'pets' | 'home'>> = {
  pet: 'pets', 'pet-care': 'pets', yard: 'home', outdoor: 'home', dishwasher: 'home', plants: 'home',
};
const SCHOOL_SKILLS = new Set(['school-bag', 'school-day-prep', 'after-school']);

const PRIORITY_SKILLS: Record<string, readonly string[]> = {
  mornings: ['morning-rhythm', 'dressed', 'teeth', 'bed', 'bed-help', 'school-bag'],
  evenings: ['evening-rhythm', 'table', 'dishes', 'dinner-help', 'counters', 'kitchen'],
  bedtime: ['evening-rhythm', 'teeth', 'floor', 'toys'],
  activities: ['school-day-prep', 'school-bag', 'after-school'],
  'school-stuff': ['school-bag', 'school-day-prep', 'after-school', 'desk'],
  tidying: ['toys', 'floor', 'room', 'shared', 'entryway', 'desk'],
  laundry: ['hamper', 'sort', 'fold', 'load', 'own-laundry'],
  reminding: ['family-meeting', 'morning-rhythm', 'evening-rhythm', 'after-school'],
};
const CHALLENGE_SKILLS: Record<string, readonly string[]> = {
  routines: ['morning-rhythm', 'evening-rhythm', 'teeth', 'dressed'],
  preparing: ['school-bag', 'school-day-prep'],
  remembering: ['family-meeting', 'after-school'],
  'sharing-fairly': ['shared', 'table', 'dishes', 'trash-small', 'entryway'],
  'knowing-plans': ['family-meeting'],
  communicating: ['family-meeting'],
};
/** Familiar anchors for habit stacking, by the family's priority. Shown as options, never assumed. */
const PRIORITY_ANCHOR: Record<string, string> = {
  mornings: 'After brushing teeth in the morning',
  evenings: 'Right after dinner',
  bedtime: 'Before brushing teeth at night',
  'school-stuff': 'When we get home from school',
  activities: 'When we get home from school',
};

// ------------------------------------------------------------------ output

export interface CheckInQuestion {
  signal: CheckSignal;
  text: string;
  answers: { value: CheckValue; label: string }[];
}

export interface CheckInStep {
  kind: 'check-in';
  /** Its agreement was removed elsewhere (Who does what): the family chooses to put it back or pause it. */
  agreementRemoved?: boolean;
  record: DevelopmentRecord;
  /** Null if the library no longer has the id (the family's own words still show). */
  skill: CuratedSkill | null;
  question: CheckInQuestion;
  /** Stage coaching for the adult, from the authored library. */
  coaching: string;
  /** Watch only, occasionally: a new circumstance to practice quality and adaptation. */
  watchVariation?: string;
  /** A gentle, optional observation. Never a decision. */
  hint?: string;
  decisions: DevelopmentDecision[];
  attention: boolean;
  why: string[];
  safety?: string;
}

export interface SuggestStep {
  kind: 'suggest';
  skill: CuratedSkill;
  /** Always Model: the family chooses a different starting stage if the child is further along. */
  suggestedStage: 'model';
  cueOptions: string[];
  finishLine: string;
  naturalPayoff: string;
  coaching: string;
  why: string[];
  /** True when the profile gave us nothing specific: shown as a starting idea. */
  generic: boolean;
  safety?: string;
  score: number;
}

export type DevelopmentStep = CheckInStep | SuggestStep;

export interface PersonDevelopment {
  memberId: string;
  firstName: string;
  age: number | null;
  step: DevelopmentStep | null;
  /** Active or launched records, for a one-line summary ("Working on: …"). */
  current: DevelopmentRecord[];
}

export interface DevelopmentPlan {
  engineVersion: typeof ENGINE_VERSION;
  libraryVersion: typeof SKILLS_LIBRARY_VERSION;
  season: SeasonContext;
  /** Records couldn't be read: nothing new is suggested (a dismissed skill must never come back by accident). */
  unavailable: boolean;
  people: PersonDevelopment[];
}

export interface EngineInput {
  household: Household | null;
  profile?: FamilyProfile | null;
  /** null = could not be loaded. [] = loaded, none yet. */
  records: readonly DevelopmentRecord[] | null;
  /** 'YYYY-MM-DD', the meeting's date. */
  today: string;
}

// ------------------------------------------------------------------ helpers

const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / 86400e3);

function childAge(m: FamilyMember, today: string): number | null {
  if (m.kind !== 'child' || m.birthYear === undefined) return null;
  return ageInMonth(m.birthYear, m.birthMonth, today.slice(0, 7));
}

const STAGE_COACH_FALLBACK: Record<MawlStage, string> = {
  model: 'Do it while they watch, and say out loud what finished looks like.',
  assist: 'Do it together. Hand over one step at a time.',
  watch: 'Let them do it while you stay nearby. Coach quality, and notice how it goes when the day is different.',
  launch: 'It’s their responsibility now. Notice it and thank them. If it slips for a while, you can always step back and practice together.',
};

export function checkInQuestion(record: Pick<DevelopmentRecord, 'stage' | 'title' | 'cue'>, firstName: string): CheckInQuestion {
  switch (record.stage) {
    case 'watch':
      return {
        signal: 'consistency',
        text: `Did ${firstName} do “${record.title}” ${record.cue ? `at the usual time (${record.cue.charAt(0).toLowerCase() + record.cue.slice(1)})` : 'at the usual time'} without a reminder?`,
        answers: [{ value: 'strong', label: 'Usually' }, { value: 'partial', label: 'Sometimes' }, { value: 'not-yet', label: 'Rarely' }],
      };
    case 'launch':
      return {
        signal: 'ownership',
        text: `Is “${record.title}” still ${firstName}’s? Noticing it, starting it and finishing it.`,
        answers: [{ value: 'strong', label: 'Yes, theirs' }, { value: 'partial', label: 'Slipping a bit' }, { value: 'not-yet', label: 'Back to us' }],
      };
    default:
      return {
        signal: 'performance',
        text: `Can ${firstName} do the steps of “${record.title}” with you nearby?`,
        answers: [{ value: 'strong', label: 'Yes, the steps are clear' }, { value: 'partial', label: 'Some of them' }, { value: 'not-yet', label: 'Not yet' }],
      };
  }
}

function lastCheckValues(r: DevelopmentRecord): CheckValue[] {
  return r.history.filter((e) => e.value).map((e) => e.value!).slice(-2);
}

function checkInFor(r: DevelopmentRecord, firstName: string, today: string): CheckInStep | null {
  if (r.status !== 'active' && r.status !== 'launched') return null;
  if (!r.stage) return null;
  const skill = skillById(r.skillId);
  // The record says active but its agreement is gone from the lists: never leave the two contradicting each other.
  if (r.agreementLive === false) {
    return {
      kind: 'check-in', agreementRemoved: true, record: r, skill, question: checkInQuestion(r, firstName),
      coaching: skill?.[r.stage] ?? STAGE_COACH_FALLBACK[r.stage],
      decisions: availableDecisions(r), attention: true,
      why: [`“${r.title}” was taken off ${firstName}’s list. Put it back, or pause it here too?`],
      ...(skill?.safety ? { safety: skill.safety } : {}),
    };
  }
  const attention = r.status === 'active' && (r.lastValue === 'not-yet' || r.lastValue === 'partial');
  const since = r.lastCheckInOn ?? r.createdAt?.slice(0, 10);
  const days = since ? daysBetween(since, today) : Infinity;
  const due = days >= (r.status === 'launched' ? LAUNCHED_CHECK_IN_DAYS : CHECK_IN_DAYS);
  if (!due && !attention) return null;
  // Already answered today (two phones, or the page reopened): don't ask twice.
  if (r.lastCheckInOn === today) return null;

  const why: string[] = [];
  if (attention) why.push(r.lastValue === 'not-yet' ? 'Last time you said it wasn’t happening yet.' : 'Last time you said it was happening some of the time.');
  else why.push(r.status === 'launched' ? `${firstName} owns this. A quick check that it’s still working.` : 'Something your family is already working on comes first.');

  // The library's generated Watch line repeats its variation ("…practice a variation: X"); the variation gets its own
  // line below, so the coaching says what Watch is for instead of saying the same thing twice.
  const authored = skill?.[r.stage];
  // The library's Launch lines describe the decision to hand over ("The family decides when…"); once the family has
  // made it, coach what comes after instead.
  const coaching = authored && r.stage !== 'launch' && !(r.stage === 'watch' && /practice a variation:/.test(authored)) ? authored : STAGE_COACH_FALLBACK[r.stage];
  let watchVariation: string | undefined;
  let hint: string | undefined;
  if (r.stage === 'watch' && skill) {
    const watchCheckIns = r.history.filter((e) => e.toStage === 'watch' && (e.decision === 'check-in' || e.decision === 'stay')).length;
    // Occasionally, not every week: when it's holding at the usual cue, or every other Watch check-in.
    if (r.lastValue === 'strong' || watchCheckIns % 2 === 1) {
      watchVariation = skill.watchVariations[r.variationsPracticed % skill.watchVariations.length];
    }
    if (r.lastValue === 'strong' && r.variationsPracticed >= 2) {
      hint = `It’s held up in different situations. When you’re confident ${firstName} is ready, “${HAND_OVER_LABEL}” is your decision to make. There’s no rush.`;
    }
  }
  const recent = lastCheckValues(r);
  if (r.status === 'active' && recent.length === 2 && recent.every((v) => v === 'not-yet')) {
    hint = r.stage === 'model'
      ? 'Two weeks of “not yet.” Pausing for now is fine, or try a different time of day.'
      : 'Two weeks of “not yet.” Stepping back a stage, or tying it to a different moment in the day, often helps.';
  } else if (!hint && (r.stage === 'model' || r.stage === 'assist') && r.lastValue === 'strong') {
    hint = r.stage === 'model' ? 'When you’re ready, try doing it together.' : 'When you’re ready, let them try it while you coach.';
  }
  return {
    kind: 'check-in', record: r, skill, question: checkInQuestion(r, firstName), coaching,
    ...(watchVariation ? { watchVariation } : {}), ...(hint ? { hint } : {}),
    decisions: availableDecisions(r), attention, why, ...(skill?.safety ? { safety: skill.safety } : {}),
  };
}

interface Candidate { skill: CuratedSkill; score: number; why: string[]; generic: boolean; index: number }

function candidatesFor(
  m: FamilyMember, age: number | null, input: EngineInput, season: SeasonContext,
  records: readonly DevelopmentRecord[], takenThisMeeting: Set<string>,
): Candidate[] {
  const profile = input.profile ?? null;
  const prefs = input.household?.preferences ?? {};
  const name = m.firstName.trim();
  const mine = records.filter((r) => r.memberId === m.id);
  const known = new Set(mine.map((r) => r.skillId));
  const launched = new Set(mine.filter((r) => r.status === 'launched').map((r) => r.skillId));
  const inProgress = new Set(mine.filter((r) => r.status === 'active' || r.status === 'paused').map((r) => r.skillId));

  // What the child already owns (exact): agreements made from a skill, and profile rows naming a growth item.
  const ownedExact = new Set<string>();
  const ownedCategories = new Set<ResponsibilityCategory>();
  const desired = new Map<string, string>(); // skill id → growth label
  for (const r of profile?.responsibilities ?? []) {
    if (!r.ownerIds.includes(m.id)) continue;
    const fromSource = skillFromAgreementSource(r.agreement?.source);
    if (r.status === 'desired') {
      const s = r.item ? skillForGrowthItem(r.item, age) : null;
      if (s) desired.set(s, labelOf(GROWTH_ITEMS, r.item));
      continue;
    }
    if (r.status !== 'existing' && r.status !== 'confirmed') continue;
    if (fromSource) ownedExact.add(fromSource);
    const fromItem = r.item ? skillForGrowthItem(r.item, age) : null;
    if (fromItem) ownedExact.add(fromItem);
    if (!fromSource && !fromItem && r.category !== 'other') ownedCategories.add(r.category);
  }
  const hasPets = prefs.pets === true || (profile?.responsibilities ?? []).some((r) => r.category === 'pet-care');
  const homeschool = prefs.school === 'homeschool';
  const priority = profile?.priority;
  const challenges = profile?.challenges ?? [];

  const out: Candidate[] = [];
  skills.forEach((skill: CuratedSkill, index: number) => {
    if (known.has(skill.id) || ownedExact.has(skill.id)) return;
    const from = skill.typicalAge?.from ?? 0;
    // Safety first: a supervised task is never suggested below its typical starting age, or without a known age.
    if (skill.requiresAdultSupervision && (age === null || age < from)) return;
    if (age !== null && age < from - 1) return;
    if (age === null && from > 6) return;
    if (NEEDS_FACT[skill.id] === 'pets' && !hasPets) return;
    if (NEEDS_FACT[skill.id] === 'home' && !desired.has(skill.id)) return;
    if (homeschool && SCHOOL_SKILLS.has(skill.id)) return;
    // A next step waits until its foundation is launched, unless the family asked for it for this child: their
    // judgment of what the child can take on wins over the default sequence.
    const foundations = FOUNDATIONS.get(skill.id) ?? [];
    if (!desired.has(skill.id) && foundations.some((f) => inProgress.has(f))) return;

    const why: string[] = [];
    let score = 0;
    let specific = false;
    if (desired.has(skill.id)) { score += 100; specific = true; why.push(`You said you’d like ${name} to take on ${desired.get(skill.id)!.toLowerCase()}.`); }
    const built = foundations.find((f) => launched.has(f));
    if (built) { score += 25; specific = true; why.push(`Builds on “${skillById(built)?.title ?? built}”, which ${name} now owns.`); }
    if (priority && PRIORITY_SKILLS[priority]?.includes(skill.id)) { score += 40; specific = true; why.push(`Fits what your family is working on: ${labelOf(PRIORITIES, priority).toLowerCase()}.`); }
    const ch = challenges.find((c) => CHALLENGE_SKILLS[c]?.includes(skill.id));
    if (ch) { score += 10; specific = true; why.push(`Could help with “${labelOf(CHALLENGES, ch).toLowerCase()}”.`); }
    if (season !== 'everyday' && skill.seasons.includes(season)) { score += 20; why.push(`${SEASON_LABEL[season]} is a natural time to start.`); }
    if (age !== null) {
      if (from <= age) {
        const gap = age - from;
        score += gap <= 3 ? 15 : Math.max(-15, 15 - (gap - 3) * 4);
        why.push(`Often a starting point from about age ${from}. A guide, not a rule.`);
      } else {
        why.push(`A little earlier than usual. You know ${name} best.`);
      }
    }
    if (responsibilityCategoryOf(skill) !== 'other' && ownedCategories.has(responsibilityCategoryOf(skill)) && !desired.has(skill.id)) score -= 20;
    if (takenThisMeeting.has(skill.id)) score -= 8;
    if (!specific) why.push(`A starting idea. Tell us what you’d like ${name} to grow into, and ideas get more specific.`);
    out.push({ skill, score, why, generic: !specific, index });
  });
  return out.filter((c) => c.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
}

function cueOptionsFor(skill: CuratedSkill, profile: FamilyProfile | null | undefined): string[] {
  const anchor = profile?.priority ? PRIORITY_ANCHOR[profile.priority] : undefined;
  return [...new Set([...skill.cueSuggestions, ...(anchor ? [anchor] : [])])].slice(0, 3);
}

// ------------------------------------------------------------------ the plan

export function buildDevelopmentPlan(input: EngineInput): DevelopmentPlan {
  const season = seasonOf(input.today);
  const base = { engineVersion: ENGINE_VERSION, libraryVersion: SKILLS_LIBRARY_VERSION, season } as const;
  if (!input.household) return { ...base, unavailable: input.records === null, people: [] };
  const children = input.household.members.filter((m) => !m.archived && m.kind === 'child' && m.firstName.trim());
  const records = input.records ?? [];
  const activeIds = new Set(children.map((c) => c.id));
  // Current agreements not tied to a development record (made in a meeting, the month's plan, or Who does what).
  const linked = new Set(records.map((r) => r.agreementId).filter(Boolean));
  const otherAgreements = (memberId: string) => (input.profile?.responsibilities ?? []).filter((r) =>
    r.status === 'confirmed' && r.agreement && r.ownerIds.includes(memberId) && !(r.id && linked.has(r.id))
    && !skillFromAgreementSource(r.agreement.source));
  const people: PersonDevelopment[] = children.map((m) => {
    const age = childAge(m, input.today);
    const mine = records.filter((r) => r.memberId === m.id);
    const current = mine.filter((r) => r.status === 'active' || r.status === 'launched');
    const checks = mine.map((r) => checkInFor(r, m.firstName.trim(), input.today)).filter((s): s is CheckInStep => Boolean(s));
    checks.sort((a, b) => Number(b.attention) - Number(a.attention)
      || (a.record.lastCheckInOn ?? '').localeCompare(b.record.lastCheckInOn ?? '')
      || a.record.id.localeCompare(b.record.id));
    return { memberId: m.id, firstName: m.firstName.trim(), age, step: checks[0] ?? null, current };
  });
  if (input.records === null) return { ...base, unavailable: true, people };

  // New skills: children with the fewest active records first, then in the family's own order. Two per meeting.
  const order = people
    .map((p, i) => {
      const others = otherAgreements(p.memberId);
      const fresh = others.some((r) => r.agreement!.agreedAt && daysBetween(r.agreement!.agreedAt, input.today) < 7);
      return { p, i, active: p.current.filter((r) => r.status === 'active').length + others.length, fresh };
    })
    .filter(({ fresh }) => !fresh)
    .filter(({ p }) => activeIds.has(p.memberId) && !p.step)
    .filter(({ p }) => !p.current.some((r) => r.status === 'active' && (r.stage === 'model' || r.stage === 'assist')))
    .filter(({ active }) => active < MAX_ACTIVE_PER_CHILD)
    .filter(({ p }) => p.age === null || p.age >= 3)
    .sort((a, b) => a.active - b.active || a.i - b.i);
  const taken = new Set<string>();
  let offered = 0;
  for (const { p } of order) {
    if (offered >= MAX_NEW_PER_MEETING) break;
    const m = children.find((c) => c.id === p.memberId)!;
    const best = candidatesFor(m, p.age, input, season, records, taken)[0];
    if (!best) continue;
    taken.add(best.skill.id);
    offered += 1;
    p.step = {
      kind: 'suggest', skill: best.skill, suggestedStage: 'model', cueOptions: cueOptionsFor(best.skill, input.profile),
      finishLine: best.skill.finishLine, naturalPayoff: best.skill.naturalPayoff, coaching: best.skill.model,
      why: best.why, generic: best.generic, score: best.score, ...(best.skill.safety ? { safety: best.skill.safety } : {}),
    };
  }
  return { ...base, unavailable: false, people };
}

/** For tests and the docs: every candidate for one child, ranked, with reasons. */
export function rankSkillsFor(input: EngineInput, memberId: string): { id: string; score: number; why: string[] }[] {
  const m = input.household?.members.find((x) => x.id === memberId);
  if (!m || m.kind !== 'child') return [];
  return candidatesFor(m, childAge(m, input.today), input, seasonOf(input.today), input.records ?? [], new Set())
    .map((c) => ({ id: c.skill.id, score: c.score, why: c.why }));
}

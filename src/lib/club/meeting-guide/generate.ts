/**
 * The Family Meeting guide generator: family profile + developmental stage + monthly content = a personalized
 * meeting guide. Pure and deterministic: the same family, choices and content always give the same guide. No
 * randomness, no network, no AI. It reads; it never saves.
 *
 *   family data      src/lib/club/profile.ts (household) + ./state.ts (the profile answers it uses, and her choices)
 *   stage matching   ./stages.ts
 *   month content    src/data/club/meeting-guides/<YYYY-MM>.ts (types in ./types.ts)
 *   presentation     src/components/club/MeetingGuidePrintable.astro (screen and print)
 *
 * Rules (tests/club-meeting-guide-generator.test.ts):
 *   - Only the family's own details: names, ages, activities and school come from her household and profile, or the
 *     content's generic line is used. Nothing about a child is invented.
 *   - Every person at home gets a line in all four parts, from their own stage. Siblings in one stage get different
 *     lines where the content has more than one.
 *   - Under 3 joins in and owns no part. Under 6 never leads; 6–8 may lead Let's Practice only.
 *   - The account holder leads a part only when nobody else can, and never gets an organizer or reminder job.
 *   - One or two agreed actions, never more than the month allows.
 *
 * Extension point for optional AI help later: `GuideRefiner` below. A refiner may only rephrase lines of a generated
 * guide; it's never called here, and nothing calls it yet.
 */
import { ACTIVITY_CATEGORIES, labelOf } from '../../../data/club/family-profile';
import type { FamilyMember, Household } from '../profile';
import { ageOn, STAGE_RULES, stageFor, type GuideStage } from './stages';
import { PART_MINUTES, PART_ORDER, PART_TITLES, type Contribution, type GuideMonthContent, type PartId } from './types';
import { emptyGuideState, type GuideProfile, type GuideState } from './state';

export interface GuidePerson {
  id: string;
  name: string;
  stage: GuideStage;
  age: number | null;
  isHolder: boolean;
  /** The parts this person leads. */
  leads: PartId[];
  lines: Record<PartId, string>;
  /** Everyone's Part: what they own this month (null: joins in, no job). */
  part: { text: string; finished: string; custom: boolean } | null;
  /** The part's options for this person, for the editor. */
  partOptions: { id: string; text: string }[];
}

export interface GuidePart {
  id: PartId;
  n: number;
  title: string;
  minutes: number;
  goal: string;
  say: string;
  leaderId: string | null;
  leaderName: string;
  /** Let's Talk only. */
  questions?: string[];
  lines: { id: string; name: string; text: string }[];
}

export interface MeetingGuide {
  month: string;
  title: string;
  subtitle: string;
  familyName: string;
  why: string;
  prepare: string[];
  parts: GuidePart[];
  people: GuidePerson[];
  actions: { id: string; text: string; finished: string }[];
  /** Every action that fits this family, recommended ones first (for the editor). */
  actionChoices: { id: string; text: string; recommended: boolean }[];
  rhythm: { title: string; when: string; options: readonly { id: string; label: string }[]; chosen: string; habits: readonly string[] };
  /** What personalized it, and what fell back to generic content. */
  used: string[];
  missing: string[];
}

export interface GuideInput {
  household: Household;
  /** The profile answers the guide uses (./state.ts → guideProfile), if any. */
  profile?: GuideProfile | null;
  content: GuideMonthContent;
  state?: GuideState | null;
}

/** Later: optional AI rephrasing of a generated guide. Must keep every id, person and part; never called yet. */
export interface GuideRefiner {
  refine(guide: MeetingGuide, content: GuideMonthContent): Promise<MeetingGuide>;
}

const GEAR_ACTIVITIES = ['sports', 'lessons', 'clubs'] as const;
const nameOf = (m: FamilyMember) => m.firstName.trim();
const atHome = (h: Household) => h.members.filter((m) => !m.archived && m.firstName.trim());

/** "The Rivera Family" from her family name, else "Our Family". */
export function familyTitle(h: Household): string {
  const n = h.displayName?.trim();
  if (!n) return 'Our Family';
  return /family$/i.test(n) ? n.replace(/^the /i, 'The ') : `The ${n.replace(/^the /i, '')} Family`;
}

function activityLabel(a: { name?: string; category: string }) {
  return a.name?.trim() || labelOf(ACTIVITY_CATEGORIES, a.category).toLowerCase();
}

/** Who can lead which part, in the order they're asked: other grown-ups, then teens and older children, oldest first. */
function leaderOrder(people: { m: FamilyMember; stage: GuideStage; age: number | null }[]) {
  const others = people.filter((p) => !p.m.isAccountHolder);
  const adults = others.filter((p) => p.stage === 'adult');
  const kids = others.filter((p) => p.stage !== 'adult' && STAGE_RULES[p.stage].leads !== 'none').sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
  return [...adults, ...kids];
}

export function generateMeetingGuide(input: GuideInput): MeetingGuide {
  const { household, content } = input;
  const state = input.state ?? emptyGuideState(content);
  const profile = input.profile ?? null;
  const month = content.month;
  const used: string[] = [];
  const missing: string[] = [];

  const members = atHome(household);
  if (!members.length) throw new Error('no_family');
  const people = members.map((m) => {
    const own = state.people[m.id]?.stage;
    // A correction stays within grown-up or child: it can't turn a child into a grown-up.
    const stage = own && (m.kind === 'adult') === (own === 'adult') ? own : stageFor(m, month);
    return { m, stage, age: ageOn(m, month) };
  });
  used.push('names');
  if (people.some((p) => p.age !== null)) used.push('ages');
  if (people.some((p) => p.stage === 'child')) missing.push('ages');

  // Her activities that name someone at home.
  const ids = new Set(members.map((m) => m.id));
  const activities = (profile?.activities ?? []).filter((a) => a.memberIds.some((id) => ids.has(id)));
  const schooled = household.preferences.school;
  const schoolWord = schooled === 'homeschool' ? 'lessons' : 'school';
  const inSchool = (m: FamilyMember) => Boolean(schooled) || activities.some((a) => a.category === 'school' && a.memberIds.includes(m.id));
  const gearFor = (m: FamilyMember) => activities.find((a) => (GEAR_ACTIVITIES as readonly string[]).includes(a.category) && a.memberIds.includes(m.id));

  // Leaders: her choice if it's still someone who can lead that part, else the rule.
  const order = leaderOrder(people);
  const holder = people.find((p) => p.m.isAccountHolder) ?? people.find((p) => p.stage === 'adult') ?? null;
  const canLead = (p: (typeof people)[number], part: PartId) => {
    const r = STAGE_RULES[p.stage].leads;
    return r === 'any' || (r === 'practice' && part === 'practice');
  };
  const leaders = {} as Record<PartId, (typeof people)[number] | null>;
  let turn = 0;
  for (const part of PART_ORDER) {
    const chosen = people.find((p) => p.m.id === state.leaders[part] && canLead(p, part));
    if (chosen) { leaders[part] = chosen; continue; }
    const eligible = order.filter((p) => canLead(p, part));
    leaders[part] = eligible.length ? eligible[turn++ % eligible.length] : holder;
  }

  // Each person's line in each part: the k-th option that fits them, k = their place among siblings in that stage.
  const place = new Map<string, number>();
  const seen: Partial<Record<GuideStage, number>> = {};
  for (const p of people) { place.set(p.m.id, seen[p.stage] ?? 0); seen[p.stage] = (seen[p.stage] ?? 0) + 1; }
  const fill = (text: string, m: FamilyMember) => text
    .replaceAll('{school}', schoolWord)
    .replaceAll('{activity}', gearFor(m) ? activityLabel(gearFor(m)!) : 'their activity');
  const fits = (c: Contribution, m: FamilyMember) => {
    switch (c.requires) {
      case 'activity': return Boolean(gearFor(m));
      case 'school': return inSchool(m);
      case 'holder': return Boolean(m.isAccountHolder);
      case 'not-holder': return !m.isAccountHolder;
      default: return true;
    }
  };
  const optionsFor = (part: PartId, p: (typeof people)[number]) => content.parts[part].byStage[p.stage].filter((c) => fits(c, p.m));
  const pick = (part: PartId, p: (typeof people)[number]) => {
    const opts = optionsFor(part, p);
    return opts[(place.get(p.m.id) ?? 0) % opts.length];
  };

  if (activities.some((a) => people.some((p) => gearFor(p.m) === a))) used.push('activities');

  const guidePeople: GuidePerson[] = people.map((p) => {
    const lines = {} as Record<PartId, string>;
    for (const part of PART_ORDER) lines[part] = fill(pick(part, p).text, p.m);
    const choice = state.people[p.m.id];
    const options = optionsFor('parts', p);
    let part: GuidePerson['part'] = null;
    if (STAGE_RULES[p.stage].ownsPart) {
      const custom = choice?.custom?.trim();
      const chosen = options.find((o) => o.id === choice?.part) ?? pick('parts', p);
      part = custom
        ? { text: custom, finished: '', custom: true }
        : { text: fill(chosen.text, p.m), finished: chosen.finished ? fill(chosen.finished, p.m) : '', custom: false };
      lines.parts = part.text;
    }
    return {
      id: p.m.id, name: nameOf(p.m), stage: p.stage, age: p.age, isHolder: Boolean(p.m.isAccountHolder),
      leads: PART_ORDER.filter((x) => leaders[x]?.m.id === p.m.id), lines, part,
      partOptions: STAGE_RULES[p.stage].ownsPart ? options.map((o) => ({ id: o.id, text: fill(o.text, p.m) })) : [],
    };
  });

  // Talk: one activity question if she gave one, the month's questions, one from her priority or challenges.
  // Her own named activity first ("soccer"), else an activity type that reads well in a question; never school or work.
  const named = activities.find((a) => a.name?.trim() && a.category !== 'work') ?? activities.find((a) => (GEAR_ACTIVITIES as readonly string[]).includes(a.category) || a.category === 'community');
  const questions = [named ? content.questions.withActivity.replaceAll('{activity}', activityLabel(named)) : content.questions.generic, ...content.questions.always];
  const priority = profile?.priority;
  const extra = (priority && content.questions.byPriority[priority]) || (profile?.challenges ?? []).map((c) => content.questions.byChallenge[c]).find(Boolean);
  if (extra) questions.push(extra);
  if (!named) missing.push('activities');

  const why = (priority && content.whyByPriority[priority]) || (profile?.challenges ?? []).map((c) => content.whyByChallenge[c]).find(Boolean) || content.why;
  if (priority || profile?.challenges?.length) used.push('priorities'); else missing.push('priorities');

  // Actions: hers if she picked, else her matches, then the month's defaults.
  const kids6 = people.some((p) => p.stage !== 'adult' && (p.age === null || p.age >= 6));
  const fitting = content.actions.filter((a) => !a.needsKids || kids6);
  const score = (a: (typeof fitting)[number]) => (priority && a.priorities?.includes(priority) ? 2 : 0) + ((profile?.challenges ?? []).some((c) => a.challenges?.includes(c)) ? 1 : 0);
  const ranked = [...fitting].sort((a, b) => score(b) - score(a) || fitting.indexOf(a) - fitting.indexOf(b));
  const recommended = ranked.filter((a) => score(a) > 0).map((a) => a.id);
  const defaults = [...recommended, ...content.defaultActions.filter((id) => fitting.some((a) => a.id === id))];
  const pickedIds = (state.actions.length ? state.actions : [...new Set(defaults)]).filter((id) => fitting.some((a) => a.id === id)).slice(0, content.maxActions);
  const actions = pickedIds.map((id) => fitting.find((a) => a.id === id)!).map(({ id, text, finished }) => ({ id, text, finished }));

  const chosenRhythm = content.rhythm.options.find((o) => o.id === state.rhythm) ?? content.rhythm.options.find((o) => o.id === content.rhythm.defaultOption)!;

  const opener = leaders.focus;
  const littles = people.some((p) => p.stage === 'toddler' || p.stage === 'preschool');
  const prepare = content.prepare.map((line) => (line.includes('{leader}')
    ? (opener && !opener.m.isAccountHolder ? line.replaceAll('{leader}', nameOf(opener.m)) : content.selfLead)
    : line));
  if (littles && content.prepareLittle) prepare.push(content.prepareLittle);

  const parts: GuidePart[] = PART_ORDER.map((id, i) => {
    const leader = leaders[id];
    return {
      id, n: i + 1, title: PART_TITLES[id], minutes: PART_MINUTES[id],
      goal: content.parts[id].goal, say: content.parts[id].say,
      leaderId: leader?.m.id ?? null, leaderName: leader ? nameOf(leader.m) : 'Anyone',
      ...(id === 'talk' ? { questions } : {}),
      // Let's Talk goes youngest first, as its goal says.
      lines: (id === 'talk' ? [...guidePeople].sort((a, b) => (a.stage === 'adult' ? 99 : a.age ?? 50) - (b.stage === 'adult' ? 99 : b.age ?? 50)) : guidePeople)
        .map((p) => ({ id: p.id, name: p.name, text: p.lines[id] })),
    };
  });

  return {
    month, title: content.title, subtitle: content.subtitle, familyName: familyTitle(household), why, prepare, parts,
    people: guidePeople, actions,
    actionChoices: ranked.map((a) => ({ id: a.id, text: a.text, recommended: recommended.includes(a.id) })),
    rhythm: { title: content.rhythm.title, when: chosenRhythm.label, options: content.rhythm.options, chosen: chosenRhythm.id, habits: content.rhythm.habits },
    used, missing,
  };
}

/** Everything that prints, as a stable string: approval is checked against it. */
export const guideFingerprint = (g: MeetingGuide) => JSON.stringify([g.familyName, g.why, g.prepare, g.parts.map((p) => [p.leaderName, p.questions, p.lines]), g.people.map((p) => p.part), g.actions, g.rhythm.when]);

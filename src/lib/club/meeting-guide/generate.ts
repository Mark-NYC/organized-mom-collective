/**
 * The Family Meeting guide generator: family profile + developmental stage + monthly content = a focused,
 * personalized meeting guide and the family's plan as structured data. Pure and deterministic: the same family,
 * choices and content always give the same guide. No randomness, no network, no AI. It reads; it never saves.
 *
 *   family data      src/lib/club/profile.ts (household) + ./state.ts (the profile answers it uses, and her choices)
 *   stage matching   ./stages.ts
 *   month content    src/data/club/meeting-guides/<YYYY-MM>.ts (types in ./types.ts)
 *   the plan         src/lib/club/family-plan.ts (structured, saved with the month)
 *   presentation     src/components/club/MeetingGuidePrintable.astro (screen and print)
 *
 * Selection rules (tests/club-meeting-guide-generator.test.ts):
 *   - Focus: one or two things that matter most, from her priority, then her challenges (one per theme). Only when she
 *     gave neither, the month's own purpose. Never invented.
 *   - One part per person. A child's part is what she said she'd like that child to take on (or, unassigned, the
 *     children it fits, spread so siblings differ), in the version for their stage; otherwise the month's default.
 *     Nothing a child already takes care of is given again: it's recognized instead, with no new job.
 *   - Each part has a cue (when), the support it needs at that stage, and a finish line; a setup when the home needs
 *     one. Setups become the to-dos before the next meeting (at most two).
 *   - At most one obstacle, from her challenges, offered as a possibility with one small adjustment. With none named,
 *     the family is asked instead. Nothing is guessed about why anyone struggles.
 *   - Under 3 joins in with no job; under 6 never leads; 6–8 may lead Let's Practice; the account holder leads only
 *     when nobody else can and never gets an organizer or reminder job.
 *   - Recommendations are suggestions: the family keeps, swaps or shrinks each part at the meeting.
 *
 * Extension point for optional AI help later: `GuideRefiner`. A refiner may only rephrase lines of a generated guide;
 * nothing calls it.
 */
import { ACTIVITY_CATEGORIES, RESPONSIBILITY_CATEGORIES, labelOf } from '../../../data/club/family-profile';
import type { FamilyPlan, ResponsibilityPractice } from '../family-plan';
import type { FamilyMember, Household } from '../profile';
import { ageOn, STAGE_RULES, stageFor, type GuideStage } from './stages';
import { emptyGuideState, type GuideProfile, type GuideState } from './state';
import {
  PART_MINUTES, PART_ORDER, PART_TITLES, type FamilyFocus, type GuideMonthContent, type HabitPrinciple, type PartId, type Practice,
} from './types';

export interface GuidePractice { behavior: string; cue: string; support: string; finished: string; setup?: string }

export interface GuidePerson {
  id: string;
  name: string;
  stage: GuideStage;
  age: number | null;
  isHolder: boolean;
  /** The parts of the meeting this person leads. */
  leads: PartId[];
  /** Their one part this month (null: joins in, no job). */
  part: (GuidePractice & { itemId: string; source: ResponsibilityPractice['source'] }) | null;
  /** Something they already take care of: recognized, no new job. */
  keeps: string | null;
  /** The parts they could take on (for the editor). */
  options: { id: string; text: string; source: ResponsibilityPractice['source'] }[];
}

export interface GuideSection {
  id: PartId;
  n: number;
  title: string;
  minutes: number;
  goal: string;
  say: string;
  leaderId: string | null;
  leaderName: string;
}

export interface MeetingGuide {
  month: string;
  title: string;
  subtitle: string;
  familyName: string;
  prepare: string[];
  sections: GuideSection[];
  focus: { id: string; title: string; source: 'priority' | 'challenge' | 'month' }[];
  questions: string[];
  talkLittle: string | null;
  obstacle: { obstacle: string; adjustment: string | null; principle: HabitPrinciple | null } | null;
  obstacleOpen: string | null;
  people: GuidePerson[];
  tryNow: string;
  todos: string[];
  checkIn: string;
  rhythm: { title: string; when: string; options: readonly { id: string; label: string }[]; chosen: string; habits: readonly string[] };
  plan: FamilyPlan;
  /** What personalized it, and what fell back to the month's own content. */
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

const nameOf = (m: FamilyMember) => m.firstName.trim();
const atHome = (h: Household) => h.members.filter((m) => !m.archived && m.firstName.trim());
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "The Rivera Family" from her family name, else "Our Family". */
export function familyTitle(h: Household): string {
  const n = h.displayName?.trim();
  if (!n) return 'Our Family';
  return /family$/i.test(n) ? n.replace(/^the /i, 'The ') : `The ${n.replace(/^the /i, '')} Family`;
}

type Person = { m: FamilyMember; stage: GuideStage; age: number | null };

/** Who can lead which part, in the order they're asked: other grown-ups, then teens and older children, oldest first. */
function leaderOrder(people: Person[]) {
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
  const people: Person[] = members.map((m) => {
    const own = state.people[m.id]?.stage;
    // A correction stays within grown-up or child: it can't turn a child into a grown-up.
    const stage = own && (m.kind === 'adult') === (own === 'adult') ? own : stageFor(m, month);
    return { m, stage, age: ageOn(m, month) };
  });
  used.push('names');
  if (people.some((p) => p.age !== null)) used.push('ages');
  if (people.some((p) => p.stage === 'child')) missing.push('ages');

  const ids = new Set(members.map((m) => m.id));
  const mine = <T extends { memberIds?: string[]; ownerIds?: string[] }>(list: T[]) => list.filter((x) => (x.memberIds ?? x.ownerIds ?? []).every((id) => ids.has(id)));
  const activities = mine(profile?.activities ?? []).filter((a) => a.memberIds.length);
  const responsibilities = mine(profile?.responsibilities ?? []);
  const schoolWord = household.preferences.school === 'homeschool' ? 'lessons' : 'school';
  const fill = (t: string) => t.replaceAll('{school}', schoolWord);

  // ---- Leaders: her choice if it's still someone who can lead that part, else the rule. ----
  const order = leaderOrder(people);
  const holder = people.find((p) => p.m.isAccountHolder) ?? people.find((p) => p.stage === 'adult') ?? null;
  const canLead = (p: Person, part: PartId) => {
    const r = STAGE_RULES[p.stage].leads;
    return r === 'any' || (r === 'practice' && part === 'practice');
  };
  const leaders = {} as Record<PartId, Person | null>;
  let turn = 0;
  for (const part of PART_ORDER) {
    const chosen = people.find((p) => p.m.id === state.leaders[part] && canLead(p, part));
    if (chosen) { leaders[part] = chosen; continue; }
    const eligible = order.filter((p) => canLead(p, part));
    leaders[part] = eligible.length ? eligible[turn++ % eligible.length] : holder;
  }

  // ---- Focus: her priority, then her challenges, one per theme; the month's purpose only if she gave neither. ----
  const groupOf = (id: string) => content.focusGroups.findIndex((g) => g.includes(id));
  const focus: { id: string; source: 'priority' | 'challenge' | 'month'; f: FamilyFocus }[] = [];
  const addFocus = (id: string, source: 'priority' | 'challenge', f: FamilyFocus | undefined) => {
    if (!f || focus.length >= content.maxFocus) return;
    const g = groupOf(id);
    if (focus.some((x) => x.id === id || (g >= 0 && content.focusGroups[g].includes(x.id)))) return;
    focus.push({ id, source, f });
  };
  const pr = profile?.priority;
  if (pr === 'other' && profile?.priorityNote) addFocus('other', 'priority', { title: profile.priorityNote, discuss: 'What’s one small step toward this?' });
  else if (pr) addFocus(pr, 'priority', content.focusByPriority[pr]);
  for (const c of profile?.challenges ?? []) addFocus(c, 'challenge', content.focusByChallenge[c]);
  if (focus.length) used.push('priorities'); else { missing.push('priorities'); focus.push({ id: 'month', source: 'month', f: content.focusDefault }); }

  // ---- Talk: her week (her own named activity if any), then the focus questions. ----
  const named = activities.find((a) => a.name?.trim() && a.category !== 'work')
    ?? activities.find((a) => ['sports', 'lessons', 'clubs', 'community'].includes(a.category));
  if (named) used.push('activities'); else missing.push('activities');
  const activityLabel = named ? (named.name?.trim() || labelOf(ACTIVITY_CATEGORIES, named.category).toLowerCase()) : '';
  const questions = [named ? content.questions.withActivity.replaceAll('{activity}', activityLabel) : content.questions.generic, ...focus.map((x) => fill(x.f.discuss))];
  const littles = people.some((p) => p.stage === 'toddler' || p.stage === 'preschool');

  // ---- Obstacle: at most one, from her challenges, as a possibility. ----
  const obstacleFrom = (profile?.challenges ?? []).find((c) => content.obstacles[c] || (c === 'other' && profile?.challengeNote));
  const obstacle = obstacleFrom
    ? (obstacleFrom === 'other'
      ? { obstacle: profile!.challengeNote!, adjustment: null, principle: null }
      : { ...content.obstacles[obstacleFrom] })
    : null;

  // ---- Everyone's part ----
  const owns = (p: Person) => responsibilities.filter((r) => r.status === 'existing' && r.ownerIds.includes(p.m.id));
  const ownsCategory = (p: Person, cat: string) => owns(p).some((r) => r.category === cat);
  const desired = responsibilities.filter((r) => r.status === 'desired' && r.item);
  const unassigned = desired.filter((r) => !r.ownerIds.length);
  if (desired.length) used.push('growth areas'); else missing.push('growth areas');
  const kids = people.filter((p) => p.stage !== 'adult');
  const practiceFor = (id: string, stage: GuideStage) => content.practices.find((x) => x.id === id && x.byStage[stage]);

  const toPart = (pr: Practice, stage: GuideStage) => ({
    behavior: fill(pr.behavior), cue: pr.cue, finished: fill(pr.finished), support: content.support[stage], ...(pr.setup ? { setup: fill(pr.setup) } : {}),
  });

  const guidePeople: GuidePerson[] = people.map((p) => {
    const choice = state.people[p.m.id];
    const base = {
      id: p.m.id, name: nameOf(p.m), stage: p.stage, age: p.age, isHolder: Boolean(p.m.isAccountHolder),
      leads: PART_ORDER.filter((x) => leaders[x]?.m.id === p.m.id),
    };
    const keepsFor = (p2: Person) => {
      const r = owns(p2).find((x) => RESPONSIBILITY_CATEGORIES.some((c) => c.id === x.category));
      return r ? content.keepsDoing.replace('{area}', lower(labelOf(RESPONSIBILITY_CATEGORIES, r.category))) : null;
    };
    if (!STAGE_RULES[p.stage].ownsPart) return { ...base, part: null, keeps: null, options: [] };

    // Options, best first: what she wants for this child, then unassigned wishes (rotated so siblings differ), then the month's.
    const opts: { id: string; source: ResponsibilityPractice['source']; pr: Practice }[] = [];
    if (p.stage === 'adult') {
      const list = p.m.isAccountHolder ? [content.adultHolder] : content.adultOther;
      list.forEach((x, i) => opts.push({ id: `adult-${p.m.isAccountHolder ? 'holder' : 'other'}-${i}`, source: 'month', pr: x }));
    } else {
      const fits = (r: (typeof desired)[number]) => practiceFor(r.item!, p.stage) && !ownsCategory(p, r.category);
      for (const r of desired.filter((r) => r.ownerIds.includes(p.m.id) && fits(r))) opts.push({ id: r.item!, source: 'desired', pr: practiceFor(r.item!, p.stage)!.byStage[p.stage]! });
      const k = kids.indexOf(p);
      const open = unassigned.filter(fits);
      for (let i = 0; i < open.length; i++) {
        const r = open[(i + k) % open.length];
        if (!opts.some((o) => o.id === r.item)) opts.push({ id: r.item!, source: 'desired', pr: practiceFor(r.item!, p.stage)!.byStage[p.stage]! });
      }
      for (const d of content.defaults[p.stage] ?? []) opts.push({ id: d.id, source: 'month', pr: d.byStage[p.stage]! });
    }
    // Siblings in one stage with only the month's defaults get different ones.
    const sameStage = kids.filter((x) => x.stage === p.stage);
    const fallbackIndex = opts[0]?.source === 'month' && p.stage !== 'adult' ? sameStage.indexOf(p) % opts.length : 0;
    const otherAdults = people.filter((x) => x.stage === 'adult' && !x.m.isAccountHolder);
    const adultIndex = p.stage === 'adult' && !p.m.isAccountHolder ? otherAdults.indexOf(p) % opts.length : 0;
    const picked = opts.find((o) => o.id === choice?.part) ?? opts[p.stage === 'adult' ? adultIndex : fallbackIndex];
    const custom = choice?.custom?.trim();
    const part = custom
      ? { behavior: custom, cue: '', finished: '', support: content.support[p.stage], itemId: 'custom', source: 'custom' as const }
      : { ...toPart(picked.pr, p.stage), itemId: picked.id, source: picked.source };
    return {
      ...base, part,
      // Recognition, not a new job. Never for the account holder (it would only list what she already carries).
      keeps: p.m.isAccountHolder ? null : keepsFor(p),
      options: opts.map((o) => ({ id: o.id, text: fill(o.pr.behavior), source: o.source })),
    };
  });
  if (responsibilities.some((r) => r.status === 'existing')) used.push('existing responsibilities');

  // ---- Practice and the to-dos before the next meeting: the plan's own setups first. ----
  const setups = guidePeople.flatMap((p) => (p.part?.setup ? [`For ${p.name}: ${p.part.setup}`] : []));
  const todos = [...setups, ...content.todosDefault].slice(0, content.maxTodos);

  const chosenRhythm = content.rhythm.options.find((o) => o.id === state.rhythm) ?? content.rhythm.options.find((o) => o.id === content.rhythm.defaultOption)!;
  const opener = leaders.focus;
  const prepare = content.prepare.map((line) => (line.includes('{leader}')
    ? (opener && !opener.m.isAccountHolder ? line.replaceAll('{leader}', nameOf(opener.m)) : content.selfLead)
    : line));
  if (littles && content.prepareLittle) prepare.push(content.prepareLittle);

  const sections: GuideSection[] = PART_ORDER.map((id, i) => ({
    id, n: i + 1, title: PART_TITLES[id], minutes: PART_MINUTES[id], goal: content.parts[id].goal, say: content.parts[id].say,
    leaderId: leaders[id]?.m.id ?? null, leaderName: leaders[id] ? nameOf(leaders[id]!.m) : 'Anyone',
  }));

  const plan: FamilyPlan = {
    v: 1, month,
    focus: focus.map((x) => ({ id: x.id, source: x.source, title: x.f.title })),
    obstacle: obstacle ? { challengeId: obstacleFrom!, ...obstacle } : null,
    practices: guidePeople.flatMap((p) => (p.part ? [{
      memberId: p.id, itemId: p.part.itemId, category: p.part.itemId === 'custom' ? 'other' : (content.practices.find((x) => x.id === p.part!.itemId) ?? Object.values(content.defaults).flat().find((x) => x?.id === p.part!.itemId))?.category ?? 'other',
      behavior: p.part.behavior, cue: p.part.cue, ...(p.part.setup ? { setup: p.part.setup } : {}), ...(p.part.support ? { support: p.part.support } : {}), ...(p.part.finished ? { finished: p.part.finished } : {}),
      source: p.part.source, status: 'suggested' as const, progress: 'practicing' as const, since: month,
    }] : [])),
    todos,
    meeting: { rhythm: chosenRhythm.label },
  };

  return {
    month, title: content.title, subtitle: content.subtitle, familyName: familyTitle(household), prepare, sections,
    focus: plan.focus, questions, talkLittle: littles ? content.talkLittle : null,
    obstacle, obstacleOpen: obstacle ? null : content.obstacleOpen,
    people: guidePeople, tryNow: content.tryNow, todos, checkIn: content.checkIn,
    rhythm: { title: content.rhythm.title, when: chosenRhythm.label, options: content.rhythm.options, chosen: chosenRhythm.id, habits: content.rhythm.habits },
    plan, used, missing,
  };
}

/** Everything that prints, as a stable string: approval is checked against it. */
export const guideFingerprint = (g: MeetingGuide) => JSON.stringify([
  g.familyName, g.prepare, g.sections.map((s) => s.leaderName), g.focus, g.questions, g.obstacle, g.obstacleOpen,
  g.people.map((p) => [p.name, p.part, p.keeps]), g.todos, g.rhythm.when,
]);

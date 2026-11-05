/**
 * The Family Meeting companion generator: family profile + developmental stage + monthly content = a short,
 * personalized menu of ideas under the Club's four meeting parts, plus the same ideas as structured data. Pure and
 * deterministic: the same family, choices and content always give the same companion. No randomness, network or AI.
 *
 *   family data      src/lib/club/profile.ts (household) + ./state.ts (the profile answers it uses, and her choices)
 *   stage matching   ./stages.ts
 *   month content    src/data/club/meeting-guides/<YYYY-MM>.ts (types in ./types.ts)
 *   the plan         src/lib/club/family-plan.ts (structured, saved with the month)
 *   presentation     src/components/club/MeetingGuidePrintable.astro (screen and print)
 *
 * It's a menu for any of the month's meetings, not a completed meeting: nobody leads anything, nothing is assigned,
 * and no decision is filled in. Selection rules (tests/club-meeting-guide-generator.test.ts):
 *   - Our Focus: one or two priorities from her priority, then her challenges (one per theme). Only when she gave
 *     neither, the month's own purpose. Never invented.
 *   - Let's Talk: at most four prompts: her week (her own named activity if any), one per focus, and one about what gets
 *     in the way (a possibility from her challenges, or an open question).
 *   - Everyone's Part: per child, at most two ideas to choose from: what she said she'd like that child to take on, in
 *     their stage's version (unassigned wishes spread so siblings differ), then the month's. Nothing a child already
 *     does is suggested again: it's noticed instead. Under 3 joins in. One shared idea for the grown-ups.
 *   - Let's Practice: at most four habit ideas: try it now, a clear cue (from one of the family's own ideas), at most
 *     two setups that make the ideas easy, the adjustment for her obstacle, or making a part smaller. An idea that
 *     another section already says is left out.
 *   - Anything she hid stays hidden.
 *
 * Extension point for optional AI help later: `GuideRefiner`. A refiner may only rephrase lines; nothing calls it.
 */
import { ACTIVITY_CATEGORIES, RESPONSIBILITY_CATEGORIES, labelOf } from '../../../data/club/family-profile';
import type { FamilyPlan } from '../family-plan';
import type { FamilyMember, Household } from '../profile';
import { ageOn, STAGE_RULES, stageFor, type GuideStage } from './stages';
import { emptyGuideState, type GuideProfile, type GuideState } from './state';
import { PART_ORDER, PART_TITLES, type FamilyFocus, type GuideMonthContent, type HabitPrinciple, type PartId, type Practice } from './types';

/** One idea on the companion. `key` is stable, so she can hide it. */
export interface GuideIdea {
  key: string;
  text: string;
}

export interface GuidePerson {
  id: string;
  name: string;
  stage: GuideStage;
  age: number | null;
  /** Ideas to choose from (none for a toddler or a grown-up). */
  ideas: (GuideIdea & { itemId: string; source: 'desired' | 'month'; cue: string; setup?: string })[];
  /** How much help a first try needs at this stage. */
  support: string;
  /** Something they already take care of: noticed, not added to. */
  keeps: string | null;
  joinsIn: boolean;
}

export interface MeetingGuide {
  month: string;
  title: string;
  subtitle: string;
  howTo: string;
  familyName: string;
  sections: { id: PartId; n: number; title: string; goal: string }[];
  focus: (GuideIdea & { id: string; title: string; opportunity: string; source: 'priority' | 'challenge' | 'month' })[];
  talk: GuideIdea[];
  talkLittle: string | null;
  partsNote: string;
  people: GuidePerson[];
  grownUps: GuideIdea[];
  practice: GuideIdea[];
  checkIn: string;
  plan: FamilyPlan;
  /** What personalized it, and what fell back to the month's own content. */
  used: string[];
  missing: string[];
}

export interface GuideInput {
  household: Household;
  profile?: GuideProfile | null;
  content: GuideMonthContent;
  state?: GuideState | null;
}

/** Later: optional AI rephrasing of a generated companion. Must keep every key; never called yet. */
export interface GuideRefiner {
  refine(guide: MeetingGuide, content: GuideMonthContent): Promise<MeetingGuide>;
}

const nameOf = (m: FamilyMember) => m.firstName.trim();
const atHome = (h: Household) => h.members.filter((m) => !m.archived && m.firstName.trim());
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const joinNames = (n: string[]) => (n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);

/** "The Rivera Family" from her family name, else "Our Family". */
export function familyTitle(h: Household): string {
  const n = h.displayName?.trim();
  if (!n) return 'Our Family';
  return /family$/i.test(n) ? n.replace(/^the /i, 'The ') : `The ${n.replace(/^the /i, '')} Family`;
}

type Person = { m: FamilyMember; stage: GuideStage; age: number | null };

export function generateMeetingGuide(input: GuideInput): MeetingGuide {
  const { household, content } = input;
  const state = input.state ?? emptyGuideState();
  const hidden = new Set(state.hidden);
  const shown = <T extends GuideIdea>(list: T[]) => list.filter((x) => !hidden.has(x.key));
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

  // ---- Our Focus ----
  const groupOf = (id: string) => content.focusGroups.findIndex((g) => g.includes(id));
  const focusAll: { id: string; source: 'priority' | 'challenge' | 'month'; f: FamilyFocus }[] = [];
  const addFocus = (id: string, source: 'priority' | 'challenge', f: FamilyFocus | undefined) => {
    if (!f || focusAll.length >= content.maxFocus) return;
    const g = groupOf(id);
    if (focusAll.some((x) => x.id === id || (g >= 0 && content.focusGroups[g].includes(x.id)))) return;
    focusAll.push({ id, source, f });
  };
  const pr = profile?.priority;
  if (pr === 'other' && profile?.priorityNote) addFocus('other', 'priority', { title: profile.priorityNote, opportunity: '', discuss: 'What’s one small step toward this?' });
  else if (pr) addFocus(pr, 'priority', content.focusByPriority[pr]);
  for (const c of profile?.challenges ?? []) addFocus(c, 'challenge', content.focusByChallenge[c]);
  if (focusAll.length) used.push('priorities'); else { missing.push('priorities'); focusAll.push({ id: 'month', source: 'month', f: content.focusDefault }); }
  const focus = shown(focusAll.map((x) => ({ key: `focus:${x.id}`, id: x.id, source: x.source, title: x.f.title, opportunity: fill(x.f.opportunity), text: x.f.title })));

  // ---- Let's Talk ----
  const named = activities.find((a) => a.name?.trim() && a.category !== 'work')
    ?? activities.find((a) => ['sports', 'lessons', 'clubs', 'community'].includes(a.category));
  if (named) used.push('activities'); else missing.push('activities');
  const activityLabel = named ? (named.name?.trim() || labelOf(ACTIVITY_CATEGORIES, named.category).toLowerCase()) : '';
  const obstacleFrom = (profile?.challenges ?? []).find((c) => content.obstacles[c] || (c === 'other' && profile?.challengeNote));
  const obstacle = obstacleFrom
    ? (obstacleFrom === 'other' ? { obstacle: profile!.challengeNote!, adjustment: null, principle: null as HabitPrinciple | null } : { ...content.obstacles[obstacleFrom] })
    : null;
  const talk = shown([
    { key: 'talk:week', text: named ? content.questions.withActivity.replaceAll('{activity}', activityLabel) : content.questions.generic },
    ...focusAll.map((x) => ({ key: `talk:${x.id}`, text: fill(x.f.discuss) })),
    { key: 'talk:obstacle', text: obstacle ? `What gets in our way? One possibility: ${lower(obstacle.obstacle)}` : content.obstacleOpen },
  ]).slice(0, content.maxTalk);
  const littles = people.some((p) => p.stage === 'toddler' || p.stage === 'preschool');

  // ---- Everyone's Part: ideas to choose from ----
  const owns = (p: Person) => responsibilities.filter((r) => r.status === 'existing' && r.ownerIds.includes(p.m.id));
  const desired = responsibilities.filter((r) => r.status === 'desired' && r.item);
  const unassigned = desired.filter((r) => !r.ownerIds.length);
  if (desired.length) used.push('growth areas'); else missing.push('growth areas');
  const kids = people.filter((p) => p.stage !== 'adult');
  const practiceFor = (id: string, stage: GuideStage) => content.practices.find((x) => x.id === id && x.byStage[stage]);
  const keepsLine = (p: Person) => {
    const r = owns(p).find((x) => RESPONSIBILITY_CATEGORIES.some((c) => c.id === x.category));
    return r ? content.keepsDoing.replace('{name}', nameOf(p.m)).replace('{area}', lower(labelOf(RESPONSIBILITY_CATEGORIES, r.category))) : null;
  };

  const guidePeople: GuidePerson[] = kids.map((p) => {
    const base = { id: p.m.id, name: nameOf(p.m), stage: p.stage, age: p.age, support: content.support[p.stage], keeps: keepsLine(p) };
    if (!STAGE_RULES[p.stage].ownsPart) return { ...base, ideas: [], joinsIn: true };
    const opts: { id: string; source: 'desired' | 'month'; pr: Practice }[] = [];
    const add = (id: string, source: 'desired' | 'month', pr: Practice) => { if (!opts.some((o) => o.id === id)) opts.push({ id, source, pr }); };
    const fits = (r: (typeof desired)[number]) => practiceFor(r.item!, p.stage) && !owns(p).some((o) => o.category === r.category);
    for (const r of desired.filter((r) => r.ownerIds.includes(p.m.id) && fits(r))) add(r.item!, 'desired', practiceFor(r.item!, p.stage)!.byStage[p.stage]!);
    const open = unassigned.filter(fits);
    const k = kids.indexOf(p);
    for (let i = 0; i < open.length; i++) { const r = open[(i + k) % open.length]; add(r.item!, 'desired', practiceFor(r.item!, p.stage)!.byStage[p.stage]!); }
    // The month's own ideas fill in; siblings in one stage start at different ones.
    const defs = content.defaults[p.stage] ?? [];
    const off = kids.filter((x) => x.stage === p.stage).indexOf(p);
    for (let i = 0; i < defs.length; i++) { const d = defs[(i + off) % defs.length]; add(d.id, 'month', d.byStage[p.stage]!); }
    const all = shown(opts.map((o) => ({ key: `idea:${p.m.id}:${o.id}`, text: fill(o.pr.behavior), itemId: o.id, source: o.source, cue: o.pr.cue, ...(o.pr.setup ? { setup: fill(o.pr.setup) } : {}) })));
    return { ...base, ideas: all, joinsIn: false };
  });
  // No idea printed twice: every child gets one idea before anyone gets a second, skipping any already offered to a
  // sibling; only a child who'd otherwise have none gets a repeat.
  const offered = new Set<string>();
  const picked = new Map(guidePeople.map((p) => [p.id, [] as GuidePerson['ideas']]));
  for (let round = 0; round < content.maxIdeas; round++) {
    for (const p of guidePeople) {
      const next = p.ideas.find((i) => !offered.has(i.text) && !picked.get(p.id)!.includes(i))
        ?? (round === 0 ? p.ideas[0] : undefined);
      if (next) { picked.get(p.id)!.push(next); offered.add(next.text); }
    }
  }
  for (const p of guidePeople) p.ideas = picked.get(p.id)!;
  if (responsibilities.some((r) => r.status === 'existing')) used.push('existing responsibilities');
  const adults = people.filter((p) => p.stage === 'adult');
  const grownUps = shown([
    ...(adults.length ? [{ key: 'grown-ups', text: `${joinNames(adults.map((p) => nameOf(p.m)))}: ${lower(content.grownUps)}` }] : []),
    // A grown-up other than the account holder who already carries something: noticed. Never the account holder.
    ...adults.filter((p) => !p.m.isAccountHolder).flatMap((p) => { const t = keepsLine(p); return t ? [{ key: `keeps:${p.m.id}`, text: t }] : []; }),
  ]);

  // ---- Let's Practice: habit ideas, none repeating another section ----
  const firstIdea = guidePeople.find((p) => p.ideas.length)?.ideas[0];
  const firstName = guidePeople.find((p) => p.ideas.length)?.name;
  const setups = guidePeople.flatMap((p) => p.ideas.filter((i) => i.setup).slice(0, 1).map((i) => ({ key: `setup:${p.id}:${i.itemId}`, text: `${content.practice.setupLead} for ${p.name}: ${lower(i.setup!)}` })));
  const practice = shown([
    { key: 'practice:now', text: content.practice.tryNow },
    ...(obstacle?.adjustment ? [{ key: 'practice:obstacle', text: obstacle.adjustment }] : []),
    ...(firstIdea && obstacle?.principle !== 'trigger'
      ? [{ key: 'practice:stack', text: content.practice.stack.replace('{example}', `“${firstIdea.cue}, ${firstName} ${lower(firstIdea.text)}”`) }] : []),
    ...setups.slice(0, 2),
    ...(obstacle?.principle !== 'simplicity' ? [{ key: 'practice:simplify', text: content.practice.simplify }] : []),
  ]).slice(0, content.maxPractice);

  const sections = PART_ORDER.map((id, i) => ({ id, n: i + 1, title: PART_TITLES[id], goal: content.goals[id] }));

  const plan: FamilyPlan = {
    v: 1, month,
    focus: focus.map((x) => ({ id: x.id, source: x.source, title: x.title })),
    obstacle: obstacle ? { challengeId: obstacleFrom!, ...obstacle } : null,
    practices: guidePeople.flatMap((p) => p.ideas.map((i) => ({
      memberId: p.id, itemId: i.itemId,
      category: (content.practices.find((x) => x.id === i.itemId) ?? Object.values(content.defaults).flat().find((x) => x?.id === i.itemId))?.category ?? 'other',
      behavior: i.text, cue: i.cue, ...(i.setup ? { setup: i.setup } : {}), support: p.support,
      source: i.source, status: 'suggested' as const, progress: 'practicing' as const, since: month,
    }))),
    todos: [],
  };

  return {
    month, title: content.title, subtitle: content.subtitle, howTo: content.howTo, familyName: familyTitle(household), sections,
    focus, talk, talkLittle: littles ? content.talkLittle : null, partsNote: content.partsNote,
    people: guidePeople, grownUps, practice, checkIn: content.checkIn, plan, used, missing,
  };
}

/** Everything that prints, as a stable string: approval is checked against it. */
export const guideFingerprint = (g: MeetingGuide) => JSON.stringify([
  g.familyName, g.focus, g.talk, g.talkLittle, g.people.map((p) => [p.name, p.ideas.map((i) => i.text), p.support, p.keeps, p.joinsIn]), g.grownUps, g.practice,
]);

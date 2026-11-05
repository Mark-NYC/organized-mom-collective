/**
 * The Family Meeting companion generator: family profile + developmental stage + monthly content = a short,
 * personalized menu of ideas under the Club's four meeting parts, plus the same ideas as structured data. Pure and
 * deterministic. No randomness, network or AI. It reads; it never saves.
 *
 *   family data      src/lib/club/profile.ts (household) + ./state.ts (the profile answers it uses, and her choices)
 *   stage matching   ./stages.ts
 *   month content    src/data/club/meeting-guides/<YYYY-MM>.ts (types in ./types.ts)
 *   the plan         src/lib/club/family-plan.ts (structured, saved with the month; suggestions, never commitments)
 *   presentation     src/components/club/MeetingGuidePrintable.astro (screen and print)
 *
 * Selection (docs/club/PERSONALIZATION.md → Selection):
 *   1. Score every opportunity in the month's content against what she reported:
 *        relevance  her priority 3 · each matching challenge 2 · a wish she named for a child 2 · an unassigned wish 1
 *        impact     her priority 2 · a challenge 1
 *        readiness  children (3+) with a fitting step at their age they don't already do, up to 2
 *        habit      1 if there's a cue-ready step or an adjustment for an obstacle she named
 *      Only opportunities with relevance > 0 count: nothing she didn't report becomes a focus.
 *   2. One focus: the highest score. A second only when it's strongly supported on its own (relevance 4+, and at
 *      least three quarters of the first's score).
 *   3. One idea per child, for the focus first: her wish for that child, then her unassigned wishes, then the focus's
 *      own steps at their age. A child who already takes care of the area is recognized instead. Two ideas only when
 *      the obstacle she reported is about ownership, so the child can choose.
 *   4. One adjustment worth trying (for the obstacle she named, else the chosen step's setup) and one way to keep it
 *      going without adding work.
 *   5. With little or no intake, discovery questions instead of guesses.
 *
 * Extension point for optional AI help later: `GuideRefiner`. A refiner may only rephrase lines; nothing calls it.
 */
import { ACTIVITY_CATEGORIES, PRIORITIES, CHALLENGES, GROWTH_ITEMS, RESPONSIBILITY_CATEGORIES, labelOf } from '../../../data/club/family-profile';
import type { FamilyPlan } from '../family-plan';
import type { FamilyMember, Household } from '../profile';
import { ageOn, STAGE_RULES, stageFor, type GuideStage } from './stages';
import { emptyGuideState, type GuideProfile, type GuideState } from './state';
import { PART_ORDER, PART_TITLES, type GuideMonthContent, type HabitPrinciple, type Opportunity, type PartId, type Practice } from './types';

/** One idea on the companion. `key` is stable, so she can hide it. */
export interface GuideIdea {
  key: string;
  text: string;
}

export interface ChildIdea extends GuideIdea {
  itemId: string;
  source: 'desired' | 'month';
  cue: string;
  setup?: string;
  principle: HabitPrinciple;
}

export interface GuidePerson {
  id: string;
  name: string;
  stage: GuideStage;
  age: number | null;
  /** The discovery question that brings this child into the problem (with their idea). */
  ask: string | null;
  /** One idea, or two to choose from when ownership is the obstacle. */
  ideas: ChildIdea[];
  choose: boolean;
  support: string;
  /** Something they already take care of: noticed, not added to. */
  keeps: string | null;
  joinsIn: boolean;
}

/** Why the companion says what it says. Never printed; for tests, review and later months. */
export interface GuideRationale {
  focus: { id: string; score: number; parts: Record<'relevance' | 'impact' | 'readiness' | 'habit', number>; evidence: string[] }[];
  considered: { id: string; score: number; why: string }[];
  children: { name: string; chosen: string[]; why: string; excluded: string[] }[];
}

export interface MeetingGuide {
  month: string;
  title: string;
  subtitle: string;
  howTo: string;
  familyName: string;
  sections: { id: PartId; n: number; title: string; goal: string }[];
  focus: (GuideIdea & { id: string; title: string; opportunity: string; source: 'priority' | 'challenge' | 'growth' | 'month' })[];
  talk: GuideIdea[];
  talkLittle: string | null;
  people: GuidePerson[];
  partsNote: string;
  /** When no child has an idea: ask them instead of guessing. */
  partsDiscover: string | null;
  grownUps: GuideIdea[];
  practice: GuideIdea[];
  checkIn: string;
  plan: FamilyPlan;
  rationale: GuideRationale;
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
  const fill = (t: string, name = '') => t.replaceAll('{school}', schoolWord).replaceAll('{name}', name);
  const kids = people.filter((p) => p.stage !== 'adult');
  const ownsPart = (p: Person) => STAGE_RULES[p.stage].ownsPart;
  const owns = (p: Person) => responsibilities.filter((r) => r.status === 'existing' && r.ownerIds.includes(p.m.id));
  const ownsCategory = (p: Person, cat: string) => owns(p).some((r) => r.category === cat);
  const desired = responsibilities.filter((r) => r.status === 'desired' && r.item);
  const practice = (id: string) => content.practices.find((x) => x.id === id);
  const stepFor = (id: string, p: Person): Practice | undefined => {
    const item = practice(id);
    if (!item || ownsCategory(p, item.category)) return undefined;
    return item.byStage[p.stage];
  };
  const label = (list: { id: string; label: string }[], id: string) => labelOf(list, id) || id;
  const priority = profile?.priority;
  const challenges = profile?.challenges ?? [];
  if (desired.length) used.push('growth areas'); else missing.push('growth areas');
  if (responsibilities.some((r) => r.status === 'existing')) used.push('existing responsibilities');

  // ---- 1. Score every opportunity against what she reported ----
  const scored = content.opportunities.map((o) => {
    const evidence: string[] = [];
    // Each answer that supports it, with its weight: a second focus can't reuse the first's answers.
    const support = new Map<string, number>();
    let relevance = 0;
    let impact = 0;
    if (priority && o.priorities.includes(priority)) {
      relevance += 3; impact += 2; support.set(`p:${priority}`, 3);
      evidence.push(`Top priority: “${label(PRIORITIES, priority)}”`);
    }
    const ch = challenges.filter((c) => o.challenges.includes(c));
    if (ch.length) {
      relevance += Math.min(4, 2 * ch.length); impact = Math.max(impact, 1);
      for (const c of ch) { evidence.push(`Hard right now: “${label(CHALLENGES, c)}”`); support.set(`c:${c}`, 2); }
    }
    let wishPoints = 0;
    for (const r of desired.filter((r) => o.items.includes(r.item!))) {
      const named = r.ownerIds.length > 0;
      const fits = (named ? kids.filter((k) => r.ownerIds.includes(k.m.id)) : kids).some((k) => stepFor(r.item!, k));
      if (!fits) continue;
      wishPoints += named ? 2 : 1;
      support.set(`w:${r.item}:${r.ownerIds.join(',')}`, named ? 2 : 1);
      const who = named ? kids.filter((k) => r.ownerIds.includes(k.m.id)).map((k) => nameOf(k.m)).join(' and ') : 'the kids';
      evidence.push(`Wants ${who} to take on “${label(GROWTH_ITEMS, r.item!)}”`);
    }
    relevance += Math.min(4, wishPoints);
    const ready = kids.filter((k) => ownsPart(k) && o.items.some((id) => stepFor(id, k))).length;
    const readiness = Math.min(2, ready);
    const habit = ready > 0 || ch.some((c) => content.obstacles[c]) ? 1 : 0;
    return { o, evidence, support, parts: { relevance, impact, readiness, habit }, score: relevance + impact + readiness + habit };
  });
  const isPriority = (s: (typeof scored)[number]) => Boolean(priority && s.o.priorities.includes(priority));
  const candidates = scored.filter((s) => s.parts.relevance > 0)
    // Ties go to her stated top priority (the one thing she most wants to stop managing alone), then the stronger evidence.
    .sort((a, b) => b.score - a.score || Number(isPriority(b)) - Number(isPriority(a)) || b.parts.relevance - a.parts.relevance || content.opportunities.indexOf(a.o) - content.opportunities.indexOf(b.o));

  // ---- 2. One focus, a second only when it's strongly supported on its own ----
  type Pick = { o: Opportunity; score: number; parts: (typeof scored)[number]['parts']; evidence: string[]; support?: Map<string, number>; source: 'priority' | 'challenge' | 'growth' | 'month' };
  const picks: Pick[] = [];
  const ownWords = priority === 'other' && profile?.priorityNote;
  const sourceOf = (s: (typeof scored)[number]): Pick['source'] => (priority && s.o.priorities.includes(priority) ? 'priority' : challenges.some((c) => s.o.challenges.includes(c)) ? 'challenge' : 'growth');
  if (candidates[0]) picks.push({ ...candidates[0], source: sourceOf(candidates[0]) });
  // A second focus needs its own evidence: answers the first focus didn't already use.
  const independent = (s: (typeof scored)[number]) => [...s.support].filter(([k]) => !picks[0]?.support?.has(k)).reduce((n, [, w]) => n + w, 0);
  const second = candidates.slice(1).find((c) => independent(c) >= 4 && c.score >= 0.75 * (picks[0]?.score ?? 0));
  if (second && picks[0]) picks.push({ ...second, source: sourceOf(second) });
  if (!picks.length) {
    picks.push({ o: content.fallback, score: 0, parts: { relevance: 0, impact: 0, readiness: 0, habit: 0 }, evidence: [], source: 'month' });
    missing.push('priorities');
  } else used.push('priorities');
  const primary = picks[0].o;
  const considered = scored.filter((s) => !picks.some((p) => p.o.id === s.o.id) && s.parts.relevance > 0).map((s) => ({
    id: s.o.id, score: s.score,
    why: picks[1] ? 'Lower score than the two chosen' : `Score ${s.score} vs ${picks[0].score}; a second focus needs 4+ points of its own evidence and three quarters of the first’s score (had ${independent(s)})`,
  }));

  // The obstacle she reported for the focus, if any (never guessed).
  const obstacleFrom = challenges.find((c) => primary.challenges.includes(c) && content.obstacles[c]);
  const obstacle = obstacleFrom ? content.obstacles[obstacleFrom] : null;
  // Ownership is the obstacle she reported: children 6 and up get two ideas to choose from.
  const choice = obstacle?.principle === 'ownership';

  // ---- 3. Children: one idea each, for the focus first ----
  const childNotes: GuideRationale['children'] = [];
  const offered = new Set<string>();
  const guidePeople: GuidePerson[] = kids.map((p) => {
    const name = nameOf(p.m);
    const base = { id: p.m.id, name, stage: p.stage, age: p.age, support: content.support[p.stage], keeps: null as string | null, ask: null as string | null, choose: false };
    if (!ownsPart(p)) {
      childNotes.push({ name, chosen: [], why: 'Under 3: joins in, no job', excluded: [] });
      return { ...base, ideas: [], joinsIn: true };
    }
    const area = (cat: string) => lower(labelOf(RESPONSIBILITY_CATEGORIES, cat));
    const owned = owns(p).filter((r) => RESPONSIBILITY_CATEGORIES.some((c) => c.id === r.category));
    const ownsFocusArea = owned.find((r) => primary.items.some((id) => practice(id)?.category === r.category));
    const forChild = desired.filter((r) => r.ownerIds.includes(p.m.id));
    const unassigned = desired.filter((r) => !r.ownerIds.length);
    type Cand = { id: string; source: 'desired' | 'month'; why: string };
    const cands: Cand[] = [];
    const add = (id: string, source: Cand['source'], why: string) => { if (stepFor(id, p) && !cands.some((c) => c.id === id)) cands.push({ id, source, why }); };
    for (const r of forChild) if (primary.items.includes(r.item!)) add(r.item!, 'desired', `Her wish for ${name}, and it serves the focus`);
    for (const r of forChild) add(r.item!, 'desired', `Her wish for ${name}`);
    for (const r of unassigned) if (primary.items.includes(r.item!)) add(r.item!, 'desired', 'Her wish for the kids, and it serves the focus');
    // A child who already handles the focus area isn't given more; one with no wish of hers gets the focus's own steps.
    if (!ownsFocusArea && !primary.askFirst) for (const id of primary.items) add(id, 'month', `Serves the focus at ${name}’s age`);
    const excluded: string[] = [];
    for (const r of [...forChild, ...unassigned]) if (!cands.some((c) => c.id === r.item) && r.item) excluded.push(`${label(GROWTH_ITEMS, r.item)}: ${stepFor(r.item, p) ? 'not chosen' : 'no fitting step at this age, or already done'}`);
    // Siblings at one stage don't get the identical line when there's another good option.
    // A line already offered to a sibling isn't repeated; with nothing else, the child joins through the questions.
    const pool = cands.filter((c) => !offered.has(fill(stepFor(c.id, p)!.try, name)));
    const n = choice && ['early', 'middle', 'teen'].includes(p.stage) ? 2 : 1;
    const chosen = pool.slice(0, n);
    for (const c of pool.slice(n)) excluded.push(`${practice(c.id) ? label(GROWTH_ITEMS, c.id) || c.id : c.id}: one strong idea is enough`);
    const ideas: ChildIdea[] = chosen.map((c) => {
      const s = stepFor(c.id, p)!;
      offered.add(fill(s.try, name));
      return { key: `idea:${p.m.id}:${c.id}`, text: fill(s.try, name), itemId: c.id, source: c.source, cue: s.cue, ...(s.setup ? { setup: s.setup } : {}), principle: s.principle };
    });
    const keeps = owned[0] ? fill(ownsFocusArea && !ideas.length ? content.showHow : content.keepsDoing, name).replace('{area}', area((ownsFocusArea ?? owned[0]).category)) : null;
    childNotes.push({ name, chosen: chosen.map((c) => c.id), why: chosen.length ? chosen.map((c) => c.why).join('; ') : ownsFocusArea ? 'Already takes care of the focus area: recognized, no new job' : primary.askFirst ? 'She named no job for this child: asked, not guessed' : 'Nothing she reported fits at this age', excluded });
    return {
      ...base,
      ideas: shown(ideas),
      choose: ideas.length > 1,
      // The discovery question is asked in Let's Talk (grouped by idea), not repeated on each card.
      ask: null,
      keeps,
      joinsIn: false,
    };
  });

  // ---- Let's Talk: the focus conversation, the obstacle (hers, or a discovery question), the kids' ideas ----
  const named = activities.find((a) => a.name?.trim() && a.category !== 'work') ?? activities.find((a) => ['sports', 'lessons', 'clubs', 'community'].includes(a.category));
  if (named) used.push('activities');
  const activityLabel = named ? (named.name?.trim() || labelOf(ACTIVITY_CATEGORIES, named.category).toLowerCase()) : '';
  const focusLines = picks.map((x, i) => ({
    key: `focus:${x.o.id}`, id: x.o.id, source: x.source,
    title: i === 0 && ownWords ? profile!.priorityNote! : x.o.title,
    // Her own words lead; the matched theme says what getting better could look like (and why it matters).
    opportunity: fill(x.o.opportunity),
    text: x.o.title,
  }));
  // One discovery question per idea, naming every child it was offered to: they help solve it.
  const asks = new Map<string, string[]>();
  // Children 6 and up: a preschooler's ownership is doing it together first (their support line), not analyzing it.
  for (const p of guidePeople.filter((x) => ['early', 'middle', 'teen', 'child'].includes(x.stage))) { const id = p.ideas[0]?.itemId; if (id) asks.set(id, [...(asks.get(id) ?? []), p.name]); }
  const join = (n: string[]) => (n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
  const askLines = [...asks].slice(0, 2).map(([id, names]) => ({ key: `talk:ask:${id}`, text: fill(practice(id)!.ask, join(names)) }));
  const talk = shown([
    ...(primary.id === 'schedules'
      ? [{ key: 'talk:week', text: named ? content.weekQuestion.withActivity.replaceAll('{activity}', activityLabel) : content.weekQuestion.generic }]
      : [{ key: `talk:${primary.id}`, text: ownWords ? content.ownWordsDiscuss : fill(primary.discuss) }]),
    { key: 'talk:obstacle', text: obstacle ? `What gets in the way? One possibility: ${obstacle.obstacle}` : fill(primary.discover) },
    ...(picks[1] ? [{ key: `talk:${picks[1].o.id}`, text: fill(picks[1].o.discuss) }] : []),
    ...askLines,
    ...(!askLines.length && guidePeople.some((p) => p.ideas.length) ? [{ key: 'talk:invite', text: content.invite }] : []),
  ]).slice(0, 4);
  // Too little to suggest anything for the children: ask them instead.
  const askable = guidePeople.filter((p) => !p.joinsIn);
  // Children with no idea yet, where the focus says to ask rather than pick a job for them.
  const unasked = askable.filter((p) => !p.ideas.length && !p.keeps);
  // Every child 3+ is on the page: with an idea, recognized, or named in a question. Never left out.
  const partsDiscover = !unasked.length ? null
    : primary.askFirst ? fill(primary.askFirst).replace('{names}', join(unasked.map((p) => p.name)))
    : content.partsDiscover.replace('{names}', join(unasked.map((p) => p.name)));
  const littles = people.some((p) => p.stage === 'toddler' || p.stage === 'preschool');

  // ---- Grown-ups: a conversation, plus what another grown-up already does ----
  const adults = people.filter((p) => p.stage === 'adult');
  const grownUps = shown([
    ...(guidePeople.some((p) => p.ideas.length) || partsDiscover ? [{ key: 'grown-ups', text: content.grownUps }] : []),
    ...adults.filter((p) => !p.m.isAccountHolder).flatMap((p) => {
      const r = owns(p).find((x) => RESPONSIBILITY_CATEGORIES.some((c) => c.id === x.category));
      return r ? [{ key: `keeps:${p.m.id}`, text: fill(content.keepsDoing, nameOf(p.m)).replace('{area}', lower(labelOf(RESPONSIBILITY_CATEGORIES, r.category))) }] : [];
    }),
  ]);

  // ---- 4. Practice: one adjustment worth trying, one way to keep it going ----
  // The obstacle's adjustment, unless the page already does it: one small idea per child already is "make it smaller",
  // and two ideas to choose from already are "let them choose". Then the setup that makes an idea easier is more useful.
  const withSetup = guidePeople.find((p) => p.ideas[0]?.setup);
  const setupLine = withSetup ? { key: `practice:setup:${withSetup.id}`, text: `${content.practice.adjustmentLead}: ${withSetup.ideas[0].setup}, for ${withSetup.name}.` } : null;
  const alreadyDone = obstacle?.principle === 'simplicity' ? Boolean(setupLine) : obstacle?.principle === 'ownership' ? guidePeople.some((p) => p.choose) : false;
  const adjustment = obstacle && !alreadyDone
    ? { key: 'practice:obstacle', text: `${content.practice.adjustmentLead}: ${obstacle.adjustment}` }
    : setupLine;
  const practiceLines = shown([
    ...(adjustment ? [adjustment] : primary === content.fallback ? [{ key: 'practice:meeting', text: content.practice.meetingHabit }] : []),
    ...(guidePeople.some((p) => p.ideas.length) || partsDiscover && primary.askFirst ? [{ key: 'practice:sustain', text: content.practice.sustain[primary.id === 'reminders' ? 'reminders' : 'default'] }] : []),
  ]);

  const sections = PART_ORDER.map((id, i) => ({ id, n: i + 1, title: PART_TITLES[id], goal: content.goals[id] }));
  const plan: FamilyPlan = {
    v: 1, month,
    focus: focusLines.map((x) => ({ id: x.id, source: x.source, title: x.title })),
    obstacle: obstacle ? { challengeId: obstacleFrom!, obstacle: obstacle.obstacle, principle: obstacle.principle, adjustment: obstacle.adjustment } : null,
    // Ideas offered, never commitments: nothing here is tracked until the family chooses it (family-plan.ts).
    ideas: guidePeople.flatMap((p) => p.ideas.map((i) => ({
      memberId: p.id, itemId: i.itemId, category: practice(i.itemId)?.category ?? 'other',
      behavior: i.text, cue: i.cue, ...(i.setup ? { setup: i.setup } : {}), support: p.support,
      source: i.source, status: 'suggested' as const, offered: month,
    }))),
  };

  return {
    month, title: content.title, subtitle: content.subtitle, howTo: content.howTo, familyName: familyTitle(household), sections,
    focus: shown(focusLines), talk, talkLittle: littles ? content.talkLittle : null,
    people: guidePeople, partsNote: content.partsNote, partsDiscover, grownUps, practice: practiceLines, checkIn: content.checkIn, plan,
    rationale: { focus: picks.map((x) => ({ id: x.o.id, score: x.score, parts: x.parts, evidence: x.evidence })), considered, children: childNotes },
    used, missing,
  };
}

/** Everything that prints, as a stable string: approval is checked against it. */
export const guideFingerprint = (g: MeetingGuide) => JSON.stringify([
  g.familyName, g.focus, g.talk, g.talkLittle, g.people.map((p) => [p.name, p.ask, p.ideas.map((i) => i.text), p.support, p.keeps, p.joinsIn]), g.grownUps, g.practice,
]);

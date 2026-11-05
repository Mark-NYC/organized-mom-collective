/**
 * January's Family Meeting companion: presents the month-independent habit intelligence (src/lib/club/habits/) under
 * the Club's four meeting parts. Pure and deterministic; no network or AI; it reads and never saves.
 *
 *   family context   ../habits/context.ts   (household + the profile answers kept with her guide, ./state.ts)
 *   focus            ../habits/focus.ts     one opportunity, from her answers
 *   experiments      ../habits/recommend.ts the fewest habit experiments that matter (or the month's starter)
 *   presentation     here, and MeetingGuidePrintable.astro
 *
 * The page: Our Focus (the one focus) → Let's Talk (its conversation, what gets in the way, the children's say) →
 * Everyone's Part (the habit experiments: who, why, the small action, a moment it could follow, the child's own way,
 * support) → Let's Practice (try the first step, what to do if it gets stuck, how to keep it going). Everything is a
 * suggestion; nothing is assigned. Extension point for optional AI help later: `GuideRefiner` (rephrase only).
 */
import { RESPONSIBILITY_CATEGORIES, labelOf } from '../../../data/club/family-profile';
import { habitItem } from '../../../data/club/habit-library';
import type { FamilyPlan } from '../family-plan';
import type { Household } from '../profile';
import { familyContext } from '../habits/context';
import { scoreOpportunities } from '../habits/focus';
import { recommendHabits, starterHabits } from '../habits/recommend';
import type { HabitExperiment } from '../habits/types';
import type { GuideStage } from './stages';
import { emptyGuideState, type GuideProfile, type GuideState } from './state';
import { PART_ORDER, PART_TITLES, type GuideMonthContent, type PartId } from './types';

/** One line on the companion. `key` is stable, so she can hide it. */
export interface GuideIdea {
  key: string;
  text: string;
}

export type GuideExperiment = HabitExperiment & GuideIdea;

export interface GuideRationale {
  focus: { id: string; score: number; parts: Record<'relevance' | 'impact' | 'readiness' | 'habit', number>; evidence: string[] }[];
  considered: { id: string; score: number; why: string }[];
  children: { name: string; outcome: string }[];
}

export interface MeetingGuide {
  month: string;
  title: string;
  subtitle: string;
  howTo: string;
  familyName: string;
  sections: { id: PartId; n: number; title: string; goal: string }[];
  focus: (GuideIdea & { id: string; title: string; opportunity: string; because: string; source: 'priority' | 'challenge' | 'growth' | 'month' })[];
  talk: GuideIdea[];
  talkLittle: string | null;
  /** Children at home (for the editor's age corrections). */
  people: { id: string; name: string; stage: GuideStage; age: number | null }[];
  experimentsLabel: string;
  experimentsNote: string;
  /** Too little intake: why the companion starts with the meeting itself. */
  starterNote: string | null;
  /** Under an experiment that's a common idea, not a need she reported. */
  considerLabel: string;
  experiments: GuideExperiment[];
  anchorOptions: string;
  /** What someone already does: noticed, not added to. */
  recognized: GuideIdea[];
  partsDiscover: string | null;
  grownUps: GuideIdea[];
  practice: GuideIdea[];
  checkIn: string;
  plan: FamilyPlan;
  rationale: GuideRationale;
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

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const join = (n: string[]) => (n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);

/** Her family name as she wrote it ("The Goerings", "Team Brooks"); a bare surname becomes "The … Family". */
export function familyTitle(h: Household): string {
  const n = h.displayName?.trim();
  if (!n) return 'Our Family';
  if (/family$/i.test(n) || /^the /i.test(n) || /\s/.test(n)) return n.replace(/^the /i, 'The ');
  return `The ${n} Family`;
}

export function generateMeetingGuide(input: GuideInput): MeetingGuide {
  const { household, content } = input;
  const state = input.state ?? emptyGuideState();
  const hidden = new Set(state.hidden);
  const shown = <T extends GuideIdea>(list: T[]) => list.filter((x) => !hidden.has(x.key));
  const profile = input.profile ?? null;
  const theme = content.theme;
  if (!household.members.some((m) => !m.archived && m.firstName.trim())) throw new Error('no_family');

  const stages = Object.fromEntries(Object.entries(state.people).flatMap(([id, p]) => (p.stage ? [[id, p.stage]] : []))) as Record<string, GuideStage>;
  const ctx = familyContext(household, profile, content.month, { stages });
  const fill = (t: string) => t.replaceAll('{school}', ctx.schoolWord);
  const used = ['names'];
  const missing: string[] = [];
  if (ctx.children.some((c) => c.age !== null)) used.push('ages');
  if (ctx.children.some((c) => c.stage === 'child')) missing.push('ages');

  // ---- Focus: one, from her answers; the month's own when she gave none ----
  const scored = scoreOpportunities(ctx, content.opportunities, theme);
  const top = scored[0];
  const primary = top?.o ?? content.fallback;
  if (top) used.push('priorities'); else missing.push('priorities');
  if (ctx.children.some((c) => c.wishes.length) || ctx.openWishes.length) used.push('growth areas'); else missing.push('growth areas');
  const ownWords = ctx.priority === 'other' && ctx.priorityNote;
  const focusSource = top?.source ?? 'month';
  const focus = shown([{
    key: `focus:${primary.id}`, id: primary.id, source: focusSource,
    title: ownWords ? ctx.priorityNote! : primary.title, opportunity: fill(primary.opportunity), text: primary.title,
    // Her answers behind the focus, once, so each experiment needn't repeat them.
    because: top ? top.evidence.filter((e) => !e.startsWith('Wants ')).map((e) => e.replace(/^Top priority: /, 'your top priority, ').replace(/^Hard right now: /, 'hard right now: ')).join('; ') : '',
  }]);

  // ---- Experiments: the fewest that matter, or the month's starter when we know too little ----
  const rec = top
    ? recommendHabits(ctx, theme, primary, { title: ownWords ? `“${ctx.priorityNote}”` : primary.title, source: focusSource })
    : starterHabits(ctx, theme, content.starter.sharedId, content.starter.considerId);
  const experiments = shown(rec.experiments.map((e) => ({ ...e, text: e.action })));
  const inExperiments = new Set(experiments.flatMap((e) => e.memberIds));
  const recognized = shown(rec.recognized.map((r) => ({
    key: `keeps:${r.memberId}`,
    text: (inExperiments.has(r.memberId) ? content.keepsDoing : content.showHow).replaceAll('{name}', r.name).replace('{area}', r.area),
  })));
  const askable = ctx.children.filter((c) => c.stage !== 'toddler' && !inExperiments.has(c.id) && !rec.recognized.some((r) => r.memberId === c.id));
  const partsDiscover = !askable.length ? null
    : primary.askFirst && !experiments.length ? primary.askFirst.replace('{names}', join(askable.map((c) => c.name)))
    : !top ? content.partsDiscover.replace('{names}', join(askable.map((c) => c.name))) : null;

  // ---- Let's Talk: about the focus, what gets in the way, the children's say ----
  const named = ctx.children.flatMap((c) => c.activities)[0];
  if (named) used.push('activities');
  const obstacleFrom = ctx.challenges.find((c) => primary.challenges.includes(c) && content.obstacles[c]);
  const obstacle = obstacleFrom ? content.obstacles[obstacleFrom] : null;
  const talkNames = ctx.children.filter((c) => inExperiments.has(c.id) && ['early', 'middle', 'teen', 'child'].includes(c.stage)).map((c) => c.name);
  const talk = shown([
    primary.id === 'schedules'
      ? { key: 'talk:week', text: named ? content.weekQuestion.withActivity.replaceAll('{activity}', named.name) : content.weekQuestion.generic }
      : { key: `talk:${primary.id}`, text: ownWords ? content.ownWordsDiscuss : fill(primary.discuss) },
    { key: 'talk:obstacle', text: obstacle ? `What gets in the way? One possibility: ${obstacle.obstacle}` : fill(primary.discover) },
    ...(talkNames.length ? [{ key: 'talk:invite', text: content.invite.replace('{names}', join(talkNames)) }] : []),
  ]);
  const littles = ctx.children.some((c) => c.stage === 'toddler' || c.stage === 'preschool');

  // ---- Grown-ups: a conversation, and what another grown-up already does ----
  const grownUps = shown([
    ...(experiments.length || partsDiscover ? [{ key: 'grown-ups', text: content.grownUps }] : []),
    ...ctx.adults.filter((a) => !a.isHolder).flatMap((a) => {
      const cat = a.owns.find((x) => RESPONSIBILITY_CATEGORIES.some((c) => c.id === x));
      return cat ? [{ key: `keeps:${a.id}`, text: content.keepsDoing.replaceAll('{name}', a.name).replace('{area}', lower(labelOf(RESPONSIBILITY_CATEGORIES, cat))) }] : [];
    }),
  ]);

  // ---- Let's Practice: the first step now, if it gets stuck, how to keep it going (nothing the experiments say) ----
  const practice = shown([
    ...(obstacle && !experiments.some((e) => e.principle === obstacle.principle) ? [{ key: 'practice:obstacle', text: `${content.practice.adjustmentLead}: ${obstacle.adjustment}` }] : []),
    ...(experiments.length ? [{ key: 'practice:sustain', text: content.practice.sustain[primary.id === 'reminders' ? 'reminders' : 'default'] }] : []),
  ]);

  const plan: FamilyPlan = {
    v: 1, month: content.month,
    focus: focus.map((f) => ({ id: f.id, source: f.source, title: f.title })),
    obstacle: obstacle ? { challengeId: obstacleFrom!, obstacle: obstacle.obstacle, principle: obstacle.principle, adjustment: obstacle.adjustment } : null,
    // Ideas offered, never commitments: nothing here is tracked until the family chooses it (family-plan.ts).
    ideas: experiments.flatMap((e) => (e.adaptations ?? (e.memberIds.length ? [{ memberId: e.memberIds[0], name: '', action: e.action }] : [])).map((a) => ({
      memberId: a.memberId, itemId: e.itemId, category: habitItem(e.itemId)?.category ?? 'other', behavior: a.action, cue: e.anchor.text, ...(e.support ? { setup: e.support } : {}),
      source: e.source === 'desired' ? 'desired' as const : 'month' as const, status: 'suggested' as const, offered: content.month,
    }))),
  };

  return {
    month: content.month, title: content.title, subtitle: content.subtitle, howTo: content.howTo, familyName: familyTitle(household),
    sections: PART_ORDER.map((id, i) => ({ id, n: i + 1, title: PART_TITLES[id], goal: content.goals[id] })),
    focus, talk, talkLittle: littles ? content.talkLittle : null,
    people: ctx.children.map((c) => ({ id: c.id, name: c.name, stage: c.stage, age: c.age })),
    experimentsLabel: content.experimentsLabel, experimentsNote: content.experimentsNote,
    starterNote: top ? null : content.starterNote, considerLabel: content.considerNote,
    experiments, anchorOptions: content.anchorOptions, recognized, partsDiscover, grownUps, practice, checkIn: content.checkIn, plan,
    rationale: {
      focus: top ? [{ id: top.o.id, score: top.score, parts: top.parts, evidence: top.evidence }] : [{ id: content.fallback.id, score: 0, parts: { relevance: 0, impact: 0, readiness: 0, habit: 0 }, evidence: [] }],
      considered: scored.slice(1).map((s) => ({ id: s.o.id, score: s.score, why: `Score ${s.score} vs ${top!.score}` })),
      children: rec.notes.map((n) => ({ name: n.name, outcome: n.outcome })),
    },
    used, missing,
  };
}

/** Everything that prints, as a stable string: approval is checked against it. */
export const guideFingerprint = (g: MeetingGuide) => JSON.stringify([
  g.familyName, g.focus, g.talk, g.talkLittle, g.experiments.map((e) => [e.who, e.title, e.why, e.action, e.anchor, e.ownership, e.support, e.adaptations]),
  g.recognized, g.partsDiscover, g.grownUps, g.practice,
]);


/**
 * Habit experiments for a family, for one focus, in one month. Month-independent: the month supplies its theme
 * (allowed behaviors, school in session, how many experiments at most, when to go shared), the family context
 * supplies everything else. The month's resource decides how to present the result.
 *
 * Rules (tests/club-habits.test.ts):
 *   - Only behaviors that serve the focus. Her wish for a child counts most, then her open wishes, then the focus's own
 *     behaviors (when the focus says which job; a focus like "fewer reminders" asks instead).
 *   - The fewest experiments that matter: the best one, and a second only for a different child and a different kind
 *     of job. Never one per child just to include everyone.
 *   - From `sharedFrom` children with a fitting behavior: one shared routine, adapted by age, instead of a list.
 *   - Anchors are options to discuss; only her own information (school, her named activity and its days) confirms one.
 *     Nothing assumes a season or an activity's schedule.
 *   - Progress (later, from check-ins): independent or retired → not suggested again (recognized); struggling → the
 *     simpler version of the same behavior.
 *   - Nothing claims to know why a habit isn't working.
 */
import { GROWTH_ITEMS, RESPONSIBILITY_CATEGORIES, WEEK_DAYS, labelOf } from '../../../data/club/family-profile';
import { habitItem } from '../../../data/club/habit-library';
import type { ChildContext, FamilyContext } from './context';
import { fits } from './focus';
import { progressKey, type ExperimentAnchor, type HabitExperiment, type MonthTheme, type Opportunity, type StageHabit } from './types';
import type { GuideStage } from '../meeting-guide/stages';

const SIMPLER: Partial<Record<GuideStage, GuideStage>> = { teen: 'middle', middle: 'early', early: 'preschool' };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const join = (n: string[]) => (n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);

export interface Recommendation {
  experiments: HabitExperiment[];
  /** Children who already take care of the focus area (or have made it a habit): noticed, not given more. */
  recognized: { memberId: string; name: string; area: string }[];
  /** Why each child did or didn't get an experiment (for review and tests; never printed). */
  notes: { name: string; outcome: string }[];
}

interface Candidate { child: ChildContext; itemId: string; score: number; source: HabitExperiment['source']; habit: StageHabit; simpler: boolean }

/** The moment to anchor to: her own information if it confirms one, else options to discuss. */
function anchorFor(itemId: string, habit: StageHabit, child: ChildContext, ctx: FamilyContext, theme: MonthTheme): ExperimentAnchor {
  const item = habitItem(itemId)!;
  const activity = item.activity ? child.activities[0] : undefined;
  if (activity) {
    // Her named activity, on the days she gave (if any); never a season.
    const days = activity.days.map((d) => (d + 6) % 7);
    const names = WEEK_DAYS.filter((d) => days.includes(d.day)).map((d) => d.label);
    return { text: names.length ? `${join(names)} evenings, before ${activity.name}` : `the evening before each ${activity.name}`, verified: true };
  }
  const options = habit.anchors.map((a) => a.replaceAll('{activity}', ''));
  if (item.school && child.inSchool && theme.schoolInSession) return { text: `on ${ctx.schoolWord} nights, ${options.join(' or ')}`, verified: true };
  return { text: options.join(' or '), verified: false };
}

export function recommendHabits(ctx: FamilyContext, theme: MonthTheme, focus: Opportunity, why: { title: string; source: 'priority' | 'challenge' | 'growth' | 'month' }): Recommendation {
  const notes: Recommendation['notes'] = [];
  const recognized: Recommendation['recognized'] = [];
  const kids = ctx.children.filter((c) => !['toddler'].includes(c.stage));
  const cands: Candidate[] = [];
  for (const c of kids) {
    const focusArea = focus.items.map((id) => habitItem(id)?.category).filter(Boolean) as string[];
    const owned = c.owns.find((cat) => focusArea.includes(cat));
    if (owned) recognized.push({ memberId: c.id, name: c.name, area: lower(labelOf(RESPONSIBILITY_CATEGORIES, owned)) });
    // The focus's own behaviors only when her priority or a challenge points to the focus; a focus that comes only from
    // her wishes stays with those wishes (no extra jobs for siblings she didn't mention).
    const themeItems = focus.askFirst || why.source === 'growth' ? [] : focus.items;
    const items = [...new Set([...c.wishes, ...ctx.openWishes, ...themeItems])].filter((id) => focus.items.includes(id));
    let any = false;
    for (const id of items) {
      const status = ctx.progress[progressKey(c.id, id)];
      if (status === 'independent' || status === 'retired') {
        recognized.push({ memberId: c.id, name: c.name, area: lower(habitItem(id)?.title ?? id) });
        continue;
      }
      // Struggling: the simpler version of the same behavior (never a guess at why).
      const stage = status === 'struggling' ? SIMPLER[c.stage] ?? c.stage : c.stage;
      if (!fits(id, { ...c, stage }, theme)) continue;
      const habit = habitItem(id)!.byStage[stage]!;
      const score = (c.wishes.includes(id) ? 4 : ctx.openWishes.includes(id) ? 3 : 0) + (focus.items.indexOf(id) === 0 ? 2 : 1);
      cands.push({ child: c, itemId: id, score, source: c.wishes.includes(id) || ctx.openWishes.includes(id) ? 'desired' : 'theme', habit, simpler: stage !== c.stage });
      any = true;
    }
    if (!any) notes.push({ name: c.name, outcome: owned ? 'already takes care of the focus area: recognized' : focus.askFirst ? 'she named no job: the children are asked' : 'nothing for the focus fits at this age' });
  }

  const label = (list: { id: string; label: string }[], id: string) => labelOf(list, id) || id;
  const reason = (c: Candidate) => {
    const lead = why.source === 'priority' ? `${why.title} is your top priority.` : why.source === 'challenge' ? `${why.title} is hard right now.` : '';
    const what = habitItem(c.itemId)?.wish ?? lower(label(GROWTH_ITEMS, c.itemId));
    const wish = c.child.wishes.includes(c.itemId) ? ` You’d like ${c.child.name} to take on ${what}.`
      : ctx.openWishes.includes(c.itemId) ? ` You’d like the kids to take on ${what}.` : '';
    return (lead + wish).trim();
  };
  const wishOf = (c: Candidate) => {
    const what = habitItem(c.itemId)?.wish ?? lower(label(GROWTH_ITEMS, c.itemId));
    return c.child.wishes.includes(c.itemId) ? `You’d like ${c.child.name} to take on ${what}.` : ctx.openWishes.includes(c.itemId) ? `You’d like the kids to take on ${what}.` : undefined;
  };
  const fill = (t: string, c: ChildContext) => t.replaceAll('{name}', c.name).replaceAll('{school}', ctx.schoolWord).replaceAll('{activity}', c.activities[0]?.name ?? '');
  const experiment = (c: Candidate): HabitExperiment => {
    const item = habitItem(c.itemId)!;
    return {
      key: `exp:${c.child.id}:${c.itemId}`, itemId: c.itemId, memberIds: [c.child.id],
      who: `${c.child.name}${c.child.age !== null ? `, ${c.child.age}` : ''}`, title: fill(item.title, c.child),
      why: reason(c), ...(wishOf(c) ? { wish: wishOf(c) } : {}), basis: 'need', action: fill(c.habit.action, c.child), anchor: anchorFor(c.itemId, c.habit, c.child, ctx, theme),
      ownership: fill(c.habit.ownership, c.child), ...(c.habit.support ? { support: fill(c.habit.support, c.child) } : {}),
      principle: c.habit.principle, source: c.source,
    };
  };

  // Groups: children who share an activity she named (whatever their ages), or a routine that fits several children
  // (from `sharedFrom`). One habit, each child's own version shown, so differences in ability aren't erased.
  const byItem = new Map<string, Candidate[]>();
  for (const c of cands) byItem.set(c.itemId, [...(byItem.get(c.itemId) ?? []), c]);
  const group = (id: string, list: Candidate[], shared: NonNullable<ReturnType<typeof habitItem>>['shared'] & object, title: string): HabitExperiment => {
    const s = list.slice().sort((a, b) => (a.child.age ?? 0) - (b.child.age ?? 0));
    const first = s[0];
    const f = (t: string) => fill(t, first.child);
    return {
      key: `exp:shared:${id}`, itemId: id, memberIds: s.map((c) => c.child.id), who: join(s.map((c) => c.child.name)), title,
      why: reason({ ...first, child: { ...first.child, wishes: [] } }) || `${why.title}.`, basis: 'need', action: f(shared.action),
      anchor: list.every((c) => c.habit && habitItem(id)?.activity) ? anchorFor(id, first.habit, first.child, ctx, theme) : { text: (shared.anchors ?? first.habit.anchors).join(' or '), verified: false },
      ownership: f(shared.ownership), ...(shared.support ? { support: f(shared.support) } : {}),
      adaptations: s.map((c) => ({ memberId: c.child.id, name: c.child.name, action: fill(c.habit.action, c.child) })),
      principle: first.habit.principle, source: s.some((c) => c.source === 'desired') ? 'desired' : first.source,
    };
  };
  let grouped: { exp: HabitExperiment; ids: string[]; category: string } | null = null;
  // Same named activity: one preparation habit for the siblings who share it.
  const gear = byItem.get('activity-gear') ?? [];
  const byActivity = new Map<string, Candidate[]>();
  for (const c of gear) { const n = c.child.activities[0]?.name; if (n) byActivity.set(n.toLowerCase(), [...(byActivity.get(n.toLowerCase()) ?? []), c]); }
  const sharedActivity = [...byActivity.values()].find((l) => l.length >= 2);
  const sharedPick = [...byItem].filter(([id]) => habitItem(id)?.shared).sort((a, b) => b[1].length - a[1].length || b[1].reduce((n, x) => n + x.score, 0) - a[1].reduce((n, x) => n + x.score, 0))[0];
  if (sharedActivity) {
    const name = sharedActivity[0].child.activities[0].name;
    grouped = { exp: group('activity-gear', sharedActivity, { title: '', action: `Each child packs their own gear for ${name}.`, ownership: 'Each child keeps a gear checklist, in words or pictures.', support: 'One gear bag per child that lives in one spot.' }, `Ready for ${name}`), ids: sharedActivity.map((c) => c.child.id), category: 'belongings' };
  } else if (sharedPick && sharedPick[1].length >= (cands.some((c) => c.child.wishes.includes(c.itemId)) ? Math.max(theme.sharedFrom, 4) : theme.sharedFrom)) {
    // A routine several children share, unless she named a wish for a child in this focus: then individual ideas
    // serve her better, and grouping waits for a larger family.
    const [id, list] = sharedPick;
    grouped = { exp: group(id, list, habitItem(id)!.shared!, habitItem(id)!.shared!.title), ids: list.map((c) => c.child.id), category: habitItem(id)!.category };
  }
  if (grouped) {
    // A second, individual idea only for her wish for a child outside the group, in a different kind of job.
    const extra = cands.filter((c) => !grouped!.ids.includes(c.child.id) && c.child.wishes.includes(c.itemId) && habitItem(c.itemId)!.category !== grouped!.category)
      .sort((a, b) => b.score - a.score)[0];
    for (const k of kids) if (!grouped.ids.includes(k.id) && extra?.child.id !== k.id) notes.push({ name: k.name, outcome: 'not part of the shared habit (no fitting version, or already does it)' });
    return { experiments: [grouped.exp, ...(extra && theme.maxExperiments > 1 ? [experiment(extra)] : [])], recognized, notes };
  }

  // Otherwise: the best experiment, and a second only for a different child and a different kind of job.
  const ranked = cands.slice().sort((a, b) => b.score - a.score || (b.child.age ?? 0) - (a.child.age ?? 0));
  const chosen: Candidate[] = [];
  for (const c of ranked) {
    if (chosen.length >= theme.maxExperiments) break;
    if (chosen.some((x) => x.child.id === c.child.id || habitItem(x.itemId)!.category === habitItem(c.itemId)!.category)) continue;
    chosen.push(c);
  }
  for (const c of kids) if (!chosen.some((x) => x.child.id === c.id) && cands.some((x) => x.child.id === c.id)) notes.push({ name: c.name, outcome: 'a fitting idea, left out to keep it to the strongest one or two' });
  return { experiments: chosen.map(experiment), recognized, notes };
}

/** A family who told us too little: one shared habit (the month's), and at most one clearly framed idea to consider. */
export function starterHabits(ctx: FamilyContext, theme: MonthTheme, sharedId: string, considerId?: string): Recommendation {
  const shared = habitItem(sharedId)?.shared;
  const experiments: HabitExperiment[] = [];
  if (shared) {
    experiments.push({
      key: `exp:shared:${sharedId}`, itemId: sharedId, memberIds: [], who: 'Everyone', title: shared.title, why: '', basis: 'consider',
      action: shared.action, anchor: { text: (shared.anchors ?? []).join(' or '), verified: false }, ownership: shared.ownership,
      ...(shared.support ? { support: shared.support } : {}), principle: 'consistency', source: 'month',
    });
  }
  // The oldest child with a known age and a fitting version: one idea, clearly "to consider".
  const kid = considerId ? ctx.children.filter((c) => c.age !== null && fits(considerId, c, theme)).sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0] : undefined;
  if (kid && considerId && experiments.length < theme.maxExperiments) {
    const h = habitItem(considerId)!.byStage[kid.stage]!;
    const f = (t: string) => t.replaceAll('{name}', kid.name);
    experiments.push({
      key: `exp:${kid.id}:${considerId}`, itemId: considerId, memberIds: [kid.id], who: `${kid.name}, ${kid.age}`, title: habitItem(considerId)!.title, why: '', basis: 'consider',
      action: f(h.action), anchor: { text: h.anchors.join(' or '), verified: false }, ownership: f(h.ownership), ...(h.support ? { support: f(h.support) } : {}),
      principle: h.principle, source: 'month',
    });
  }
  return { experiments, recognized: [], notes: [] };
}


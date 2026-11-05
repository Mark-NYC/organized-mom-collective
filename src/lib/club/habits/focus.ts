/**
 * Which opportunity a family's own answers point to most strongly. Month-independent: each month supplies its
 * opportunities (mornings, evenings, back to school…); the scoring is the same.
 *
 *   relevance  her top priority 3 · each matching challenge 2 (up to 4) · a wish she named for a child 2 · an open wish 1
 *   impact     her priority 2 · a challenge 1
 *   readiness  children with a fitting behavior at their age they don't already do, up to 2
 *   habit      1 if a fitting behavior exists
 * Only opportunities with relevance > 0 count; ties go to her stated top priority, then stronger evidence.
 */
import { CHALLENGES, GROWTH_ITEMS, PRIORITIES, labelOf } from '../../../data/club/family-profile';
import { habitItem } from '../../../data/club/habit-library';
import type { ChildContext, FamilyContext } from './context';
import type { MonthTheme, Opportunity } from './types';

export interface ScoredOpportunity {
  o: Opportunity;
  score: number;
  parts: Record<'relevance' | 'impact' | 'readiness' | 'habit', number>;
  evidence: string[];
  source: 'priority' | 'challenge' | 'growth';
}

const label = (list: { id: string; label: string }[], id: string) => labelOf(list, id) || id;

/** Whether a library behavior fits this child this month (an age version, allowed, in season, not already theirs). */
export function fits(itemId: string, c: ChildContext, theme: MonthTheme): boolean {
  const item = habitItem(itemId);
  if (!item || !theme.allowed.includes(itemId) || !item.byStage[c.stage]) return false;
  if (item.school && !theme.schoolInSession) return false;
  if (item.activity && !c.activities.length) return false;
  if (c.owns.includes(item.category)) return false;
  return true;
}

export function scoreOpportunities(ctx: FamilyContext, opportunities: readonly Opportunity[], theme: MonthTheme): ScoredOpportunity[] {
  const kids = ctx.children;
  const scored = opportunities.map((o) => {
    const evidence: string[] = [];
    let relevance = 0;
    let impact = 0;
    const isPriority = Boolean(ctx.priority && o.priorities.includes(ctx.priority));
    if (isPriority) { relevance += 3; impact += 2; evidence.push(`Top priority: “${label(PRIORITIES, ctx.priority!)}”`); }
    const ch = ctx.challenges.filter((c) => o.challenges.includes(c));
    if (ch.length) { relevance += Math.min(4, 2 * ch.length); impact = Math.max(impact, 1); for (const c of ch) evidence.push(`Hard right now: “${label(CHALLENGES, c)}”`); }
    let wish = 0;
    for (const k of kids) for (const w of k.wishes) if (o.items.includes(w) && fits(w, k, theme)) { wish += 2; evidence.push(`Wants ${k.name} to take on “${label(GROWTH_ITEMS, w)}”`); }
    for (const w of ctx.openWishes) if (o.items.includes(w) && kids.some((k) => fits(w, k, theme))) { wish += 1; evidence.push(`Wants the kids to take on “${label(GROWTH_ITEMS, w)}”`); }
    relevance += Math.min(4, wish);
    const ready = kids.filter((k) => o.items.some((id) => fits(id, k, theme))).length;
    const parts = { relevance, impact, readiness: Math.min(2, ready), habit: ready ? 1 : 0 };
    const source: ScoredOpportunity['source'] = isPriority ? 'priority' : ch.length ? 'challenge' : 'growth';
    return { o, evidence, parts, score: parts.relevance + parts.impact + parts.readiness + parts.habit, source };
  });
  const isPriority = (s: ScoredOpportunity) => Boolean(ctx.priority && s.o.priorities.includes(ctx.priority));
  return scored.filter((s) => s.parts.relevance > 0)
    .sort((a, b) => b.score - a.score || Number(isPriority(b)) - Number(isPriority(a)) || b.parts.relevance - a.parts.relevance || opportunities.indexOf(a.o) - opportunities.indexOf(b.o));
}

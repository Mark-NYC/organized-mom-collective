/**
 * Who's helping, for the site's family job planners (the Family Spring Cleaning Builder, the Family Meal Responsibility
 * Planner): first names, a group (adult, teen, school-age, young child), a child's age when it's known, and personal
 * limits each tool defines for itself. Ages are suggestions; limits are rules. The account holder (usually Mom) is
 * marked so planners can lean her last. Editing UI: src/components/site/HelpersEditor.astro and helpers-editor.ts.
 */
import type { ToolHandoff } from './tool-handoff';

export type Group = 'adult' | 'teen' | 'school' | 'young';
export const GROUPS: readonly Group[] = ['adult', 'teen', 'school', 'young'];

export interface Helper {
  id: string;
  name: string;
  group: Group;
  /** Their real age when known (children only); otherwise the group decides. */
  age: number | null;
  /** The tool's own limit ids ("no-lift", "no-knives"…): jobs they rule out are never suggested or reassigned to them. */
  limits: string[];
  /** The person whose account it is (usually Mom): planners pick her last when others are equally free. */
  holder?: boolean;
}

export const groupLabel: Record<Group, string> = { adult: 'Adult', teen: 'Teen', school: 'School-age child', young: 'Young child' };
/** An age to plan with when only the group is known. */
export const groupAge: Record<Group, number | null> = { adult: null, teen: 14, school: 8, young: 4 };
export const groupFor = (age: number | null): Group => (age === null || age >= 18 ? 'adult' : age >= 13 ? 'teen' : age >= 6 ? 'school' : 'young');
/** The age a job's suggested minimum is checked against (grown-ups: none). */
export const ageOf = (h: Helper) => (h.group === 'adult' ? null : h.age ?? groupAge[h.group]);
/** Experience order: young 0 → adult 3. */
export const rankOf = (h: Helper) => GROUPS.length - 1 - GROUPS.indexOf(h.group);

/** A family's helpers from a page's handoff (first names, children's ages, the account holder). */
export function helpersFromHandoff(handoff?: ToolHandoff | null): Helper[] {
  return (handoff?.people ?? []).map((p, i) => ({
    id: `h${i}`, name: p.name, group: p.adult ? 'adult' : groupFor(p.age ?? null), age: p.adult ? null : p.age ?? null, limits: [],
    ...(p.holder ? { holder: true } : {}),
  }));
}

/** A new helper of a group, named "Adult 2", "Child 3"… until she types a name. */
export function newHelper(group: Group, existing: readonly Helper[], id: string): Helper {
  const count = existing.filter((h) => h.group === group).length + 1;
  return { id, name: `${group === 'adult' ? 'Adult' : group === 'teen' ? 'Teen' : 'Child'} ${count}`, group, age: null, limits: [] };
}

/** Saved helpers back from storage, dropping anything malformed and any limit the tool doesn't know. */
export function readHelpers(json: unknown, limits: readonly string[]): Helper[] {
  if (!Array.isArray(json)) return [];
  return json.slice(0, 12).flatMap((h: Partial<Helper>) => (typeof h?.id === 'string' && GROUPS.includes(h.group as Group) ? [{
    id: h.id.slice(0, 20),
    name: typeof h.name === 'string' && h.name.trim() ? h.name.replace(/\s+/g, ' ').slice(0, 30) : groupLabel[h.group as Group],
    group: h.group as Group,
    age: Number.isInteger(h.age) && h.age! >= 2 && h.age! < 18 ? h.age! : null,
    limits: Array.isArray(h.limits) ? h.limits.filter((l): l is string => limits.includes(l as string)) : [],
    ...(h.holder ? { holder: true } : {}),
  }] : []));
}

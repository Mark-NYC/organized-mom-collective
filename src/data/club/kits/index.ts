/**
 * Every Organized Family Club kit, oldest first, and the checks a kit must pass before it can be scheduled.
 * Planning-phase code: nothing renders these yet (docs/club/IMPLEMENTATION_PLAN.md → Phase 1).
 */
import { responsibilityById } from '../../responsibilities';
import { FREQUENCIES, OWNERSHIP_LEVELS, type KitConfig, type KitItem } from '../types';
import { kit as november2026 } from './2026-11-family-ownership';

export const kits: readonly KitConfig[] = [november2026];

export const kitBySlug = (slug: string) => kits.find((k) => k.slug === slug);

const SLUG = /^(\d{4}-\d{2})-[a-z0-9]+(-[a-z0-9]+)*$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function itemProblems(items: readonly KitItem[], where: string): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const i of items) {
    const at = `${where} ${i.id}`;
    if (!ID.test(i.id)) out.push(`${at}: id must be lowercase-with-dashes`);
    if (ids.has(i.id)) out.push(`${at}: duplicate id`);
    ids.add(i.id);
    if (!i.title.trim() || i.title.length > 80) out.push(`${at}: title 1–80 characters`);
    if (!i.doneMeans.trim()) out.push(`${at}: needs a doneMeans`);
    if (!FREQUENCIES.includes(i.frequency)) out.push(`${at}: unknown frequency`);
    if (i.for === 'adult' && (i.minAge !== undefined || i.maxAge !== undefined || i.levels)) out.push(`${at}: adult jobs have no ages or levels`);
    if (i.for === 'adult' && i.scope !== 'household') out.push(`${at}: adult jobs are household jobs`);
    if (i.minAge !== undefined && i.maxAge !== undefined && i.minAge > i.maxAge) out.push(`${at}: minAge after maxAge`);
    if (i.levels) {
      for (let n = 0; n < i.levels.length; n++) {
        const [age, level] = i.levels[n];
        if (!OWNERSHIP_LEVELS.includes(level)) out.push(`${at}: unknown level ${level}`);
        if (n > 0 && age <= i.levels[n - 1][0]) out.push(`${at}: levels must go up in age`);
        if (n > 0 && OWNERSHIP_LEVELS.indexOf(level) <= OWNERSHIP_LEVELS.indexOf(i.levels[n - 1][1])) out.push(`${at}: levels must grow`);
      }
      if (i.minAge !== undefined && i.levels[0][0] < i.minAge) out.push(`${at}: first level before minAge`);
    }
    for (const x of i.excludes ?? []) if (!items.some((o) => o.id === x)) out.push(`${at}: excludes unknown ${x}`);
    if (i.illustration && !responsibilityById(i.illustration)?.image) out.push(`${at}: illustration ${i.illustration} isn't in the responsibility library`);
  }
  return out;
}

/** Problems that stop a kit being built; empty when it's sound. */
export function kitProblems(kit: KitConfig): string[] {
  const out: string[] = [];
  const m = SLUG.exec(kit.slug);
  if (!m) out.push('slug must be YYYY-MM-theme');
  else if (m[1] !== kit.month) out.push('slug month must match month');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(kit.month)) out.push('month must be YYYY-MM');
  if (!Number.isInteger(kit.engineVersion) || kit.engineVersion < 1) out.push('engineVersion must be a positive integer');
  if ((kit.inputs?.length ?? 0) > 2) out.push('at most two kit-specific inputs');
  out.push(...itemProblems(kit.items, 'item'));
  if (kit.reset) out.push(...itemProblems(kit.reset.items, 'reset'));
  const printables = new Set<string>();
  for (const p of kit.printables) {
    if (!ID.test(p.id) || printables.has(p.id)) out.push(`printable ${p.id}: id missing, malformed or duplicated`);
    printables.add(p.id);
    if (p.items === 'reset' && !kit.reset) out.push(`printable ${p.id}: uses the reset, but the kit has none`);
  }
  if (kit.printables.filter((p) => p.kind === 'flagship').length !== 1) out.push('exactly one flagship printable');
  if (kit.mailer.qrPath !== `/club/kits/${kit.slug}?source=mailer`) out.push('qrPath must point at this kit');
  return out;
}

/** Scheduling also needs Megan's letter: a kit never goes out with a stand-in. */
export const schedulable = (kit: KitConfig) => kitProblems(kit).length === 0 && kit.mailer.letter !== null;

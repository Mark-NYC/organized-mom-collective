/**
 * Every Organized Family Club kit, oldest first, and the checks a kit must pass before it can be scheduled.
 * Planning-phase code: nothing renders these yet (docs/club/IMPLEMENTATION_PLAN.md → Phase 1).
 */
import { responsibilityById } from '../../responsibilities';
import { FREQUENCIES, OWNERSHIP_LEVELS, SCHOOL_TYPES, type KitConfig, type KitItem } from '../types';
import { routineTypes } from '../../routines';
import { clubToolById } from '../tools';
import { kit as november2026 } from './2026-11-family-ownership';
import { kit as january2027 } from './2027-01-fresh-start-together';
import { kit as february2027 } from './2027-02-better-together';
import { kit as march2027 } from './2027-03-spring-clean-together';
import { kit as august2027 } from './2027-08-school-year';
import { kit as october2027 } from './2027-10-home-works-together';
import { kit as december2027 } from './2027-12-christmas-family-affair';

export const kits: readonly KitConfig[] = [november2026, january2027, february2027, march2027, august2027, october2027, december2027];

export const kitBySlug = (slug: string) => kits.find((k) => k.slug === slug);

/** The rules behind an engine-filled printable: 'items', 'reset', or a key of the kit's itemSets. */
export function kitItems(kit: KitConfig, key: string | undefined): KitItem[] | undefined {
  if (!key) return undefined;
  if (key === 'items') return kit.items;
  if (key === 'reset') return kit.reset?.items;
  return kit.itemSets?.[key];
}

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
    for (const t of i.requires?.childSchool ?? []) if (!SCHOOL_TYPES.includes(t)) out.push(`${at}: unknown school type ${t}`);
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
  for (const [key, set] of Object.entries(kit.itemSets ?? {})) out.push(...itemProblems(set, key));
  const ids = new Set<string>();
  for (const set of [kit.items, ...Object.values(kit.itemSets ?? {})]) for (const i of set) {
    if (ids.has(i.id)) out.push(`item ${i.id}: used in two item sets (saved edits couldn't tell them apart)`);
    ids.add(i.id);
  }
  if (kit.overview) {
    const pool = kitItems(kit, kit.overview.from) ?? [];
    if (!kitItems(kit, kit.overview.from)) out.push(`overview: no item set ${kit.overview.from}`);
    if (pool.filter((i) => i.priority !== undefined).length < kit.overview.minActions) out.push('overview: fewer prioritized items than minActions');
    if (kit.overview.minActions > kit.overview.maxActions) out.push('overview: minActions above maxActions');
  }
  const printables = new Set<string>();
  for (const p of kit.printables) {
    if (!ID.test(p.id) || printables.has(p.id)) out.push(`printable ${p.id}: id missing, malformed or duplicated`);
    printables.add(p.id);
    if (p.items === 'reset' && !kit.reset) out.push(`printable ${p.id}: uses the reset, but the kit has none`);
    else if (p.items && !kitItems(kit, p.items)) out.push(`printable ${p.id}: no item set ${p.items}`);
    if (p.editor && p.editor !== 'chart' && !p.items) out.push(`printable ${p.id}: a ${p.editor} editor needs an item set`);
  }
  if (kit.printables.filter((p) => p.kind === 'flagship').length !== 1) out.push('exactly one flagship printable');
  if (kit.printables.some((p) => p.id === 'school-setup' || p.id === 'field-guide' || p.id === 'overview' || p.id === 'in-the-mail')) out.push('printable ids school-setup, field-guide, overview and in-the-mail are reserved');
  if (kit.mailer.qrPath !== `/club/kits/${kit.slug}?source=mailer`) out.push('qrPath must point at this kit');
  // Three-part kits: one short action, one optional tool, and the letter's back page.
  if (kit.action) {
    if (kit.action.items.length < 3 || kit.action.items.length > 8) out.push('action: 3–8 lines (one small action, not a project)');
    if (kit.action.items.some((t) => !t.text.trim() || t.text.length > 90)) out.push('action: each line 1–90 characters');
    if (kit.action.items.some((t) => t.detail !== undefined && (!t.detail.trim() || t.detail.length > 120))) out.push('action: each detail 1–120 characters');
    if (kit.action.kind === 'countdown') {
      if (kit.action.items.some((t) => !Number.isInteger(t.daysBefore) || t.daysBefore! < 1 || t.daysBefore! > 60)) out.push('action: daysBefore a whole number from 1 to 60');
      if (!kit.action.items.some((t) => t.essential)) out.push('action: mark the essentials (what still matters a day or two out)');
    } else if (kit.action.items.some((t) => t.daysBefore !== undefined || t.essential)) {
      out.push('action: a checklist has no dates (daysBefore, essential are for a countdown)');
    }
    if (!kit.mailer.invite || !kit.mailer.calendarNote) out.push('action: the letter needs its invite and calendar note');
    if (kit.action.helperPlacement === 'below' && !kit.action.helperLabel) out.push('action: a blank below each line needs a helperLabel');
    const f = kit.action.focus;
    if (f) {
      const n = kit.action.items.length;
      if (kit.action.kind !== 'checklist') out.push('action: a one-thing focus goes with a plain checklist');
      const line = (x: number | undefined) => x === undefined || (Number.isInteger(x) && x >= 0 && x < n);
      if (!line(f.planAt) || !line(f.startAt)) out.push('action: focus planAt and startAt must be lines of the action');
      if ((f.planAt === undefined) !== (f.planLabel === undefined) || (f.startAt === undefined) !== (f.startLabel === undefined)) out.push('action: focus planAt/startAt need their labels');
      if (f.startAt !== undefined && f.whenLabel) out.push('action: a focus has a start day or a when, not both');
      if (!f.suggestions.length || f.suggestions.length > 12 || f.suggestions.some((x) => !ID.test(x.id) || !x.label.trim())) out.push('action: focus needs 1–12 suggestions with ids');
    }
  }
  if (kit.tool && !clubToolById(kit.tool.tool)) out.push(`tool: ${kit.tool.tool} isn't a site tool the Club hosts (src/data/club/tools.ts)`);
  const prompts = kit.mailer.conversation?.prompts;
  if (prompts && (prompts.length < 2 || prompts.length > 4 || !prompts.includes(kit.mailer.conversation!.question))) out.push('conversation: 2–4 prompts, the letter’s question among them');
  if (kit.mailer.letter?.namedGreeting && !kit.mailer.letter.namedGreeting.includes('{name}')) out.push('letter: namedGreeting needs {name}');
  if (kit.mailer.example && !routineTypes[kit.mailer.example.variant]) out.push(`example: no routine ${kit.mailer.example.variant}`);
  if (!kit.action && !kit.mailer.activity) out.push('a kit needs an action or an activity');
  return out;
}

/** Scheduling also needs Megan's letter, approved: a kit never goes out with a stand-in or a draft. */
export const schedulable = (kit: KitConfig) => kitProblems(kit).length === 0 && kit.mailer.letter !== null && !kit.mailer.letter.draft;

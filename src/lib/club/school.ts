/**
 * A kit's school setup (kits with `setup: 'school'`, like August's): where each child goes to school this year and
 * when it starts. Saved as the kit's own document ('school-setup' in club_documents), not on the family profile.
 * Opens with sensible guesses from each child's age, and never assumes every child goes to school or starts the same day.
 */
import { LEAD_DAYS, SCHOOL_TYPES, type Lead, type SchoolType } from '../../data/club/types';
import { planMembers, type Household, type HouseholdPreferences } from './profile';

export const SETUP_DOC = 'school-setup';

export interface ChildSchool {
  type: SchoolType;
  /** 'YYYY-MM-DD', or undefined until she adds it. */
  start?: string;
}

export type SchoolSetup = Record<string, ChildSchool>;

/** A first guess from age: toddlers aren't in school, 3–4 preschool, 5–17 the household's school (public unless she said homeschool). */
export function defaultSchool(age: number, prefs: HouseholdPreferences): SchoolType {
  if (age <= 2 || age >= 18) return 'none';
  if (age <= 4) return 'preschool';
  return prefs.school === 'homeschool' ? 'homeschool' : 'public';
}

/** Every current child's school for the kit month: what she saved, else the guess. */
export function schoolSetupFor(household: Household, month: string, saved: SchoolSetup = {}): SchoolSetup {
  const out: SchoolSetup = {};
  for (const p of planMembers(household, month)) {
    if (p.stage === 'adult') continue;
    out[p.id] = saved[p.id] ?? { type: defaultSchool(p.age ?? 0, household.preferences) };
  }
  return out;
}

/** The household with each child's school on them, for the engine. */
export function withSchool(household: Household, setup: SchoolSetup): Household {
  return { ...household, members: household.members.map((m) => (setup[m.id] ? { ...m, school: setup[m.id].type } : m)) };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Saved JSON → setup, dropping anything malformed. */
export function readSetup(json: unknown): SchoolSetup {
  const out: SchoolSetup = {};
  const children = (json && typeof json === 'object' && (json as { children?: unknown }).children) || {};
  if (typeof children !== 'object' || Array.isArray(children)) return out;
  for (const [id, v] of Object.entries(children as Record<string, unknown>)) {
    const c = v as { type?: unknown; start?: unknown } | null;
    if (!c || !SCHOOL_TYPES.includes(c.type as SchoolType)) continue;
    out[id] = { type: c.type as SchoolType, ...(typeof c.start === 'string' && DATE.test(c.start) ? { start: c.start } : {}) };
  }
  return out;
}

export const inSchool = (c: ChildSchool | undefined) => Boolean(c && c.type !== 'none');

/** 'YYYY-MM-DD' minus `days`, as a Date at noon UTC (no daylight-saving edge). */
const dayBefore = (start: string, days: number) => {
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Aug 12" for a task due `lead` before `start`; null without a date. */
export const dueLabel = (start: string | undefined, lead: Lead) => (start ? fmt(dayBefore(start, LEAD_DAYS[lead])) : null);

/** "Wed, Aug 26" */
export const startLabel = (start: string) => new Date(`${start}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The earliest first day among children in school (household prep counts back from it). */
export const earliestStart = (setup: SchoolSetup) =>
  Object.values(setup).filter((c) => inSchool(c) && c.start).map((c) => c.start!).sort()[0];

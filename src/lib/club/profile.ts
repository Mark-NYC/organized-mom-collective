/**
 * Organized Family Club family profile: the browser-side shape of club_households + club_family_members
 * (docs/club/draft-schema.sql), ages for a kit's month, and the same validation the database applies.
 *
 * Children never have accounts. A member is a first name (or nickname), adult or child, a role and, for children,
 * a birth year and month. No last names, photos, schools, gender or full birthdays.
 */

export type MemberKind = 'adult' | 'child';
export type MemberRole = 'parent' | 'partner' | 'grandparent' | 'caregiver' | 'child' | 'other';
export const MEMBER_ROLES: readonly MemberRole[] = ['parent', 'partner', 'grandparent', 'caregiver', 'child', 'other'];

export interface FamilyMember {
  /** Stable: saved edits point at it. */
  id: string;
  firstName: string;
  kind: MemberKind;
  role: MemberRole;
  /** Children only. */
  birthYear?: number;
  birthMonth?: number;
  /** The adult who holds the account. The engine never gives them more than an even adult share. */
  isAccountHolder?: boolean;
  /** Removed from the family. Their saved jobs keep the id and show "Needs a new owner". */
  archived?: boolean;
}

export interface HouseholdPreferences {
  palette?: 'rose-lavender' | 'blue-green' | 'warm-neutrals';
  week_starts?: 'sunday' | 'monday';
  faith_content?: boolean;
  pets?: boolean;
  school?: 'public' | 'homeschool' | 'mixed';
  weekday_dinner?: string;
  /** What she said matters most (src/data/club/onboarding.ts). Shown back to her; doesn't change suggestions. */
  priorities?: string[];
}

export interface Household {
  id: string;
  displayName?: string;
  preferences: HouseholdPreferences;
  /** Bumped on every family or preference change. */
  profileVersion: number;
  members: FamilyMember[];
}

/** Life stage the engine plans for. Children 13 and up are teens. */
export type Stage = 'child' | 'teen' | 'adult';

export interface PlannedMember {
  id: string;
  firstName: string;
  stage: Stage;
  /** Age in whole years on the first day of the kit's month; null for adults. */
  age: number | null;
  isAccountHolder: boolean;
}

export const MAX_MEMBERS = 12;
export const MAX_NAME_LENGTH = 30;
export const TEEN_FROM = 13;

/** 'YYYY-MM' → [year, month 1–12]. */
export function parseMonth(month: string): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error(`invalid month: ${month}`);
  return [Number(m[1]), Number(m[2])];
}

/**
 * Age on the first day of `month`. Without a birth month we assume December, the youngest the child could be,
 * so a missing month never makes a job look more age-appropriate than it is.
 */
export function ageInMonth(birthYear: number, birthMonth: number | undefined, month: string): number {
  const [y, m] = parseMonth(month);
  const bm = birthMonth ?? 12;
  return y - birthYear - (m < bm ? 1 : 0);
}

export function stageOf(member: FamilyMember, month: string): { stage: Stage; age: number | null } {
  if (member.kind === 'adult') return { stage: 'adult', age: null };
  const age = ageInMonth(member.birthYear!, member.birthMonth, month);
  return { stage: age >= TEEN_FROM ? 'teen' : 'child', age };
}

/** The current (not archived) members, as the engine sees them in the kit's month. */
export function planMembers(household: Household, month: string): PlannedMember[] {
  return household.members
    .filter((m) => !m.archived)
    .map((m) => ({ id: m.id, firstName: m.firstName.trim(), ...stageOf(m, month), isAccountHolder: Boolean(m.isAccountHolder) && m.kind === 'adult' }));
}

/** Problems with a profile, in the database's words ('invalid' there). Empty when it can be saved. */
export function validateHousehold(household: Household, month: string): string[] {
  const errors: string[] = [];
  const active = household.members.filter((m) => !m.archived);
  if (active.length < 1 || household.members.length > MAX_MEMBERS) errors.push(`between 1 and ${MAX_MEMBERS} people`);
  if (new Set(household.members.map((m) => m.id)).size !== household.members.length) errors.push('duplicate member id');
  if (active.filter((m) => m.isAccountHolder).length > 1) errors.push('only one account holder');
  if (!active.some((m) => m.kind === 'adult')) errors.push('at least one adult');
  for (const m of household.members) {
    const name = m.firstName.trim();
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) errors.push(`${m.id}: first name 1–${MAX_NAME_LENGTH} characters`);
    if (!MEMBER_ROLES.includes(m.role)) errors.push(`${m.id}: unknown role`);
    else if ((m.kind === 'child') !== (m.role === 'child')) errors.push(`${m.id}: children, and only children, have the child role`);
    if (m.isAccountHolder && m.kind !== 'adult') errors.push(`${m.id}: the account holder is an adult`);
    if (m.kind === 'child') {
      if (!Number.isInteger(m.birthYear)) errors.push(`${m.id}: a child needs a birth year`);
      else if (m.birthMonth !== undefined && !(Number.isInteger(m.birthMonth) && m.birthMonth >= 1 && m.birthMonth <= 12)) errors.push(`${m.id}: birth month 1–12`);
      else if (ageInMonth(m.birthYear!, m.birthMonth, month) < 0) errors.push(`${m.id}: birth date after this month`);
    } else if (m.birthYear !== undefined || m.birthMonth !== undefined) {
      errors.push(`${m.id}: no birth date for adults`);
    }
  }
  return errors;
}

/** 'YYYY-MM' for a date (local time). */
export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Onboarding asks a child's age, and their birthday month only if she wants to give it. Stored as a birth year and
 * month so ages move up on their own. Without a month we record this month, so the age she typed is right today
 * and goes up a year from now.
 */
export function birthFromAge(age: number, today: string, birthMonth?: number): { birthYear: number; birthMonth: number } {
  const [y, m] = parseMonth(today);
  const month = birthMonth ?? m;
  // Born `age` years ago if the birthday has come this year, otherwise a year earlier.
  const birthYear = y - age - (m < month ? 1 : 0);
  return { birthYear, birthMonth: month };
}

/** A child's age today, for the family form. */
export const ageNow = (m: Pick<FamilyMember, 'birthYear' | 'birthMonth'>, today: string) =>
  m.birthYear === undefined ? null : ageInMonth(m.birthYear, m.birthMonth, today);

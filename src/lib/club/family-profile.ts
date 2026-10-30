/**
 * The family profile beyond the people: the browser-side shape of club_activities, club_responsibilities and the
 * household's challenge/priority columns (supabase/migrations/20261109000000_club_family_profile.sql), the setup
 * steps and the same checks the database applies.
 *
 * Kept apart on purpose: activities (what happens and when), existing responsibilities (what someone already owns or
 * helps with), desired responsibilities (what the family wants the kids to take on), challenges, and the priority.
 * Suggested and confirmed assignments share the responsibilities table but are never written by onboarding.
 */
import type { ActivityCategory, ResponsibilityCategory } from '../../data/club/family-profile';

/** Step 1 (the people) is the family form; these are the rest, in order. */
export const SETUP_STEPS = ['week', 'responsibilities', 'growth', 'challenges', 'priority'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
export const STEP_TITLES: Record<'family' | SetupStep, string> = {
  family: 'Your family',
  week: 'Your week',
  responsibilities: 'Who does what',
  growth: 'Growing responsibility',
  challenges: 'Staying on the same page',
  priority: 'Your first priority',
};
/** All six, the family form included, for the progress bar. */
export const TOTAL_STEPS = SETUP_STEPS.length + 1;

export type ResponsibilityStatus = 'existing' | 'desired' | 'suggested' | 'confirmed';

export interface Activity {
  id?: string;
  category: ActivityCategory;
  name?: string;
  memberIds: string[];
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** 'HH:MM', if she knows it. */
  startsAt?: string;
}

export interface Responsibility {
  id?: string;
  status: ResponsibilityStatus;
  category: ResponsibilityCategory;
  item?: string;
  label?: string;
  /** Takes care of it without being asked. */
  ownerIds: string[];
  /** Helps when asked. Never also an owner. */
  helperIds: string[];
  /** From the owners: one is individual, two or more shared, none not assigned yet. */
  scope?: 'individual' | 'shared';
}

export interface FamilyProfile {
  setupDone: SetupStep[];
  setupCompleted: boolean;
  challenges: string[];
  challengeNote?: string;
  priority?: string;
  priorityNote?: string;
  activities: Activity[];
  responsibilities: Responsibility[];
}

export const emptyProfile = (): FamilyProfile => ({ setupDone: [], setupCompleted: false, challenges: [], activities: [], responsibilities: [] });

export const MAX_ACTIVITIES = 30;
export const MAX_RESPONSIBILITIES = 30;
export const MAX_NOTE = 120;
export const MAX_ACTIVITY_NAME = 40;
export const MAX_LABEL = 60;

/** The first step she hasn't answered or skipped; null when setup is complete. */
export function nextOpenStep(p: Pick<FamilyProfile, 'setupDone' | 'setupCompleted'>): SetupStep | null {
  if (p.setupCompleted) return null;
  return SETUP_STEPS.find((s) => !p.setupDone.includes(s)) ?? null;
}

/** 'Step 3 of 6'. The family form is step 1. */
export const stepNumber = (step: 'family' | SetupStep) => (step === 'family' ? 1 : SETUP_STEPS.indexOf(step) + 2);

export const scopeOf = (ownerIds: string[]): Responsibility['scope'] =>
  ownerIds.length === 0 ? undefined : ownerIds.length === 1 ? 'individual' : 'shared';

export const byStatus = (p: FamilyProfile, status: ResponsibilityStatus) => p.responsibilities.filter((r) => r.status === status);

/** Mark a step answered (or skipped), the way club_setup_mark does. */
export function markStep(p: FamilyProfile, step: SetupStep): FamilyProfile {
  const setupDone = p.setupDone.includes(step) ? p.setupDone : [...p.setupDone, step];
  return { ...p, setupDone, setupCompleted: p.setupCompleted || SETUP_STEPS.every((s) => setupDone.includes(s)) };
}

const ID = /^[a-z]+(-[a-z]+)*$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Problems the database would refuse ('invalid' there). Empty when it can be saved. */
export function validateActivities(list: Activity[], memberIds: Set<string>): string[] {
  const errors: string[] = [];
  if (list.length > MAX_ACTIVITIES) errors.push(`at most ${MAX_ACTIVITIES} activities`);
  list.forEach((a, i) => {
    if (a.name !== undefined && (a.name.trim().length < 1 || a.name.trim().length > MAX_ACTIVITY_NAME)) errors.push(`${i}: name 1–${MAX_ACTIVITY_NAME} characters`);
    if (a.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errors.push(`${i}: day 0–6`);
    if (a.startsAt !== undefined && !TIME.test(a.startsAt)) errors.push(`${i}: time HH:MM`);
    if (a.memberIds.some((m) => !memberIds.has(m))) errors.push(`${i}: unknown person`);
  });
  return errors;
}

export function validateResponsibilities(list: Responsibility[], memberIds: Set<string>): string[] {
  const errors: string[] = [];
  if (list.length > MAX_RESPONSIBILITIES) errors.push(`at most ${MAX_RESPONSIBILITIES}`);
  list.forEach((r, i) => {
    if (r.status !== 'existing' && r.status !== 'desired') errors.push(`${i}: only existing or desired are saved here`);
    if (r.item !== undefined && !ID.test(r.item)) errors.push(`${i}: item id`);
    if (r.label !== undefined && (r.label.trim().length < 1 || r.label.trim().length > MAX_LABEL)) errors.push(`${i}: label 1–${MAX_LABEL} characters`);
    if (r.ownerIds.some((m) => r.helperIds.includes(m))) errors.push(`${i}: someone both owns and helps`);
    if ([...r.ownerIds, ...r.helperIds].some((m) => !memberIds.has(m))) errors.push(`${i}: unknown person`);
  });
  return errors;
}

// ------------------------------------------------------------------ the database's shape

export interface DbProfile {
  setup_done: SetupStep[];
  setup_completed: boolean;
  challenges: string[];
  challenge_note: string | null;
  priority: string | null;
  priority_note: string | null;
  activities: { id: string; category: ActivityCategory; name: string | null; member_ids: string[]; days: number[]; starts_at: string | null }[];
  responsibilities: {
    id: string; status: ResponsibilityStatus; category: ResponsibilityCategory; item: string | null; label: string | null;
    owner_ids: string[]; helper_ids: string[]; scope: 'individual' | 'shared' | null;
  }[];
}

export const profileFromDb = (p: DbProfile): FamilyProfile => ({
  setupDone: p.setup_done ?? [],
  setupCompleted: p.setup_completed,
  challenges: p.challenges ?? [],
  ...(p.challenge_note ? { challengeNote: p.challenge_note } : {}),
  ...(p.priority ? { priority: p.priority } : {}),
  ...(p.priority_note ? { priorityNote: p.priority_note } : {}),
  activities: p.activities.map((a) => ({
    id: a.id, category: a.category, memberIds: a.member_ids, days: a.days,
    ...(a.name ? { name: a.name } : {}), ...(a.starts_at ? { startsAt: a.starts_at } : {}),
  })),
  responsibilities: p.responsibilities.map((r) => ({
    id: r.id, status: r.status, category: r.category, ownerIds: r.owner_ids, helperIds: r.helper_ids,
    ...(r.item ? { item: r.item } : {}), ...(r.label ? { label: r.label } : {}), ...(r.scope ? { scope: r.scope } : {}),
  })),
});

export const activitiesToDb = (list: Activity[]) =>
  list.map((a) => ({
    ...(a.id ? { id: a.id } : {}), category: a.category, name: a.name?.trim() || null, member_ids: a.memberIds,
    days: [...new Set(a.days)].sort(), starts_at: a.startsAt || null,
  }));

export const responsibilitiesToDb = (list: Responsibility[]) =>
  list.map((r) => ({
    ...(r.id ? { id: r.id } : {}), category: r.category, item: r.item ?? null, label: r.label?.trim() || null,
    owner_ids: r.ownerIds, helper_ids: r.helperIds.filter((h) => !r.ownerIds.includes(h)),
  }));

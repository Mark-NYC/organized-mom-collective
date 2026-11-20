/**
 * When the weekly meeting's development plan may be shown, kept, rebuilt or must be dropped. Pure, so the rules are
 * tested directly (tests/family-development-lifecycle.test.ts); WeeklyMeeting and useDevelopment only apply them.
 *
 * A plan belongs to one signed-in adult, one household, Club access and one meeting day: its key. While the key stays
 * the same, the plan stays the same (a decision mid-meeting never reshuffles the steps on screen; decisions show
 * through the live records). When the key changes (sign-out, another account, another household, Club access lost,
 * a new day) the old plan is dropped at once, and a new one is built only from records loaded for the new key, so a
 * previous family's guidance can never be shown, even for a moment.
 */
import type { DevelopmentPlan } from './engine';
import type { DevelopmentRecord } from './records';

export interface MeetingIdentity {
  /** The signed-in adult (session user id); null when signed out. */
  userId: string | null;
  /** The household the page is showing (useCalendar's household id). */
  householdId: string | null;
  /** Club access as the database last confirmed it for this user. */
  club: boolean;
  /** 'YYYY-MM-DD', the meeting's day. */
  today: string;
}

/** The scope records are loaded for: a user in a household, with Club. Null: load nothing, show nothing. */
export function recordScope(i: Pick<MeetingIdentity, 'userId' | 'householdId' | 'club'>): string | null {
  return i.userId && i.householdId && i.club ? `${i.userId}|${i.householdId}` : null;
}

/** The plan's key: the record scope plus the day. */
export function planKey(i: MeetingIdentity): string | null {
  const scope = recordScope(i);
  return scope ? `${scope}|${i.today}` : null;
}

/** Records as loaded, tagged with the scope they were loaded for. */
export interface ScopedRecords { scope: string; records: DevelopmentRecord[] | null }

/** Only records loaded for this exact scope; anything else (a previous account or household) counts as not loaded. */
export function recordsFor(loaded: ScopedRecords | null, scope: string | null): DevelopmentRecord[] | null | undefined {
  if (!scope || !loaded || loaded.scope !== scope) return undefined; // undefined: not loaded for this scope (yet)
  return loaded.records; // null: loading failed for this scope
}

export interface PlanSlot { key: string; plan: DevelopmentPlan }

/**
 * The plan to show now. `build` is called only when a new plan is needed and everything it reads belongs to `key`:
 * records loaded for the key's scope, and the household on screen is the key's household.
 */
export function reconcilePlan(
  slot: PlanSlot | null,
  identity: MeetingIdentity,
  inputs: { records: DevelopmentRecord[] | null | undefined; householdOnScreen: string | null; profileLoaded: boolean },
  build: (records: DevelopmentRecord[]) => DevelopmentPlan,
): PlanSlot | null {
  const key = planKey(identity);
  if (!key) return null;
  if (slot?.key === key) return slot;
  if (inputs.householdOnScreen !== identity.householdId) return null;
  if (!inputs.records || !inputs.profileLoaded) return null; // not loaded, or failed: show nothing rather than guess
  return { key, plan: build(inputs.records) };
}

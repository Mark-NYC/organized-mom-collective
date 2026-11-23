/**
 * A new family's first steps (docs/ios/FAMILY_PLAN.md → First shared win). Organized Family is not another calendar
 * for Mom to keep up, so the first thing after the household is a shared win: one responsibility someone in the
 * family owns, agreed in about a minute, right on Today (an ordinary agreement, the same one the Family Meeting
 * saves). Then the first ten-minute Family Meeting, then (optional) the other grown-up. The calendar is not a step: it
 * comes in when it helps the family look ahead together (the meeting's week review, the Plans shortcut).
 *
 * Shown at the top of Today until the family has started, and on Family (FamilyHub). One list, so both screens agree.
 * A household with one grown-up has nobody to invite: that step counts as done (single parents finish the list too).
 */
import type { Household } from '../club/profile';

export interface FirstStep { id: 'household' | 'share' | 'meeting' | 'adult' | 'club'; label: string; href: string; done: boolean }

export function firstSteps(i: {
  household: Household | null;
  signedIn: boolean;
  shared: boolean;
  /** How many responsibilities the household has agreed (each counted once). */
  agreedParts: number;
  /** A Family Meeting was finished on this phone. */
  met: boolean;
  /** The other grown-up's invitation was put off for now ("Skip for now"). */
  inviteSkipped?: boolean;
  /** Website only (never the iPhone app), for a family without the Club. */
  offerClub: boolean;
}): FirstStep[] {
  const adults = (i.household?.members ?? []).filter((m) => m.kind === 'adult' && !m.archived).length;
  return [
    { id: 'household', done: Boolean(i.household), label: 'Set up your household', href: i.signedIn ? '/app/family/setup' : '/app/sign-in?next=/app/family/setup' },
    { id: 'share', done: i.agreedParts > 0, label: 'Start with one thing your family can share', href: '/app#start-here-h' },
    // A family that already agreed more than its first part has held a meeting (or done the same work), on any phone.
    { id: 'meeting', done: i.met || i.agreedParts > 1, label: 'Hold your first ten-minute Family Meeting', href: '/app/family/meeting' },
    { id: 'adult', done: i.shared || Boolean(i.inviteSkipped) || (Boolean(i.household) && adults <= 1), label: 'Invite the other grown-up (if there is one)', href: '/app/account#sharing-h' },
    ...(i.offerClub ? [{ id: 'club' as const, done: false, label: 'Discover Family Meeting Club', href: '/club' }] : []),
  ];
}

/** Still getting started: any of the family's own steps (not the Club) isn't done. */
export const gettingStarted = (steps: FirstStep[]) => steps.some((s) => s.id !== 'club' && !s.done);

/** The one thing to do next. */
export const nextStep = (steps: FirstStep[]) => steps.find((s) => s.id !== 'club' && !s.done) ?? null;

/** "Skip for now" on the invitation, remembered on this phone only. */
export const INVITE_SKIPPED = 'omc:start:invite-skipped:v1';
export const inviteSkipped = () => { try { return localStorage.getItem(INVITE_SKIPPED) === '1'; } catch { return false; } };
export const skipInvite = () => { try { localStorage.setItem(INVITE_SKIPPED, '1'); } catch { /* this visit only */ } };

/** A few starter ideas for one person, by age, from the existing chore list (src/data/chore-recommendations.ts). */
export function starterIdeas(age: number | null, choices: { label: string; minAge: number; frequency: string }[]): string[] {
  const a = age ?? 18;
  return choices.filter((c) => c.minAge <= a && c.frequency === 'daily').sort((x, y) => y.minAge - x.minAge).slice(0, 4).map((c) => c.label);
}

/**
 * A new family's first steps, in the owner's order: the household, this week on the calendar, the other grown-up, the
 * first Family Meeting (and, on the website only, a look at the Club). Shown at the top of Today until the family has
 * started, and on Family (FamilyHub). One list, so both screens always agree.
 *
 * A household with one grown-up has nobody to invite: that step counts as done (single parents finish the list too).
 */
import type { Household } from '../club/profile';

export interface FirstStep { id: 'household' | 'week' | 'adult' | 'meeting' | 'club'; label: string; href: string; done: boolean }

export function firstSteps(i: {
  household: Household | null;
  signedIn: boolean;
  hasPlans: boolean;
  shared: boolean;
  agreedCount: number;
  /** Website only (never the iPhone app), for a family without the Club. */
  offerClub: boolean;
}): FirstStep[] {
  const adults = (i.household?.members ?? []).filter((m) => m.kind === 'adult' && !m.archived).length;
  return [
    { id: 'household', done: Boolean(i.household), label: 'Set up your household', href: i.signedIn ? '/app/family/setup' : '/app/sign-in?next=/app/family/setup' },
    { id: 'week', done: i.hasPlans, label: 'Put this week on the family calendar', href: '/app/family-calendar' },
    { id: 'adult', done: i.shared || (Boolean(i.household) && adults <= 1), label: 'Invite the other grown-up (if there is one)', href: '/app/account#sharing-h' },
    { id: 'meeting', done: i.agreedCount > 0, label: 'Hold your first ten-minute Family Meeting', href: '/app/family/meeting' },
    ...(i.offerClub ? [{ id: 'club' as const, done: false, label: 'Discover Family Meeting Club', href: '/club' }] : []),
  ];
}

/** Still getting started: any of the family's own steps (not the Club) isn't done. */
export const gettingStarted = (steps: FirstStep[]) => steps.some((s) => s.id !== 'club' && !s.done);

/** The one thing to do next. */
export const nextStep = (steps: FirstStep[]) => steps.find((s) => s.id !== 'club' && !s.done) ?? null;

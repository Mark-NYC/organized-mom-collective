/**
 * Organized Family Club switches. Everything Club is off unless PUBLIC_CLUB_ENABLED is 'true' (it isn't, in
 * production): the /club pages then build as a plain "not available" notice with no app code, linked from nowhere.
 * `astro dev` shows them so the team can work on them.
 *
 * With the flag on there are two ways in:
 * - a sample household (?sample=<id>, src/data/club/samples.ts): made-up families, saved only in this browser tab,
 *   for development and Preview deployments;
 * - a real account (needs PUBLIC_ACCOUNTS_ENABLED and the Club migration on the project, plus a preview or beta
 *   access grant until billing exists).
 * No payments, no emails, no public links either way.
 */
import { accountsEnabled } from '../../lib/account';

export const clubEnabled = () => import.meta.env.PUBLIC_CLUB_ENABLED === 'true' || Boolean(import.meta.env.DEV);

/** Real sign-in for the Club: the flag plus customer accounts. */
export const clubAccountsEnabled = () => clubEnabled() && accountsEnabled();

export const CLUB_NAME = 'Organized Family Club';

/**
 * Your First Month FREE. The monthly resources are the 2027 program. A household that joins before it (a founding
 * member) gets the January 2027 plan free and is first charged on February 1, 2027; once it runs, the month she joins
 * is free and the first charge is one month after she joins. Either way the Family Vision welcome print is free and
 * nothing is charged at checkout. The server decides (club_checkout_state from club_settings.program_start_month and
 * intro_offer, supabase/migrations/20261107000000_club_first_month_free.sql); keep these in step with it. They only
 * choose the words the pages show.
 */
export const CLUB_OFFER = 'Your First Month FREE';
export const CLUB_OFFER_LINE = 'Get your family’s first personalized monthly resource printed and mailed to your door, on us. Then just $5.90/month. Cancel anytime.';
export const CLUB_PROGRAM_START = { label: 'January 2027', at: '2027-01-01T05:00:00Z', foundingFirstCharge: 'February 1, 2027' };
export const clubFoundingOpen = (now = Date.now()) => now < Date.parse(CLUB_PROGRAM_START.at);

/** A later member's first charge: one month after she joins (the last day of next month when it's shorter). */
export function rollingFirstCharge(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  d.setDate(Math.min(now.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

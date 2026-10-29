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
 * The monthly resources are the 2027 program. Members who join before it (founding members) pay for the Family
 * Vision welcome print at checkout, and their $5.90 monthly billing starts at midnight New York on its first day.
 * The server decides from club_settings.program_start_month (supabase/migrations/20261107000000_club_founding.sql);
 * keep these in step with it. They only choose which words the pages show.
 */
export const CLUB_PROGRAM_START = { label: 'January 2027', firstDay: 'January 1, 2027', at: '2027-01-01T05:00:00Z' };
export const clubFoundingOpen = (now = Date.now()) => now < Date.parse(CLUB_PROGRAM_START.at);

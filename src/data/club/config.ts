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

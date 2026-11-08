/**
 * Her Welcome Kit's personalized item, in one place: the Family Vision print (every kit before the owner's switch,
 * club_settings.welcome_item) or her Family Rhythm (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → Phase 2c). Pages
 * name it, link to it and draw its miniature from here, so the two never get mixed up.
 */
import { routes } from '../../routes';
import type { Membership } from './membership';

type WithWelcome = Pick<Membership, 'welcome'> | null | undefined;
export const welcomeIsRhythm = (me: WithWelcome) => me?.welcome?.kind === 'rhythm';
/** "Family Rhythm" or "Family Vision print". */
export const welcomeItemName = (me: WithWelcome) => (welcomeIsRhythm(me) ? 'Family Rhythm' : 'Family Vision print');
/** Its page: her Family Rhythm (in Welcome Kit mode while the kit waits on it) or the Vision print. */
export const welcomeItemHref = (me: WithWelcome, kitMode = false) =>
  welcomeIsRhythm(me) ? `${routes.appClubFamilyRhythm}${kitMode ? '?welcome=1' : ''}` : routes.clubFamilyVision;
/** Where its miniature (KitPreview) is drawn from, and which element is the printed sheet. */
export const welcomeItemPreview = (me: WithWelcome) => (welcomeIsRhythm(me)
  ? { src: routes.appClubFamilyRhythm, target: '.club-plan[data-plan-state="ready"] [data-plan-sheet]' }
  : { src: routes.clubFamilyVision, target: '#club-vision-content:not([hidden]) #fvp-art' });

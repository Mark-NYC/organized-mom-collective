/**
 * The Family Meeting Club's navigation inside Organized Family (docs/ios/CLUB_INTEGRATION.md): never a separate site
 * header. Every Club page keeps the app's own header and four tabs (Nav.astro: the Club lives under Family); this is
 * the secondary bar under it, the same on every Club page (/app/club, /app/club/<month>, /club/family,
 * /club/dashboard, /club/family-vision, /club/welcome, /club/welcome-kit).
 *
 * - Normal: "Family › Family Meeting Club", then Club Home, Monthly resources, Family profile and Account (& Billing on
 *   the website). Signing out is on Account, like everywhere else in the app.
 * - Onboarding (a page called setJourney, src/lib/club/journey.ts): her three-phase Welcome Kit progress and "Finish
 *   later" (back to Club Home; everything she did is already saved).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { clubAccountsEnabled } from '../../data/club/config';
import { getSession } from '../../lib/account';
import { loadMembership } from '../../lib/club/membership';
import { kitProgress } from '../../lib/club/onboarding';
import { useJourney } from '../../lib/club/journey';
import { routes } from '../../routes';
import KitSteps from './KitSteps';

export type ClubNavItem = 'home' | 'family' | 'months' | 'account';
/** `short`: the phone label (each is part of the full one, which is also the link's accessible name). */
export const CLUB_NAV: { id: ClubNavItem; label: string; short: string; href: string }[] = [
  { id: 'home', label: 'Club Home', short: 'Home', href: routes.appClub },
  { id: 'months', label: 'Monthly resources', short: 'Resources', href: routes.appClubMonths },
  { id: 'family', label: 'Family profile', short: 'Profile', href: routes.clubFamily },
  // In the app (Our Week): the app's Account page; billing stays on the website and isn't linked from the app.
  import.meta.env.PUBLIC_APP_SHELL === 'ios'
    ? { id: 'account', label: 'Account', short: 'Account', href: routes.appAccount }
    : { id: 'account', label: 'Account & Billing', short: 'Account', href: routes.clubDashboard },
];

export default function ClubNav({ current }: { current?: ClubNavItem | null }): ReactElement {
  const journey = useJourney();
  const trail = (
    <p className="of-eyebrow of-clubbar-trail"><a href={routes.appFamily}>Family</a><span aria-hidden="true"> › </span><a href={routes.appClub}>Family Meeting Club</a></p>
  );
  if (journey && journey !== 'done') {
    return (
      <nav aria-label="Family Meeting Club" data-club-chrome data-club-nav data-club-onboarding className="of-clubbar print:hidden">
        {trail}
        <div className="of-clubbar-row">
          <KitSteps steps={kitProgress(journey)} className="min-w-0 flex-1" />
          <a href={routes.appClub} className="of-tile-action shrink-0">Finish later</a>
        </div>
      </nav>
    );
  }
  return (
    <nav aria-label="Family Meeting Club" data-club-chrome data-club-nav className="of-clubbar print:hidden">
      {trail}
      <div className="of-seg of-clubbar-seg">
        {CLUB_NAV.map((i) => (
          <a key={i.id} href={i.href} aria-label={i.label} aria-current={current === i.id ? 'page' : undefined}>{i.label}</a>
        ))}
      </div>
    </nav>
  );
}

/** Signed out (the Club's sign-in pages): the trail only; the app header above carries the brand. */
export function ClubBarSignedOut() {
  return <nav aria-label="Family Meeting Club" data-club-chrome className="of-clubbar print:hidden"><p className="of-eyebrow of-clubbar-trail">Family Meeting Club</p></nav>;
}

/** The header on pages outside ClubGate (the month tools): shown only once a signed-in member is confirmed. */
export function ClubNavForMembers({ current }: { current?: ClubNavItem | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!clubAccountsEnabled() || q.get('sample') || q.get('fulfillment') || q.has('thumb')) return;
    getSession().then(async (s) => {
      if (!s) return;
      const me = await loadMembership();
      setShow(Boolean(me.member || me.grant));
    }).catch(() => undefined);
  }, []);
  return show ? <ClubNav current={current} /> : null;
}

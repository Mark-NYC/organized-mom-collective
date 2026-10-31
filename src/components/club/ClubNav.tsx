/**
 * The one Club navigation for a signed-in member, the same on every Club page (/app/club, /app/club/<month>,
 * /club/family, /club/dashboard, /club/family-vision, /club/welcome): Club Home, My Family, Monthly Resources,
 * Account & Billing, Sign out. Club Home and Monthly Resources are /app/club (the month grid is #months); family and
 * billing live on their own pages. The companion's own navigation (src/components/Nav.astro) stays separate.
 */
import { useEffect, useState } from 'react';
import { CLUB_NAME, clubAccountsEnabled } from '../../data/club/config';
import { getSession, signOut } from '../../lib/account';
import { loadMembership } from '../../lib/club/membership';
import { routes } from '../../routes';
import { clubNav } from '../../lib/club/nav';

export type ClubNavItem = 'home' | 'family' | 'months' | 'account';
/** `short`: the phone label (each is part of the full one, which is also the link's accessible name). */
export const CLUB_NAV: { id: ClubNavItem; label: string; short: string; href: string }[] = [
  { id: 'home', label: 'Club Home', short: 'Home', href: routes.appClub },
  { id: 'family', label: 'My Family', short: 'My Family', href: routes.clubFamily },
  { id: 'months', label: 'Monthly Resources', short: 'Resources', href: `${routes.appClub}#months` },
  { id: 'account', label: 'Account & Billing', short: 'Account', href: routes.clubDashboard },
];

export default function ClubNav({ current }: { current?: ClubNavItem | null }) {
  return (
    <header data-club-chrome data-club-nav className="border-b border-warm-rule bg-ivory print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 px-4 py-1 sm:px-8 sm:py-2">
        <a href={routes.appClub} className="order-1 py-1 font-serif text-[1.05rem] text-warm-ink">{CLUB_NAME}</a>
        <button type="button" className="order-2 inline-flex min-h-11 items-center whitespace-nowrap px-2 text-[0.82rem] text-warm-soft underline underline-offset-4 sm:order-3"
          onClick={() => signOut().then(() => clubNav().reload())}>
          Sign out
        </button>
        <nav aria-label="Club" className="order-3 -mx-2 flex w-full items-center justify-between sm:order-2 sm:ml-auto sm:w-auto sm:justify-end">
          {CLUB_NAV.map((i) => (
            <a key={i.id} href={i.href} aria-label={i.label} aria-current={current === i.id ? 'page' : undefined}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-[3px] px-2 text-[0.82rem] font-semibold text-warm-ink aria-[current=page]:underline aria-[current=page]:underline-offset-[6px] sm:px-2.5">
              <span className="sm:hidden">{i.short}</span><span className="hidden sm:inline">{i.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** The nav on pages outside ClubGate (the month tools): shown only once a signed-in member is confirmed. */
export function ClubNavForMembers({ current }: { current?: ClubNavItem | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!clubAccountsEnabled() || new URLSearchParams(location.search).get('sample')) return;
    getSession().then(async (s) => {
      if (!s) return;
      const me = await loadMembership();
      setShow(Boolean(me.member || me.grant));
    }).catch(() => undefined);
  }, []);
  return show ? <ClubNav current={current} /> : null;
}

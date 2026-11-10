/**
 * The one header for a signed-in member, the same on every Club page (/app/club, /app/club/<month>, /club/family,
 * /club/dashboard, /club/family-vision, /club/welcome, /club/welcome-kit): one compact row, never stacked under
 * another bar.
 *
 * - Normal: the Club's name, then Club Home, My Family, Monthly Resources, Account & Billing and Sign out. On phones
 *   the four links fold into a small "Menu" so the row stays one line.
 * - Onboarding (a page called setJourney, src/lib/club/journey.ts): the name, her three-phase Welcome Kit progress and
 *   "Finish later" (back to Club Home; everything she did is already saved). Account links stay out of her way.
 *
 * On the companion pages (/app/club…) it takes the place of the companion's own top bar (AppLayout's Nav), so a member
 * sees one header there too; the companion's bottom tab bar on phones stays.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { clubAccountsEnabled } from '../../data/club/config';
import { getSession, signOut } from '../../lib/account';
import { loadMembership } from '../../lib/club/membership';
import { kitProgress } from '../../lib/club/onboarding';
import { useJourney } from '../../lib/club/journey';
import { routes } from '../../routes';
import { clubNav } from '../../lib/club/nav';
import KitSteps from './KitSteps';

export type ClubNavItem = 'home' | 'family' | 'months' | 'account';
/** `short`: the phone label (each is part of the full one, which is also the link's accessible name). */
export const CLUB_NAV: { id: ClubNavItem; label: string; short: string; href: string }[] = [
  { id: 'home', label: 'Club Home', short: 'Home', href: routes.appClub },
  { id: 'family', label: 'My Family', short: 'My Family', href: routes.clubFamily },
  { id: 'months', label: 'Monthly Resources', short: 'Resources', href: routes.appClubMonths },
  { id: 'account', label: 'Account & Billing', short: 'Account', href: routes.clubDashboard },
];

/**
 * On a companion page (/app/club…, AppLayout) the header goes where the companion's top bar is, full width at the top
 * of the page, instead of inside the page's padded <main>; on the Club's own pages it renders in place.
 */
function useTopSlot(): HTMLElement | null {
  const [slot] = useState(() => {
    if (typeof document === 'undefined') return null;
    const app = document.querySelector('body > header[data-chrome]');
    if (!app) return null;
    let s = document.getElementById('club-header-slot');
    if (!s) {
      s = document.createElement('div');
      s.id = 'club-header-slot';
      app.before(s);
    }
    return s;
  });
  return slot;
}

export default function ClubNav(props: { current?: ClubNavItem | null }) {
  const slot = useTopSlot();
  const header = <ClubHeader {...props} />;
  return slot ? createPortal(header, slot) : header;
}

function ClubHeader({ current }: { current?: ClubNavItem | null }): ReactElement {
  const journey = useJourney();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A member sees this header instead of the companion's top bar (one header per page).
    document.documentElement.dataset.clubHeader = '';
    return () => { delete document.documentElement.dataset.clubHeader; };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!(e.target instanceof Node && menu.current?.contains(e.target))) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [open]);

  const brand = (
    <a href={routes.appClub} aria-label="Family Meeting Club home" className="flex min-w-0 flex-none items-center py-1"><img src="/images/club/family-meeting-club-horizontal-logo.webp" alt="The Family Meeting Club" width={2027} height={570} className="block h-auto w-[154px] max-w-[49vw] object-contain object-left sm:w-[195px]" /></a>
  );

  if (journey && journey !== 'done') {
    return (
      <header data-club-chrome data-club-nav data-club-onboarding className="club-header border-b border-warm-rule bg-ivory print:hidden">
        <div className="mx-auto flex min-h-[56px] max-w-6xl flex-wrap items-center justify-between gap-x-3 px-4 sm:px-8 md:flex-nowrap">
          {brand}
          <KitSteps steps={kitProgress(journey)} className="justify-center max-md:order-last max-md:w-full max-md:pb-2 md:flex-1" />
          <a href={routes.appClub} className="inline-flex min-h-11 flex-none items-center text-[0.8rem] font-semibold text-warm-soft underline underline-offset-4 hover:text-warm-ink">
            Finish later
          </a>
        </div>
      </header>
    );
  }

  const links = (
    <nav aria-label="Club" className="club-header-links">
      {CLUB_NAV.map((i) => (
        <a key={i.id} href={i.href} aria-label={i.label} aria-current={current === i.id ? 'page' : undefined} onClick={() => setOpen(false)}>
          {i.label}
        </a>
      ))}
      <button type="button" className="club-header-signout" onClick={() => signOut().then(() => clubNav().reload())}>Sign out</button>
    </nav>
  );
  return (
    <header data-club-chrome data-club-nav className="club-header border-b border-warm-rule bg-ivory print:hidden">
      <div ref={menu} className="relative mx-auto flex min-h-[56px] max-w-6xl items-center justify-between gap-3 px-4 sm:px-8" data-open={open ? '' : undefined}>
        {brand}
        <button type="button" className="club-header-menu" aria-expanded={open} aria-controls="club-header-links" onClick={() => setOpen(!open)}>
          {current ? CLUB_NAV.find((i) => i.id === current)?.short : 'Menu'} <span aria-hidden="true">▾</span>
        </button>
        <div id="club-header-links" className="club-header-panel">{links}</div>
      </div>
    </header>
  );
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

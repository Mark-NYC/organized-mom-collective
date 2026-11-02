/**
 * Above the Family Meeting guide (/club/family-meeting-guide). A member whose Welcome Kit is still open: one short
 * line (it's in her kit, the same for every family, nothing to change) and "Back to my Welcome Kit". The guide never
 * asks for an approval; opening it is noted (markMeetingGuideSeen) and never holds the kit. A member after that: the
 * Club header and a Print button. Anyone else (the owner printing it): a Print button.
 */
import { useEffect, useState } from 'react';
import { clubAccountsEnabled } from '../../data/club/config';
import { getSession } from '../../lib/account';
import { loadMembership, type Membership } from '../../lib/club/membership';
import { kitSubmitted, markMeetingGuideSeen } from '../../lib/club/onboarding';
import { setJourney } from '../../lib/club/journey';
import { routes } from '../../routes';
import ClubNav from './ClubNav';

export default function MeetingGuideStep() {
  const [me, setMe] = useState<Membership | null>(null);
  const thumb = typeof location !== 'undefined' && new URLSearchParams(location.search).has('thumb');
  useEffect(() => {
    if (!clubAccountsEnabled() || thumb) return;
    getSession().then(async (s) => {
      if (!s) return;
      const m = await loadMembership();
      if (!m.member && !m.grant) return;
      setMe(m);
      const open = Boolean(m.welcome && ['pending', 'on_hold'].includes(m.welcome.status) && !kitSubmitted(m));
      if (open) {
        setJourney('meeting_guide');
        markMeetingGuideSeen(s.user_id).catch(() => undefined);
      }
    }).catch(() => undefined);
    return () => setJourney(null);
  }, []);

  if (thumb) return null;
  const print = <button type="button" className="text-[0.92rem] font-semibold underline underline-offset-4" onClick={() => window.print()}>Print this guide</button>;
  if (!me) return <div data-club-chrome className="mx-auto max-w-[720px] px-4 pt-6 text-right print:hidden">{print}</div>;

  const inKit = Boolean(me.welcome && ['pending', 'on_hold'].includes(me.welcome.status) && !kitSubmitted(me));
  return (
    <>
      <ClubNav />
      <section data-club-chrome data-meeting-guide-step className="mx-auto mt-5 max-w-[720px] px-4 print:hidden">
        {inKit ? (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-warm-rule pb-4">
            <div className="min-w-0 flex-1 basis-[22rem]">
              <p className="text-[0.78rem] font-semibold tracking-[0.12em] text-warm-soft uppercase"><a className="underline underline-offset-4" href={routes.clubWelcomeKit}>Welcome Kit</a> / Family Meeting Guide</p>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-warm-ink">This one-page guide comes in your Welcome Kit. It’s the same for every family, so there’s nothing to change.</p>
            </div>
            <a className="btn-primary" href={routes.clubWelcomeKit}>Back to my Welcome Kit</a>
          </div>
        ) : (
          <p className="text-right">{print} · <a className="text-[0.92rem] font-semibold underline underline-offset-4" href={routes.appClub}>Club Home</a></p>
        )}
      </section>
    </>
  );
}

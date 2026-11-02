/**
 * Above the Family Meeting guide (/club/family-meeting-guide). A member whose Welcome Kit is still open: one short
 * line (it’s in her kit, the same for every family, nothing to change), the Welcome Kit step bar and one "Next". The guide never
 * asks for an approval; opening it is noted (markMeetingGuideSeen) and never holds the kit. A member after that: the
 * Club header and a Print button. Anyone else (the owner printing it): a Print button.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clubAccountsEnabled } from '../../data/club/config';
import { getSession } from '../../lib/account';
import { loadMembership, type Membership } from '../../lib/club/membership';
import { firstMonth, firstResourceReviewed, kitNext, kitSubmitted, markMeetingGuideSeen } from '../../lib/club/onboarding';
import WelcomeKitBar from './WelcomeKitBar';
import { setJourney } from '../../lib/club/journey';
import { routes } from '../../routes';
import ClubNav from './ClubNav';

export default function MeetingGuideStep() {
  const [me, setMe] = useState<Membership | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const thumb = typeof location !== 'undefined' && new URLSearchParams(location.search).has('thumb');
  useEffect(() => {
    if (!clubAccountsEnabled() || thumb) return;
    getSession().then(async (s) => {
      if (!s) return;
      const m = await loadMembership();
      if (!m.member && !m.grant) return;
      setMe(m);
      setUid(s.user_id);
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

  const inKit = Boolean(me.welcome && !me.welcome.satisfies_month && ['pending', 'on_hold'].includes(me.welcome.status) && !kitSubmitted(me));
  // Opening the guide is all it needs, so it counts as done here.
  const flags = { guideSeen: true, reviewed: firstResourceReviewed(firstMonth(me)?.slug, uid) };
  const next = kitNext(me, 'guide', flags);
  return (
    <>
      <ClubNav />
      <WelcomeKitBar current="guide" flow={{ me, uid, flags, open: inKit }} />
      {inKit ? (() => {
        // The same layout as her other two pieces: this rail beside the sheet on the grey desk.
        const rail = (
          <section data-club-chrome data-meeting-guide-step className="print:hidden">
            <h1>Family Meeting Guide</h1>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-warm-ink">This one-page guide comes in your Welcome Kit. It’s the same for every family, so there’s nothing to change.</p>
            <a className="btn-primary mt-5 w-full" href={next.href} data-kit-next>{next.label} <span aria-hidden="true">&nbsp;→</span></a>
            <p className="mt-3">{print}</p>
          </section>
        );
        const slot = document.getElementById('mg-rail');
        return slot ? createPortal(rail, slot) : rail;
      })() : (
        <section data-club-chrome data-meeting-guide-step className="mx-auto mt-5 max-w-[720px] px-4 print:hidden">
          <p className="text-right">{print} · <a className="text-[0.92rem] font-semibold underline underline-offset-4" href={routes.appClub}>Club Home</a></p>
        </section>
      )}
    </>
  );
}

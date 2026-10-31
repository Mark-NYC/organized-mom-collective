/**
 * Above the Family Meeting guide (/club/family-meeting-guide). A member in setup: the Club nav, her Welcome Kit's
 * progress (the guide step) and one button on to her first resource; her review is recorded (markMeetingGuideSeen),
 * and never holds the kit. Any other visitor (the owner printing it): a Print button.
 */
import { useEffect, useState } from 'react';
import { clubAccountsEnabled } from '../../data/club/config';
import { getSession } from '../../lib/account';
import { loadMembership, monthName, type Membership } from '../../lib/club/membership';
import { firstMonth, kitProgress, markMeetingGuideSeen, nextStep, stepHref } from '../../lib/club/onboarding';
import { routes } from '../../routes';
import ClubNav from './ClubNav';
import KitSteps from './KitSteps';

export default function MeetingGuideStep() {
  const [me, setMe] = useState<Membership | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!clubAccountsEnabled()) return;
    getSession().then(async (s) => {
      if (!s) return;
      const m = await loadMembership();
      if (m.member || m.grant) { setUid(s.user_id); setMe(m); }
    }).catch(() => undefined);
  }, []);

  const print = <button type="button" className="text-[0.92rem] font-semibold underline underline-offset-4" onClick={() => window.print()}>Print this guide</button>;
  if (!me) return <div data-club-chrome className="mx-auto max-w-[720px] px-4 pt-6 text-right print:hidden">{print}</div>;

  const step = nextStep(me, { meetingGuideSeen: false });
  const inSetup = step === 'meeting_guide';
  const first = firstMonth(me);
  const month = first ? monthName(first.month).split(' ')[0] : 'first';
  const next = async () => {
    setBusy(true);
    await markMeetingGuideSeen(uid);
    location.assign(stepHref(me, 'first_resource'));
  };
  return (
    <>
      <ClubNav />
      <section data-club-chrome data-meeting-guide-step className="mx-auto mt-6 max-w-[720px] px-4 print:hidden">
        {inSetup ? (
          <div className="rounded-[12px] border border-[#dde4dc] bg-[#eaf2eb] p-5 sm:p-6">
            <KitSteps steps={kitProgress('meeting_guide')} />
            <h2 className="font-serif text-[1.5rem] leading-tight text-warm-ink">Your Family Meeting guide</h2>
            <p className="mt-2 text-warm-soft">This one-page guide comes in your Welcome Kit. It’s the same for every family: how to hold a ten-minute family meeting each month, so everyone knows the plan and plays a part. Nothing to change here.</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={next}>{busy ? 'One moment…' : `Next: your ${month} resource`}</button>
              {print}
            </div>
          </div>
        ) : (
          <p className="text-right">{print} · <a className="text-[0.92rem] font-semibold underline underline-offset-4" href={routes.appClub}>Club Home</a></p>
        )}
      </section>
    </>
  );
}

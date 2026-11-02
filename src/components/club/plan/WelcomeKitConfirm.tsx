/**
 * Her first month's real tool in Welcome Kit mode (/app/club/<month>?welcome=1, from the Welcome Kit page): one small
 * line above the plan, "Welcome Kit / Your January Resource" and what to do, never a banner between her and the
 * printable. The page root gets data-plan-welcome, which turns the plan's own approve button (desktop rail and phone
 * action bar) into "Approve for printing": that marks her review on this device (markFirstResourceReviewed) and takes
 * her back to her Welcome Kit, where "Prepare My Welcome Kit" makes the one approval the kit waits on
 * (club_fulfillment_approve). A later change to the plan clears the review, so what she submits is what she saw.
 * Before her print is approved, the line points her to it instead. Never on samples, previews, print views or ?thumb.
 */
import { useEffect, useState } from 'react';
import { clubAccountsEnabled } from '../../../data/club/config';
import { clubResourceBySlug } from '../../../data/club/resources';
import { getSession } from '../../../lib/account';
import { loadMembership, monthName } from '../../../lib/club/membership';
import { clearFirstResourceReviewed, firstResourceReviewed, markFirstResourceReviewed, welcomeKitView, type WelcomeKitView as View } from '../../../lib/club/onboarding';
import { setJourney } from '../../../lib/club/journey';
import { routes } from '../../../routes';
import { PLAN_SAVE } from '../../../lib/club/plan/account';
import { PLAN_WELCOME, PLAN_WELCOME_APPROVE } from '../../../lib/club/plan/resource';

export default function WelcomeKitConfirm({ kitSlug }: { kitSlug: string }) {
  const [view, setView] = useState<View>('none');
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!clubAccountsEnabled() || q.get('sample') || q.get('fulfillment') || q.has('thumb')) return;
    const root = document.querySelector<HTMLElement>(`.club-plan[data-kit-slug="${kitSlug}"]`);
    let uid: string | null = null;
    let active = false;
    const onSave = () => {
      // A change after she approved it: she looks again before it goes in her kit.
      if (active && root?.dataset.planSave === 'saved' && firstResourceReviewed(kitSlug, uid)) {
        clearFirstResourceReviewed(kitSlug, uid);
        setReviewed(false);
      }
    };
    // The plan's own approve button, in Welcome Kit mode: her review for the kit, then back to the kit.
    const onApproval = () => {
      if (!active) return;
      markFirstResourceReviewed(kitSlug, uid);
      setReviewed(true);
      location.assign(routes.clubWelcomeKit);
    };
    getSession().then(async (s) => {
      if (!s) return;
      uid = s.user_id;
      const now = welcomeKitView(await loadMembership(), kitSlug);
      setView(now);
      setReviewed(firstResourceReviewed(kitSlug, uid));
      active = now === 'confirm';
      if (root) {
        if (active) root.dataset.planWelcome = '';
        else delete root.dataset.planWelcome;
        root.dispatchEvent(new Event(PLAN_WELCOME));
      }
      if (now !== 'none') setJourney('first_resource');
    }).catch(() => undefined);
    root?.addEventListener(PLAN_SAVE, onSave);
    root?.addEventListener(PLAN_WELCOME_APPROVE, onApproval);
    return () => {
      root?.removeEventListener(PLAN_SAVE, onSave);
      root?.removeEventListener(PLAN_WELCOME_APPROVE, onApproval);
      setJourney(null);
    };
  }, [kitSlug]);

  if (view === 'none') return null;
  const r = clubResourceBySlug(kitSlug);
  const month = r ? monthName(`${r.month}-01`).split(' ')[0] : 'First';
  return (
    <nav data-welcome-kit-confirm data-club-chrome aria-label="Welcome Kit" className="wkc print:hidden">
      <p className="wkc-crumb"><a href={routes.clubWelcomeKit}>Welcome Kit</a> <span aria-hidden="true">/</span> <span aria-current="page">Your {month} Resource</span></p>
      <p className="wkc-text">
        {view === 'print_first'
          ? <>Your {month} plan is mailed with your Family Vision Print. <a href={routes.clubFamilyVision}>Approve your print first</a>, then come back to this plan.</>
          : reviewed
            ? <>You approved this plan for printing. <a href={routes.clubWelcomeKit}>Back to my Welcome Kit</a></>
            : <>Review your family’s plan. Make any changes, then approve it for printing.</>}
      </p>
    </nav>
  );
}

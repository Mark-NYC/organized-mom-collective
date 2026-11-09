/**
 * Her Family Rhythm in Welcome Kit mode (/app/club/family-rhythm?welcome=1, from her Welcome Kit while it carries the
 * Family Rhythm: docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → Phase 2c). Like her first month's tool
 * (WelcomeKitConfirm): the Welcome Kit step bar above the plan, and the plan's own approve button reads "Approve for
 * printing". Her approval is saved to her account (club_welcome_plan_approve puts the plan she approved on her kit's
 * order); once it has landed she goes on to the next piece, or back to her kit. Without ?welcome=1, or once the kit has
 * gone in, the page is simply hers to keep: nothing here asks her to come back. Never on samples, previews or print views.
 */
import { useEffect, useRef, useState } from 'react';
import { clubAccountsEnabled } from '../../../data/club/config';
import { getSession } from '../../../lib/account';
import { loadMembership } from '../../../lib/club/membership';
import { kitNext, kitSubmitted } from '../../../lib/club/onboarding';
import { welcomeIsRhythm } from '../../../lib/club/welcome-item';
import { setJourney } from '../../../lib/club/journey';
import { welcomeApprovalSettled } from '../../../lib/club/plan/family';
import { PLAN_WELCOME, PLAN_WELCOME_APPROVE } from '../../../lib/club/plan/resource';
import { routes } from '../../../routes';
import WelcomeKitBar, { useKitFlow } from '../WelcomeKitBar';

export default function WelcomeRhythmKit() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const flow = useKitFlow();
  const flowRef = useRef(flow);
  flowRef.current = flow;

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!clubAccountsEnabled() || !q.has('welcome') || q.get('sample') || q.get('fulfillment') || q.has('thumb')) return;
    const root = document.querySelector<HTMLElement>('.club-plan[data-plan-context="welcome"]');
    let on = false;
    const onApproval = () => {
      if (!on) return;
      setError('');
      welcomeApprovalSettled().then(() => {
        const f = flowRef.current;
        location.assign(f ? kitNext(f.me, 'print', f.flags).href : `${routes.clubWelcomeKit}?done=print`);
      }, () => setError('We couldn’t save your approval. Check your connection and try again.'));
    };
    getSession().then(async (s) => {
      if (!s) return;
      const me = await loadMembership();
      const w = me.welcome;
      on = Boolean(welcomeIsRhythm(me) && w && ['pending', 'on_hold'].includes(w.status) && !kitSubmitted(me));
      setActive(on);
      if (root) {
        if (on) root.dataset.planWelcome = '';
        else delete root.dataset.planWelcome;
        root.dispatchEvent(new Event(PLAN_WELCOME));
      }
      if (on) setJourney('print');
    }).catch(() => undefined);
    root?.addEventListener(PLAN_WELCOME_APPROVE, onApproval);
    return () => {
      root?.removeEventListener(PLAN_WELCOME_APPROVE, onApproval);
      setJourney(null);
    };
  }, []);

  if (!active) return null;
  return (
    <div data-welcome-rhythm-kit data-club-chrome className="wkc-wrap print:hidden">
      <WelcomeKitBar current="print" flow={flow} />
      {error && <p role="alert" className="mx-auto max-w-3xl px-4 py-2 text-[0.9rem] text-[#9a3b3b]">{error}</p>}
    </div>
  );
}

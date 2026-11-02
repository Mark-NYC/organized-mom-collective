/**
 * The Welcome Kit's step bar, the same on all three piece pages (/club/family-vision, /club/family-meeting-guide and
 * her first month's tool in Welcome Kit mode): "Welcome Kit", the three pieces numbered in order with their state
 * (done, here, still to do; each one a link), and "Back to my kit". On phones: "2 of 3 · Meeting Guide" with three
 * dots. It renders nothing unless her kit is open and not yet submitted, so after that the pages are just themselves.
 *
 * `useKitFlow` loads what the bar and the page's own "Next" button need (src/lib/club/onboarding.ts → kitNext).
 */
import { useEffect, useState } from 'react';
import { clubAccountsEnabled } from '../../data/club/config';
import { getSession } from '../../lib/account';
import { loadMembership, type Membership } from '../../lib/club/membership';
import { firstMonth, firstResourceReviewed, KIT_ORDER, kitStepDone, kitStepHref, kitStepName, kitSubmitted, loadMeetingGuideSeen, type KitFlags, type KitStepId } from '../../lib/club/onboarding';
import { routes } from '../../routes';

export interface KitFlow { me: Membership; uid: string | null; flags: KitFlags; open: boolean }

/** Her kit as the step pages need it; `open`: the kit still waits on her (pending or on hold, not submitted). */
export function useKitFlow(): KitFlow | null {
  const [flow, setFlow] = useState<KitFlow | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!clubAccountsEnabled() || q.has('thumb') || q.get('sample') || q.get('fulfillment')) return;
    let alive = true;
    const load = async () => {
      const s = await getSession();
      if (!s) return;
      const [me, guideSeen] = await Promise.all([loadMembership(), loadMeetingGuideSeen(s.user_id)]);
      if (!me.member && !me.grant) return;
      const open = Boolean(me.welcome && !me.welcome.satisfies_month && ['pending', 'on_hold'].includes(me.welcome.status) && !kitSubmitted(me));
      if (alive) setFlow({ me, uid: s.user_id, open, flags: { guideSeen, reviewed: firstResourceReviewed(firstMonth(me)?.slug, s.user_id) } });
    };
    load().catch(() => undefined);
    // A piece page changes its own state (approving the print, opening the guide): it asks the bar to look again.
    window.addEventListener('omc:kit-flow', load);
    return () => { alive = false; window.removeEventListener('omc:kit-flow', load); };
  }, []);
  return flow;
}
export const refreshKitFlow = () => window.dispatchEvent(new Event('omc:kit-flow'));

export default function WelcomeKitBar({ current, flow }: { current: KitStepId; flow: KitFlow | null }) {
  if (!flow?.open) return null;
  const { me, flags } = flow;
  const at = KIT_ORDER.indexOf(current);
  return (
    <nav className="wkbar" aria-label="Your Welcome Kit" data-kit-bar data-club-chrome>
      <div className="wkbar-inner">
        <a className="wkbar-home" href={routes.clubWelcomeKit}>Welcome Kit</a>
        <ol className="wkbar-steps">
          {KIT_ORDER.map((id, i) => {
            const done = kitStepDone(me, id, flags);
            const state = id === current ? 'current' : done ? 'done' : 'todo';
            return (
              <li key={id} data-state={state} data-step={id}>
                <a href={kitStepHref(me, id)} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="wkbar-num" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
                  <span className="wkbar-name">{kitStepName(me, id)}</span>
                  {state === 'done' && <span className="sr-only"> (done)</span>}
                </a>
              </li>
            );
          })}
        </ol>
        <p className="wkbar-phone" aria-hidden="true">
          {at + 1} of 3 · {kitStepName(me, current)}
          <span className="wkbar-dots">{KIT_ORDER.map((id) => <i key={id} data-state={id === current ? 'current' : kitStepDone(me, id, flags) ? 'done' : 'todo'} />)}</span>
        </p>
        <a className="wkbar-back" href={routes.clubWelcomeKit}>Back to my kit</a>
      </div>
    </nav>
  );
}

/**
 * /club/login: the Club's sign-in (ClubGate), then a safe ?next= inside /club, or the step that's hers next (her family,
 * her Welcome Kit; src/lib/club/onboarding.ts), else her Club (/app/club). Club emails link here.
 */
import { useEffect } from 'react';
import ClubGate, { type ClubContext } from './ClubGate';
import { routes } from '../../routes';
import { clubNav } from '../../lib/club/nav';
import { loadMembership } from '../../lib/club/membership';
import { stepHref } from '../../lib/club/onboarding';

export default function ClubLogin() {
  return <ClubGate page="login">{(ctx) => <Go ctx={ctx} />}</ClubGate>;
}

function Go({ ctx }: { ctx: ClubContext }) {
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('next');
    if (next && /^\/club\/[a-z0-9/_-]*$/i.test(next)) return clubNav().go(next, { replace: true });
    if (ctx.store.kind === 'sample') return clubNav().go(ctx.href(routes.clubDashboard), { replace: true });
    loadMembership().then((me) => stepHref(me), () => routes.clubDashboard).then((to) => clubNav().go(to === routes.appClub ? to : ctx.href(to), { replace: true }));
  }, []);
  return <p className="text-warm-soft">Signing you in…</p>;
}

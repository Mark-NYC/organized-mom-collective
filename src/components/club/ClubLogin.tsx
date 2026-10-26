/** /club/login: the Club's sign-in (ClubGate), then straight to her dashboard (or a safe ?next= inside /club). */
import { useEffect } from 'react';
import ClubGate, { type ClubContext } from './ClubGate';
import { routes } from '../../routes';
import { clubNav } from '../../lib/club/nav';

export default function ClubLogin() {
  return <ClubGate page="login">{(ctx) => <Go ctx={ctx} />}</ClubGate>;
}

function Go({ ctx }: { ctx: ClubContext }) {
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('next');
    clubNav().go(next && /^\/club\/[a-z0-9/_-]*$/i.test(next) ? next : ctx.href(routes.clubDashboard), { replace: true });
  }, []);
  return <p className="text-warm-soft">Signing you in…</p>;
}

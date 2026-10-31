/**
 * /club/login: the Club's sign-in (ClubGate), then a safe ?next= inside /club, or the step that's hers next (her family,
 * her Welcome Kit; src/lib/club/onboarding.ts), else her Club (/app/club). Club emails link here.
 */
import { useEffect } from 'react';
import ClubGate, { type ClubContext } from './ClubGate';
import { routes } from '../../routes';
import { clubNav } from '../../lib/club/nav';
import { loadMembership } from '../../lib/club/membership';
import { loadMeetingGuideSeen, nextStep, profileDeferred, stepHref } from '../../lib/club/onboarding';
import { getSession } from '../../lib/account';

export default function ClubLogin() {
  return <ClubGate page="login">{(ctx) => <Go ctx={ctx} />}</ClubGate>;
}

function Go({ ctx }: { ctx: ClubContext }) {
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('next');
    if (next && /^\/club\/[a-z0-9/_-]*$/i.test(next)) return clubNav().go(next, { replace: true });
    if (ctx.store.kind === 'sample') return clubNav().go(ctx.href(routes.clubDashboard), { replace: true });
    // Her family profile counts too: an unfinished one (not put off with "Finish later") resumes on /club/welcome.
    Promise.all([loadMembership(), ctx.store.household(), ctx.store.profile().catch(() => null), getSession()])
      .then(async ([me, h, profile, s]) => stepHref(me, nextStep(me, {
        profile: h ? profile : null, profileDeferred: profileDeferred(s?.user_id), meetingGuideSeen: await loadMeetingGuideSeen(s?.user_id),
      })), () => routes.clubDashboard)
      .then((to) => clubNav().go(to.startsWith(routes.appClub) ? to : ctx.href(to), { replace: true }));
  }, []);
  return <p className="text-warm-soft">Signing you in…</p>;
}

/**
 * /club/invite?code=…: the partner's side of an invitation (docs/ios/HOUSEHOLD_ARCHITECTURE.md). Sign in with the
 * emailed 6-digit code (ClubGate, the same sign-in as the Club), using the email the invitation was sent to; then
 * join the household as the grown-up the inviter picked. No payment, no membership: the family calendar and Sunday
 * Setup are free.
 */
import { useEffect, useState } from 'react';
import ClubGate from '../club/ClubGate';
import { acceptInvite, clearInviteCode, householdErrorText, pendingInviteCode, rememberInviteCode } from '../../lib/household/api';
import { routes } from '../../routes';

function readCode(): string | null {
  const q = new URLSearchParams(location.search).get('code');
  if (q && /^[0-9a-f]{32}$/i.test(q.trim())) {
    rememberInviteCode(q.trim());
    return q.trim();
  }
  return pendingInviteCode();
}

export default function JoinHousehold() {
  const [code] = useState(readCode);
  if (!code) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-8">
        <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">Open your invitation link</h1>
        <p className="mt-3 text-warm-soft">This page needs the link from your invitation. Open it from the message you were sent.</p>
      </main>
    );
  }
  return (
    <ClubGate page="login" signInIntro={<p className="mb-6 text-warm-soft">You’ve been invited to share a family’s calendar and plans. Sign in with <strong>the email the invitation was sent to</strong>. We’ll send a 6-digit code; there’s no password.</p>}>
      {() => <Accept code={code} />}
    </ClubGate>
  );
}

function Accept({ code }: { code: string }) {
  const [state, setState] = useState<'joining' | 'joined' | { error: string }>('joining');
  useEffect(() => {
    acceptInvite(code)
      .then(() => { clearInviteCode(); setState('joined'); })
      .catch((e: Error) => setState({ error: e.message }));
  }, [code]);

  if (state === 'joining') return <p className="text-warm-soft" data-invite-state="joining">Joining your family…</p>;
  if (state === 'joined') {
    return (
      <section data-invite-state="joined" className="max-w-xl">
        <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">You’re in.</h1>
        <p className="mt-3 text-warm-soft">You now share this family’s calendar, weekly plan and who-does-what. Anything either of you changes shows up for both of you.</p>
        <a href={routes.today} className="mt-7 inline-flex min-h-12 items-center rounded-[3px] bg-[#4a3f3e] px-6 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-white">Go to Today</a>
      </section>
    );
  }
  return (
    <section data-invite-state="error" role="alert" className="max-w-xl">
      <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">We couldn’t add you yet</h1>
      <p className="mt-3 text-warm-ink">{householdErrorText(state.error)}</p>
    </section>
  );
}

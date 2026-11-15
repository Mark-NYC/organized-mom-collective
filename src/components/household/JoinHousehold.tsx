/**
 * /club/invite?code=…: the partner's side of an invitation (docs/ios/HOUSEHOLD_ARCHITECTURE.md). Sign in with the
 * emailed 6-digit code (ClubGate, the same sign-in as the Club), using the email the invitation was sent to; then
 * join the household as the grown-up the inviter picked. No payment, no membership: the family calendar and Sunday
 * Setup are free.
 */
import { useEffect, useState } from 'react';
import ClubGate from '../club/ClubGate';
import {
  acceptInvite, acceptInviteLeaving, clearInviteCode, householdErrorText, inviteCodeFrom, pendingInviteCode, previewInvite,
  rememberInviteCode, type InvitePreview,
} from '../../lib/household/api';
import { routes } from '../../routes';

function readCode(): string | null {
  const q = inviteCodeFrom(new URLSearchParams(location.search).get('code') ?? '');
  if (q) {
    rememberInviteCode(q);
    return q;
  }
  return pendingInviteCode();
}

export default function JoinHousehold() {
  const [code, setCode] = useState(readCode);
  if (!code) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-8">
        <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">Join your family</h1>
        <p className="mt-3 text-warm-soft">Paste the invitation you were sent: the link, or the whole message.</p>
        <PasteInvite onCode={(c) => { rememberInviteCode(c); setCode(c); }} />
      </main>
    );
  }
  return (
    <ClubGate page="login" signInIntro={<p className="mb-6 text-warm-soft">You’ve been invited to share a family’s calendar and plans. Sign in with <strong>the email the invitation was sent to</strong>. We’ll send a 6-digit code; there’s no password.</p>}>
      {() => <Accept code={code} />}
    </ClubGate>
  );
}

/** Paste box for the invitation (the link opens the website; inside the app she pastes it). */
export function PasteInvite({ onCode, label = 'Join' }: { onCode: (code: string) => void; label?: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  return (
    <form className="mt-5" data-invite-paste onSubmit={(e) => {
      e.preventDefault();
      const c = inviteCodeFrom(text);
      if (c) onCode(c); else setError('We couldn’t find an invitation in that. Paste the link exactly as it was sent.');
    }}>
      <label className="block">
        <span className="label">YOUR INVITATION</span>
        <input className="mt-2 block min-h-12 w-full border border-warm-rule bg-white px-3" value={text} onChange={(e) => { setText(e.target.value); setError(''); }} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Paste the link here" />
      </label>
      <button type="submit" className="mt-4 inline-flex min-h-12 items-center rounded-[3px] bg-[#4a3f3e] px-6 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-50" disabled={!text.trim()}>{label}</button>
      {error && <p role="alert" className="mt-3 text-sm text-warm-ink">{error}</p>}
    </form>
  );
}

type AcceptState = 'joining' | 'joined' | { confirm: InvitePreview } | { error: string };

function Accept({ code }: { code: string }) {
  const [state, setState] = useState<AcceptState>('joining');
  const done = () => { clearInviteCode(); setState('joined'); };
  const fail = (e: Error) => setState({ error: e.message });
  useEffect(() => {
    // Look first: an account that already has a family is asked before anything is replaced.
    previewInvite(code)
      .then((p) => {
        if (p?.status === 'joined') return done();
        if (p?.status === 'leave_own') return setState({ confirm: p });
        if (p?.status === 'blocked') return setState({ error: p.reason ?? 'already_in_household' });
        return acceptInvite(code).then(done);
      })
      .catch(fail);
  }, [code]);

  if (typeof state === 'object' && 'confirm' in state) {
    const p = state.confirm;
    const theirs = p.family ?? 'the family you were invited to';
    const mine = p.mine!;
    const has = [mine.people.length ? mine.people.join(', ') : null, mine.events ? `${mine.events} calendar ${mine.events === 1 ? 'plan' : 'plans'}` : null, mine.agreements ? `${mine.agreements} ${mine.agreements === 1 ? 'agreement' : 'agreements'}` : null].filter(Boolean).join(' · ');
    return (
      <section data-invite-state="confirm" className="max-w-xl">
        <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">Join {theirs}?</h1>
        {mine.role === 'owner' ? (
          <p className="mt-3 text-warm-ink" data-invite-leaving="own">
            You already set up a family on this account{has ? ` (${has})` : ''}. A sign-in belongs to one family, so joining replaces the one you set up with {theirs}. <strong>What you set up here is deleted.</strong>
          </p>
        ) : (
          <p className="mt-3 text-warm-ink" data-invite-leaving="shared">
            You’re sharing {mine.family ?? 'another family'} now. A sign-in belongs to one family, so joining means leaving that one. Nothing they’ve planned is deleted.
          </p>
        )}
        <button type="button" className="mt-6 inline-flex min-h-12 items-center rounded-[3px] bg-[#4a3f3e] px-6 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-50" data-invite-confirm onClick={() => { setState('joining'); acceptInviteLeaving(code).then(done).catch(fail); }}>Join {theirs}</button>
        <a href={routes.today} className="mt-3 block inline-flex min-h-11 items-center text-sm underline underline-offset-4 text-warm-ink" data-invite-keep>Keep what I have</a>
      </section>
    );
  }
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
      <p className="mt-3 text-warm-ink">{householdErrorText((state as { error: string }).error)}</p>
    </section>
  );
}

/**
 * /club/invite?code=…: the partner's side of an invitation (docs/ios/HOUSEHOLD_ARCHITECTURE.md). Sign in with the
 * emailed 6-digit code, using the email the invitation was sent to; then join the household as the grown-up the
 * inviter picked. Free, and independent of the Club: no Club gate, no Club branding, no payment or membership.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getSession, requestCode, verifyCode } from '../../lib/account';
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
      <section className="max-w-xl">
        <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">Join your family</h1>
        <p className="mt-3 text-warm-soft">Paste the invitation you were sent: the link, or the whole message.</p>
        <PasteInvite onCode={(c) => { rememberInviteCode(c); setCode(c); }} />
      </section>
    );
  }
  return <SignedIn>{() => <Accept code={code} />}</SignedIn>;
}

/**
 * The invitation's own sign-in: the emailed 6-digit code, nothing else. Not the Club's gate: a household invitation
 * is free and works whether or not Club enrollment is open.
 */
function SignedIn({ children }: { children: () => ReactNode }) {
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { void getSession().then((s) => setState(s ? 'in' : 'out')).catch(() => setState('out')); }, []);
  if (state === 'loading') return <p className="text-warm-soft">Loading…</p>;
  if (state === 'in') return <>{children()}</>;
  const trouble = (r: string) => (r === 'rate_limited' ? 'Too many tries. Wait a minute and try again.' : r === 'invalid' ? 'Check the email address and try again.' : r === 'wrong_code' ? 'That code didn’t work. Check it, or send a new one.' : 'We couldn’t reach the sign-in. Check your connection and try again.');
  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true); setMsg('');
    const r = await requestCode(email);
    setBusy(false);
    if (r === 'sent') setSent(true); else setMsg(trouble(r));
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    const r = await verifyCode(email, code);
    setBusy(false);
    if (r.ok) setState('in'); else setMsg(trouble(r.error));
  };
  return (
    <section className="max-w-md" data-invite-signin>
      <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">You’re invited to share your family’s week</h1>
      <p className="mt-3 text-warm-soft">One calendar, one plan, both grown-ups. It’s free. Sign in with <strong>the email the invitation was sent to</strong>: we’ll email a 6-digit code, there’s no password.</p>
      {!sent ? (
        <form onSubmit={send} className="mt-6" noValidate>
          <label htmlFor="join-email" className="label text-warm-soft">Email</label>
          <input id="join-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem]" />
          <button type="submit" disabled={busy} className={`mt-5 ${BTN}`}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6">
          <p className="text-sm text-warm-soft">We sent a 6-digit code to <strong>{email}</strong>.</p>
          <label htmlFor="join-code" className="label mt-4 block text-warm-soft">Code</label>
          <input id="join-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} autoFocus className="mt-2 block min-h-12 w-full max-w-[12rem] rounded-[4px] border border-warm-rule bg-white px-3 text-[1.3rem] tracking-[0.3em]" />
          <button type="submit" disabled={busy || code.replace(/\D/g, '').length < 6} className={`mt-5 ${BTN}`}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="mt-4 block text-sm underline underline-offset-4" onClick={() => send()}>Send a new code</button>
        </form>
      )}
      {msg && <p role="alert" className="mt-4 text-sm text-warm-ink">{msg}</p>}
    </section>
  );
}

const BTN = 'inline-flex min-h-12 items-center rounded-[3px] bg-[#4a3f3e] px-6 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-50';

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
      <button type="submit" className={`mt-4 ${BTN}`} disabled={!text.trim()}>{label}</button>
      {error && <p role="alert" className="mt-3 text-sm text-warm-ink">{error}</p>}
    </form>
  );
}

type AcceptState = 'joining' | 'joined' | { confirm: InvitePreview } | { error: string };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Accept({ code }: { code: string }) {
  const [state, setState] = useState<AcceptState>('joining');
  const [keep, setKeep] = useState(true);
  const [brought, setBrought] = useState(0);
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
    const own = mine.role === 'owner';
    return (
      <section data-invite-state="confirm" className="max-w-xl">
        <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">Join {theirs}?</h1>
        {own ? (
          <div data-invite-leaving="own">
            <p className="mt-3 text-warm-ink">You already set up a family on this sign-in. A sign-in belongs to one family, so joining {theirs} replaces the one you set up:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-warm-ink" data-invite-mine>
              {mine.people.length > 0 && <li>{mine.people.join(', ')}</li>}
              {mine.events > 0 && <li>{plural(mine.events, 'calendar plan', 'calendar plans')}</li>}
              {mine.agreements > 0 && <li>{plural(mine.agreements, 'Family Meeting agreement', 'Family Meeting agreements')}</li>}
            </ul>
            {mine.events > 0 && (
              <label className="mt-4 flex min-h-11 items-start gap-3 text-warm-ink">
                <input type="checkbox" className="mt-1 size-5" checked={keep} onChange={(e) => setKeep(e.target.checked)} data-invite-keep-events />
                <span>Bring my {plural(mine.events, 'calendar plan', 'calendar plans')} to {theirs}’s calendar <span className="text-warm-soft">(you’ll pick who each one is for again)</span></span>
              </label>
            )}
            <p className="mt-4 text-sm text-warm-soft">The people{mine.agreements > 0 ? ' and agreements' : ''} you set up here are removed: {theirs} already has its own. We keep a copy of everything you set up for 90 days, so contact us if you need any of it back.</p>
          </div>
        ) : (
          <p className="mt-3 text-warm-ink" data-invite-leaving="shared">
            You’re sharing {mine.family ?? 'another family'} now. A sign-in belongs to one family, so joining means leaving that one. Nothing they’ve planned is deleted.
          </p>
        )}
        <button type="button" className={`mt-6 ${BTN}`} data-invite-confirm onClick={() => {
          setState('joining');
          acceptInviteLeaving(code, mine.id, keep).then((r) => { setBrought(r?.brought_events ?? 0); done(); }).catch(fail);
        }}>{own ? `Replace mine and join ${theirs}` : `Join ${theirs}`}</button>
        <a href={routes.today} className="mt-3 flex min-h-11 items-center text-sm text-warm-ink underline underline-offset-4" data-invite-keep>Keep what I have</a>
      </section>
    );
  }
  if (state === 'joining') return <p className="text-warm-soft" data-invite-state="joining">Joining your family…</p>;
  if (state === 'joined') {
    return (
      <section data-invite-state="joined" className="max-w-xl">
        <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">You’re in.</h1>
        <p className="mt-3 text-warm-soft">You now share this family’s calendar, weekly plan and who-does-what. Anything either of you changes shows up for both of you.{brought > 0 ? ` Your ${plural(brought, 'calendar plan is', 'calendar plans are')} on the shared calendar now.` : ''}</p>
        <a href={routes.today} className={`mt-7 ${BTN}`}>Go to Today</a>
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

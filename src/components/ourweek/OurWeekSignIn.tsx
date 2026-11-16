/**
 * /app/sign-in: Our Week's own sign-in (the free family planning app). The same passwordless 6-digit email code as the
 * Club (src/lib/account.ts), but it never routes into Family Meeting Club setup: afterwards she goes back to Our Week,
 * to the page that sent her (?next=, Our Week pages and the partner invitation only), else Today, or to setting up
 * her family when there isn't one yet. Nothing here asks for payment, a membership or a calendar purchase.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { getSession, requestCode, verifyCode } from '../../lib/account';
import { accountStore } from '../../lib/club/store';

/** Where to go after signing in: only Our Week's own pages or the invitation page. */
export function afterSignIn(next: string | null, hasFamily: boolean): string {
  if (next && /^\/(app(\/[a-z0-9/_-]*)?|club\/invite)(\?[a-z0-9=&_-]*)?$/i.test(next)) return next;
  return hasFamily ? '/app' : '/app/family/setup';
}

export default function OurWeekSignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const next = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('next');

  const go = async () => {
    const h = await accountStore.household().catch(() => null);
    location.assign(afterSignIn(next, Boolean(h)));
  };
  useEffect(() => { void getSession().then((s) => { if (s) void go(); }); }, []); // already signed in

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true); setMsg('');
    const r = await requestCode(email);
    setBusy(false);
    if (r === 'sent') { setSent(true); return; }
    setMsg(r === 'invalid' ? 'Check the email address and try again.' : r === 'rate_limited' ? 'Too many tries. Wait a minute and try again.' : 'We couldn’t send a code. Check your connection and try again.');
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    const r = await verifyCode(email, code);
    if (r.ok) { await go(); return; }
    setBusy(false);
    setMsg(r.error === 'wrong_code' ? 'That code didn’t work. Check it, or send a new one.' : r.error === 'rate_limited' ? 'Too many tries. Wait a minute and try again.' : 'We couldn’t sign you in. Check your connection and try again.');
  };

  return (
    <div className="family-brand mx-auto max-w-md" data-ourweek-signin>
      <p className="label text-[#71866c]">ORGANIZED FAMILY</p>
      <h1 className="family-title mt-4 !text-[2.1rem]">Sign in to share your week.</h1>
      <p className="family-lede mt-3">Keep your family’s calendar, cleaning and meeting on every phone, shared with the other grown-up in your home. Free.</p>
      {!sent ? (
        <form onSubmit={send} className="mt-6" noValidate>
          <label htmlFor="ow-email" className="label text-warm-soft">Email</label>
          <input id="ow-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem]" />
          <button type="submit" disabled={busy} className="family-action mt-5 w-full sm:w-auto">{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6">
          <p className="text-sm text-warm-soft">We sent a 6-digit code to <strong>{email}</strong>. There’s no password.</p>
          <label htmlFor="ow-code" className="label mt-4 block text-warm-soft">Code</label>
          <input id="ow-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} autoFocus className="mt-2 block min-h-12 w-full max-w-[12rem] rounded-[4px] border border-warm-rule bg-white px-3 text-[1.3rem] tracking-[0.3em]" />
          <button type="submit" disabled={busy || code.replace(/\D/g, '').length < 6} className="family-action mt-5 w-full sm:w-auto">{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="family-link mt-4 block" onClick={() => send()}>Send a new code</button>
        </form>
      )}
      {msg && <p role="alert" className="mt-4 text-sm text-warm-ink">{msg}</p>}
    </div>
  );
}

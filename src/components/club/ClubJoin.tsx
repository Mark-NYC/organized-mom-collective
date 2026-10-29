/**
 * /club/join: the monthly membership ($5.90; annual isn't offered yet): give an email (or use her signed-in one), go to Stripe's secure Checkout.
 * Her account is made after payment and opens only once she signs in with that email's code. The server decides
 * whether checkout is open (club_settings.checkout_mode) and refuses a second membership.
 */
import { useEffect, useState } from 'react';
import { getSession, type AccountSession } from '../../lib/account';
import { billingErrorText, PLANS, startCheckout, type OfferedPlan } from '../../lib/club/membership';
import { routes } from '../../routes';
import { CLUB_NAME } from '../../data/club/config';

export default function ClubJoin() {
  const [session, setSession] = useState<AccountSession | null | undefined>(undefined);
  const [plan, setPlan] = useState<OfferedPlan>('monthly');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canceled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('canceled');

  useEffect(() => {
    getSession().then(setSession, () => setSession(null));
  }, []);

  const go = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');
    if (!session && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter the email you’d like to use for your account.');
    setBusy(true);
    try {
      const { url } = await startCheckout(plan, session ? undefined : email.trim());
      location.assign(url);
    } catch (err) {
      setBusy(false);
      setError(billingErrorText((err as Error).message));
    }
  };

  return (
    <div className="max-w-3xl">
      <p className="label text-warm-soft">{CLUB_NAME}</p>
      <h1 className="mt-2 font-serif text-[2.2rem] leading-[1.1] text-warm-ink sm:text-[2.7rem]">One family. One monthly problem. One tailored plan.</h1>
      <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-warm-soft">Delivered ready to use: prepared with your family’s names, in your account and in your mailbox.</p>
      {canceled && <p role="status" className="mt-6 border-l-[3px] border-sage bg-sage-wash px-4 py-3">No problem. Nothing was charged. Pick a plan whenever you’re ready.</p>}

      <form onSubmit={go} className="mt-8" noValidate>
        <fieldset className={`grid gap-4 ${Object.keys(PLANS).length > 1 ? 'sm:grid-cols-2' : 'max-w-md'}`}>
          <legend className="sr-only">Your membership</legend>
          {(Object.keys(PLANS) as OfferedPlan[]).map((p) => (
            <label key={p} className={`block cursor-pointer bg-white p-6 ring-1 ${plan === p ? 'ring-2 ring-warm-ink' : 'ring-warm-rule'}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} className="h-5 w-5" />
                <span className="label text-warm-soft">{p === 'monthly' ? 'Monthly' : 'Annual'}</span>
              </span>
              <span className="mt-3 block font-serif text-[2.4rem] leading-none text-warm-ink">{PLANS[p].price} <span className="font-sans text-[0.95rem] text-warm-soft">{PLANS[p].per}</span></span>
              <span className="mt-3 block text-[0.95rem] leading-relaxed text-warm-ink">{PLANS[p].summary}</span>
              <ul className="mt-3 space-y-1 text-[0.9rem] text-warm-soft">{PLANS[p].points.map((t) => <li key={t}>· {t}</li>)}</ul>
            </label>
          ))}
        </fieldset>

        {session === undefined ? null : session ? (
          <p className="mt-6 text-[0.95rem] text-warm-soft">Signed in as <strong className="text-warm-ink">{session.email}</strong>.</p>
        ) : (
          <label className="mt-6 block max-w-md">
            <span className="label text-warm-soft">Your email</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem]" />
            <span className="mt-1.5 block text-[0.85rem] text-warm-soft">You’ll sign in with this email. No password.</span>
          </label>
        )}
        {error && (
          <p role="alert" className="mt-5 max-w-xl border-l-[3px] border-rose bg-rose-wash px-4 py-3">
            {error} {error.includes('Log in') && <a className="font-semibold underline underline-offset-4" href={`${routes.clubLogin}${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}>Log in</a>}
          </p>
        )}
        <button type="submit" disabled={busy || session === undefined} className="btn-primary mt-7 w-full sm:w-auto">{busy ? 'Opening secure checkout…' : 'Continue to secure checkout'}</button>
        <p className="mt-3 max-w-xl text-[0.85rem] leading-relaxed text-warm-soft">Payment is handled by Stripe. You’ll enter your mailing address there. Cancel any time from your account; resources you’ve received stay yours.</p>
      </form>
      <p className="mt-10 text-[0.95rem]">Already a member? <a className="font-semibold underline underline-offset-4" href={routes.clubLogin}>Log in</a></p>
    </div>
  );
}

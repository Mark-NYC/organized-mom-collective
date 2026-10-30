/**
 * /club/join: Your First Month FREE, then $5.90/month (annual isn't offered): give an email (or use her signed-in one), go to Stripe's secure Checkout.
 * Her account is made after payment and opens only once she signs in with that email's code. The server decides
 * whether checkout is open (club_settings.checkout_mode) and refuses a second membership.
 */
import { useEffect, useState } from 'react';
import { getSession, type AccountSession } from '../../lib/account';
import { billingErrorText, introPlan, startCheckout } from '../../lib/club/membership';
import { routes } from '../../routes';
import { CLUB_NAME } from '../../data/club/config';

export default function ClubJoin() {
  const [session, setSession] = useState<AccountSession | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canceled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('canceled');
  // Your First Month FREE: what she pays today (nothing) and the exact first charge date (club-billing decides).
  const offer = introPlan();

  useEffect(() => {
    getSession().then(setSession, () => setSession(null));
  }, []);

  const go = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');
    if (!session && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter the email you’d like to use for your account.');
    setBusy(true);
    try {
      const { url } = await startCheckout('monthly', session ? undefined : email.trim());
      location.assign(url);
    } catch (err) {
      setBusy(false);
      setError(billingErrorText((err as Error).message));
    }
  };

  return (
    <div className="max-w-xl lg:max-w-none lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
      <div>
      <p className="label text-warm-soft">{CLUB_NAME}</p>
      <h1 className="mt-2 text-balance font-serif text-[2.1rem] leading-[1.1] text-warm-ink sm:text-[2.7rem]">One family. One monthly problem. One tailored plan.</h1>
      <p className="mt-3 text-[1rem] leading-[1.6] text-warm-soft sm:text-[1.08rem]">Personalized, ready-to-use family tools that help your kids build habits, take responsibility, and share the load. Printed and mailed to your door every month.</p>
      {canceled && <p role="status" className="mt-5 border-l-[3px] border-sage bg-sage-wash px-4 py-3">No problem. Nothing was charged. Start whenever you’re ready.</p>}

      </div>
      <div>
      <form onSubmit={go} className="mt-5 sm:mt-8 lg:mt-0" noValidate>
        <section aria-labelledby="club-offer" className="join-offer">
          <p id="club-offer" className="label text-[#55684b]">{offer.label}</p>
          <p className="mt-1.5 font-serif text-[2.6rem] leading-none text-warm-ink">{offer.price} <span className="font-sans text-[1rem] text-warm-soft">{offer.per}</span></p>
          <p className="mt-3.5 text-[0.98rem] font-semibold text-warm-ink">Get your family started with:</p>
          <ul className="mt-2.5 space-y-2.5">
            {offer.benefits.map((b) => (
              <li key={b.lead} className="join-check text-[0.95rem] leading-[1.45] text-warm-soft">
                <span><strong className="font-semibold text-warm-ink">{b.lead}</strong> {b.detail}</span>
              </li>
            ))}
          </ul>
          <div className="join-billing">
            <p className="text-[0.95rem] text-warm-ink">Free today. <strong className="font-semibold">$5.90/month</strong> starting {offer.firstCharge}.</p>
            <p className="mt-1 text-[0.9rem] text-warm-soft">Cancel anytime. No charge if you cancel before {offer.cancelBy}.</p>
          </div>
        </section>

        {session === undefined ? null : session ? (
          <p className="mt-5 text-[0.95rem] text-warm-soft">Signed in as <strong className="text-warm-ink">{session.email}</strong>.</p>
        ) : (
          <label className="mt-5 block">
            <span className="label text-warm-soft">Your email</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem]" />
            <span className="mt-1.5 block text-[0.88rem] text-warm-soft">You’ll sign in with this email. No password.</span>
          </label>
        )}
        {error && (
          <p role="alert" className="mt-4 border-l-[3px] border-rose bg-rose-wash px-4 py-3">
            {error} {error.includes('Log in') && <a className="font-semibold underline underline-offset-4" href={`${routes.clubLogin}${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}>Log in</a>}
          </p>
        )}
        <button type="submit" disabled={busy || session === undefined} className="btn-primary mt-5 w-full">{busy ? 'Opening secure checkout…' : 'Continue to secure checkout'}</button>
        <p className="mt-3 text-center text-[0.9rem] leading-relaxed text-warm-soft">Secure checkout with Stripe. Nothing charged today. Cancel anytime.<br />You’ll add your mailing address at checkout.</p>
      </form>
      <p className="mt-8 text-[0.95rem]">Already a member? <a className="font-semibold underline underline-offset-4" href={routes.clubLogin}>Log in</a></p>
      </div>
    </div>
  );
}

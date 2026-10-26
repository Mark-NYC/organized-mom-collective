/**
 * /club/welcome: where Stripe sends her after paying, and where the welcome email's sign-in leads.
 * 1. Payment confirmed (the Checkout session, read on the server). 2. Sign in with that email's 6-digit code
 * (this proves the inbox; nothing opens before it). 3. Wait for the webhook to finish her membership (seconds).
 * 4. Family: first names and kids' ages, nothing more. 5. Mailing address, if Checkout didn't give one. Then her
 * dashboard. Each step is skipped when it's already done, so coming back later just picks up where she left off.
 */
import { useEffect, useState } from 'react';
import type { Household } from '../../lib/club/profile';
import { checkoutStatus, loadAddress, loadMembership, saveAddress, type Address } from '../../lib/club/membership';
import { routes } from '../../routes';
import ClubGate, { type ClubContext } from './ClubGate';
import FamilyForm from './FamilyForm';
import AddressForm from './AddressForm';
import { clubNav } from '../../lib/club/nav';

const SESSION = /^cs_(test|live)_[A-Za-z0-9]+$/;

export default function ClubWelcome() {
  const [paid, setPaid] = useState<'checking' | 'paid' | 'pending' | 'none'>(() => {
    const id = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('session_id');
    return id && SESSION.test(id) ? 'checking' : 'none';
  });

  useEffect(() => {
    if (paid !== 'checking') return;
    const params = new URLSearchParams(location.search);
    const id = params.get('session_id')!;
    let tries = 0;
    const check = () =>
      checkoutStatus(id).then((r) => {
        if (r.email && !params.get('email')) {
          params.set('email', r.email);
          history.replaceState(null, '', `${location.pathname}?${params}`);
        }
        if (r.paid) setPaid('paid');
        else if (++tries < 10) setTimeout(check, 2000);
        else setPaid('pending');
      }, () => setPaid('none'));
    check();
  }, [paid]);

  if (paid === 'checking') return <p className="py-16 text-center text-warm-soft">Confirming your payment…</p>;
  const intro = (
    <>
      <p className="label text-warm-soft">{paid === 'paid' ? 'Payment received' : 'Welcome'}</p>
      <h1 className="mt-2 font-serif text-[2rem] leading-tight text-warm-ink">{paid === 'paid' ? 'Thank you. You’re in.' : 'Let’s set up your family'}</h1>
      <p className="mt-3 leading-relaxed text-warm-soft">
        {paid === 'pending'
          ? 'Your payment is still being confirmed. Sign in below; your membership appears as soon as it’s done.'
          : 'To keep your family’s details private, sign in with the email you used at checkout. We’ll send a 6-digit code; there’s no password.'}
      </p>
    </>
  );
  return <ClubGate page="welcome" signInIntro={intro}>{(ctx) => <Setup ctx={ctx} />}</ClubGate>;
}

type Step = { kind: 'waiting' } | { kind: 'not_member' } | { kind: 'family'; household: Household | null } | { kind: 'address'; address: Address | null } | { kind: 'done' };

function Setup({ ctx }: { ctx: ClubContext }) {
  const [step, setStep] = useState<Step>({ kind: 'waiting' });
  const [error, setError] = useState('');

  const next = async () => {
    if (ctx.store.kind === 'sample') {
      const h = await ctx.store.household();
      return setStep(h ? { kind: 'done' } : { kind: 'family', household: null });
    }
    const me = await loadMembership();
    if (!me.member && !me.grant) return setStep({ kind: 'not_member' });
    if (!me.onboarded) return setStep({ kind: 'family', household: await ctx.store.household() });
    if (!me.has_address) return setStep({ kind: 'address', address: await loadAddress() });
    setStep({ kind: 'done' });
  };

  useEffect(() => {
    let tries = 0;
    const attempt = () =>
      next().catch(() => setError('We couldn’t load your membership. Check your connection and reload the page.'));
    // The payment webhook usually lands within seconds of checkout; give it up to a minute.
    const wait = async () => {
      if (ctx.store.kind === 'account') {
        const me = await loadMembership().catch(() => null);
        if (me && !me.member && !me.grant && ++tries < 20) return void setTimeout(wait, 3000);
      }
      attempt();
    };
    wait();
  }, []);

  useEffect(() => {
    if (step.kind === 'done') clubNav().go(ctx.href(routes.clubDashboard), { replace: true });
  }, [step.kind]);

  if (error) return <p role="alert">{error}</p>;
  switch (step.kind) {
    case 'waiting':
    case 'done':
      return <p className="text-warm-soft">Getting your membership ready…</p>;
    case 'not_member':
      return (
        <div className="max-w-xl">
          <h1 className="font-serif text-[2rem] leading-tight">We don’t see a membership on this email yet</h1>
          <p className="mt-3 leading-relaxed text-warm-soft">If you just paid, give it a minute and reload this page. Used a different email at checkout? Sign out and sign in with that one.</p>
          <a className="btn-primary mt-6 inline-block" href={routes.clubJoin}>See the plans</a>
        </div>
      );
    case 'family':
      return (
        <>
          <p className="label text-warm-soft">Step 1 of 2</p>
          <FamilyForm household={step.household} mode="start" submitLabel="Save our family" onSave={async (input) => {
            await ctx.store.saveHousehold(input);
            await next();
          }} />
        </>
      );
    case 'address':
      return (
        <>
          <p className="label text-warm-soft">Step 2 of 2</p>
          <h1 className="mt-2 font-serif text-[2rem] leading-tight text-warm-ink">Where should we mail it?</h1>
          <p className="mt-3 mb-6 max-w-xl leading-relaxed text-warm-soft">Your printed mailing comes here each month.</p>
          <AddressForm address={step.address} submitLabel="Save and open my account" onSave={async (a) => {
            await saveAddress(a);
            setStep({ kind: 'done' });
          }} />
        </>
      );
  }
}

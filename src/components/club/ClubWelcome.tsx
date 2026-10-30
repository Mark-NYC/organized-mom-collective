/**
 * /club/welcome: where Stripe sends her after checkout, and where the welcome email's sign-in leads.
 * 1. Checkout confirmed (the Checkout session, read on the server). 2. Sign in with that email's 6-digit code
 * (this proves the inbox; nothing opens before it). 3. Wait for the webhook to finish her membership (seconds).
 * 4. Her family: first names, kids' ages and what she calls her family (prefilled from the name she gave Stripe, never
 * over a name she already chose). 4b. The rest of her family profile (FamilySetup: week, who does what, growth,
 * challenges, priority), each step skippable and saved as she goes; shown right after the family step, or to resume a
 * setup she started, never to someone who finished it or chose "Finish later" in this visit. 5. Mailing address, only if Checkout didn't give one. Then her Welcome Kit: her
 * welcome print (/club/family-vision), then her first resource. Each step comes from club_me (src/lib/club/onboarding.ts),
 * so coming back later, or refreshing, picks up exactly where she left off.
 */
import { useEffect, useRef, useState } from 'react';
import type { Household } from '../../lib/club/profile';
import { STEP_TITLES, TOTAL_STEPS, type FamilyProfile } from '../../lib/club/family-profile';
import FamilySetup from './FamilySetup';
import { checkoutStatus, loadAddress, loadMembership, saveAddress, type Address } from '../../lib/club/membership';
import { familyNameFrom, kitProgress, nextStep, stepHref } from '../../lib/club/onboarding';
import { routes } from '../../routes';
import ClubGate, { type ClubContext } from './ClubGate';
import FamilyForm from './FamilyForm';
import AddressForm from './AddressForm';
import KitSteps from './KitSteps';
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

  if (paid === 'checking') return <p className="py-16 text-center text-warm-soft">Confirming your membership…</p>;
  const intro = (
    <>
      <p className="label text-warm-soft">{paid === 'paid' ? 'Welcome to the Organized Family Club' : 'Welcome'}</p>
      <h1 className="mt-2 font-serif text-[2.2rem] leading-tight text-warm-ink">{paid === 'paid' ? 'You’re in.' : 'Let’s make your Welcome Kit'}</h1>
      <p className="mt-3 leading-relaxed text-warm-soft">
        {paid === 'pending'
          ? 'We’re still confirming your checkout. Sign in below; your membership appears as soon as it’s done.'
          : paid === 'paid'
            ? 'Let’s make your Welcome Kit. First, a quick code to keep your family’s details private: sign in with the email you used at checkout. There’s no password.'
            : 'Sign in with the email you used at checkout. We’ll send a 6-digit code; there’s no password.'}
      </p>
    </>
  );
  return <ClubGate page="welcome" signInIntro={intro}>{(ctx) => <Setup ctx={ctx} />}</ClubGate>;
}

type Step = { kind: 'waiting' } | { kind: 'not_member' } | { kind: 'family'; household: Household | null; suggested: string }
  | { kind: 'profile'; household: Household; profile: FamilyProfile } | { kind: 'address'; address: Address | null } | { kind: 'done'; to: string };

function Setup({ ctx }: { ctx: ClubContext }) {
  const [step, setStep] = useState<Step>({ kind: 'waiting' });
  const [error, setError] = useState('');
  // Set when she saves her family in this visit (show the profile steps next) or picks "Finish later" (don't).
  const justSavedFamily = useRef(false);
  const profileLater = useRef(false);

  /** The profile steps, if this is the moment for them; false otherwise. */
  const profileStep = async () => {
    if (profileLater.current) return false;
    const [household, profile] = await Promise.all([ctx.store.household(), ctx.store.profile().catch(() => null)]);
    if (!household || !profile || profile.setupCompleted) return false;
    if (!(justSavedFamily.current || profile.setupDone.length > 0)) return false;
    setStep({ kind: 'profile', household, profile });
    return true;
  };

  const next = async () => {
    if (ctx.store.kind === 'sample') {
      const h = await ctx.store.household();
      if (h && (await profileStep())) return;
      return setStep(h ? { kind: 'done', to: routes.clubDashboard } : { kind: 'family', household: null, suggested: '' });
    }
    const me = await loadMembership();
    const s = nextStep(me);
    if (s === 'not_member') return setStep({ kind: 'not_member' });
    if (s === 'family') {
      const [household, address] = await Promise.all([ctx.store.household(), loadAddress().catch(() => null)]);
      return setStep({ kind: 'family', household, suggested: familyNameFrom(address?.name) });
    }
    // Still in her Welcome Kit steps: the profile questions come before the address and the print.
    if (['address', 'print'].includes(s) && (await profileStep())) return;
    if (s === 'address') return setStep({ kind: 'address', address: await loadAddress() });
    setStep({ kind: 'done', to: stepHref(me, s) });
  };

  useEffect(() => {
    let tries = 0;
    const attempt = () =>
      next().catch(() => setError('We couldn’t load your membership. Check your connection and reload the page.'));
    // The checkout webhook usually lands within seconds; give it up to a minute.
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
    if (step.kind === 'done') clubNav().go(ctx.href(step.to), { replace: true });
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
          <p className="mt-3 leading-relaxed text-warm-soft">If you just joined, give it a minute and reload this page. Used a different email at checkout? Sign out and sign in with that one. Still stuck? Reply to your welcome email and we’ll sort it out.</p>
          <button type="button" className="btn-primary mt-6" onClick={() => clubNav().reload()}>Check again</button>
        </div>
      );
    case 'family':
      return (
        <>
          <KitSteps steps={kitProgress('family')} />
          <SetupProgress />
          <FamilyForm household={step.household} mode="start" suggestedName={step.suggested} submitLabel="Next" onSave={async (input) => {
            await ctx.store.saveHousehold(input);
            justSavedFamily.current = true;
            await next();
          }} />
        </>
      );
    case 'profile': {
      const leave = () => {
        profileLater.current = true;
        setStep({ kind: 'waiting' });
        next().catch(() => setError('We couldn’t load your membership. Check your connection and reload the page.'));
      };
      return (
        <>
          <KitSteps steps={kitProgress('family')} />
          <FamilySetup store={ctx.store} members={step.household.members} profile={step.profile} mode="wizard" onDone={leave} onExit={leave} />
        </>
      );
    }
    case 'address':
      return (
        <>
          <KitSteps steps={kitProgress('family')} />
          <h1 className="mt-2 font-serif text-[2rem] leading-tight text-warm-ink">Where should we mail your Welcome Kit?</h1>
          <p className="mt-3 mb-6 max-w-xl leading-relaxed text-warm-soft">Your Welcome Kit and your monthly printed resources come here.</p>
          <AddressForm address={step.address} submitLabel="See my welcome gift" onSave={async (a) => {
            await saveAddress(a);
            await next();
          }} />
        </>
      );
  }
}

/** Step 1 of 6 on the family form, matching FamilySetup's bar. */
function SetupProgress() {
  return (
    <div className="mb-6 max-w-2xl">
      <p className="text-[0.88rem] font-semibold text-warm-soft">Step 1 of {TOTAL_STEPS} · {STEP_TITLES.family}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-warm-rule" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={1} aria-label="Family setup progress">
        <div className="h-full rounded-full bg-sage" style={{ width: `${100 / TOTAL_STEPS}%` }} />
      </div>
    </div>
  );
}

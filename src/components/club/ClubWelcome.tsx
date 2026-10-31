/**
 * /club/welcome: where Stripe sends her after checkout, and where the welcome email's sign-in leads.
 * 1. Checkout confirmed (the Checkout session, read on the server). 2. Sign in with that email's 6-digit code
 * (this proves the inbox; nothing opens before it). 3. Wait for the webhook to finish her membership (seconds).
 * 4. Her family: first names, kids' ages and what she calls her family (prefilled from the name she gave Stripe, never
 * over a name she already chose). 4b. The rest of her family profile (FamilySetup: week, who does what, growth,
 * challenges, priority), each step skippable and saved as she goes; shown right after the family step, and to anyone
 * who hasn't finished it (it resumes at the first open step), unless she chose "Finish later" (then a summary of
 * what's left, and on to her kit). 5. Mailing address, only if Checkout didn't give one. Then her Welcome Kit: her
 * welcome print (/club/family-vision), then her first resource on its real tool (/app/club/<month>?welcome=1). A
 * member with no month yet (her free month wasn't available) is told it starts with her first payment. Each step comes from club_me (src/lib/club/onboarding.ts),
 * so coming back later, or refreshing, picks up exactly where she left off.
 */
import { useEffect, useRef, useState } from 'react';
import type { Household } from '../../lib/club/profile';
import { SETUP_STEPS, STEP_TITLES, TOTAL_STEPS, type FamilyProfile } from '../../lib/club/family-profile';
import FamilySetup from './FamilySetup';
import { checkoutStatus, loadAddress, loadMembership, monthName, saveAddress, shortDate, type Address, type Membership } from '../../lib/club/membership';
import { deferProfile, familyNameFrom, kitProgress, loadMeetingGuideSeen, nextStep, profileDeferred, startsWithFirstPayment, stepHref } from '../../lib/club/onboarding';
import { getSession } from '../../lib/account';
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
  | { kind: 'profile'; household: Household; profile: FamilyProfile } | { kind: 'later'; profile: FamilyProfile }
  | { kind: 'address'; address: Address | null } | { kind: 'starts'; me: Membership } | { kind: 'done'; to: string };

function Setup({ ctx }: { ctx: ClubContext }) {
  const [step, setStep] = useState<Step>({ kind: 'waiting' });
  const [error, setError] = useState('');
  // She chose "Finish later" in this visit (also remembered on this device), and whether she did any step here.
  const deferred = useRef(false);
  const progressed = useRef(false);
  const fail = () => setError('We couldn’t load your membership. Check your connection and reload the page.');

  const next = async () => {
    const [household, profile, session] = await Promise.all([
      ctx.store.household(),
      ctx.store.profile().catch(() => null),
      ctx.store.kind === 'account' ? getSession() : null,
    ]);
    const later = deferred.current || profileDeferred(session?.user_id);
    if (ctx.store.kind === 'sample') {
      if (!household) return setStep({ kind: 'family', household: null, suggested: '' });
      if (profile && !profile.setupCompleted && !later) return setStep({ kind: 'profile', household, profile });
      return setStep({ kind: 'done', to: routes.clubDashboard });
    }
    const me = await loadMembership();
    // The family form comes first; its steps 2–6 follow straight away, then the address, then the Welcome Kit.
    const s = nextStep(me, { profile: household ? profile : null, profileDeferred: later, meetingGuideSeen: await loadMeetingGuideSeen(session?.user_id) });
    if (s === 'not_member') return setStep({ kind: 'not_member' });
    if (s === 'family') {
      const address = await loadAddress().catch(() => null);
      return setStep({ kind: 'family', household, suggested: familyNameFrom(address?.name) });
    }
    if (s === 'profile' && household && profile) return setStep({ kind: 'profile', household, profile });
    if (s === 'address') return setStep({ kind: 'address', address: await loadAddress() });
    // No Welcome Kit yet (her free month wasn't available): say what happens next instead of a silent jump.
    if (s === 'home' && progressed.current && startsWithFirstPayment(me)) return setStep({ kind: 'starts', me });
    setStep({ kind: 'done', to: stepHref(me, s) });
  };
  const advance = () => {
    progressed.current = true;
    setStep({ kind: 'waiting' });
    return next().catch(fail);
  };

  useEffect(() => {
    let tries = 0;
    // The checkout webhook usually lands within seconds; give it up to a minute.
    const wait = async () => {
      if (ctx.store.kind === 'account') {
        const me = await loadMembership().catch(() => null);
        if (me && !me.member && !me.grant && ++tries < 20) return void setTimeout(wait, 3000);
      }
      next().catch(fail);
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
            await advance();
          }} />
        </>
      );
    case 'profile':
      return (
        <>
          <KitSteps steps={kitProgress('family')} />
          <FamilySetup store={ctx.store} members={step.household.members} profile={step.profile} mode="wizard" onDone={() => advance()}
            onExit={(profile) => setStep({ kind: 'later', profile })} />
        </>
      );
    case 'later': {
      const open = SETUP_STEPS.filter((s) => !step.profile.setupDone.includes(s));
      return (
        <div className="max-w-2xl">
          <KitSteps steps={kitProgress('family')} />
          <h1 className="mt-2 font-serif text-[2rem] leading-tight text-warm-ink">Saved. Finish the rest anytime.</h1>
          <p className="mt-3 leading-relaxed text-warm-soft">Everything you answered is saved to your account. {open.length ? 'Still open:' : ''}</p>
          {open.length > 0 && (
            <ul className="mt-2 list-disc pl-6 leading-relaxed text-warm-ink">{open.map((s) => <li key={s}>{STEP_TITLES[s]}</li>)}</ul>
          )}
          <p className="mt-3 leading-relaxed text-warm-soft">You’ll find them under <strong className="text-warm-ink">My Family</strong>. Next, your Welcome Kit.</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="button" className="btn-primary" onClick={async () => {
              deferred.current = true;
              deferProfile((await getSession())?.user_id);
              await advance();
            }}>Continue</button>
            <button type="button" className="min-h-11 text-[0.95rem] text-warm-soft underline underline-offset-4"
              onClick={() => ctx.store.household().then((h) => h && setStep({ kind: 'profile', household: h, profile: step.profile }))}>Keep going now</button>
          </div>
        </div>
      );
    }
    case 'address':
      return (
        <>
          <KitSteps steps={kitProgress('address')} />
          <h1 className="mt-2 font-serif text-[2rem] leading-tight text-warm-ink">Where should we mail your Welcome Kit?</h1>
          <p className="mt-3 mb-6 max-w-xl leading-relaxed text-warm-soft">Your Welcome Kit and your monthly printed resources come here.</p>
          <AddressForm address={step.address} submitLabel="See my welcome gift" onSave={async (a) => {
            await saveAddress(a);
            await advance();
          }} />
        </>
      );
    case 'starts':
      return <StartsWithPayment me={step.me} />;
  }
}

/**
 * Her family and address are set, but her membership has no month yet: the free first month is one per household and
 * this one had it, so her first month, and her Welcome Kit with it, open with her first payment. Nothing is granted early.
 */
function StartsWithPayment({ me }: { me: Membership }) {
  const n = me.next!;
  const month = monthName(n.month).split(' ')[0];
  return (
    <div className="max-w-2xl">
      <p className="label text-warm-soft">You’re all set</p>
      <h1 className="mt-2 font-serif text-[2rem] leading-tight text-warm-ink">Your Club starts with {month}</h1>
      <p className="mt-3 leading-relaxed text-warm-soft">
        Your family and mailing address are saved. The free first month is one per household, and this household has already had it, so your membership starts with your first payment on <strong className="text-warm-ink">{shortDate(n.payment_on!)}</strong>.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-6 leading-relaxed text-warm-ink">
        <li>{month} opens in your Club that day, prepared with your family’s names.</li>
        <li>Your Welcome Kit comes with it: you’ll approve your Family Vision print and {month}, and we mail them with our Family Meeting guide in one package.</li>
      </ul>
      <p className="mt-3 leading-relaxed text-warm-soft">Think that’s a mistake? Reply to your welcome email and we’ll look.</p>
      <a href={routes.appClub} className="btn-primary mt-6 inline-block">Go to Club Home</a>
    </div>
  );
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

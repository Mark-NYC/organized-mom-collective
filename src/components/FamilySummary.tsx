/**
 * /app/account's family panel.
 * - Anyone signed in with a household (free: the family calendar and Sunday Setup need no membership) sees her own
 *   family, the same record every feature uses, plus Family sharing (src/components/household/HouseholdSharing.tsx).
 *   Club members also get Club Home and Account & Billing (owner only).
 * - Signed in with no household yet: one link to set up the family.
 * - Anyone else sees a plain state: sign in (when sign-in is on), or that a member's family shows here. Never made-up
 *   people: a fictional family in someone's Account reads as somebody else's data.
 * - The fictional sample family only in an explicit demo, `/app/account?demo=1`, labeled as one (development,
 *   previews, screenshots).
 */
import { useEffect, useState } from 'react';
import { appPreviewFamily } from '../lib/app-family';
import { ageInMonth, monthOf, type Household } from '../lib/club/profile';
import { clubAccountsEnabled } from '../data/club/config';
import { deleteAccount, getSession, signOut } from '../lib/account';
import { loadMembership } from '../lib/club/membership';
import { accountStore } from '../lib/club/store';
import { routes } from '../routes';
import HouseholdSharing from './household/HouseholdSharing';

import { householdAccess, type HouseholdAccess } from '../lib/household/api';

/** The iPhone app (Our Week, free): its own sign-in, setup and account; never Club sales or billing (docs/brand/OUR_WEEK.md). */
const ourWeek = import.meta.env.PUBLIC_APP_SHELL === 'ios';

export default function FamilySummary() {
  const [family, setFamily] = useState<Family | undefined>(undefined);
  const [email, setEmail] = useState('');
  useEffect(() => {
    if (new URLSearchParams(location.search).get('demo') === '1') {
      appPreviewFamily().then((h) => setFamily({ state: 'demo', household: h }), () => setFamily({ state: 'demo', household: null }));
      return;
    }
    if (!clubAccountsEnabled()) return void setFamily({ state: 'no-sign-in', household: null });
    getSession().then(async (s) => {
      if (!s) return setFamily({ state: 'signed-out', household: null });
      setEmail(s.email);
      const [household, access, me] = await Promise.all([
        accountStore.household(), householdAccess().catch(() => null), loadMembership().catch(() => null),
      ]);
      if (!household) return setFamily({ state: 'not-member', household: null });
      const owner = (access?.myRole ?? 'owner') === 'owner';
      // Website: Club links for the paying owner. Our Week: the household's Club content for either adult (20261128), no billing.
      setFamily({ state: 'member', household, access, club: ourWeek ? Boolean(me?.access) : Boolean(me && (me.member || me.grant)) && owner });
    }).catch(() => setFamily({ state: 'unavailable', household: null }));
  }, []);
  if (family === undefined) return <p className="mt-6 text-warm-soft">Loading your family…</p>;
  const month = monthOf(new Date());
  const { household, state } = family;
  if (state === 'member') {
    return (
      <>
        <section className="family-panel mt-6" data-account-family="member">
          <p className="label">YOUR FAMILY</p>
          <h2 className="family-panel-title mt-4">{household?.displayName ?? 'Your family'}</h2>
          {household ? <Members household={household} month={month} /> : <p className="mt-3 text-sm text-warm-soft">You haven’t added your family yet.</p>}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <a href={ourWeek ? '/app/family/setup' : routes.clubFamily} className="family-link">{household ? 'Edit our family →' : 'Add your family →'}</a>
            {family.club && <a href={routes.appClub} className="family-link">Club Home →</a>}
            {family.club && !ourWeek && <a href={routes.clubDashboard} className="family-link">Account &amp; Billing →</a>}
          </div>
        </section>
        {household && family.access && <HouseholdSharing household={household} access={family.access} />}
        {ourWeek && family.club && (
          <section className="family-panel mt-5" data-account-club>
            <p className="label text-[#71866c]">FAMILY MEETING CLUB</p>
            <h2 className="family-panel-title mt-3">Your household’s membership</h2>
            <p className="mt-2 text-sm leading-relaxed text-warm-soft">Your monthly Family Focus and kits, for both grown-ups.</p>
            <a href={routes.appClub} className="family-link mt-4">Club Home →</a>
          </section>
        )}
        {ourWeek && <OurWeekSignedIn email={email} role={family.access?.myRole ?? 'owner'} shared={(family.access?.adults.length ?? 1) > 1} />}
      </>
    );
  }
  if (state === 'demo') {
    return (
      <>
        <div className="family-note mt-8" data-account-family="demo"><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm leading-relaxed">You opened the demo (<code>?demo=1</code>). The people below are made up, to show how a family's details look. <a href={routes.appAccount} className="underline">Leave the demo</a>.</p></div>
        {household ? (
          <section className="family-panel mt-6">
            <p className="label">DEMO FAMILY</p>
            <h2 className="family-panel-title mt-4">{household.displayName ?? 'Our family'}</h2>
            <Members household={household} month={month} />
          </section>
        ) : <p className="mt-6 text-warm-soft">Demo family unavailable.</p>}
      </>
    );
  }
  const copy: Record<Exclude<Family['state'], 'member' | 'demo'>, { title: string; body: string; signIn: boolean; setup?: boolean }> = {
    'signed-out': { title: 'Sign in to see your family', body: 'Sign in with your email to keep your family, calendar and weekly plan on every phone, shared with the other adult in your home. We’ll send a 6-digit code; there’s no password.', signIn: true },
    'not-member': ourWeek
      ? { title: 'Set up your family', body: 'Add everyone once: names, ages and each person’s color. The calendar, cleaning and your weekly Family Meeting all use the same family. Invited by another grown-up? Open the link in your invitation.', signIn: false, setup: true }
      : { title: 'Set up your family', body: 'Add everyone once: names, ages and who does what. The calendar, the cleaning companion and the Family Meeting Club all use the same family. Invited by another adult? Open the link in your invitation.', signIn: false, setup: true },
    'no-sign-in': { title: 'Your family', body: 'A Family Meeting Club member’s family (names, ages and roles, used by every monthly plan) appears here once she signs in.', signIn: false },
    unavailable: { title: 'We couldn’t load your family', body: 'Check your connection and open this page again. Nothing you saved is lost.', signIn: false },
  };
  const c = copy[state];
  return (
    <>
    <section className="family-panel mt-8" data-account-family={state}>
      <p className="label">YOUR FAMILY</p>
      <h2 className="family-panel-title mt-4">{c.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-warm-soft">{c.body}</p>
      {/* In the app (Our Week, free) sign-in and setup never go through the Club's paid onboarding. */}
      {c.signIn && <a href={ourWeek ? '/app/sign-in?next=/app/account' : routes.clubLogin} className="family-action mt-6">Sign in</a>}
      {c.setup && <a href={ourWeek ? '/app/family/setup' : routes.clubFamily} className="family-action mt-6">Set up our family</a>}
    </section>
    {ourWeek && state === 'not-member' && <OurWeekSignedIn email={email} role="owner" shared={false} />}
    </>
  );
}

type Family = {
  state: 'member' | 'demo' | 'signed-out' | 'not-member' | 'no-sign-in' | 'unavailable';
  household: Household | null;
  /** Who shares the household (state 'member'). */
  access?: HouseholdAccess | null;
  /** Club links (members, owner's account only: billing is hers). */
  club?: boolean;
};

function Members({ household, month }: { household: Household; month: string }) {
  return (
    <ul className="mt-5 divide-y divide-warm-rule">
      {household.members.filter((m) => !m.archived).map((m) => (
        <li key={m.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
          <span className="font-semibold">{m.firstName}</span>
          <span className="text-sm text-warm-soft">{m.kind === 'child' && m.birthYear ? `Child · ${ageInMonth(m.birthYear, m.birthMonth, month)} years` : m.kind === 'child' ? 'Child' : 'Adult'}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Our Week: who's signed in, sign out, and deleting the account (App Store guideline 5.1.1(v): an app that creates
 * accounts lets people delete them in the app). What deleting does depends on her place in the household (20261124):
 * the family stays with the other grown-up; alone, it goes with the account. A membership that can still be charged
 * blocks it (20261129 / account_delete): she's told to contact us, never sent to a payment page from the app.
 */
function OurWeekSignedIn({ email, role, shared }: { email: string; role: 'owner' | 'partner'; shared: boolean }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [msg, setMsg] = useState('');
  const what = role === 'partner'
    ? 'Only your sign-in goes. Your family, calendar and agreements stay with the grown-up who set up the family.'
    : shared
      ? 'Your family, calendar, agreements and colors stay with the other grown-up, who becomes the family’s owner.'
      : 'Your family, calendar, agreements and colors are deleted with your account. This can’t be undone.';
  const remove = async () => {
    setStep('busy'); setMsg('');
    try {
      await deleteAccount();
      location.replace('/app');
    } catch (e) {
      setStep('confirm');
      const m = (e as Error).message;
      setMsg(m.includes('active_membership')
        ? 'Your Family Meeting Club membership is still active, so your account can’t be deleted yet. Contact us and we’ll help you cancel it first.'
        : m.includes('admin_account') ? 'This is an admin account; it can’t be deleted here.' : 'We couldn’t delete your account just now. Check your connection and try again.');
    }
  };
  return (
    <section className="family-panel mt-5" data-account-signin aria-labelledby="acct-signin-h">
      <p className="label">SIGN-IN</p>
      <h2 id="acct-signin-h" className="family-panel-title mt-3">Signed in{email ? ` as ${email}` : ''}</h2>
      <p className="mt-2 text-sm text-warm-soft">{role === 'partner' ? 'You share this family with the grown-up who set it up.' : shared ? 'You set up this family and share it with one other grown-up.' : 'You set up this family.'}</p>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
        <button type="button" className="family-link" onClick={async () => { await signOut(); location.replace('/app'); }} data-sign-out>Sign out</button>
        {step === 'idle' && <button type="button" className="family-link text-warm-soft" onClick={() => setStep('confirm')} data-delete-account>Delete my account</button>}
      </div>
      {step !== 'idle' && (
        <div className="family-note mt-5" role="group" aria-label="Delete your account" data-delete-confirm>
          <p className="text-sm font-semibold">Delete your Our Week account?</p>
          <p className="mt-1 text-sm leading-relaxed">{what} Cleaning progress saved on this phone stays on this phone.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="family-action" disabled={step === 'busy'} onClick={() => void remove()} data-delete-confirm-yes>{step === 'busy' ? 'Deleting…' : 'Delete my account'}</button>
            <button type="button" className="family-link" disabled={step === 'busy'} onClick={() => { setStep('idle'); setMsg(''); }}>Keep my account</button>
          </div>
          {msg && <p role="alert" className="mt-3 text-sm">{msg} {msg.includes('Contact us') && <a href="/support" className="underline">Contact support →</a>}</p>}
        </div>
      )}
    </section>
  );
}

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
import { deleteAccount, getSession, signOut, signOutEverywhere } from '../lib/account';
import { loadMembership } from '../lib/club/membership';
import { accountStore } from '../lib/club/store';
import { routes } from '../routes';
import HouseholdSharing from './household/HouseholdSharing';
import { Avatar, Chevron } from './app/ui';
import type { MarkerColor } from '../data/club/family-colors';
import { memberColors } from '../data/club/family-colors';

import { householdAccess, type HouseholdAccess } from '../lib/household/api';

/**
 * The same account screen on the website's /app and in the iPhone app (owner decision 2026-11-17): the app's sign-in,
 * family setup, sharing and account deletion. One platform difference: billing. Nothing is bought or managed in the
 * app (docs/brand/OUR_WEEK.md), so the Club's Account & Billing link and "cancel it there" exist on the website only.
 */
const web = import.meta.env.PUBLIC_APP_SHELL !== 'ios';

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
      // The household's Club content for either adult (20261128); billing (website only) is the paying owner's.
      setFamily({ state: 'member', household, access, club: Boolean(me?.access), billing: web && owner && Boolean(me && (me.member || me.grant)) });
    }).catch(() => setFamily({ state: 'unavailable', household: null }));
  }, []);
  if (family === undefined) return <p className="mt-6 text-warm-soft">Loading your family…</p>;
  const month = monthOf(new Date());
  const { household, state } = family;
  if (state === 'member') {
    return (
      <>
        <p className="of-group-title">Household</p>
        <section className="of-tile" data-account-family="member">
          <div className="of-tile-head">
            <div className="min-w-0"><p className="of-eyebrow">Your family</p><h2 className="of-tile-title">{household?.displayName ?? 'Your family'}</h2></div>
            <a href="/app/family/setup" className="of-tile-action">{household ? 'Edit' : 'Add'} <Chevron /></a>
          </div>
          {household ? <Members household={household} month={month} /> : <p className="mt-3 text-sm text-warm-soft">You haven’t added your family yet.</p>}
        </section>
        {household && family.access && <HouseholdSharing household={household} access={family.access} />}
        {(family.club || family.billing) && (
          <>
          <p className="of-group-title">Membership</p>
          <section className="of-tile of-tile--month" data-account-club>
            <p className="of-eyebrow">Family Meeting Club</p>
            <h2 className="of-tile-title">Your household’s membership</h2>
            <p className="of-tile-sub">Your monthly Family Focus and kits, for both grown-ups.</p>
            <div className="mt-3 flex flex-wrap gap-x-6">
              {family.club && <a href={routes.appClub} className="of-tile-action">Club Home <Chevron /></a>}
              {family.billing && <a href={routes.clubDashboard} className="of-tile-action">Account &amp; Billing <Chevron /></a>}
            </div>
          </section>
          </>
        )}
        {<OurWeekSignedIn email={email} role={family.access?.myRole ?? 'owner'} shared={(family.access?.adults.length ?? 1) > 1} />}
      </>
    );
  }
  if (state === 'demo') {
    return (
      <>
        <div className="family-note mt-8" data-account-family="demo"><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm leading-relaxed">You opened the demo (<code>?demo=1</code>). The people below are made up, to show how a family's details look. <a href={routes.appAccount} className="underline">Leave the demo</a>.</p></div>
        {household ? (
          <section className="of-tile mt-6">
            <p className="of-eyebrow">Demo family</p>
            <h2 className="of-tile-title">{household.displayName ?? 'Our family'}</h2>
            <Members household={household} month={month} />
          </section>
        ) : <p className="mt-6 text-warm-soft">Demo family unavailable.</p>}
      </>
    );
  }
  const copy: Record<Exclude<Family['state'], 'member' | 'demo'>, { title: string; body: string; signIn: boolean; setup?: boolean }> = {
    'signed-out': { title: 'Sign in to see your family', body: 'Sign in with your email to keep your family, calendar and weekly plan on every phone, shared with the other adult in your home. We’ll send a 6-digit code; there’s no password.', signIn: true },
    'not-member': { title: 'Set up your family', body: 'Add everyone once: names, ages and each person’s color. The calendar, cleaning and your weekly Family Meeting all use the same family. Invited by another grown-up? Open the link in your invitation.', signIn: false, setup: true },
    'no-sign-in': { title: 'Your family', body: 'A Family Meeting Club member’s family (names, ages and roles, used by every monthly plan) appears here once she signs in.', signIn: false },
    unavailable: { title: 'We couldn’t load your family', body: 'Check your connection and open this page again. Nothing you saved is lost.', signIn: false },
  };
  const c = copy[state];
  return (
    <>
    <section className="of-tile mt-6" data-account-family={state}>
      <p className="of-eyebrow">Your family</p>
      <h2 className="of-tile-title">{c.title}</h2>
      <p className="of-tile-sub">{c.body}</p>
      {/* Sign-in and setup never go through the Club's paid onboarding. */}
      {c.signIn && <a href="/app/sign-in?next=/app/account" className="of-btn mt-5">Sign in</a>}
      {c.setup && <a href="/app/family/setup" className="of-btn mt-5">Set up our family</a>}
    </section>
    {state === 'not-member' && <OurWeekSignedIn email={email} role="owner" shared={false} />}
    </>
  );
}

type Family = {
  state: 'member' | 'demo' | 'signed-out' | 'not-member' | 'no-sign-in' | 'unavailable';
  household: Household | null;
  /** Who shares the household (state 'member'). */
  access?: HouseholdAccess | null;
  /** The household has the Club (either adult). */
  club?: boolean;
  /** Website only: the paying owner's Account & Billing link. */
  billing?: boolean;
};

function Members({ household, month }: { household: Household; month: string }) {
  const colors: Record<string, MarkerColor> = memberColors(household);
  return (
    <ul className="of-rows">
      {household.members.filter((m) => !m.archived).map((m) => (
        <li key={m.id} className="of-row justify-between">
          <span className="flex items-center gap-3"><Avatar name={m.firstName} color={colors[m.id]} size="sm" /><span className="font-semibold">{m.firstName}</span></span>
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
        ? (web
          ? 'Your Family Meeting Club membership is still active, so your account can’t be deleted yet. Cancel it in Account & Billing first, or contact us and we’ll help.'
          : 'Your Family Meeting Club membership is still active, so your account can’t be deleted yet. Contact us and we’ll help you cancel it first.')
        : m.includes('admin_account') ? 'This is an admin account; it can’t be deleted here.' : 'We couldn’t delete your account just now. Check your connection and try again.');
    }
  };
  return (
    <>
    <p className="of-group-title">Sign-in</p>
    <section className="of-tile" data-account-signin aria-labelledby="acct-signin-h">
      <h2 id="acct-signin-h" className="of-tile-title !mt-0 break-words">Signed in{email ? ` as ${email}` : ''}</h2>
      <p className="of-tile-sub">{role === 'partner' ? 'You share this family with the grown-up who set it up.' : shared ? 'You set up this family and share it with one other grown-up.' : 'You set up this family.'}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" className="of-btn of-btn--soft" onClick={async () => { await signOut(); location.replace('/app'); }} data-sign-out>Sign out</button>
        <button type="button" className="of-btn of-btn--soft" data-sign-out-everywhere onClick={async () => {
          if (!confirm('Sign out on every phone, tablet and computer where you’re signed in? Use this if a device is lost or shared. Other devices can take up to an hour to sign out.')) return;
          try { await signOutEverywhere(); location.replace('/app'); } catch { alert('We couldn’t sign you out everywhere just now. You’re still signed in here. Check your connection and try again.'); }
        }}>Sign out everywhere</button>
        {step === 'idle' && <button type="button" className="of-btn of-btn--danger sm:col-span-2" onClick={() => setStep('confirm')} data-delete-account>Delete my account</button>}
      </div>
      {step !== 'idle' && (
        <div className="family-note mt-5" role="group" aria-label="Delete your account" data-delete-confirm>
          <p className="text-sm font-semibold">Delete your Organized Family account?</p>
          <p className="mt-1 text-sm leading-relaxed">{what} Cleaning progress saved on this {web ? 'device stays on this device' : 'phone stays on this phone'}.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="of-btn of-btn--danger" disabled={step === 'busy'} onClick={() => void remove()} data-delete-confirm-yes>{step === 'busy' ? 'Deleting…' : 'Delete my account'}</button>
            <button type="button" className="of-btn of-btn--soft" disabled={step === 'busy'} onClick={() => { setStep('idle'); setMsg(''); }}>Keep my account</button>
          </div>
          {msg && <p role="alert" className="mt-3 text-sm">{msg} {web && msg.includes('Account & Billing') && <><a href={routes.clubDashboard} className="underline">Account &amp; Billing →</a> </>}{/contact us/i.test(msg) && <a href="/support" className="underline">Contact support →</a>}</p>}
        </div>
      )}
    </section>
    {/* Easy to find from the app (App Review 5.1.1(i)); they open on the website. */}
    <nav className="mt-4 flex flex-wrap gap-x-5 text-sm" aria-label="Policies and help" data-account-policies>
      <a href={routes.privacy} className="inline-flex min-h-[44px] items-center underline underline-offset-4">Privacy Policy</a>
      <a href={routes.terms} className="inline-flex min-h-[44px] items-center underline underline-offset-4">Terms of Service</a>
      <a href="/support" className="inline-flex min-h-[44px] items-center underline underline-offset-4">Help &amp; support</a>
      <a href="/app/feedback?from=/app/account" className="inline-flex min-h-[44px] items-center underline underline-offset-4" data-feedback-link>Send feedback</a>
    </nav>
    </>
  );
}

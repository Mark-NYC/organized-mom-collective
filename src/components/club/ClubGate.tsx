/**
 * Every Club member page starts here: picks the store (a sample household from ?sample=, or the signed-in account),
 * signs her in with the emailed code when needed, and shows the member header. Pages render inside it.
 * Off entirely unless PUBLIC_CLUB_ENABLED (the .astro page doesn't even load this then).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CLUB_NAME, clubAccountsEnabled } from '../../data/club/config';
import { sampleHouseholds } from '../../data/club/samples';
import { getSession, requestCode, signOut, verifyCode, type AccountSession } from '../../lib/account';
import { accountStore, clubHref, resetSample, sampleFromUrl, sampleStore, type ClubStore } from '../../lib/club/store';
import { routes } from '../../routes';
import { clubNav } from '../../lib/club/nav';

export interface ClubContext {
  store: ClubStore;
  /** The open sample's id, or null for a real account. */
  sample: string | null;
  href: (path: string) => string;
}

type Page = 'dashboard' | 'family' | 'kit' | 'start';

export default function ClubGate({ page, children }: { page: Page; children: (ctx: ClubContext) => ReactNode }) {
  const [sample] = useState(() => (typeof location === 'undefined' ? null : sampleFromUrl(clubNav().search())));
  const [session, setSession] = useState<AccountSession | null | undefined>(sample ? null : undefined);

  useEffect(() => {
    if (sample || !clubAccountsEnabled()) return setSession(null);
    getSession().then(setSession);
  }, [sample]);

  const store = sample ? sampleStore(sample) : session ? accountStore : null;
  const href = (path: string) => clubHref(path, sample);

  if (session === undefined) return <p className="py-16 text-center text-warm-soft">Loading…</p>;

  return (
    <>
      <MemberHeader page={page} href={href} signedIn={Boolean(session)} />
      {sample && store && <SampleBanner id={sample} label={store.label} />}
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-8 sm:pt-10">
        {store ? children({ store, sample, href }) : clubAccountsEnabled() ? <ClubSignIn onSignedIn={setSession} /> : <NoSignIn />}
      </main>
    </>
  );
}

function MemberHeader({ page, href, signedIn }: { page: Page; href: (p: string) => string; signedIn: boolean }) {
  const link = (p: Page, to: string, label: string) => (
    <a href={href(to)} aria-current={page === p ? 'page' : undefined} className="rounded-[3px] px-2.5 py-2 text-[0.82rem] font-semibold text-warm-ink aria-[current=page]:underline aria-[current=page]:underline-offset-[6px]">
      {label}
    </a>
  );
  return (
    <header data-club-chrome className="border-b border-warm-rule bg-ivory">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-8">
        <a href={href(routes.clubDashboard)} className="font-serif text-[1.05rem] text-warm-ink">{CLUB_NAME}</a>
        <nav aria-label="Club" className="-mr-2 flex items-center gap-1">
          {link('dashboard', routes.clubDashboard, 'Kits')}
          {link('family', routes.clubFamily, 'Family')}
          {signedIn && (
            <button type="button" className="px-2.5 py-2 text-[0.82rem] text-warm-soft underline underline-offset-4" onClick={() => signOut().then(() => clubNav().reload())}>
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

function SampleBanner({ id, label }: { id: string; label: string }) {
  return (
    <div data-club-chrome className="border-b border-[#e8d9b8] bg-[#fdf6e6] text-[0.85rem] text-warm-ink">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-8">
        <p>
          <strong>{label}</strong> · a made-up preview family. Changes stay in this browser tab.
        </p>
        <span className="flex gap-4">
          <button type="button" className="underline underline-offset-4" onClick={() => { resetSample(id); clubNav().reload(); }}>
            Reset sample
          </button>
          <a className="underline underline-offset-4" href={routes.clubDashboard}>Other samples</a>
        </span>
      </div>
    </div>
  );
}

/** No sign-in available here (accounts off): offer the sample households. */
function NoSignIn() {
  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">{CLUB_NAME}</h1>
      <p className="mt-4 leading-relaxed text-warm-soft">
        Member sign-in isn’t switched on in this build. Open a sample household to preview the member pages.
      </p>
      <ul className="mt-6 divide-y divide-warm-rule border-y border-warm-rule">
        {sampleHouseholds.map((s) => (
          <li key={s.id}>
            <a className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between" href={clubHref(routes.clubDashboard, s.id)}>
              <span className="font-semibold text-warm-ink underline underline-offset-4">{s.label}</span>
              <span className="text-[0.9rem] text-warm-soft">{s.shows}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Submit = { preventDefault(): void };

/** The account's emailed-code sign-in (src/lib/account.ts), in the Club's words. */
function ClubSignIn({ onSignedIn }: { onSignedIn: (s: AccountSession) => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e?: Submit) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    const r = await requestCode(email);
    setBusy(false);
    if (r === 'sent') setStep('code');
    else setError(r === 'invalid' ? 'Check the email address and try again.' : r === 'rate_limited' ? 'Too many codes asked for. Wait a few minutes, then try again.' : 'We couldn’t send a code just now. Please try again in a minute.');
  };
  const verify = async (e: Submit) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await verifyCode(email, code);
    setBusy(false);
    if (r.ok) onSignedIn(r.session);
    else setError(r.error === 'wrong_code' ? 'That code didn’t work. Check the newest email, or send a new code.' : 'Something went wrong. Please try again.');
  };

  return (
    <div className="max-w-md">
      <h1 className="font-serif text-[2rem] leading-tight text-warm-ink">Welcome back</h1>
      <p className="mt-3 leading-relaxed text-warm-soft">Sign in with your email. We’ll send a 6-digit code; there’s no password.</p>
      {step === 'email' ? (
        <form onSubmit={send} className="mt-6" noValidate>
          <label htmlFor="club-email" className="label text-warm-soft">Email</label>
          <input id="club-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem]" />
          <button type="submit" disabled={busy} className="btn-primary mt-5 w-full sm:w-auto">{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6">
          <p className="leading-relaxed">We sent a code to <strong>{email.trim().toLowerCase()}</strong>.</p>
          <label htmlFor="club-code" className="label mt-5 block text-warm-soft">Code</label>
          <input id="club-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} autoFocus className="mt-2 block min-h-12 w-full max-w-[12rem] rounded-[4px] border border-warm-rule bg-white px-3 text-[1.3rem] tracking-[0.3em]" />
          <button type="submit" disabled={busy || code.replace(/\D/g, '').length < 6} className="btn-primary mt-5 w-full sm:w-auto">{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="mt-4 block text-[0.9rem] underline underline-offset-4" onClick={() => send()}>Send a new code</button>
        </form>
      )}
      {error && <p role="alert" className="mt-4 border-l-[3px] border-rose bg-rose-wash px-4 py-3">{error}</p>}
    </div>
  );
}

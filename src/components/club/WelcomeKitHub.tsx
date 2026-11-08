/**
 * /club/welcome-kit: her first family package, all in one place. After the questionnaire she lands here and sees the
 * three printed pieces together (Family Vision Print, Family Meeting Guide, her first month's resource), each as a
 * miniature of the real printable with its status and one action. Then her mailing address and one final
 * "Prepare My Welcome Kit".
 *
 * Nothing new on the server: her print is approved on its own page (club_welcome_approve), her first month is reviewed
 * on its real tool (/app/club/<month>?welcome=1, remembered on this device), and "Prepare My Welcome Kit" is the same
 * club_fulfillment_approve the kit always waited on, followed by the owner's kit_submitted email (once per kit).
 * Approving twice changes nothing, so a double click or a refresh can't make a second order; the button only works
 * once everything is ready. Every state comes from club_me, so a refresh or another device lands on the same page.
 */
import { useEffect, useState } from 'react';
import ClubGate, { type ClubContext } from './ClubGate';
import AddressForm from './AddressForm';
import WelcomeKitItems, { nextItem } from './WelcomeKitItems';
import { approveResource, loadAddress, loadMembership, notifyKitSubmitted, saveAddress, type Address, type Membership } from '../../lib/club/membership';
import { firstMonth, firstResourceReviewed, kitItems, kitSubmitted, kitText, loadMeetingGuideSeen, nextStep, profileDeferred, stepHref } from '../../lib/club/onboarding';
import { setJourney } from '../../lib/club/journey';
import { clubResourceBySlug } from '../../data/club/resources';
import { getSession } from '../../lib/account';
import { routes } from '../../routes';
import { clubNav } from '../../lib/club/nav';

export default function WelcomeKitHub() {
  return <ClubGate page="kit">{(ctx) => <Hub ctx={ctx} />}</ClubGate>;
}

const resourceTitle = (slug: string | null) => clubResourceBySlug(slug)?.title ?? null;

function Hub({ ctx }: { ctx: ClubContext }) {
  const [me, setMe] = useState<Membership | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [editAddress, setEditAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Back from a piece (?done=print|guide|first): a short "✓ … approved" note and that card highlighted, once.
  const [done] = useState<'print' | 'guide' | 'first' | null>(() => {
    const d = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('done');
    return d === 'print' || d === 'guide' || d === 'first' ? d : null;
  });
  useEffect(() => {
    if (done) history.replaceState(null, '', location.pathname);
  }, []);

  useEffect(() => {
    if (ctx.store.kind === 'sample') return void clubNav().go(ctx.href(routes.clubDashboard), { replace: true });
    (async () => {
      const [s, m, a, household, profile] = await Promise.all([
        getSession(), loadMembership(), loadAddress().catch(() => null), ctx.store.household(), ctx.store.profile().catch(() => null),
      ]);
      const step = nextStep(m, { profile: household ? profile : null, profileDeferred: profileDeferred(s?.user_id), meetingGuideSeen: await loadMeetingGuideSeen(s?.user_id) });
      // Not set up yet (family, questions, address): back to the questionnaire. No kit at all: Club Home explains.
      if (step === 'not_member' || step === 'family' || step === 'profile' || step === 'address') return clubNav().go(ctx.href(stepHref(m, step)), { replace: true });
      if (!m.welcome || m.welcome.satisfies_month) return clubNav().go(routes.appClub, { replace: true });
      setUid(s?.user_id ?? null);
      setAddress(a);
      setMe(m);
    })().catch(() => setError('We couldn’t load your Welcome Kit. Check your connection and reload the page.'));
    return () => setJourney(null);
  }, []);

  const first = me ? firstMonth(me) : null;
  const reviewed = firstResourceReviewed(first?.slug, uid);
  const items = me ? kitItems(me, reviewed, resourceTitle) : [];
  const submitted = me ? kitSubmitted(me) : false;
  const w = me?.welcome;
  const canSubmit = Boolean(me && w && w.approved && reviewed && w.readiness === 'needs_confirmation' && first?.slug && first.can === 'edit' && ['pending', 'on_hold'].includes(w.status));
  const allReady = items.length > 0 && items.every((i) => i.status === 'approved' || i.status === 'ready');

  useEffect(() => {
    if (!me) return;
    setJourney(submitted ? 'done' : allReady ? 'confirm' : 'print');
  }, [me, submitted, allReady]);

  if (error && !me) return <p role="alert">{error}</p>;
  if (!me || !w) return <p className="text-warm-soft">Getting your Welcome Kit…</p>;

  const prepare = async () => {
    if (!first?.slug || busy) return;
    setBusy(true);
    setError('');
    try {
      await approveResource(first.slug);
    } catch {
      // A lost answer after it went in still counts: check before saying it failed.
    }
    try {
      const now = await loadMembership();
      setMe(now);
      if (kitSubmitted(now)) notifyKitSubmitted().catch(() => undefined);
      else setError('We couldn’t prepare your Welcome Kit just now. Nothing was sent to print. Please try again.');
    } catch {
      setError('We couldn’t prepare your Welcome Kit just now. Nothing was sent to print. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const month = first ? clubResourceBySlug(first.slug)?.month : null;
  const monthWord = items[2]?.name.replace(/ Resource$/, '') ?? 'first';
  const todo = items.filter((i) => i.status === 'needs_review');
  const next = nextItem(items);
  const readyCount = items.filter((i) => i.status === 'approved' || i.status === 'ready').length;
  const doneName = done === 'print' ? `${items[0]?.name.replace(/^Your /, '') ?? 'Family Vision Print'} approved for printing.` : done === 'first' ? `${monthWord} Resource approved for printing.` : done === 'guide' ? 'Family Meeting Guide: ready, nothing to change.' : null;

  if (submitted) {
    return (
      <div className="wk" data-welcome-kit data-kit-submitted>
        <p className="label text-[#71866c]">Your Welcome Kit</p>
        <h1 className="wk-title"><span aria-hidden="true">✓ </span>Your Welcome Kit is getting ready!</h1>
        <p className="wk-lede">{w.status === 'mailed' ? kitText(me) : 'We’re printing your three resources together and aim to mail them within two business days. Club Home shows when your package is on its way.'}</p>
        <WelcomeKitItems items={items} firstSlug={first?.slug ?? null} />
        <section className="wk-next" aria-labelledby="wk-next-title">
          <h2 id="wk-next-title" className="wk-h2">Here’s what’s coming next</h2>
          <p>Your {monthWord} plan and the Family Meeting Guide are already in your Club, so you can start before the mail comes. From next month, a new resource arrives on the regular Club schedule.</p>
          <a className="btn-primary mt-5" href={routes.appClub}>Go to Club Home</a>
        </section>
      </div>
    );
  }

  return (
    <div className="wk" data-welcome-kit>
      <p className="label text-[#71866c]">Your Welcome Kit{month ? ` · ${monthWord} ${month.slice(0, 4)}` : ''}</p>
      <h1 className="wk-title">Let’s get your first family package ready.</h1>
      <p className="wk-lede">Three printed resources, made for your family and mailed together to your door.</p>
      {doneName && (
        <p className="wk-flash" role="status" data-kit-flash><span aria-hidden="true">✓</span> {doneName} {canSubmit || (allReady && !todo.length) ? 'Everything’s ready: confirm your kit below.' : next ? `Next: ${next.name}.` : ''}</p>
      )}
      <p className="wk-count" data-kit-count><strong>{readyCount} of 3 ready</strong>{todo.length ? ` · ${todo.length === 1 ? 'one piece needs' : `${todo.length} pieces need`} you` : ''}</p>
      <WelcomeKitItems items={items} firstSlug={first?.slug ?? null} startHere={next?.id ?? null} justDone={done === 'guide' ? null : done} />

      <section className="wk-confirm" aria-labelledby="wk-confirm-title">
        <h2 id="wk-confirm-title" className="wk-h2">Confirm your Welcome Kit</h2>
        <div className="wk-ship" data-kit-address>
          <p className="wk-ship-label">Mailing to</p>
          {address ? (
            <p className="wk-ship-to">
              {address.paused ? <strong>Printed mailings are paused for this address.</strong> : <>{address.name}, {address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postal_code}</>}
              {' '}<button type="button" className="wk-link" onClick={() => setEditAddress(!editAddress)}>{editAddress ? 'Close' : 'Change'}</button>
            </p>
          ) : <p className="wk-ship-to">No mailing address yet. <button type="button" className="wk-link" onClick={() => setEditAddress(true)}>Add it</button></p>}
          {editAddress && (
            <div className="mt-4 max-w-xl">
              <AddressForm address={address} submitLabel="Save address" onSave={async (a) => {
                setAddress(await saveAddress(a));
                setEditAddress(false);
                setMe(await loadMembership().catch(() => me));
              }} />
            </div>
          )}
        </div>
        <div className="wk-submit">
          <button type="button" className="btn-primary" disabled={!canSubmit || busy} aria-describedby="wk-submit-note" onClick={prepare} data-kit-prepare>
            {busy ? 'Preparing…' : 'Prepare My Welcome Kit'}
          </button>
          <p id="wk-submit-note" className="wk-submit-note" role="status">
            {canSubmit ? 'We print all three together and aim to mail them within two business days.'
              : todo.length ? `First, ${todo.map((i) => (i.id === 'print' ? `approve your ${i.name.replace(/^Your /, '')}` : `review your ${monthWord} Resource`)).join(' and ')}.`
              : kitText(me)}
          </p>
          {!canSubmit && next && <a className="wk-link mt-1 inline-block" href={next.href}>{next.action}: {next.name} <span aria-hidden="true">→</span></a>}
        </div>
        {error && <p role="alert" className="mt-4 border-l-[3px] border-rose bg-rose-wash px-4 py-3 text-warm-ink">{error}</p>}
      </section>
    </div>
  );
}

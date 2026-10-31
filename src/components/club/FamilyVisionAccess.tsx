/**
 * Opens a member's Family Vision welcome print on /club/family-vision: the print (FamilyVisionPrint.astro, the same
 * design as the public preview) starts hidden and shows once the database hands over her welcome order
 * (club_welcome_get). Her choices save to that order about a second after she changes them (club_welcome_save);
 * "Yes! Send me my print" approves it (club_welcome_approve, a second click changes nothing). It's the first half of
 * her Welcome Kit: next she looks over her first month's resource (src/lib/club/onboarding.ts), and both go out in
 * one package. She can change her print until we approve the kit for print; then it's locked.
 *
 * ?fulfillment=<order id> (owner admins, from /admin/club): that household's approved choices, read-only, to
 * print the PDF, through the audited club_admin_fulfillment_bundle.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ClubGate, { type ClubContext } from './ClubGate';
import { approveWelcome, loadAddress, loadMembership, loadWelcome, saveAddress, saveWelcome, type Address, type Membership, type Vision, type WelcomeOrder } from '../../lib/club/membership';
import { firstMonth, kitProgress, kitText, nextStep, stepHref } from '../../lib/club/onboarding';
import { clubResourceBySlug } from '../../data/club/resources';
import AddressForm from './AddressForm';
import KitSteps from './KitSteps';
import { routes } from '../../routes';
import { adminRpc, loadSession as loadAdminSession } from '../../lib/admin/session';

const setVision = (v: Partial<Vision>) => window.dispatchEvent(new CustomEvent('omc:vision-set', { detail: v }));
const lock = (locked: boolean) => window.dispatchEvent(new CustomEvent('omc:vision-lock', { detail: { locked } }));
const reveal = (show: boolean) => {
  const host = document.getElementById('club-vision-content');
  if (host) host.hidden = !show;
};

export default function FamilyVisionAccess() {
  const order = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('fulfillment');
  if (order) return <FulfillmentView order={order} />;
  return <ClubGate page="resource" bare>{(ctx) => <Member ctx={ctx} />}</ClubGate>;
}

/** Messages outside the print (loading, nothing to show yet), in the page's own gutter. */
const Note = ({ children }: { children: ReactNode }) => <div className="mx-auto max-w-5xl px-4 py-8 text-warm-soft sm:px-8">{children}</div>;

function Member({ ctx }: { ctx: ClubContext }) {
  const [w, setW] = useState<WelcomeOrder | null | undefined>(undefined);
  const [me, setMe] = useState<Membership | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [editAddress, setEditAddress] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = useRef<Vision | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = async (v: Vision) => {
    setMsg('Saving…');
    try {
      setW(await saveWelcome(v));
      setMsg('Saved to your account');
    } catch (e) {
      const m = (e as Error).message;
      setMsg(m === 'invalid' ? 'Add your family name to save it.' : m === 'locked' ? 'It’s already approved for printing, so it can’t change now.' : 'Couldn’t save. Check your connection.');
    }
  };

  useEffect(() => {
    reveal(false);
    if (ctx.store.kind === 'sample') {
      ctx.store.household().then((h) => setVision({ family_name: h?.displayName ?? '' }));
      setW(null);
      reveal(true);
      return;
    }
    Promise.all([loadWelcome(), ctx.store.household(), loadMembership(), loadAddress()])
      .then(([order, h, m, a]) => {
        setW(order);
        setMe(m);
        setAddress(a);
        if (!order) return;
        const start = order.personalization ?? { family_name: order.display_name ?? h?.displayName ?? '', value: '' };
        latest.current = { family_name: start.family_name, value: start.value || 'Love' };
        setVision(latest.current);
        lock(!order.editable);
        reveal(true);
      })
      .catch(() => setMsg('We couldn’t load your welcome print. Refresh and try again.'));
    const onChange = (e: Event) => {
      latest.current = (e as CustomEvent<Vision>).detail;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current && save(latest.current), 900);
    };
    window.addEventListener('omc:vision-change', onChange);
    return () => {
      window.removeEventListener('omc:vision-change', onChange);
      clearTimeout(timer.current);
      reveal(false);
    };
  }, []);

  const approve = async () => {
    if (!latest.current) return;
    setBusy(true);
    clearTimeout(timer.current);
    try {
      // Whatever she sees is what gets printed: save it first if it isn't saved yet.
      const saved = w?.personalization;
      if (!saved || saved.family_name !== latest.current.family_name.trim() || saved.value !== latest.current.value) await saveWelcome(latest.current);
      setW(await approveWelcome());
      setMe(await loadMembership());
      setMsg('');
    } catch (e) {
      const m = (e as Error).message;
      if (m === 'incomplete' || m === 'invalid') setMsg('Add your family name and choose a word first.');
      else {
        // Approving twice changes nothing, so a lost answer is checked before saying it failed.
        const now = await loadWelcome().catch(() => null);
        if (now?.approved) {
          setW(now);
          setMe(await loadMembership().catch(() => null));
          setMsg('');
        } else setMsg('Couldn’t approve it. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (w === undefined) return <Note>{msg || 'Getting your welcome print…'}</Note>;
  if (ctx.store.kind === 'sample') return <Note>Sample family: your choices stay in this tab.</Note>;
  if (w === null) {
    return (
      <Note>
        <p className="text-warm-ink">Your welcome print appears here as soon as your membership is confirmed.</p>
        <a className="mt-4 inline-block font-semibold underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>Your account</a>
      </Note>
    );
  }
  const open = w.status === 'pending' || w.status === 'on_hold';
  const approved = !open || w.approved;
  const step = me ? nextStep(me) : 'home';
  const first = me ? firstMonth(me) : null;
  const firstTitle = first ? clubResourceBySlug(first.slug)?.title ?? first.title : null;
  const mailLine = address && (
    <p className="fvp-mail-line">
      {address.paused ? 'Printed mailings are paused.' : <>Mailing to {address.city}, {address.state}.</>}{' '}
      <button type="button" onClick={() => setEditAddress(!editAddress)}>{editAddress ? 'Close' : 'Change'}</button>
    </p>
  );
  const addressForm = editAddress && (
    <div className="mt-4 text-left">
      <AddressForm address={address} submitLabel="Save address" onSave={async (a) => {
        setAddress(await saveAddress(a));
        setEditAddress(false);
        setMe(await loadMembership().catch(() => me));
      }} />
    </div>
  );
  const bar = (
    <div className="fvp-member-flow" data-club-chrome>
      {!approved ? (
        <>
          <button type="button" className="fvp-approve-cta" disabled={busy} onClick={approve}>
            {busy ? 'Saving your print…' : 'Yes! Send me my print'}
          </button>
          <p className="fvp-mail-hint">It comes in your Welcome Kit with your first family resource. Included in your membership.</p>
          <button type="button" className="fvp-edit-after-cta" onClick={() => document.getElementById('fvp-open-editor')?.click()}>✎ Customize artwork</button>
          {mailLine}
          {addressForm}
          <span className="fvp-save-state" role="status" aria-live="polite">{msg}</span>
        </>
      ) : (
        <div className="fvp-approved-state" role="status">
          <span className="fvp-approved-check" aria-hidden="true">✓</span>
          <strong>{open ? 'It’s yours!' : 'Your welcome print'}</strong>
          <p>{open ? 'Your print is approved.' : kitText({ welcome: me?.welcome ?? null })}</p>
          {step === 'first_resource' && first?.slug ? (
            <>
              <p className="fvp-approved-next">Next, a quick look at your {firstTitle ? <span className="font-semibold">{firstTitle}</span> : 'first family resource'}. It’s already prepared for your family, and both arrive together in your Welcome Kit.</p>
              <a className="fvp-next-cta" href={ctx.href(stepHref(me!, 'first_resource'))}>See your first family resource <span aria-hidden="true">→</span></a>
            </>
          ) : (
            <>
              {open && me && <p className="fvp-approved-next">{kitText(me)}</p>}
              <a className="fvp-next-cta" href={routes.appClub}>Go to Club Home <span aria-hidden="true">→</span></a>
            </>
          )}
          {open && <button type="button" className="fvp-edit-after-cta" onClick={() => document.getElementById('fvp-open-editor')?.click()}>Change my print</button>}
          {mailLine}
          {addressForm}
          <span className="fvp-save-state" role="status" aria-live="polite">{msg}</span>
        </div>
      )}
    </div>
  );
  const slot = document.getElementById('fvp-member-actions');
  const progress = document.getElementById('fvp-progress-slot');
  return (
    <>
      {progress && open && createPortal(<KitSteps steps={kitProgress(approved ? 'first_resource' : 'print')} />, progress)}
      {slot ? createPortal(bar, slot) : bar}
    </>
  );
}

interface Bundle {
  order: { id: string; display_name: string | null; email: string; status: string; readiness: string; fulfillment_type: string;
    satisfies_month: string | null; personalization: Vision | null; address: Record<string, string> | null };
}

function FulfillmentView({ order }: { order: string }) {
  const [b, setB] = useState<Bundle | null>(null);
  const [err, setErr] = useState('');
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    const s = loadAdminSession();
    if (!s) return setErr('Sign in to /admin first, then open this print from /admin/club.');
    adminRpc<Bundle>(s, 'club_admin_fulfillment_bundle', { p_order: order }).then((bundle) => {
      if (bundle.order.fulfillment_type !== 'welcome_vision' || !bundle.order.personalization) return setErr('This order isn’t a personalized welcome print yet.');
      setB(bundle);
      setVision(bundle.order.personalization);
      lock(true);
      reveal(true);
    }, (e: Error) => setErr(e.message));
  }, [order]);
  if (err) return <p role="alert" className="p-6">{err}</p>;
  if (!b) return <p className="p-6">Loading the print…</p>;
  const a = b.order.address;
  // In the print's own box, like the member's controls: the desktop layout covers anything outside it.
  const slot = document.getElementById('fvp-member-actions');
  const bar = (
    <div data-club-chrome className="border-b border-[#e8d9b8] bg-[#fdf6e6] px-4 py-3 text-[0.9rem] print:hidden">
      <strong>Welcome print · {b.order.display_name ?? b.order.email}</strong> · {b.order.personalization?.family_name} · {b.order.personalization?.value}
      {b.order.satisfies_month && <> · their {b.order.satisfies_month.slice(0, 7)} resource</>} · status {b.order.status} ({b.order.readiness})
      {a && <> · {a.name}, {a.line1}{a.line2 ? ` ${a.line2}` : ''}, {a.city}, {a.state} {a.postal_code}</>}
      <button type="button" className="ml-3 underline" onClick={() => window.print()}>Print / Save PDF</button>
      <span className="ml-1">, then</span>
      <button type="button" className="ml-2 underline" disabled={marked} onClick={() => {
        const s = loadAdminSession();
        if (s) adminRpc(s, 'club_admin_set_fulfillment', { p_order: order, p_status: null, p_note: null, p_pdf: 'ready' }).then(() => setMarked(true), (e: Error) => setErr(e.message));
      }}>{marked ? 'PDF marked ready ✓' : 'Mark PDF ready'}</button>
    </div>
  );
  return slot ? createPortal(bar, slot) : bar;
}

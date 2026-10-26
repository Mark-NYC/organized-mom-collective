/**
 * Opens a member's Family Vision welcome print on /club/family-vision: the print (FamilyVisionPrint.astro, the same
 * design as the public preview) starts hidden and shows once the database hands over her welcome order
 * (club_welcome_get). Her choices save to that order about a second after she changes them (club_welcome_save);
 * "Looks good, print it" approves it (club_welcome_approve, a second click changes nothing). Once we approve it
 * for print it's locked. It goes to the admin queue as soon as she approves it; it never waits for a monthly cutoff.
 *
 * ?fulfillment=<order id> (owner admins, from /admin/club): that household's approved choices, read-only, to
 * print the PDF, through the audited club_admin_fulfillment_bundle.
 */
import { useEffect, useRef, useState } from 'react';
import ClubGate, { type ClubContext } from './ClubGate';
import { approveWelcome, loadWelcome, monthName, saveWelcome, welcomeText, type Vision, type WelcomeOrder } from '../../lib/club/membership';
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
  return <ClubGate page="resource">{(ctx) => <Member ctx={ctx} />}</ClubGate>;
}

function Member({ ctx }: { ctx: ClubContext }) {
  const [w, setW] = useState<WelcomeOrder | null | undefined>(undefined);
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
    Promise.all([loadWelcome(), ctx.store.household()])
      .then(([order, h]) => {
        setW(order);
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
      setMsg('');
    } catch (e) {
      setMsg((e as Error).message === 'incomplete' || (e as Error).message === 'invalid' ? 'Add your family name and choose a word first.' : 'Couldn’t approve it. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  if (w === undefined) return <p className="py-6 text-warm-soft">{msg || 'Getting your welcome print…'}</p>;
  if (ctx.store.kind === 'sample') return <p className="pb-3 text-[0.92rem] text-warm-soft">Sample family: your choices stay in this tab.</p>;
  if (w === null) {
    return (
      <div className="max-w-xl py-6">
        <p className="text-warm-ink">Your welcome print appears here as soon as your membership payment goes through.</p>
        <a className="mt-4 inline-block font-semibold underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>Your account</a>
      </div>
    );
  }
  const month = w.satisfies_month ? monthName(w.satisfies_month).split(' ')[0] : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 text-[0.92rem]" data-club-chrome>
      <div>
        <a className="underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>← Your account</a>
        <p className="mt-1 font-semibold text-warm-ink">Your welcome print · {welcomeText(w)}</p>
        {month && <p className="mt-1 max-w-xl text-warm-soft">You joined in {month}: this print is your {month} resource.</p>}
      </div>
      <span className="text-warm-soft" role="status">{msg}</span>
      {w.editable && w.status === 'pending' && (
        w.approved
          ? <span className="font-semibold text-warm-ink">Approved for printing ✓</span>
          : <button type="button" className="btn-primary" disabled={busy} onClick={approve}>{busy ? 'Approving…' : 'Looks good, print it'}</button>
      )}
    </div>
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
  return (
    <div data-club-chrome className="border-b border-[#e8d9b8] bg-[#fdf6e6] px-4 py-3 text-[0.9rem] print:hidden">
      <strong>Welcome print · {b.order.display_name ?? b.order.email}</strong> · {b.order.personalization?.family_name} · {b.order.personalization?.value}
      {b.order.satisfies_month && <> · their {b.order.satisfies_month.slice(0, 7)} resource</>} · status {b.order.status} ({b.order.readiness})
      {a && <> · {a.name}, {a.line1}{a.line2 ? ` ${a.line2}` : ''}, {a.city}, {a.state} {a.postal_code}</>}
      <span className="ml-3">“Print / Save PDF” below, then</span>
      <button type="button" className="ml-2 underline" disabled={marked} onClick={() => {
        const s = loadAdminSession();
        if (s) adminRpc(s, 'club_admin_set_fulfillment', { p_order: order, p_status: null, p_note: null, p_pdf: 'ready' }).then(() => setMarked(true), (e: Error) => setErr(e.message));
      }}>{marked ? 'PDF marked ready ✓' : 'Mark PDF ready'}</button>
    </div>
  );
}

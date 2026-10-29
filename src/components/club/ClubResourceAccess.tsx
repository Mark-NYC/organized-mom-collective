/**
 * Opens a member's month on /club/resources/<slug>: the month's printable (the same component as its public sample
 * preview) starts hidden; it shows only after the database says she may open it (club_resource_get) and hands it her
 * household. Her edits are mirrored to club_resource_versions (bridgeResourceState), so the printed mailing and her
 * other devices get the same version. While her mailing is waiting she can approve it for printing.
 *
 * ?fulfillment=<order id> (owner admins, from /admin/club): the same page with that one household's profile and
 * saved version, through the audited club_admin_fulfillment_bundle, to print the mailing's PDF.
 */
import { useEffect, useRef, useState } from 'react';
import ClubGate, { type ClubContext } from './ClubGate';
import type { Household } from '../../lib/club/profile';
import { fromDb } from '../../lib/club/store';
import { approveResource, bridgeResourceState, loadResource, saveResource, type ResourceVersion } from '../../lib/club/membership';
import { MEMBER_STORAGE_PREFIX } from '../../data/club/resources';
import { routes } from '../../routes';
import { adminRpc, loadSession as loadAdminSession } from '../../lib/admin/session';

const show = (household: Household, sample: string | null) => {
  window.dispatchEvent(new CustomEvent('omc:club-preview-household', { detail: { household, sample } }));
  const host = document.getElementById('club-month-content');
  if (host) host.hidden = false;
};

/** Another household's copy (a shared device, the admin printing one family after another) never leaks into this one. */
function clearMemberStorage() {
  for (const store of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      for (const k of Object.keys(store)) if (k.startsWith(MEMBER_STORAGE_PREFIX)) store.removeItem(k);
    } catch {
      /* storage blocked */
    }
  }
}

export default function ClubResourceAccess({ slug }: { slug: string }) {
  const order = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('fulfillment');
  if (order) return <FulfillmentView slug={slug} order={order} />;
  return <ClubGate page="resource">{(ctx) => <Member ctx={ctx} slug={slug} />}</ClubGate>;
}

function Member({ ctx, slug }: { ctx: ClubContext; slug: string }) {
  const [state, setState] = useState<'loading' | 'denied' | 'ready' | 'failed'>('loading');
  const [v, setV] = useState<ResourceVersion | null>(null);
  const [saving, setSaving] = useState<'' | 'saving' | 'saved' | 'conflict' | 'printed' | 'error'>('');
  const [approved, setApproved] = useState(false);
  const rev = useRef(0);

  useEffect(() => {
    let undo = () => {};
    const host = document.getElementById('club-month-content');
    if (host) host.hidden = true;
    if (ctx.store.kind === 'sample') {
      ctx.store.household().then((h) => {
        if (!h) return setState('denied');
        show(h, ctx.sample);
        setState('ready');
      });
      return;
    }
    Promise.all([loadResource(slug), ctx.store.household()])
      .then(([res, h]) => {
        if (!h) return clubNavToWelcome(ctx);
        setV(res);
        setApproved(Boolean(res.mailing?.approved));
        rev.current = res.revision;
        clearMemberStorage();
        if (res.can === 'edit') {
          undo = bridgeResourceState({
            saved: res.state,
            onChange: async (next) => {
              setSaving('saving');
              try {
                rev.current = await saveResource(slug, next, rev.current);
                setApproved(false);
                setSaving('saved');
              } catch (e) {
                const m = (e as Error).message;
                setSaving(m === 'conflict' ? 'conflict' : m === 'already_printed' ? 'printed' : 'error');
              }
            },
          });
        } else {
          for (const [k, { s, v: val }] of Object.entries(res.state)) {
            try { (s === 'l' ? localStorage : sessionStorage).setItem(k, val); } catch { /* fine */ }
          }
        }
        show(h, null);
        setState('ready');
      })
      .catch((e: Error) => setState(e.message === 'not_found' ? 'denied' : 'failed'));
    return () => {
      undo();
      if (host) host.hidden = true;
    };
  }, [slug]);

  if (state === 'loading') return <p className="py-6 text-warm-soft">Preparing this month for your family…</p>;
  if (state === 'denied') {
    return (
      <div className="max-w-xl py-6">
        <p role="alert" className="text-warm-ink">This month isn’t part of your membership.</p>
        <p className="mt-2 text-warm-soft">Monthly members receive each month they pay for; annual members get their year’s collection.</p>
        <a className="mt-4 inline-block font-semibold underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>See your months</a>
      </div>
    );
  }
  if (state === 'failed') return <p role="alert" className="py-6">We couldn’t load this month. Refresh and try again.</p>;

  const pending = v?.mailing && v.mailing.status === 'pending';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 text-[0.92rem]" data-club-chrome>
      <a className="underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>← Your months</a>
      <span className="text-warm-soft" role="status">
        {v?.can === 'read' ? 'Your copy to view and print (your membership has ended, so changes aren’t saved).'
          : saving === 'saving' ? 'Saving…'
          : saving === 'saved' ? 'Saved to your account'
          : saving === 'conflict' ? 'Changed on another device. Reload to see the latest.'
          : saving === 'printed' ? 'This month is already printed. New changes won’t be in the mail.'
          : saving === 'error' ? 'Couldn’t save. Check your connection.'
          : ctx.store.kind === 'sample' ? 'Sample family: changes stay in this tab.' : 'Changes save to your account.'}
      </span>
      {pending && v?.can === 'edit' && (
        approved
          ? <span className="font-semibold text-warm-ink">Approved for printing ✓</span>
          : <button type="button" className="btn-primary" onClick={() => approveResource(slug).then((ok) => setApproved(ok), () => setSaving('error'))}>Looks good, print it</button>
      )}
    </div>
  );
}

function clubNavToWelcome(ctx: ClubContext) {
  location.replace(ctx.href(routes.clubWelcome));
}

interface Bundle {
  order: { id: string; display_name: string | null; email: string; resource_month: string; readiness: string; status: string; address: Record<string, string> | null; pdf_status: string };
  household: Parameters<typeof fromDb>[0];
  state: Record<string, { s: 'l' | 's'; v: string }> | null;
}

function FulfillmentView({ slug, order }: { slug: string; order: string }) {
  const [b, setB] = useState<Bundle | null>(null);
  const [err, setErr] = useState('');
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    const s = loadAdminSession();
    if (!s) return setErr('Sign in to /admin first, then open this mailing from /admin/club.');
    adminRpc<Bundle>(s, 'club_admin_fulfillment_bundle', { p_order: order }).then((bundle) => {
      clearMemberStorage();
      for (const [k, { s: kind, v }] of Object.entries(bundle.state ?? {})) {
        try { (kind === 'l' ? localStorage : sessionStorage).setItem(k, v); } catch { /* fine */ }
      }
      setB(bundle);
      show(fromDb(bundle.household), null);
    }, (e: Error) => setErr(e.message));
  }, [order]);
  if (err) return <p role="alert" className="p-6">{err}</p>;
  if (!b) return <p className="p-6">Loading the mailing…</p>;
  const a = b.order.address;
  return (
    <div data-club-chrome className="border-b border-[#e8d9b8] bg-[#fdf6e6] px-4 py-3 text-[0.9rem] print:hidden">
      <strong>Fulfillment · {b.order.display_name ?? b.order.email}</strong> · {b.order.resource_month.slice(0, 7)} · {slug} · status {b.order.status} ({b.order.readiness})
      {a && <> · {a.name}, {a.line1}{a.line2 ? ` ${a.line2}` : ''}, {a.city}, {a.state} {a.postal_code}</>}
      <span className="ml-3">Print → Save as PDF, then</span>
      <button type="button" className="ml-2 underline" disabled={marked} onClick={() => {
        const s = loadAdminSession();
        if (s) adminRpc(s, 'club_admin_set_fulfillment', { p_order: order, p_status: null, p_note: null, p_pdf: 'ready' }).then(() => setMarked(true), (e: Error) => setErr(e.message));
      }}>{marked ? 'PDF marked ready ✓' : 'Mark PDF ready'}</button>
    </div>
  );
}

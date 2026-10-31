/**
 * Opens a member's month on /club/resources/<slug>: the month's printable (the same component as its public sample
 * preview) starts hidden; it shows only after the database says she may open it (club_resource_get) and hands it her
 * household. Her edits are mirrored to club_resource_versions (bridgeResourceState), so the printed mailing and her
 * other devices get the same version. While her mailing is waiting she can approve it for printing.
 *
 * ?fulfillment=<order id> (owner admins, from /admin/club): the same page with that one household's profile and
 * saved version, through the audited club_admin_fulfillment_bundle, to print the mailing's PDF.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import ClubGate, { type ClubContext } from './ClubGate';
import type { Household } from '../../lib/club/profile';
import { fromDb } from '../../lib/club/store';
import { approveResource, bridgeResourceState, loadMembership, loadResource, monthName, saveResource, type Membership, type ResourceVersion } from '../../lib/club/membership';
import { firstMonth, kitProgress, welcomeKitView } from '../../lib/club/onboarding';
import { memberPlanHref } from '../../lib/club/plan/account';
import KitSteps from './KitSteps';
import { clubResourceBySlug, MEMBER_STORAGE_PREFIX } from '../../data/club/resources';
import { routes } from '../../routes';
import { adminRpc, loadSession as loadAdminSession } from '../../lib/admin/session';

const show = (household: Household, sample: string | null) => {
  window.dispatchEvent(new CustomEvent('omc:club-preview-household', { detail: { household, sample } }));
  const host = document.getElementById('club-month-content');
  if (host) host.hidden = false;
};

/**
 * On desktop each printable fills the screen below a bar (position: fixed, top: --adc-nav-height or
 * --msc-nav-height, which ClubPrototypeNav sets on the preview pages). Here that bar is hers (or the admin's), so set
 * them from it; otherwise the printable covers her "Looks good, print it".
 */
function useLayoutBelow(bar: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const sync = () => {
      const bottom = `${Math.ceil(el.getBoundingClientRect().bottom)}px`;
      document.documentElement.style.setProperty('--adc-nav-height', bottom);
      document.documentElement.style.setProperty('--msc-nav-height', bottom);
    };
    sync();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    observer?.observe(el);
    window.addEventListener('resize', sync);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', sync);
    };
  });
}

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
  const [state, setState] = useState<'loading' | 'denied' | 'preparing' | 'ready' | 'failed'>('loading');
  const [v, setV] = useState<ResourceVersion | null>(null);
  const [saving, setSaving] = useState<'' | 'saving' | 'saved' | 'conflict' | 'printed' | 'error'>('');
  const [approved, setApproved] = useState(false);
  const [me, setMe] = useState<Membership | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [confirming, setConfirming] = useState(false);
  const rev = useRef(0);
  const bar = useRef<HTMLDivElement>(null);
  useLayoutBelow(bar);

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
    Promise.all([loadResource(slug), ctx.store.household(), loadMembership().catch(() => null)])
      .then(([res, h, m]) => {
        if (!h) return clubNavToWelcome(ctx);
        // Her Welcome Kit's first resource is looked over and confirmed on its real tool (/app/club/<month>).
        const tool = memberPlanHref(slug);
        if (m && tool !== routes.clubResource(slug) && welcomeKitView(m, slug) !== 'none') return location.replace(`${tool}?welcome=1`);
        setMe(m);
        setHousehold(h);
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
                // A change asks her to confirm her Welcome Kit's first resource again.
                setMe(await loadMembership().catch(() => null));
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
      .catch(async (e: Error) => {
        if (e.message !== 'not_found') return setState('failed');
        // Hers, but not published yet: say so, never "not part of your membership".
        const m = await loadMembership().catch(() => null);
        setMe(m);
        setState(m?.months.some((x) => x.slug === slug && x.state === 'preparing') ? 'preparing' : 'denied');
      });
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
        <p className="mt-2 text-warm-soft">Members receive each month they pay for.</p>
        <a className="mt-4 inline-block font-semibold underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>See your months</a>
      </div>
    );
  }
  if (state === 'preparing') {
    const r = clubResourceBySlug(slug);
    return (
      <div className="max-w-xl py-6">
        <p className="text-warm-ink"><strong>{r?.title ?? 'This month'}</strong> is yours. We’re finishing it; it opens here as soon as it’s ready.</p>
        {r && <a className="mt-3 inline-block underline underline-offset-4" href={r.preview}>See a sample of what’s coming</a>}
        <a className="mt-4 block font-semibold underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>See your months</a>
      </div>
    );
  }
  if (state === 'failed') return <p role="alert" className="py-6">We couldn’t load this month. Refresh and try again.</p>;

  const pending = v?.mailing && v.mailing.status === 'pending';
  // Her Welcome Kit carries this month: one confirmation for the package instead of the monthly "Looks good, print it".
  const kit = me?.welcome && ['pending', 'on_hold'].includes(me.welcome.status) && firstMonth(me)?.slug === slug && v?.can === 'edit' ? me.welcome : null;
  const confirm = async () => {
    setConfirming(true);
    try {
      await approveResource(slug);
      setMe(await loadMembership());
    } catch {
      setSaving('error');
    } finally {
      setConfirming(false);
    }
  };
  const r = clubResourceBySlug(slug);
  const kids = (household?.members ?? []).filter((x) => x.kind === 'child' && !x.archived).map((x) => x.firstName);
  const forKids = kids.length ? ` for ${kids.length > 1 ? `${kids.slice(0, -1).join(', ')} and ${kids.at(-1)}` : kids[0]}` : '';
  return (
    <div ref={bar} className="pb-3 text-[0.92rem]" data-club-chrome>
      {kit && (
        <section aria-labelledby="kit-first" className="kit-first">
          {kit.readiness === 'needs_confirmation' ? (
            // On a phone the printable's own toolbar covers the bottom of the screen: the button comes before the details there.
            <div className="flex flex-col">
              <KitSteps steps={kitProgress('first_resource')} />
              <p className="label text-warm-soft">Your first family resource · {monthName(`${r?.month ?? ''}-01`)}</p>
              <h1 id="kit-first" className="mt-1 font-serif text-[1.7rem] leading-tight text-warm-ink sm:text-[2rem]">{r?.title ?? 'Your first resource'}</h1>
              {r && <p className="mt-1 font-serif text-[1.1rem] italic text-warm-soft">{r.problem}. Already prepared{forKids}.</p>}
              <dl className="kit-first-facts max-sm:order-last">
                <div><dt>In your Welcome Kit</dt><dd>Your printed {r?.title ?? 'resource'}, mailed together with your Family Vision print in one package.</dd></div>
                {r?.welcome && <div><dt>How it helps</dt><dd>{r.welcome.helps}</dd></div>}
                <div><dt>Your first step</dt><dd>{r?.welcome?.firstStep ?? 'Look it over with the kids this week and pick one thing to start with.'}</dd></div>
              </dl>
              <p className="mt-3 text-warm-soft">Everything below is filled in with your family’s names. Change anything that doesn’t fit; it saves as you go.</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <button type="button" className="btn-primary" disabled={confirming} onClick={confirm}>{confirming ? 'Saving…' : 'Looks good. Prepare my Welcome Kit'}</button>
                <a className="underline underline-offset-4" href={ctx.href(routes.clubFamilyVision)}>Back to my print</a>
              </div>
            </div>
          ) : kit.readiness === 'needs_vision' ? (
            <p className="text-warm-ink">This comes in your Welcome Kit with your Family Vision print. <a className="font-semibold underline underline-offset-4" href={ctx.href(routes.clubFamilyVision)}>Approve your print first</a></p>
          ) : (
            <div role="status">
              <h1 id="kit-first" className="font-serif text-[1.7rem] leading-tight text-warm-ink sm:text-[2rem]"><span aria-hidden="true">✓ </span>It’s all set!</h1>
              <p className="mt-2 max-w-2xl text-warm-ink">Your Welcome Kit is being prepared: your Family Vision print and your {r?.title ?? 'first resource'}, printed together and mailed to you in one package. You’ll see when it ships in your account.</p>
              <a className="btn-primary mt-4" href={routes.appClub}>Go to Club Home</a>
            </div>
          )}
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      {pending && v?.can === 'edit' && !kit && (
        approved
          ? <span className="font-semibold text-warm-ink">Approved for printing ✓</span>
          : <button type="button" className="btn-primary" onClick={() => approveResource(slug).then((ok) => setApproved(ok), () => setSaving('error'))}>Looks good, print it</button>
      )}
      </div>
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
  const bar = useRef<HTMLDivElement>(null);
  useLayoutBelow(bar);
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
    <div ref={bar} data-club-chrome className="border-b border-[#e8d9b8] bg-[#fdf6e6] px-4 py-3 text-[0.9rem] print:hidden">
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

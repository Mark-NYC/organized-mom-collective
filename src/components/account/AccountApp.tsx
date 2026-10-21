import { useEffect, useState } from 'react';

type Submit = { preventDefault(): void };
import {
  accountDownload,
  accountsEnabled,
  deleteAccount,
  getSession,
  labelFromKey,
  listSaves,
  loadOrders,
  loadProfile,
  removeSave,
  requestCode,
  safeNext,
  setMarketing,
  signOut,
  sync,
  verifyCode,
  type AccountOrder,
  type AccountProfile,
  type AccountSession,
  type ServerSave,
} from '../../lib/account';
import { money } from '../../lib/shop';
import { weeklyReset } from '../../data/weekly-reset';
import { WEB_TOOLS } from '../shop/DownloadFiles';
import { routes } from '../../routes';

/**
 * /account: sign in with an emailed 6-digit code, then everything she saved and everything she bought.
 * Rules and setup: supabase/ACCOUNTS.md. Data access: src/lib/account.ts.
 */
export default function AccountApp() {
  const [session, setSession] = useState<AccountSession | null | undefined>(undefined);

  useEffect(() => {
    if (!accountsEnabled()) return setSession(null);
    getSession().then(setSession);
  }, []);

  if (!accountsEnabled()) {
    return (
      <div className="py-6">
        <h1 className="page-title">Your Account</h1>
        <p className="lede mt-4">Accounts aren’t switched on yet. Your tools still save in this browser, and your download links are in your order emails.</p>
      </div>
    );
  }
  if (session === undefined) return <p className="py-10 text-center text-soft">Loading…</p>;
  if (!session) return <SignIn onSignedIn={setSession} />;
  return <Dashboard session={session} onSignedOut={() => setSession(null)} />;
}

// ------------------------------------------------------------------ sign in

function SignIn({ onSignedIn }: { onSignedIn: (s: AccountSession) => void }) {
  const [email, setEmail] = useState('');
  const [marketing, setMarketingChoice] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const send = async (e?: Submit) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    const r = await requestCode(email);
    setBusy(false);
    if (r === 'sent') {
      setStep('code');
      setResendIn(60);
    } else {
      setError(r === 'invalid' ? 'Check the email address and try again.' : r === 'rate_limited' ? 'Too many codes asked for. Wait a few minutes, then try again.' : 'We couldn’t send a code just now. Please try again in a minute.');
    }
  };

  const verify = async (e: Submit) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await verifyCode(email, code);
    if (!r.ok) {
      setBusy(false);
      setError(r.error === 'wrong_code' ? 'That code didn’t work. Check the newest email, or send a new code.' : r.error === 'rate_limited' ? 'Too many tries. Wait a few minutes, then try again.' : 'Something went wrong. Please try again.');
      return;
    }
    if (marketing) await setMarketing(true).catch(() => undefined);
    // Everything she made in this browser goes into her account now.
    await sync().catch(() => undefined);
    const next = safeNext(new URLSearchParams(location.search).get('next'));
    if (next) {
      location.assign(next);
      return;
    }
    onSignedIn(r.session);
  };

  return (
    <div className="py-6">
      <h1 className="page-title">Your Account</h1>
      <p className="lede mt-4">Keep your charts, plans and lists on every device, and find everything you’ve bought in one place. No password: we email you a 6-digit code.</p>

      {step === 'email' ? (
        <form onSubmit={send} className="mt-8 max-w-md" noValidate>
          <label htmlFor="acct-email" className="label text-soft">
            Email
          </label>
          <input
            id="acct-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 block min-h-12 w-full rounded-[4px] border border-rule-strong px-3 text-[1rem]"
          />
          <label className="mt-5 flex items-start gap-3 text-[0.95rem] leading-snug">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketingChoice(e.target.checked)} className="mt-1 h-4 w-4 flex-none accent-[var(--color-ink)]" />
            <span>Also send me occasional ideas and offers from Organized Mom Collective. Unsubscribe anytime.</span>
          </label>
          <button type="submit" disabled={busy} className="btn-primary mt-6 w-full sm:w-auto">
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
          <p className="mt-4 text-[0.88rem] leading-relaxed text-soft">
            Signing in only lets us save your things and show your orders. We never sell your email.
          </p>
          {error && (
            <p role="alert" className="mt-4 border-l-[3px] border-month bg-band px-4 py-3">
              {error}
            </p>
          )}
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 max-w-md">
          <p className="leading-relaxed">
            We sent a 6-digit code to <strong>{email.trim().toLowerCase()}</strong>. It can take a minute; check spam if it’s not there.
          </p>
          <label htmlFor="acct-code" className="label mt-6 block text-soft">
            Code
          </label>
          <input
            id="acct-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-2 block min-h-12 w-full max-w-[12rem] rounded-[4px] border border-rule-strong px-3 text-[1.3rem] tracking-[0.3em]"
            autoFocus
          />
          <button type="submit" disabled={busy || code.replace(/\D/g, '').length < 6} className="btn-primary mt-6 w-full sm:w-auto">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.9rem]">
            <button type="button" className="underline underline-offset-4 disabled:no-underline disabled:text-soft" disabled={resendIn > 0 || busy} onClick={() => send()}>
              {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
            </button>
            <button type="button" className="underline underline-offset-4" onClick={() => { setStep('email'); setCode(''); setError(''); }}>
              Use a different email
            </button>
          </p>
          {error && (
            <p role="alert" className="mt-4 border-l-[3px] border-month bg-band px-4 py-3">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ signed in

function Dashboard({ session, onSignedOut }: { session: AccountSession; onSignedOut: () => void }) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [saves, setSaves] = useState<ServerSave[] | null>(null);
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    try {
      await sync().catch(() => undefined);
      const [p, s, o] = await Promise.all([loadProfile(), listSaves(), loadOrders()]);
      setProfile(p);
      setSaves(s);
      setOrders(o);
    } catch (err) {
      if ((err as Error).message === 'signed_out') onSignedOut();
      else setFailed(true);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="py-6">
      <p className="label text-soft">Signed in as {profile?.email ?? session.email}</p>
      <h1 className="page-title mt-3">Your Account</h1>
      {failed && (
        <p role="alert" className="mt-6 border-l-[3px] border-month bg-band px-4 py-3">
          We couldn’t load everything just now. Please reload the page in a minute.
        </p>
      )}

      <Saved saves={saves} onRemoved={(key) => setSaves((all) => all?.filter((s) => s.key !== key) ?? null)} />
      <Purchases orders={orders} email={profile?.email ?? session.email} />

      <section aria-labelledby="acct-email-h" className="mt-14">
        <h2 id="acct-email-h" className="acct-h2">
          Email
        </h2>
        {profile && (
          <label className="mt-4 flex items-start gap-3 leading-snug">
            <input
              type="checkbox"
              checked={profile.marketing}
              onChange={async (e) => {
                const on = e.target.checked;
                setProfile({ ...profile, marketing: on });
                await setMarketing(on).catch(() => setProfile({ ...profile }));
              }}
              className="mt-1 h-4 w-4 flex-none accent-[var(--color-ink)]"
            />
            <span>Send me occasional ideas and offers. Order emails and sign-in codes come either way.</span>
          </label>
        )}
      </section>

      <section aria-labelledby="acct-manage-h" className="mt-14 border-t border-rule pt-8">
        <h2 id="acct-manage-h" className="sr-only">
          Manage your account
        </h2>
        <p className="text-[0.95rem] leading-relaxed text-soft">
          The cleaning companion still saves on this device for now. Your account doesn’t hold its daily progress yet.
        </p>
        <p className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await signOut();
              onSignedOut();
            }}
          >
            Sign out
          </button>
          <DeleteAccount onDeleted={onSignedOut} />
        </p>
      </section>
    </div>
  );
}

function Saved({ saves, onRemoved }: { saves: ServerSave[] | null; onRemoved: (key: string) => void }) {
  return (
    <section aria-labelledby="acct-saved-h" className="mt-10">
      <h2 id="acct-saved-h" className="acct-h2">
        Saved
      </h2>
      {!saves ? (
        <p className="mt-4 text-soft">Loading…</p>
      ) : saves.length === 0 ? (
        <p className="mt-4 leading-relaxed">
          Nothing saved yet. Make a <a className="underline underline-offset-4" href={routes.choreChart}>chore chart</a>, a <a className="underline underline-offset-4" href={routes.planner}>weekly plan</a> or a list in any article, and it saves here on its own.
        </p>
      ) : (
        <ul className="mt-4 border-t border-rule">
          {saves.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-4">
              <span className="min-w-0">
                <span className="block font-semibold">{s.label || labelFromKey(s.key)}</span>
                <span className="block text-[0.85rem] text-soft">Saved {new Date(s.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </span>
              <span className="flex items-center gap-4">
                {s.page && (
                  <a href={s.page} className="btn-primary min-h-11 px-5">
                    Open
                  </a>
                )}
                <button
                  type="button"
                  className="text-[0.85rem] text-soft underline underline-offset-4"
                  onClick={async () => {
                    if (!confirm('Remove this from your account? It stays in this browser.')) return;
                    await removeSave(s.key).then(() => onRemoved(s.key)).catch(() => alert('We couldn’t remove it just now. Please try again.'));
                  }}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS: Record<AccountOrder['fulfillment_status'], string> = {
  unfulfilled: 'Being prepared',
  packing: 'Being packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  canceled: 'Canceled',
};

function Purchases({ orders, email }: { orders: AccountOrder[] | null; email: string }) {
  return (
    <section aria-labelledby="acct-orders-h" className="mt-14">
      <h2 id="acct-orders-h" className="acct-h2">
        Purchases
      </h2>
      {!orders ? (
        <p className="mt-4 text-soft">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-4 leading-relaxed">
          No website orders for {email} yet. Bought with a different email? Sign in with that one. Etsy orders stay in your Etsy account.
        </p>
      ) : (
        <ul className="mt-4 border-t border-rule">
          {orders.map((o) => (
            <Order key={o.id} order={o} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Order({ order: o }: { order: AccountOrder }) {
  const [files, setFiles] = useState<{ label: string; url: string | null }[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const date = o.paid_at ? new Date(o.paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  // Website tools that come with a product (the upgraded planner, the routine builder): links, not files.
  const tools = o.payment_status === 'refunded' ? [] : [...new Map(o.items.flatMap((i) => WEB_TOOLS[i.slug] ?? []).map((t) => [t.href, t])).values()];
  const status = o.payment_status === 'refunded' ? 'Refunded' : o.digital ? (o.payment_status === 'partially_refunded' ? 'Partly refunded' : 'Download') : STATUS[o.fulfillment_status];

  return (
    <li className="border-b border-rule py-5">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-semibold">
          Order #{o.order_number}
          {o.test && <span className="ml-2 text-[0.8rem] font-normal text-soft">(test)</span>}
        </span>
        <span className="text-[0.9rem] text-soft">
          {date}
          {o.total_cents != null && ` · ${money(o.total_cents)}`}
        </span>
      </p>
      <p className="mt-1 leading-snug">{o.items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name)).join(', ')}</p>
      <p className="mt-1 text-[0.9rem] text-soft">
        {status}
        {o.tracking_url && !o.digital && (
          <>
            {' · '}
            <a href={o.tracking_url} className="underline underline-offset-4" rel="noopener noreferrer" target="_blank">
              Track it{o.carrier ? ` (${o.carrier})` : ''}
            </a>
          </>
        )}
      </p>
      {o.files &&
        (files ? (
          <ul className="mt-3 space-y-2">
            {files.map((f) => (
              <li key={f.label} className="flex flex-wrap items-center justify-between gap-3">
                <span>{f.label}</span>
                {f.url ? (
                  <a href={f.url} className="btn-primary min-h-11 px-5" download>
                    Download
                  </a>
                ) : (
                  <span className="text-[0.85rem] text-soft">Not available right now</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="btn-secondary mt-3"
            onClick={async () => {
              setBusy(true);
              setError('');
              const r = await accountDownload(o.id);
              setBusy(false);
              if ('files' in r) setFiles(r.files);
              else setError(r.error === 'rate_limited' ? 'Too many downloads in a short time. Try again in a few minutes.' : `We couldn’t get your files just now. Write to ${weeklyReset.contactEmail} and we’ll send them.`);
            }}
          >
            {busy ? 'Getting your files…' : 'Get your files'}
          </button>
        ))}
      {error && <p className="mt-2 text-[0.9rem]" role="alert">{error}</p>}
      {tools.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
          {tools.map((t) => (
            <a key={t.href} href={t.href} className="font-semibold underline underline-offset-4">
              {t.label}
            </a>
          ))}
        </p>
      )}
    </li>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="inline-flex min-h-11 items-center px-2 text-[0.85rem] text-soft underline underline-offset-4"
      onClick={async () => {
        if (!confirm('Delete your account? Your saved things are removed from your account and you’re unsubscribed from marketing email. What’s in this browser stays, and your order records stay for our books.')) return;
        setBusy(true);
        try {
          await deleteAccount();
          onDeleted();
        } catch (err) {
          setBusy(false);
          alert((err as Error).message.includes('admin_account') ? 'This is an admin account. Remove it from the dashboard instead.' : 'We couldn’t delete your account just now. Please try again, or write to us.');
        }
      }}
    >
      Delete my account
    </button>
  );
}

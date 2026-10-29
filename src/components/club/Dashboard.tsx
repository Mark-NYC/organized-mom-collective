/**
 * /club/dashboard: her family, her plan and billing status, her Family Vision welcome print (personalize, approve,
 * its status), this month's resource, only the months she has bought (a first December shows the welcome print as
 * that month's resource), each month's printed mailing status, the next month and the payment that brings it,
 * family and address editing, billing and email. Everything comes from club_me (the database decides access); the
 * resource pages check again on their own.
 */
import { useEffect, useState } from 'react';
import { getSession } from '../../lib/account';
import type { Household } from '../../lib/club/profile';
import {
  changeEmail,
  loadAddress,
  loadMembership,
  mailingText,
  monthName,
  welcomeText,
  openPortal,
  saveAddress,
  shortDate,
  syncEmail,
  billingErrorText,
  type Address,
  type Membership,
  type MembershipMonth,
} from '../../lib/club/membership';
import { clubResourceBySlug, clubResources } from '../../data/club/resources';
import { routes } from '../../routes';
import ClubGate, { type ClubContext } from './ClubGate';
import AddressForm from './AddressForm';
import { clubNav } from '../../lib/club/nav';

export default function DashboardPage() {
  return <ClubGate page="dashboard">{(ctx) => <Dashboard ctx={ctx} />}</ClubGate>;
}

/** A made-up annual membership for sample households: every month open, nothing billed. */
function sampleMembership(): Membership {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    access: true, grant: 'preview', member: true, plan: 'annual', status: 'active', payment_problem: false, renews: null, ends: null,
    ended_at: null, revoked: false, onboarded: true, has_address: true, enrolled_at: null, first_paid_month: `${clubResources[0].month}-01`,
    current_month: cur, membership_year: 1, welcome: null, next: null,
    months: clubResources.map((r) => ({ month: `${r.month}-01`, slug: r.slug, title: r.title, published: true, can: 'edit', state: 'available', membership_year: 1, plan: 'annual', fulfilled_by: 'monthly_resource', mailing: null })),
  };
}

function Dashboard({ ctx }: { ctx: ClubContext }) {
  const [me, setMe] = useState<Membership | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sample = ctx.store.kind === 'sample';
    Promise.all([sample ? Promise.resolve(sampleMembership()) : loadMembership(), ctx.store.household(), sample ? null : getSession()])
      .then(([m, h, s]) => {
        if (!sample && m.member && !m.onboarded) return clubNav().go(ctx.href(routes.clubWelcome), { replace: true });
        if (!h && sample) return clubNav().go(ctx.href(routes.clubStart), { replace: true });
        setMe(m);
        setHousehold(h);
        setEmail(s?.email ?? '');
        // After she changes her sign-in email, Stripe's receipts follow it.
        if (!sample && m.member) syncEmail().catch(() => undefined);
      })
      .catch(() => setError('We couldn’t load your account. Check your connection and reload the page.'));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!me) return <p className="text-warm-soft">Loading…</p>;

  const you = household?.members.find((m) => m.isAccountHolder && !m.archived) ?? household?.members.find((m) => !m.archived);
  const mine = me.months;
  const current = mine.find((m) => m.month === me.current_month && m.state === 'available') ?? [...mine].reverse().find((m) => m.state === 'available' && m.month <= me.current_month) ?? mine.find((m) => m.state === 'available');
  const years = [...new Set(mine.map((m) => m.membership_year ?? 1))].sort();

  if (!me.member && !me.grant) {
    return (
      <div className="max-w-xl">
        <h1 className="font-serif text-[2rem] leading-tight">No membership on this account yet</h1>
        <p className="mt-3 leading-relaxed text-warm-soft">Signed in as {email}. If you joined with another email, sign out and use that one.</p>
        <a className="btn-primary mt-6 inline-block" href={routes.clubJoin}>See the plans</a>
      </div>
    );
  }

  return (
    <>
      <p className="label text-warm-soft">{household?.displayName ?? 'Your family'}</p>
      <h1 className="mt-2 font-serif text-[2.1rem] leading-[1.1] text-warm-ink sm:text-[2.6rem]">{you ? `Hi, ${you.firstName}.` : 'Your family club'}</h1>
      <Status me={me} sample={ctx.store.kind === 'sample'} />

      {!me.has_address && ctx.store.kind === 'account' && (
        <p className="mt-5 max-w-2xl border-l-[3px] border-rose bg-rose-wash px-4 py-3">Add your mailing address below so we can mail your printed resources.</p>
      )}

      {me.welcome && <WelcomeCard w={me.welcome} href={ctx.href(routes.clubFamilyVision)} />}

      {current && <CurrentCard m={current} href={ctx.href(routes.clubResource(current.slug!))} />}

      {years.map((y) => (
        <section key={y} className="mt-12">
          <h2 className="label text-warm-soft">{me.plan === 'annual' || years.length > 1 ? `Your resources · Year ${y}` : 'Your resources'}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {mine.filter((m) => (m.membership_year ?? 1) === y).map((m) => (
              m.state === 'welcome_vision'
                ? <WelcomeMonthCard key={m.month} m={m} href={ctx.href(routes.clubFamilyVision)} />
                : <MonthCard key={m.month} m={m} href={m.slug ? ctx.href(routes.clubResource(m.slug)) : null} />
            ))}
          </div>
        </section>
      ))}

      {me.next && (
        <section className="mt-10 max-w-3xl border-y border-warm-rule py-4">
          <h2 className="label text-warm-soft">Next</h2>
          <p className="mt-1 text-[1.02rem] text-warm-ink">
            {monthName(me.next.month)} · {clubResourceBySlug(me.next.slug)?.title ?? me.next.title ?? 'Monthly resource'}
          </p>
          <p className="mt-1 text-[0.92rem] text-warm-soft">
            {me.next.payment_on ? `Opens with your ${shortDate(me.next.payment_on)} payment` : 'Opens with your next payment'}, and its printed copy goes out in the {monthName(me.next.month)} mailing.
          </p>
        </section>
      )}

      <section className="mt-12 grid max-w-3xl gap-8 border-t border-warm-rule pt-6 sm:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="label text-warm-soft">Your family</h2>
            <a href={ctx.href(routes.clubFamily)} className="text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4">Edit</a>
          </div>
          <p className="mt-2 text-[1.02rem] text-warm-ink">{household?.members.filter((m) => !m.archived).map((m) => m.firstName).join(' · ')}</p>
        </div>
        {ctx.store.kind === 'account' && <MailingAddress />}
      </section>
      {ctx.store.kind === 'account' && <EmailChange email={email} />}
    </>
  );
}

function Status({ me, sample }: { me: Membership; sample: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const plan = me.plan === 'annual' ? 'Annual membership' : me.plan === 'monthly' ? 'Monthly membership · $5.90/month' : me.grant ? 'Preview access' : 'Membership';
  const line = me.revoked
    ? 'This membership was closed after a payment dispute. Reply to any of our emails if that’s a mistake.'
    : me.payment_problem
      ? 'Your last payment didn’t go through. Update your card to keep your membership.'
      : me.ends
        ? `Ends ${shortDate(me.ends)}. You keep every resource you received.`
        : me.renews
          ? `Renews ${shortDate(me.renews)}${me.membership_year ? ` · Year ${me.membership_year}` : ''}`
          : !me.access
            ? 'Your membership has ended. The resources you received stay here to view and print.'
            : '';
  const portal = async () => {
    setBusy(true);
    setErr('');
    try {
      location.assign((await openPortal()).url);
    } catch (e) {
      setBusy(false);
      setErr(billingErrorText((e as Error).message));
    }
  };
  return (
    <div className={`mt-6 max-w-3xl p-5 ${me.payment_problem || me.revoked ? 'bg-rose-wash' : 'bg-white ring-1 ring-warm-rule'}`}>
      <p className="font-semibold text-warm-ink">{plan}</p>
      {line && <p className="mt-1 text-[0.95rem] text-warm-ink">{line}</p>}
      {!sample && me.member && (
        <button type="button" onClick={portal} disabled={busy} className={`${me.payment_problem ? 'btn-primary' : 'text-[0.92rem] font-semibold underline underline-offset-4'} mt-3`}>
          {busy ? 'Opening…' : me.payment_problem ? 'Update your card' : me.access ? 'Manage billing' : 'Billing history'}
        </button>
      )}
      {!me.access && !sample && <a href={routes.clubJoin} className="ml-4 text-[0.92rem] font-semibold underline underline-offset-4">Rejoin</a>}
      {err && <p role="alert" className="mt-2 text-[0.9rem]">{err}</p>}
    </div>
  );
}

function WelcomeCard({ w, href }: { w: NonNullable<Membership['welcome']>; href: string }) {
  const todo = w.status === 'pending' && (!w.approved || !w.personalized);
  return (
    <article className={`mt-8 max-w-3xl p-6 sm:p-9 ${todo ? 'bg-sage-wash' : 'bg-white ring-1 ring-warm-rule'}`}>
      <p className="label text-warm-soft">Your welcome print{w.satisfies_month ? ` · Your ${monthName(w.satisfies_month).split(' ')[0]} resource` : ''}</p>
      <h2 className="mt-2 font-serif text-[1.8rem] leading-[1.15] text-warm-ink sm:text-[2.2rem]">Our Family Vision</h2>
      {w.satisfies_month && (
        <p className="mt-2 max-w-xl text-[0.98rem] leading-relaxed text-warm-ink">
          You joined in {monthName(w.satisfies_month)}, so this personalized print is your {monthName(w.satisfies_month).split(' ')[0]} resource. Your monthly resources start with your next payment.
        </p>
      )}
      <p className="mt-2 text-[0.95rem] text-warm-soft">{welcomeText(w)}</p>
      <a href={href} className={`${todo ? 'btn-primary' : 'text-[0.95rem] font-semibold underline underline-offset-4'} mt-5 inline-block`}>
        {todo ? 'Personalize your print' : 'See your print'}
      </a>
    </article>
  );
}

function WelcomeMonthCard({ m, href }: { m: MembershipMonth; href: string }) {
  return (
    <article className="bg-white p-5 ring-1 ring-warm-rule">
      <p className="label text-warm-soft">{monthName(m.month)}</p>
      <h3 className="mt-1 font-serif text-[1.3rem] leading-snug text-warm-ink">Our Family Vision print</h3>
      <p className="mt-1 text-[0.88rem] text-warm-soft">Your personalized welcome print is this month’s resource.</p>
      <a href={href} className="mt-3 inline-block text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4">See your print</a>
    </article>
  );
}

function CurrentCard({ m, href }: { m: MembershipMonth; href: string }) {
  const r = clubResourceBySlug(m.slug);
  return (
    <article className="mt-8 max-w-3xl bg-sage-wash p-6 sm:p-9">
      <p className="label text-warm-soft">{monthName(m.month)} · This month</p>
      <h2 className="mt-2 font-serif text-[1.8rem] leading-[1.15] text-warm-ink sm:text-[2.2rem]">{r?.title ?? m.title}</h2>
      {r && <p className="mt-2 max-w-xl font-serif text-[1.15rem] italic text-rose-deep">{r.problem}</p>}
      {mailingText(m.mailing) && <p className="mt-3 text-[0.92rem] text-warm-soft">Printed copy: {mailingText(m.mailing)}</p>}
      <a href={href} className="btn-primary mt-6 w-full sm:w-auto">{m.can === 'read' ? 'View and print' : 'Open your plan'}</a>
    </article>
  );
}

function MonthCard({ m, href }: { m: MembershipMonth; href: string | null }) {
  const r = clubResourceBySlug(m.slug);
  const open = m.state === 'available' && href && r;
  return (
    <article className="bg-white p-5 ring-1 ring-warm-rule">
      <p className="label text-warm-soft">{monthName(m.month)}</p>
      <h3 className="mt-1 font-serif text-[1.3rem] leading-snug text-warm-ink">{r?.title ?? m.title ?? 'Monthly resource'}</h3>
      {mailingText(m.mailing) && <p className="mt-1 text-[0.88rem] text-warm-soft">Printed copy: {mailingText(m.mailing)}</p>}
      {open ? (
        <a href={href!} className="mt-3 inline-block text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4">{m.can === 'read' ? 'View and print' : 'Open'}</a>
      ) : (
        <p className="mt-3 text-[0.9rem] text-warm-soft">Yours. We’re finishing it; it opens here when it’s ready.</p>
      )}
    </article>
  );
}

function MailingAddress() {
  const [address, setAddress] = useState<Address | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    loadAddress().then(setAddress, () => setAddress(null));
  }, []);
  if (address === undefined) return null;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="label text-warm-soft">Mailing address</h2>
        {!editing && <button type="button" onClick={() => setEditing(true)} className="text-[0.92rem] font-semibold underline underline-offset-4">{address ? 'Edit' : 'Add'}</button>}
      </div>
      {editing ? (
        <div className="mt-3"><AddressForm address={address} submitLabel="Save address" onSave={async (a) => { setAddress(await saveAddress(a)); setEditing(false); }} /></div>
      ) : address ? (
        <p className="mt-2 text-[0.98rem] leading-relaxed">{address.name}<br />{address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />{address.city}, {address.state} {address.postal_code}{address.paused && <><br /><em>Printed mailings paused</em></>}</p>
      ) : (
        <p className="mt-2 text-warm-soft">None yet.</p>
      )}
    </div>
  );
}

function EmailChange({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const r = await changeEmail(value);
    setMsg(r === 'sent' ? `We sent a confirmation to ${value.trim().toLowerCase()}. Open it to finish; until then, keep signing in with ${email}.` : r === 'invalid' ? 'Check the new address and try again.' : 'We couldn’t change it just now. Please try again.');
  };
  return (
    <section className="mt-10 max-w-3xl border-t border-warm-rule pt-6 text-[0.95rem]">
      <p className="text-warm-soft">Signed in as <strong className="text-warm-ink">{email}</strong>{' '}
        {!open && <button type="button" className="underline underline-offset-4" onClick={() => setOpen(true)}>Change email</button>}</p>
      {open && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="label text-warm-soft">New email</span>
            <input type="email" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1.5 block min-h-11 w-72 max-w-full rounded-[4px] border border-warm-rule bg-white px-3" /></label>
          <button type="submit" className="btn-primary">Send confirmation</button>
        </form>
      )}
      {msg && <p role="status" className="mt-3">{msg}</p>}
    </section>
  );
}

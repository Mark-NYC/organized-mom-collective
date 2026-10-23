/**
 * /club/dashboard: this month's kit first, then every other kit she can open. Driven entirely by the kit registry
 * (src/data/club/kits) and club_me's list: a new month is a new config file, not a new dashboard.
 */
import { useEffect, useState } from 'react';
import { kitBySlug } from '../../data/club/kits';
import { monthLabel } from '../../data/club/labels';
import type { KitConfig } from '../../data/club/types';
import type { Household } from '../../lib/club/profile';
import type { ClubMe } from '../../lib/club/store';
import { routes } from '../../routes';
import ClubGate, { type ClubContext } from './ClubGate';
import { clubNav } from '../../lib/club/nav';

export default function DashboardPage() {
  return <ClubGate page="dashboard">{(ctx) => <Dashboard ctx={ctx} />}</ClubGate>;
}

function Dashboard({ ctx }: { ctx: ClubContext }) {
  const [state, setState] = useState<{ me: ClubMe; household: Household | null } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([ctx.store.me(), ctx.store.household()])
      .then(([me, household]) => {
        if (!household) return clubNav().go(ctx.href(routes.clubStart), { replace: true });
        setState({ me, household });
      })
      .catch(() => setError('We couldn’t load your kits. Check your connection and reload the page.'));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!state) return <p className="text-warm-soft">Loading…</p>;

  const { me, household } = state;
  const open = me.kits.map((k) => ({ access: k.can, kit: kitBySlug(k.slug) })).filter((k): k is { access: 'edit' | 'read'; kit: KitConfig } => Boolean(k.kit));
  // A bonus that opens before its own month (November's gift of September's kit) is a gift, not this month's kit.
  const early = (k: { kit: KitConfig }) => open.some((g) => g.kit.bonus?.slug === k.kit.slug && g.kit.month < k.kit.month);
  const gifts = open.filter(early);
  const [current, ...earlier] = open.filter((k) => !early(k));
  const you = household!.members.find((m) => m.isAccountHolder && !m.archived) ?? household!.members.find((m) => !m.archived);
  const team = household!.members.filter((m) => !m.archived);

  return (
    <>
      <p className="label text-warm-soft">{household!.displayName ?? 'Your family'}</p>
      <h1 className="mt-2 font-serif text-[2.1rem] leading-[1.1] text-warm-ink sm:text-[2.6rem]">{you ? `Hi, ${you.firstName}.` : 'Your kits'}</h1>

      {!me.access && (
        <p className="mt-5 max-w-xl border-l-[3px] border-rose bg-rose-wash px-4 py-3 text-warm-ink">
          Your membership has ended. The kits you had stay here to view and print.
        </p>
      )}

      {current ? (
        <KitCard kit={current.kit} access={current.access} href={ctx.href(routes.clubKit(current.kit.slug))} featured />
      ) : (
        <p className="mt-8 max-w-xl text-warm-soft">Your first kit will appear here when it opens.</p>
      )}

      {gifts.length > 0 && (
        <section className="mt-10" data-club-gifts>
          <h2 className="label text-warm-soft">A bonus with your membership</h2>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-warm-soft">Your Club membership includes helpful resources from previous months, too. Use them whenever they help.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {gifts.map((k) => <KitCard key={k.kit.slug} kit={k.kit} access={k.access} href={ctx.href(routes.clubKit(k.kit.slug))} />)}
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <section className="mt-12">
          <h2 className="label text-warm-soft">Earlier kits</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {earlier.map((k) => <KitCard key={k.kit.slug} kit={k.kit} access={k.access} href={ctx.href(routes.clubKit(k.kit.slug))} />)}
          </div>
        </section>
      )}

      <section className="mt-12 max-w-2xl border-t border-warm-rule pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="label text-warm-soft">Your team</h2>
          <a href={ctx.href(routes.clubFamily)} className="text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4">Edit your family</a>
        </div>
        <p className="mt-2 text-[1.02rem] text-warm-ink">{team.map((m) => m.firstName).join(' · ')}</p>
      </section>
    </>
  );
}

function KitCard({ kit, access, href, featured }: { kit: KitConfig; access: 'edit' | 'read'; href: string; featured?: boolean }) {
  return (
    <article className={featured ? 'mt-8 max-w-3xl bg-sage-wash p-6 sm:p-9' : 'bg-white p-5 ring-1 ring-warm-rule'}>
      <p className="label text-warm-soft">{monthLabel(kit.month)}{featured ? ' · Newest kit' : ''}</p>
      <h2 className={`mt-2 font-serif text-warm-ink ${featured ? 'text-[1.8rem] leading-[1.15] sm:text-[2.2rem]' : 'text-[1.35rem] leading-snug'}`}>{kit.theme}</h2>
      {kit.subtitle ? (
        <p className="mt-2 max-w-xl font-serif text-[1.15rem] italic text-rose-deep">{kit.subtitle}</p>
      ) : (
        <p className="mt-3 max-w-xl leading-relaxed text-warm-soft">{kit.shift}</p>
      )}
      {featured && (
        <ul className="mt-5 grid gap-1.5 text-[0.95rem] text-warm-ink sm:grid-cols-2">
          {(kit.action
            ? ['A letter from Megan', kit.action.title, ...(kit.tool ? [kit.tool.title] : []), ...(kit.toolkit?.tools.map((t) => t.title) ?? [])]
            : kit.printables.map((p) => p.title)
          ).map((t) => <li key={t}>· {t}</li>)}
        </ul>
      )}
      <a href={href} className={featured ? 'btn-primary mt-7 w-full sm:w-auto' : 'mt-4 inline-block text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4'}>
        {access === 'read' ? 'View and print' : featured ? 'Open your kit' : 'Open'}
      </a>
    </article>
  );
}

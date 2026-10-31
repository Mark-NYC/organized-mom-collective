/**
 * /app/account's family panel. A signed-in Club member sees her own family (from her account) with links to My Family
 * and Account & Billing; anyone else sees the fictional sample family, clearly labeled as a preview.
 */
import { useEffect, useState } from 'react';
import { appPreviewFamily } from '../lib/app-family';
import { ageInMonth, monthOf, type Household } from '../lib/club/profile';
import { clubAccountsEnabled } from '../data/club/config';
import { getSession } from '../lib/account';
import { loadMembership } from '../lib/club/membership';
import { accountStore } from '../lib/club/store';
import { routes } from '../routes';

export default function FamilySummary() {
  const [family, setFamily] = useState<{ household: Household | null; mine: boolean } | undefined>(undefined);
  useEffect(() => {
    const sample = () => appPreviewFamily().then((h) => setFamily({ household: h, mine: false }), () => setFamily({ household: null, mine: false }));
    if (!clubAccountsEnabled()) return void sample();
    getSession().then(async (s) => {
      if (!s) return sample();
      const me = await loadMembership();
      if (!me.member && !me.grant) return sample();
      setFamily({ household: await accountStore.household(), mine: true });
    }).catch(sample);
  }, []);
  if (family === undefined) return <p className="mt-6 text-warm-soft">Loading your family…</p>;
  const month = monthOf(new Date());
  const { household, mine } = family;
  if (mine) {
    return (
      <section className="family-panel mt-6" data-account-family="member">
        <p className="label">YOUR FAMILY</p>
        <h2 className="family-panel-title mt-4">{household?.displayName ?? 'Your family'}</h2>
        {household ? <Members household={household} month={month} /> : <p className="mt-3 text-sm text-warm-soft">You haven’t added your family yet.</p>}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <a href={routes.clubFamily} className="family-link">{household ? 'Edit in My Family →' : 'Add your family →'}</a>
          <a href={routes.appClub} className="family-link">Club Home →</a>
          <a href={routes.clubDashboard} className="family-link">Account &amp; Billing →</a>
        </div>
      </section>
    );
  }
  return (
    <>
      <div className="family-note mt-8" data-account-family="sample"><strong className="text-sm">Sample family · Preview only</strong><p className="mt-1 text-sm leading-relaxed">The people shown here are fictional. They are not your account, your purchase history, or saved customer details. Club members: <a href="/club/login" className="underline">sign in</a> to see your own family.</p></div>
      {household ? (
        <section className="family-panel mt-6">
          <p className="label">FAMILY PROFILE · SAMPLE ONLY</p>
          <h2 className="family-panel-title mt-4">{household.displayName ?? 'Our family'}</h2>
          <Members household={household} month={month} />
          <p className="mt-4 text-xs text-warm-soft">Read from the existing Club sample store. This is not your personal account.</p>
        </section>
      ) : <p className="mt-6 text-warm-soft">Family preview unavailable.</p>}
    </>
  );
}

function Members({ household, month }: { household: Household; month: string }) {
  return (
    <ul className="mt-5 divide-y divide-warm-rule">
      {household.members.filter((m) => !m.archived).map((m) => (
        <li key={m.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
          <span className="font-semibold">{m.firstName}</span>
          <span className="text-sm text-warm-soft">{m.kind === 'child' && m.birthYear ? `Child · ${ageInMonth(m.birthYear, m.birthMonth, month)} years` : m.kind === 'child' ? 'Child' : 'Adult'}</span>
        </li>
      ))}
    </ul>
  );
}

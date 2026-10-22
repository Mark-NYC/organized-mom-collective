/** /club/start (first time) and /club/family (editing): load her household, show the family form, save. */
import { useEffect, useState } from 'react';
import { kitBySlug } from '../../data/club/kits';
import { monthLabel } from '../../data/club/labels';
import type { Household } from '../../lib/club/profile';
import { routes } from '../../routes';
import ClubGate, { type ClubContext } from './ClubGate';
import FamilyForm from './FamilyForm';

export default function FamilyPage({ mode }: { mode: 'start' | 'edit' }) {
  return <ClubGate page={mode === 'start' ? 'start' : 'family'}>{(ctx) => <Family ctx={ctx} mode={mode} />}</ClubGate>;
}

function Family({ ctx, mode }: { ctx: ClubContext; mode: 'start' | 'edit' }) {
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [firstKit, setFirstKit] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([ctx.store.household(), ctx.store.me()])
      .then(([h, me]) => {
        // Someone who already has a family goes to the edit page instead of starting over.
        if (h && mode === 'start') return location.replace(ctx.href(routes.clubFamily));
        setHousehold(h);
        setFirstKit(me.kits[0]?.slug ?? null);
      })
      .catch(() => setError('We couldn’t load your family. Check your connection and reload the page.'));
  }, []);

  if (error) return <p role="alert" className="text-warm-ink">{error}</p>;
  if (household === undefined) return <p className="text-warm-soft">Loading…</p>;

  const kit = firstKit ? kitBySlug(firstKit) : undefined;
  const startLabel = kit ? `Open our ${monthLabel(kit.month).split(' ')[0]} kit` : 'Save our family';

  return (
    <>
      <FamilyForm
        household={household}
        mode={mode}
        submitLabel={mode === 'start' ? startLabel : 'Save our family'}
        onSave={async (input) => {
          const h = await ctx.store.saveHousehold(input);
          if (mode === 'start') {
            location.assign(ctx.href(kit ? routes.clubKit(kit.slug) : routes.clubDashboard));
            return;
          }
          setHousehold(h);
          setSaved(true);
        }}
      />
      {saved && (
        <p role="status" className="mt-6 max-w-2xl border-l-[3px] border-sage bg-sage-wash px-4 py-3 text-warm-ink">
          Saved. Your kits will show suggestions for anything that changed. <a className="font-semibold underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>Back to your kits</a>
        </p>
      )}
    </>
  );
}

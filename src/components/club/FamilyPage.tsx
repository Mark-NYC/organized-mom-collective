/**
 * /club/start (first time) and /club/family (editing): load her household, show the family form, save. The edit page
 * also shows the rest of the family profile (FamilyProfileSummary) and opens one step at a time to change it, or the
 * whole remaining setup with ?setup=1 (the dashboard's "Finish your family profile").
 */
import { useEffect, useState } from 'react';
import type { FamilyProfile, SetupStep } from '../../lib/club/family-profile';
import FamilySetup from './FamilySetup';
import FamilyProfileSummary from './FamilyProfileSummary';
import { kitBySlug } from '../../data/club/kits';
import { monthLabel } from '../../data/club/labels';
import type { Household } from '../../lib/club/profile';
import { routes } from '../../routes';
import ClubGate, { type ClubContext } from './ClubGate';
import FamilyForm from './FamilyForm';
import { clubNav } from '../../lib/club/nav';

export default function FamilyPage({ mode }: { mode: 'start' | 'edit' }) {
  return <ClubGate page={mode === 'start' ? 'start' : 'family'}>{(ctx) => <Family ctx={ctx} mode={mode} />}</ClubGate>;
}

function Family({ ctx, mode }: { ctx: ClubContext; mode: 'start' | 'edit' }) {
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [editing, setEditing] = useState<{ mode: 'wizard' | 'single'; step?: SetupStep } | null>(null);
  const [firstKit, setFirstKit] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([ctx.store.household(), ctx.store.me()])
      .then(([h, me]) => {
        // Someone who already has a family goes to the edit page instead of starting over.
        if (h && mode === 'start') return clubNav().go(ctx.href(routes.clubFamily), { replace: true });
        setHousehold(h);
        setFirstKit(me.kits[0]?.slug ?? null);
        if (h && mode === 'edit') {
          // The profile beyond the people is optional here, as on the welcome and plan pages: if it can't load, she can
          // still edit her family.
          return ctx.store.profile().catch(() => null).then((p) => {
            setProfile(p);
            if (p && !p.setupCompleted && new URLSearchParams(location.search).get('setup') === '1') setEditing({ mode: 'wizard' });
          });
        }
      })
      .catch(() => setError('We couldn’t load your family. Check your connection and reload the page.'));
  }, []);

  if (error) return <p role="alert" className="text-warm-ink">{error}</p>;
  if (household === undefined) return <p className="text-warm-soft">Loading…</p>;

  if (editing && household && profile) {
    const close = (p: FamilyProfile, saved: boolean) => {
      setProfile(p);
      setEditing(null);
      setSaved(saved);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    };
    return (
      <FamilySetup store={ctx.store} members={household.members} profile={profile} mode={editing.mode} step={editing.step}
        onDone={(p) => close(p, true)} onExit={(p) => close(p, false)} />
    );
  }

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
            clubNav().go(ctx.href(kit ? routes.clubKit(kit.slug) : routes.clubDashboard));
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
      {mode === 'edit' && household && profile && (
        <FamilyProfileSummary profile={profile} members={household.members} onEdit={(step) => setEditing({ mode: 'single', step })} onFinish={() => setEditing({ mode: 'wizard' })} />
      )}
    </>
  );
}

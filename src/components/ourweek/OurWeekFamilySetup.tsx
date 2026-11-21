/**
 * /app/family/setup: Our Week's free family setup. Signed in, no payment, no membership, no calendar purchase:
 *   1. Your family: the same family form the Club uses (src/components/club/FamilyForm.tsx, variant 'app': no Club
 *      wording), grown-ups, children and ages; each person's color is saved for good (household_colors_complete).
 *   2. Right after the first save: "You're set up" with ONE next step (Today), the invitation for the other grown-up
 *      if there is one (src/components/household/HouseholdSharing.tsx), and the form folded away. A new mom isn't left
 *      on a long edit page wondering what to do next (docs/pilot/PILOT_TESTING.md → first session).
 *   3. Later visits: the form open for edits, sharing, and the three places to start.
 * An existing Club member's household is the same household: this edits it, nothing is copied or replaced.
 */
import { useEffect, useState } from 'react';
import FamilyForm from '../club/FamilyForm';
import HouseholdSharing from '../household/HouseholdSharing';
import { PasteInvite } from '../household/JoinHousehold';
import { routes } from '../../routes';
import { getSession } from '../../lib/account';
import { accountStore, ColorsNotSavedError, StaleProfileError } from '../../lib/club/store';
import { householdAccess, type HouseholdAccess } from '../../lib/household/api';
import type { Household } from '../../lib/club/profile';
import { track } from '../../lib/app/events';

export default function OurWeekFamilySetup() {
  const [state, setState] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading');
  const [household, setHousehold] = useState<Household | null>(null);
  const [access, setAccess] = useState<HouseholdAccess | null>(null);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  // True after this visit created the family: the page becomes "You're set up" with one next step.
  const [created, setCreated] = useState(false);

  const load = async () => {
    const [h, a] = await Promise.all([accountStore.household(), householdAccess().catch(() => null)]);
    setHousehold(h);
    setAccess(a);
  };
  useEffect(() => {
    getSession().then(async (s) => {
      if (!s) return setState('signed-out');
      const h = await accountStore.household();
      await load();
      if (!h) track('onboarding_started');
      setState('ready');
    }).catch(() => setState('error'));
  }, []);

  if (state === 'loading') return <p className="text-warm-soft">Loading…</p>;
  if (state === 'error') return <p role="alert">We couldn’t load your family. Check your connection and try again.</p>;
  if (state === 'signed-out') {
    return (
      <div className="family-brand mx-auto max-w-md" data-setup-signed-out>
        <h1 className="family-title !text-[2rem]">Set up your family</h1>
        <p className="family-lede mt-3">Sign in first, so your family is saved for both grown-ups’ phones.</p>
        <a href="/app/sign-in?next=/app/family/setup" className="family-action mt-6">Sign in</a>
      </div>
    );
  }

  const owner = !access || access.myRole === 'owner';
  const otherAdults = household?.members.filter((m) => m.kind === 'adult' && !m.isAccountHolder && !m.archived) ?? [];
  const form = (
    <FamilyForm
      key={household?.profileVersion ?? 0}
      household={household}
      mode={household ? 'edit' : 'start'}
      variant="app"
      submitLabel="Save our family"
      onSave={async (input) => {
        setNote('');
        const first = !household;
        try {
          await accountStore.saveHousehold({ ...input, expectedVersion: household?.profileVersion });
        } catch (e) {
          if (e instanceof StaleProfileError) { await load(); setNote('Your family was just changed on another phone, so we loaded the newest version. Make your change again and save.'); return; }
          if (!(e instanceof ColorsNotSavedError)) throw e;
        }
        await load();
        if (first) { track('onboarding_completed'); setCreated(true); window.scrollTo(0, 0); } else setSaved(true);
      }}
    />
  );
  const start = (
    <div className="family-card-grid mt-4">
      <a href="/app/family-calendar" className="family-panel block" data-start="calendar"><h2 className="family-panel-title">Calendar</h2><p className="mt-2 text-sm text-warm-soft">Add this week’s plans in each person’s color.</p></a>
      <a href="/app/cleaning" className="family-panel block" data-start="cleaning"><h2 className="family-panel-title">Cleaning</h2><p className="mt-2 text-sm text-warm-soft">Five small daily tasks, and today’s zone.</p></a>
      <a href="/app/family/meeting" className="family-panel block" data-start="meeting"><h2 className="family-panel-title">Family Meeting</h2><p className="mt-2 text-sm text-warm-soft">Ten minutes, once a week, so everyone plays a part.</p></a>
    </div>
  );

  // Just created: one clear next step, the invitation if there's another grown-up, and the form folded away.
  if (created && household) {
    const me = household.members.find((m) => m.isAccountHolder);
    return (
      <div className="family-brand mx-auto max-w-3xl space-y-8" data-ourweek-setup data-setup-done>
        <header>
          <p className="label text-[#71866c]">ORGANIZED FAMILY · FREE</p>
          <h1 className="family-title mt-3 !text-[2.1rem]">You’re set up{me ? `, ${me.firstName}` : ''}.</h1>
          <p className="family-lede mt-3">Everyone has a color now. Start with one small thing today; the rest can wait.</p>
          <a href="/app" className="family-action mt-6" data-setup-next>Go to Today</a>
        </header>
        {owner && access && otherAdults.length > 0 && (
          <section aria-labelledby="setup-partner-h" data-setup-step="partner">
            <h2 id="setup-partner-h" className="label text-[#71866c]">BRING IN {otherAdults.map((a) => a.firstName.toUpperCase()).join(' AND ')}</h2>
            <p className="mt-2 text-sm text-warm-soft">Optional, and you can do it later from Family. They see the same calendar, cleaning and plans on their own phone.</p>
            <HouseholdSharing household={household} access={access} />
          </section>
        )}
        <section aria-labelledby="setup-start-h" data-setup-step="start">
          <h2 id="setup-start-h" className="label text-[#71866c]">OR START WITH</h2>
          {start}
        </section>
        <details className="family-note" data-setup-edit>
          <summary className="cursor-pointer text-sm font-semibold">Edit your family</summary>
          <div className="mt-4">{form}</div>
        </details>
      </div>
    );
  }

  return (
    <div className="family-brand mx-auto max-w-3xl space-y-10" data-ourweek-setup>
      <header>
        <p className="label text-[#71866c]">ORGANIZED FAMILY · FREE</p>
        <h1 className="family-title mt-3 !text-[2.1rem]">{household ? 'Your family' : 'Set up your family'}</h1>
        <p className="family-lede mt-3">{household
          ? 'Who’s in your home. Each person keeps their color everywhere: the calendar, cleaning and your Family Meeting.'
          : 'First names and ages, about a minute. Kids don’t need accounts, and you can change anything later.'}</p>
      </header>

      {!household && (
        <details className="family-note" data-setup-invited>
          <summary className="cursor-pointer text-sm font-semibold">Did the other grown-up already set up your family? Join theirs instead</summary>
          <p className="mt-2 text-sm leading-relaxed">Don’t set up a second one. Paste the invitation they sent you (the link, or the whole message) and you’ll share the same family, calendar and plans.</p>
          <PasteInvite onCode={(c) => location.assign(`${routes.householdJoin}?code=${c}`)} label="Join their family" />
        </details>
      )}
      {household && owner && access && access.adults.length === 1 && (
        <p className="text-sm text-warm-soft" data-setup-have-invite>Invited to a family the other grown-up set up? <a className="underline underline-offset-4" href={routes.householdJoin}>I have an invitation</a></p>
      )}

      <section aria-label="Your family" data-setup-step="family">
        {form}
        {saved && <p role="status" className="mt-4 text-sm text-[#536e4e]" data-setup-saved>Saved.</p>}
        {note && <p role="alert" className="mt-4 text-sm">{note}</p>}
      </section>

      {household && access && (
        <section aria-labelledby="setup-partner-h" data-setup-step="partner">
          <h2 id="setup-partner-h" className="label text-[#71866c]">THE OTHER GROWN-UP</h2>
          {owner
            ? <HouseholdSharing household={household} access={access} />
            : <p className="mt-3 text-sm text-warm-soft">You’re sharing this family with the person who set it up.</p>}
        </section>
      )}

      {household && (
        <section aria-labelledby="setup-start-h" data-setup-step="start">
          <h2 id="setup-start-h" className="label text-[#71866c]">START YOUR WEEK</h2>
          {start}
        </section>
      )}
    </div>
  );
}

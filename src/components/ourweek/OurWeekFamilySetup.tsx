/**
 * /app/family/setup: Our Week's free family setup. Signed in, no payment, no membership, no calendar purchase:
 *   1. Your family: the same family form the Club uses (src/components/club/FamilyForm.tsx): grown-ups, children,
 *      ages, and each person's color, saved permanently by person (household_colors_complete).
 *   2. The other grown-up: the partner invitation (src/components/household/HouseholdSharing.tsx).
 *   3. Start: Calendar, Cleaning and the weekly Family Meeting.
 * An existing Club member's household is the same household: this edits it, nothing is copied or replaced.
 */
import { useEffect, useState } from 'react';
import FamilyForm from '../club/FamilyForm';
import HouseholdSharing from '../household/HouseholdSharing';
import { getSession } from '../../lib/account';
import { accountStore, ColorsNotSavedError, StaleProfileError } from '../../lib/club/store';
import { householdAccess, type HouseholdAccess } from '../../lib/household/api';
import type { Household } from '../../lib/club/profile';

export default function OurWeekFamilySetup() {
  const [state, setState] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading');
  const [household, setHousehold] = useState<Household | null>(null);
  const [access, setAccess] = useState<HouseholdAccess | null>(null);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');

  const load = async () => {
    const [h, a] = await Promise.all([accountStore.household(), householdAccess().catch(() => null)]);
    setHousehold(h);
    setAccess(a);
  };
  useEffect(() => {
    getSession().then(async (s) => {
      if (!s) return setState('signed-out');
      await load();
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
  return (
    <div className="family-brand mx-auto max-w-3xl space-y-10" data-ourweek-setup>
      <header>
        <p className="label text-[#71866c]">OUR WEEK · FREE</p>
        <h1 className="family-title mt-3 !text-[2.1rem]">{household ? 'Your family' : 'Set up your family'}</h1>
        <p className="family-lede mt-3">Who’s in your home, and each person’s color. The colors stay with each person everywhere: the calendar, cleaning, your Family Meeting and anything you print.</p>
      </header>

      <section aria-labelledby="setup-family-h" data-setup-step="family">
        <p id="setup-family-h" className="label text-[#71866c]">1 · YOUR FAMILY</p>
        <div className="mt-4">
          <FamilyForm
            key={household?.profileVersion ?? 0}
            household={household}
            mode={household ? 'edit' : 'start'}
            submitLabel={household ? 'Save our family' : 'Save and continue'}
            onSave={async (input) => {
              setNote('');
              try {
                await accountStore.saveHousehold({ ...input, expectedVersion: household?.profileVersion });
              } catch (e) {
                if (e instanceof StaleProfileError) { await load(); setNote('Your family was just changed on another phone, so we loaded the newest version. Make your change again and save.'); return; }
                if (!(e instanceof ColorsNotSavedError)) throw e;
              }
              await load();
              setSaved(true);
            }}
          />
          {saved && <p role="status" className="mt-4 text-sm text-[#536e4e]" data-setup-saved>Saved. Everyone’s color is now theirs for good.</p>}
          {note && <p role="alert" className="mt-4 text-sm">{note}</p>}
        </div>
      </section>

      {household && access && (
        <section aria-labelledby="setup-partner-h" data-setup-step="partner">
          <p id="setup-partner-h" className="label text-[#71866c]">2 · THE OTHER GROWN-UP</p>
          {owner
            ? <HouseholdSharing household={household} access={access} />
            : <p className="mt-3 text-sm text-warm-soft">You’re sharing this family with the person who set it up.</p>}
        </section>
      )}

      {household && (
        <section aria-labelledby="setup-start-h" data-setup-step="start">
          <p id="setup-start-h" className="label text-[#71866c]">3 · START YOUR WEEK</p>
          <div className="family-card-grid mt-4">
            <a href="/app/family-calendar" className="family-panel block" data-start="calendar"><h2 className="family-panel-title">Calendar</h2><p className="mt-2 text-sm text-warm-soft">Add this week’s plans in each person’s color.</p></a>
            <a href="/app/cleaning" className="family-panel block" data-start="cleaning"><h2 className="family-panel-title">Cleaning</h2><p className="mt-2 text-sm text-warm-soft">Today’s reset and the week’s zones.</p></a>
            <a href="/app/family/meeting" className="family-panel block" data-start="meeting"><h2 className="family-panel-title">Family Meeting</h2><p className="mt-2 text-sm text-warm-soft">Ten minutes, once a week, so everyone plays a part.</p></a>
          </div>
        </section>
      )}
    </div>
  );
}

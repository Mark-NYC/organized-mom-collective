/**
 * The family profile in the browser / app, for Everyone's Part outside the meeting page (./family-meeting-support.ts).
 * Signed in: the household's profile from the Club's own read (club_family_profile), kept on this phone so the parts
 * still show offline. Demo (?demo=1): the labeled sample family. Otherwise none. Reads only.
 */
import { useEffect, useState } from 'react';
import { accountsEnabled, getSession } from './account';
import { accountStore } from './club/store';
import { appPreviewStore } from './app-family';
import { isDemo } from './calendar/client';
import type { AgreementInput, FamilyProfile } from './club/family-profile';
import type { ClubStore } from './club/store';

const CACHE = 'omc:household:profile:v1';

function cached(scope: string): FamilyProfile | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { scope: string; profile: FamilyProfile } | null;
    return c && c.scope === scope ? c.profile : null;
  } catch {
    return null;
  }
}

/** Where agreements save: the signed-in household, or the labeled demo family on this tab. */
const familyStore = (): ClubStore | null => (isDemo() ? appPreviewStore() : accountsEnabled() ? accountStore : null);

/** Save or remove an agreement and keep this phone's copy current. Throws the database's error on failure. */
export async function changeAgreement(scope: string | null, change: { save: AgreementInput } | { remove: string }): Promise<FamilyProfile> {
  const store = familyStore();
  if (!store) throw new Error('not_signed_in');
  const p = 'save' in change ? await store.saveAgreement(change.save) : await store.removeAgreement(change.remove);
  if (scope && !isDemo()) try { localStorage.setItem(CACHE, JSON.stringify({ scope, profile: p })); } catch { /* private mode */ }
  return p;
}

/** `scope` is the household id the profile belongs to (from useCalendar), so another family's copy is never shown. */
export function useFamilyProfile(scope: string | null): FamilyProfile | null {
  return useFamilyProfileState(scope)[0];
}

export function useFamilyProfileState(scope: string | null): [FamilyProfile | null, (p: FamilyProfile) => void] {
  const [profile, setProfile] = useState<FamilyProfile | null>(() => (scope && !isDemo() ? cached(scope) : null));
  useEffect(() => {
    let live = true;
    if (isDemo()) {
      void appPreviewStore()?.profile().then((p) => { if (live) setProfile(p); });
      return () => { live = false; };
    }
    if (!scope || !accountsEnabled()) return;
    setProfile(cached(scope));
    getSession().then(async (s) => {
      if (!s) return;
      const p = await accountStore.profile();
      if (!live) return;
      setProfile(p);
      try { localStorage.setItem(CACHE, JSON.stringify({ scope, profile: p })); } catch { /* private mode */ }
    }).catch(() => { /* offline: keep the copy on this phone */ });
    return () => { live = false; };
  }, [scope]);
  return [profile, setProfile];
}

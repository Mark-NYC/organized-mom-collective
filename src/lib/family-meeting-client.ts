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
import type { FamilyProfile } from './club/family-profile';

const CACHE = 'omc:household:profile:v1';

function cached(scope: string): FamilyProfile | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { scope: string; profile: FamilyProfile } | null;
    return c && c.scope === scope ? c.profile : null;
  } catch {
    return null;
  }
}

/** `scope` is the household id the profile belongs to (from useCalendar), so another family's copy is never shown. */
export function useFamilyProfile(scope: string | null): FamilyProfile | null {
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
  return profile;
}

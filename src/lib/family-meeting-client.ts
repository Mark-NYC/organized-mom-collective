/**
 * The family profile in the browser / app, with the family's agreements in it, for every screen outside the meeting
 * page (Today, the calendar, cleaning, Family Responsibilities; ./family-meeting-support.ts).
 *
 * Signed in: the household's profile (club_family_profile), kept on this phone so it shows offline, with this phone's
 * agreements laid over it (src/lib/agreements/client.ts: offline-first, synced with the household).
 * Demo (?demo=1): the labeled sample family, in this tab only. Otherwise none.
 */
import { track } from './app/events';
import { useEffect, useState } from 'react';
import { accountsEnabled, getSession } from './account';
import { accountStore } from './club/store';
import { appPreviewStore } from './app-family';
import { isDemo } from './calendar/client';
import { useAgreements, withAgreements, type AgreementStatus } from './agreements/client';
import type { AgreementRow } from './agreements/store';
import type { FamilyProfile } from './club/family-profile';
import type { ResponsibilityCategory } from '../data/club/family-profile';

const CACHE = 'omc:household:profile:v1';

function cached(scope: string): FamilyProfile | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { scope: string; profile: FamilyProfile } | null;
    return c && c.scope === scope ? c.profile : null;
  } catch {
    return null;
  }
}

/** The household's profile as the server last sent it (no agreement overlay). */
function useServerProfile(scope: string | null): [FamilyProfile | null, (p: FamilyProfile) => void] {
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

export interface AgreementDraft {
  id?: string;
  category: ResponsibilityCategory;
  text: string;
  ownerIds: string[];
  finished?: string;
  when?: string;
  month?: string;
  source?: string;
}

/**
 * The family, its profile and its agreements: what every screen reads, and how agreements change. `scope` is the
 * household id (from useCalendar), so another family's copy is never shown.
 */
export function useFamily(scope: string | null) {
  const demo = isDemo();
  const [server, setServer] = useServerProfile(scope);
  const ag = useAgreements(demo ? null : scope);
  useEffect(() => { if (!demo && server) ag.seed(server); }, [server]); // eslint-disable-line react-hooks/exhaustive-deps
  const profile = demo ? server : withAgreements(server, ag.state);
  const sample = demo ? appPreviewStore() : null;
  const toRow = (d: AgreementDraft): Omit<AgreementRow, 'revision' | 'id'> & { id?: string } => ({
    ...(d.id ? { id: d.id } : {}), category: d.category, text: d.text.trim(), owner_ids: [...new Set(d.ownerIds)],
    finished: d.finished?.trim() || null, when: d.when?.trim() || null, month: d.month ?? null, source: d.source ?? null,
  });
  return {
    profile,
    /** Saved on this phone at once; sent to the household when there's signal. */
    async saveAgreement(d: AgreementDraft) {
      if (sample) return setServer(await sample.saveAgreement({ ...d }));
      if (!scope) throw new Error('not_signed_in');
      ag.save(toRow(d));
      if (!demo) track('agreement_made');
    },
    /** An agreement the household database already saved (a development decision): onto this phone's lists now. */
    adoptAgreement(row: AgreementRow) {
      if (!demo) { ag.adopt(row); track('agreement_made'); }
    },
    async removeAgreement(id: string) {
      if (sample) return setServer(await sample.removeAgreement(id));
      if (!scope) throw new Error('not_signed_in');
      ag.remove(id);
    },
    /**
     * One answer of the family profile (challenges or priority), from anywhere in the app, for free families too:
     * the same function the Club's intake uses (club_focus_save). It replaces both answers, so the other one is sent
     * back unchanged, and it marks that setup step, so a later Club intake skips it.
     */
    async saveFocus(step: 'challenges' | 'priority', change: { challenges?: string[]; priority?: string }) {
      const cur = server ?? profile;
      const input = {
        challenges: change.challenges ?? cur?.challenges ?? [], challengeNote: cur?.challengeNote,
        priority: step === 'priority' ? change.priority : cur?.priority, priorityNote: cur?.priorityNote,
      };
      if (sample) return setServer(await sample.saveFocus(step, input));
      if (!scope) throw new Error('not_signed_in');
      setServer(await accountStore.saveFocus(step, input));
    },
    status: (demo ? 'none' : ag.status) as AgreementStatus,
    pending: demo ? 0 : ag.pending,
    conflicts: demo ? [] : ag.state?.conflicts ?? [],
    dismissConflicts: ag.dismissConflicts,
  };
}

/** The profile with agreements, for screens that only read. */
export function useFamilyProfile(scope: string | null): FamilyProfile | null {
  return useFamily(scope).profile;
}

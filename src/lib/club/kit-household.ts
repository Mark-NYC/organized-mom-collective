/**
 * Which family a /app/club kit page is prepared for, using the Club's own stores (./store.ts):
 *
 * - ?sample=<id>: that made-up sample household, labeled as a sample.
 * - Club accounts on: the signed-in member's household, or 'signed-out'. Never a sample in her place.
 * - Club accounts off (production today): the default sample household, labeled as a sample.
 *
 * A household with nobody to put on the sheet is 'empty', so a blank plan is never shown as hers.
 */
import { sampleById } from '../../data/club/samples';
import type { Household } from './profile';
import type { ClubStore } from './store';

export const DEFAULT_PREVIEW_SAMPLE = 'rivera';

export type KitHousehold =
  | { status: 'ready'; source: 'sample' | 'account'; sample: string | null; sampleLabel: string; household: Household }
  | { status: 'empty'; source: 'sample' | 'account'; sample: string | null }
  | { status: 'denied'; source: 'sample' | 'account'; sample: string | null }
  | { status: 'signed-out' }
  | { status: 'error' };

export interface KitHouseholdEnv {
  accountsEnabled: () => boolean;
  hasSession: () => Promise<boolean>;
  accountStore: ClubStore;
  sampleStore: (id: string) => ClubStore | null;
}

const onSheet = (h: Household) => h.members.some((m) => !m.archived && (m.kind === 'adult' || m.kind === 'child'));

export async function loadKitHousehold(slug: string, search: string, env: KitHouseholdEnv): Promise<KitHousehold> {
  const requested = new URLSearchParams(search).get('sample');
  let sample: string | null = requested && sampleById(requested) ? requested : null;
  try {
    let store: ClubStore | null;
    if (sample) store = env.sampleStore(sample);
    else if (env.accountsEnabled()) {
      if (!(await env.hasSession())) return { status: 'signed-out' };
      store = env.accountStore;
    } else {
      sample = DEFAULT_PREVIEW_SAMPLE;
      store = env.sampleStore(sample);
    }
    if (!store) return { status: 'error' };
    const source = store.kind;
    const me = await store.me();
    if (!me.kits.some((k) => k.slug === slug)) return { status: 'denied', source, sample };
    const household = await store.household();
    if (!household || !onSheet(household)) return { status: 'empty', source, sample };
    return { status: 'ready', source, sample, sampleLabel: store.label, household };
  } catch {
    return { status: 'error' };
  }
}

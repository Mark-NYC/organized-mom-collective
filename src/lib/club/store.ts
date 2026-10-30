/**
 * Where the Club's member pages read and save: one interface, two stores.
 *
 * - accountStore: the signed-in customer, through the Club's database functions (club_me, club_household,
 *   club_household_save, club_document_get, club_document_save in supabase/migrations/20261023000000_club_core.sql),
 *   called with her account session (src/lib/account.ts). The database decides access.
 * - sampleStore: a made-up household (src/data/club/samples.ts) kept in this tab's sessionStorage, for development and
 *   Preview deployments. Same behavior as the database, including revision conflicts, so the pages are tested on it.
 *
 * Family data never goes into localStorage or account_saves.
 */
import type { ToolPaletteId } from '../../data/tool-palettes';
import { resolveToolPalette } from '../../data/tool-palettes';
import { kits } from '../../data/club/kits';
import { sampleById } from '../../data/club/samples';
import { accountRpc } from '../account';
import type { FamilyMember, Household, HouseholdPreferences, MemberKind, MemberRole } from './profile';
import {
  activitiesToDb, emptyProfile, markStep, profileFromDb, responsibilitiesToDb, scopeOf,
  type Activity, type DbProfile, type FamilyProfile, type Responsibility, type SetupStep,
} from './family-profile';

export type KitAccess = 'edit' | 'read';

export interface ClubMe {
  access: boolean;
  onboarded: boolean;
  /** Kits she can open now, newest first. */
  kits: { slug: string; can: KitAccess }[];
}

export interface SavedDocument {
  edits: unknown;
  palette: ToolPaletteId;
  revision: number;
  engineVersion: number;
  profileVersion: number;
}

export interface KitDocuments {
  can: KitAccess;
  documents: Record<string, SavedDocument>;
}

/** A person as the family form sends them: an id for someone already saved, none for someone new. */
export interface MemberInput {
  id?: string;
  firstName: string;
  kind: MemberKind;
  role: MemberRole;
  birthYear?: number;
  birthMonth?: number;
  isAccountHolder?: boolean;
}

export interface HouseholdInput {
  displayName?: string;
  preferences: HouseholdPreferences;
  members: MemberInput[];
}

/** Steps 5 and 6: both answers travel together; `step` says which one she just answered or skipped. */
export interface FocusInput {
  challenges: string[];
  challengeNote?: string;
  priority?: string;
  priorityNote?: string;
}

/** Someone else (another tab or device) saved first: reload before saving again. */
export class ConflictError extends Error {
  constructor() {
    super('conflict');
  }
}

export interface ClubStore {
  kind: 'sample' | 'account';
  /** Shown in the sample banner. */
  label: string;
  me(): Promise<ClubMe>;
  household(): Promise<Household | null>;
  saveHousehold(input: HouseholdInput): Promise<Household>;
  documents(slug: string): Promise<KitDocuments>;
  /** Returns the new revision. `revision` is the one she loaded (0 for a first save). */
  saveDocument(slug: string, doc: string, saved: Omit<SavedDocument, 'revision'>, revision: number): Promise<number>;
  /** The profile beyond the people (src/lib/club/family-profile.ts); null before the family step. */
  profile(): Promise<FamilyProfile | null>;
  /** Each save replaces that whole answer and marks its setup step done (an empty answer is "skip for now"). */
  saveActivities(list: Activity[]): Promise<FamilyProfile>;
  saveResponsibilities(status: 'existing' | 'desired', list: Responsibility[]): Promise<FamilyProfile>;
  saveFocus(step: 'challenges' | 'priority', focus: FocusInput): Promise<FamilyProfile>;
}

// ------------------------------------------------------------------ the database, as her

interface DbMember {
  id: string;
  first_name: string;
  kind: MemberKind;
  role: MemberRole;
  birth_year: number | null;
  birth_month: number | null;
  is_account_holder: boolean;
  archived: boolean;
}
interface DbHousehold {
  id: string;
  display_name: string | null;
  preferences: HouseholdPreferences;
  profile_version: number;
  onboarded: boolean;
  members: DbMember[];
}

export const fromDb = (h: DbHousehold): Household => ({
  id: h.id,
  ...(h.display_name ? { displayName: h.display_name } : {}),
  preferences: h.preferences ?? {},
  profileVersion: h.profile_version,
  members: h.members.map((m) => ({
    id: m.id,
    firstName: m.first_name,
    kind: m.kind,
    role: m.role,
    ...(m.birth_year !== null ? { birthYear: m.birth_year } : {}),
    ...(m.birth_month !== null ? { birthMonth: m.birth_month } : {}),
    ...(m.is_account_holder ? { isAccountHolder: true } : {}),
    ...(m.archived ? { archived: true } : {}),
  })),
});

export const toDbMembers = (members: MemberInput[]) =>
  members.map((m) => ({
    ...(m.id ? { id: m.id } : {}),
    first_name: m.firstName.trim(),
    kind: m.kind,
    role: m.role,
    ...(m.kind === 'child' ? { birth_year: m.birthYear, birth_month: m.birthMonth ?? null } : {}),
    is_account_holder: Boolean(m.isAccountHolder),
  }));

const asError = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const accountStore: ClubStore = {
  kind: 'account',
  label: '',
  async me() {
    const r = await accountRpc<{ access: boolean; onboarded: boolean; kits: { slug: string; can: KitAccess | 'none' }[] }>('club_me');
    return { access: r.access, onboarded: r.onboarded, kits: r.kits.filter((k): k is { slug: string; can: KitAccess } => k.can !== 'none') };
  },
  async household() {
    const r = await accountRpc<DbHousehold | null>('club_household');
    return r ? fromDb(r) : null;
  },
  async saveHousehold(input) {
    return fromDb(await accountRpc<DbHousehold>('club_household_save', {
      p_display_name: input.displayName ?? null,
      p_preferences: input.preferences,
      p_members: toDbMembers(input.members),
    }));
  },
  async documents(slug) {
    const r = await accountRpc<{ can: KitAccess; documents: Record<string, { edits: unknown; palette: string; revision: number; engine_version: number; profile_version: number }> }>('club_document_get', { p_kit: slug });
    return {
      can: r.can,
      documents: Object.fromEntries(Object.entries(r.documents).map(([k, d]) => [k, { edits: d.edits, palette: resolveToolPalette(d.palette), revision: d.revision, engineVersion: d.engine_version, profileVersion: d.profile_version }])),
    };
  },
  async saveDocument(slug, doc, saved, revision) {
    try {
      return await accountRpc<number>('club_document_save', {
        p_kit: slug, p_doc: doc, p_edits: saved.edits, p_palette: saved.palette,
        p_engine_version: saved.engineVersion, p_profile_version: saved.profileVersion, p_revision: revision,
      });
    } catch (e) {
      if (asError(e) === 'conflict') throw new ConflictError();
      throw e;
    }
  },
  async profile() {
    const r = await accountRpc<DbProfile | null>('club_family_profile');
    return r ? profileFromDb(r) : null;
  },
  async saveActivities(list) {
    return profileFromDb(await accountRpc<DbProfile>('club_activities_save', { p_activities: activitiesToDb(list) }));
  },
  async saveResponsibilities(status, list) {
    return profileFromDb(await accountRpc<DbProfile>('club_responsibilities_save', { p_status: status, p_items: responsibilitiesToDb(list) }));
  },
  async saveFocus(step, f) {
    return profileFromDb(await accountRpc<DbProfile>('club_focus_save', {
      p_step: step, p_challenges: f.challenges, p_challenge_note: f.challengeNote ?? null,
      p_priority: f.priority ?? null, p_priority_note: f.priorityNote ?? null,
    }));
  },
};

// ------------------------------------------------------------------ sample households (this tab only)

interface SampleState {
  household: Household;
  documents: Record<string, Record<string, SavedDocument>>;
  /** Missing in tabs saved before the profile steps existed: starts empty. */
  profile?: FamilyProfile;
}

const memory = new Map<string, string>();
const tab = {
  get(key: string) {
    try {
      return globalThis.sessionStorage?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string) {
    memory.set(key, value);
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch {
      /* kept in memory for this visit */
    }
  },
};

export const SAMPLE_KEY = (id: string) => `omc:club-sample:${id}`;

export function sampleStore(id: string): ClubStore | null {
  const sample = sampleById(id);
  if (!sample) return null;
  const key = SAMPLE_KEY(sample.id);
  const load = (): SampleState => {
    try {
      const saved = JSON.parse(tab.get(key) ?? 'null') as SampleState | null;
      if (saved?.household?.id === sample.household.id) return saved;
    } catch {
      /* start over */
    }
    return { household: structuredClone(sample.household), documents: {} };
  };
  const save = (s: SampleState) => tab.set(key, JSON.stringify(s));
  const onboarded = (h: Household) => h.members.some((m) => !m.archived);
  /** The sample's made-up profile answers (src/data/club/samples.ts), or none. */
  const startProfile = (): FamilyProfile => structuredClone(sample.profile ?? emptyProfile());

  return {
    kind: 'sample',
    label: sample.label,
    async me() {
      const h = load().household;
      // Every kit in the registry is open in a sample (a preview of the newest work).
      return { access: true, onboarded: onboarded(h), kits: [...kits].reverse().map((k) => ({ slug: k.slug, can: 'edit' as const })) };
    },
    async household() {
      const h = load().household;
      return onboarded(h) ? h : null;
    },
    async saveHousehold(input) {
      const s = load();
      const known = new Set(s.household.members.map((m) => m.id));
      let next = s.household.members.length + 1;
      const members: FamilyMember[] = input.members.map((m) => {
        if (m.id && !known.has(m.id)) throw new Error('invalid');
        const id = m.id ?? `${s.household.id}-p${next++}`;
        return {
          id,
          firstName: m.firstName.trim(),
          kind: m.kind,
          role: m.role,
          ...(m.kind === 'child' ? { birthYear: m.birthYear, ...(m.birthMonth ? { birthMonth: m.birthMonth } : {}) } : {}),
          ...(m.isAccountHolder && m.kind === 'adult' ? { isAccountHolder: true } : {}),
        };
      });
      const keep = new Set(members.map((m) => m.id));
      // Like the database: people left out are archived, never deleted.
      const archived = s.household.members.filter((m) => !keep.has(m.id)).map((m) => ({ ...m, archived: true }));
      s.household = {
        ...s.household,
        ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : { displayName: undefined }),
        preferences: input.preferences,
        profileVersion: s.household.profileVersion + 1,
        members: [...members, ...archived],
      };
      save(s);
      return s.household;
    },
    async documents(slug) {
      return { can: 'edit', documents: load().documents[slug] ?? {} };
    },
    async saveDocument(slug, doc, saved, revision) {
      const s = load();
      const current = s.documents[slug]?.[doc];
      if (current && current.revision !== revision) throw new ConflictError();
      const next = (current?.revision ?? 0) + 1;
      s.documents[slug] = { ...(s.documents[slug] ?? {}), [doc]: { ...saved, revision: next } };
      save(s);
      return next;
    },
    async profile() {
      const s = load();
      return onboarded(s.household) ? s.profile ?? startProfile() : null;
    },
    async saveActivities(list) {
      return update('week', (p) => ({ ...p, activities: list.map((a, i) => ({ ...a, id: a.id ?? `${sample.id}-a${Date.now()}-${i}` })) }));
    },
    async saveResponsibilities(status, list) {
      return update(status === 'existing' ? 'responsibilities' : 'growth', (p) => ({
        ...p,
        responsibilities: [
          ...p.responsibilities.filter((r) => r.status !== status),
          ...list.map((r, i) => {
            const helperIds = r.helperIds.filter((h) => !r.ownerIds.includes(h));
            const scope = scopeOf(r.ownerIds);
            return { ...r, status, helperIds, id: r.id ?? `${sample.id}-r${Date.now()}-${i}`, ...(scope ? { scope } : { scope: undefined }) };
          }),
        ],
      }));
    },
    async saveFocus(step, f) {
      return update(step, (p) => ({
        ...p, challenges: [...new Set(f.challenges)],
        challengeNote: f.challengeNote?.trim() || undefined, priority: f.priority || undefined, priorityNote: f.priorityNote?.trim() || undefined,
      }));
    },
  };

  /** Like the database: replace one answer, mark its step. */
  function update(step: SetupStep, change: (p: FamilyProfile) => FamilyProfile): FamilyProfile {
    const s = load();
    if (!onboarded(s.household)) throw new Error('no_household');
    s.profile = markStep(change(s.profile ?? startProfile()), step);
    save(s);
    return s.profile;
  }
}

/** Start the sample over (the banner's "Reset sample"). */
export const resetSample = (id: string) => tab.set(SAMPLE_KEY(id), 'null');

/** ?sample=<id> on the current page, if it names a sample. */
export const sampleFromUrl = (search: string) => {
  const id = new URLSearchParams(search).get('sample');
  return sampleById(id) ? id : null;
};

/** A /club link that keeps the sample open. */
export const clubHref = (path: string, sample: string | null) => (sample ? `${path}${path.includes('?') ? '&' : '?'}sample=${encodeURIComponent(sample)}` : path);

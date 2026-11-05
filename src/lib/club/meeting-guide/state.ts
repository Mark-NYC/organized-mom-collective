/**
 * What a family keeps of their companion (saved with her month, src/lib/club/plan/account.ts): her corrections, a copy
 * of the profile answers it used, and the resulting ideas as structured data (src/lib/club/family-plan.ts). The
 * profile copy is why the owner's print view (which loads her household but not her profile) prints exactly what she
 * approved. Names and ages are never copied: they come from her household, so a change on her family page regenerates
 * the companion.
 */
import type { FamilyPlan } from '../family-plan';
import type { FamilyProfile } from '../family-profile';
import { isGuideStage, type GuideStage } from './stages';

export interface GuideProfile {
  priority?: string;
  priorityNote?: string;
  challenges: string[];
  challengeNote?: string;
  activities: { category: string; name?: string; memberIds: string[] }[];
  /** What someone already takes care of (existing) and what she'd like the kids to take on (desired). */
  responsibilities: { status: 'existing' | 'desired'; category: string; item?: string; ownerIds: string[] }[];
}

export interface GuideState {
  v: 2;
  /** Per person: a corrected stage (an age not given, or a child who's ahead or behind). */
  people: Record<string, { stage?: GuideStage }>;
  /** Ideas she took off the companion (their keys): "Skip it". */
  hidden: string[];
  /** Her changes to a suggestion ("Change it"): title, action or when, by key. Still a suggestion, not a commitment. */
  edits?: Record<string, { title?: string; action?: string; anchor?: string }>;
  /** Suggestions she marked "Keep it: this fits our family". A note for later months, not a commitment. */
  kept?: string[];
  /** The profile answers used, kept so every view of this companion is the same. */
  profile?: GuideProfile;
  /** The ideas as structured data, written with every save. Read by later months; never read back here. */
  plan?: FamilyPlan;
}

export const MAX_EDIT = 160;

export const emptyGuideState = (): GuideState => ({ v: 2, people: {}, hidden: [] });

const note = (s: string | undefined) => (s?.trim() ? s.trim().slice(0, 60) : undefined);

/** Only what the companion uses, from her full profile. */
export function guideProfile(p: FamilyProfile | null | undefined): GuideProfile | undefined {
  if (!p) return undefined;
  const out: GuideProfile = {
    ...(p.priority ? { priority: p.priority } : {}),
    ...(p.priority === 'other' && note(p.priorityNote) ? { priorityNote: note(p.priorityNote) } : {}),
    challenges: p.challenges.slice(0, 7),
    ...(p.challenges.includes('other') && note(p.challengeNote) ? { challengeNote: note(p.challengeNote) } : {}),
    activities: p.activities.slice(0, 12).map((a) => ({ category: a.category, ...(a.name?.trim() ? { name: a.name.trim().slice(0, 40) } : {}), memberIds: a.memberIds.slice(0, 20) })),
    responsibilities: p.responsibilities
      .filter((r): r is typeof r & { status: 'existing' | 'desired' } => r.status === 'existing' || r.status === 'desired')
      .slice(0, 30)
      .map((r) => ({ status: r.status, category: r.category, ...(r.item ? { item: r.item } : {}), ownerIds: r.ownerIds.slice(0, 20) })),
  };
  return out.priority || out.challenges.length || out.activities.length || out.responsibilities.length ? out : undefined;
}

export function isGuideState(v: unknown): v is GuideState {
  const s = v as GuideState;
  if (!s || typeof s !== 'object' || s.v !== 2) return false;
  if (!Array.isArray(s.hidden) || s.hidden.length > 200 || !s.hidden.every((k) => typeof k === 'string' && k.length <= 120)) return false;
  if (!s.people || typeof s.people !== 'object') return false;
  if (s.kept !== undefined && (!Array.isArray(s.kept) || !s.kept.every((k) => typeof k === 'string' && k.length <= 120))) return false;
  if (s.edits !== undefined) {
    if (!s.edits || typeof s.edits !== 'object') return false;
    for (const e of Object.values(s.edits)) {
      if (!e || typeof e !== 'object') return false;
      for (const v of [e.title, e.action, e.anchor]) if (v !== undefined && (typeof v !== 'string' || v.length > MAX_EDIT)) return false;
    }
  }
  for (const p of Object.values(s.people)) {
    if (!p || typeof p !== 'object') return false;
    if (p.stage !== undefined && !isGuideStage(p.stage)) return false;
  }
  if (s.profile !== undefined) {
    const g = s.profile;
    if (!g || !Array.isArray(g.challenges) || !Array.isArray(g.activities) || !Array.isArray(g.responsibilities ?? [])) return false;
  }
  return true;
}

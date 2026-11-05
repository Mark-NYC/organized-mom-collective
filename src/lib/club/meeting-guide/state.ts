/**
 * What a family keeps of their guide (saved with her month, src/lib/club/plan/account.ts): her choices, and a copy of
 * the profile answers the guide used. The copy is why the owner's print view (which loads her household but not her
 * profile) prints exactly what she approved. Names and ages are never copied: they always come from her household, so
 * a change on her family page regenerates the guide.
 */
import type { FamilyProfile } from '../family-profile';
import { isGuideStage, type GuideStage } from './stages';
import { PART_ORDER, type GuideMonthContent, type PartId } from './types';

export interface GuideProfile {
  priority?: string;
  challenges: string[];
  activities: { category: string; name?: string; memberIds: string[] }[];
}

export interface GuideState {
  v: 1;
  rhythm: string;
  /** Agreed actions (ids); empty means the generator's picks. */
  actions: string[];
  /** Who leads each part, when she changed it. */
  leaders: Partial<Record<PartId, string>>;
  /** Per person: a corrected stage, a different part, or a part in her own words. */
  people: Record<string, { stage?: GuideStage; part?: string; custom?: string }>;
  /** The profile answers used, kept so every view of this guide is the same. */
  profile?: GuideProfile;
}

export const MAX_CUSTOM = 90;

export const emptyGuideState = (content: GuideMonthContent): GuideState => ({ v: 1, rhythm: content.rhythm.defaultOption, actions: [], leaders: {}, people: {} });

/** Only what the guide uses, from her full profile. */
export function guideProfile(p: FamilyProfile | null | undefined): GuideProfile | undefined {
  if (!p) return undefined;
  const out: GuideProfile = {
    ...(p.priority ? { priority: p.priority } : {}),
    challenges: p.challenges.slice(0, 7),
    activities: p.activities.slice(0, 12).map((a) => ({ category: a.category, ...(a.name?.trim() ? { name: a.name.trim().slice(0, 40) } : {}), memberIds: a.memberIds.slice(0, 20) })),
  };
  return out.priority || out.challenges.length || out.activities.length ? out : undefined;
}

const str = (v: unknown, max = 60): v is string => typeof v === 'string' && v.length <= max;

export function isGuideState(v: unknown): v is GuideState {
  const s = v as GuideState;
  if (!s || typeof s !== 'object' || s.v !== 1 || !str(s.rhythm) || !Array.isArray(s.actions) || !s.actions.every((a) => str(a))) return false;
  if (!s.leaders || typeof s.leaders !== 'object' || !Object.entries(s.leaders).every(([k, id]) => (PART_ORDER as readonly string[]).includes(k) && str(id))) return false;
  if (!s.people || typeof s.people !== 'object') return false;
  for (const p of Object.values(s.people)) {
    if (!p || typeof p !== 'object') return false;
    if (p.stage !== undefined && !isGuideStage(p.stage)) return false;
    if (p.part !== undefined && !str(p.part)) return false;
    if (p.custom !== undefined && !str(p.custom, MAX_CUSTOM)) return false;
  }
  if (s.profile !== undefined) {
    const g = s.profile;
    if (!g || !Array.isArray(g.challenges) || !Array.isArray(g.activities)) return false;
  }
  return true;
}

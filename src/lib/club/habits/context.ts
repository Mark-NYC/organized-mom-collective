/**
 * Family context for habit selection: who's home and how old, what she reported, what they already do, and (later)
 * how earlier habits are going. Built only from her own information; nothing here is inferred.
 */
import type { FamilyMember, Household } from '../profile';
import { ageOn, stageFor, type GuideStage } from '../meeting-guide/stages';
import type { GuideProfile } from '../meeting-guide/state';
import type { ProgressMap } from './types';

export interface ChildContext {
  id: string;
  name: string;
  stage: GuideStage;
  age: number | null;
  /** Categories this child already takes care of (existing responsibilities). */
  owns: string[];
  /** Growth items she said she'd like this child to take on. */
  wishes: string[];
  /** Her own activities that include this child (name as she wrote it, days if she gave them). */
  activities: { name: string; category: string; days: number[] }[];
  /** Whether she listed this child in a school activity. */
  inSchool: boolean;
}

export interface FamilyContext {
  householdId: string;
  children: ChildContext[];
  adults: { id: string; name: string; isHolder: boolean; owns: string[] }[];
  priority?: string;
  priorityNote?: string;
  challenges: string[];
  /** Growth items she wants for the kids without naming one. */
  openWishes: string[];
  schoolWord: string;
  progress: ProgressMap;
}

const name = (m: FamilyMember) => m.firstName.trim();

export function familyContext(household: Household, profile: GuideProfile | null | undefined, month: string, opts: { stages?: Record<string, GuideStage>; progress?: ProgressMap } = {}): FamilyContext {
  const members = household.members.filter((m) => !m.archived && m.firstName.trim());
  const ids = new Set(members.map((m) => m.id));
  const mine = <T extends { memberIds?: string[]; ownerIds?: string[] }>(list: T[]) => list.filter((x) => (x.memberIds ?? x.ownerIds ?? []).every((id) => ids.has(id)));
  const responsibilities = mine(profile?.responsibilities ?? []);
  const activities = mine(profile?.activities ?? []).filter((a) => a.memberIds.length);
  const owns = (id: string) => responsibilities.filter((r) => r.status === 'existing' && r.ownerIds.includes(id)).map((r) => r.category);
  const desired = responsibilities.filter((r) => r.status === 'desired' && r.item);
  return {
    householdId: household.id,
    children: members.filter((m) => m.kind === 'child').map((m) => {
      const own = opts.stages?.[m.id];
      return {
        id: m.id, name: name(m), stage: own && own !== 'adult' ? own : stageFor(m, month), age: ageOn(m, month), owns: owns(m.id),
        wishes: desired.filter((r) => r.ownerIds.includes(m.id)).map((r) => r.item!),
        activities: activities.filter((a) => a.memberIds.includes(m.id) && a.category !== 'school' && a.category !== 'work')
          .map((a) => ({ name: a.name?.trim() || '', category: a.category, days: (a as { days?: number[] }).days ?? [] })).filter((a) => a.name),
        inSchool: activities.some((a) => a.category === 'school' && a.memberIds.includes(m.id)),
      };
    }),
    adults: members.filter((m) => m.kind === 'adult').map((m) => ({ id: m.id, name: name(m), isHolder: Boolean(m.isAccountHolder), owns: owns(m.id) })),
    ...(profile?.priority ? { priority: profile.priority } : {}),
    ...(profile?.priorityNote ? { priorityNote: profile.priorityNote } : {}),
    challenges: profile?.challenges ?? [],
    openWishes: desired.filter((r) => !r.ownerIds.length).map((r) => r.item!),
    schoolWord: household.preferences.school === 'homeschool' ? 'lessons' : 'school',
    progress: opts.progress ?? {},
  };
}

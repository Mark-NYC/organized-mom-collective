/**
 * The family a monthly resource is personalized for, built once from the saved profile and shared by every migrated
 * month (March, May, August so far; docs/club/PERSONALIZATION_FOUNDATION.md). January's architecture is the
 * reference: people by stable member id, ages for the resource's month and the January age stages
 * (../meeting-guide/stages.ts), and a snapshot of the profile answers kept with the month's saved plan
 * ("saved means settled", docs/club/PERSONALIZATION.md), so the owner's print view, which loads her household but not
 * her profile, prints exactly what she approved.
 *
 * Pure: no DOM, no storage. Months read the family only through these helpers, so a missing or thin profile is
 * handled in one place: every query answers "nothing known" and the month falls back to ages alone.
 */
import type { FamilyProfile } from '../family-profile';
import { ageOn, stageFor, type GuideStage } from '../meeting-guide/stages';
import type { FamilyMember, MemberRole } from '../profile';

/** What a month keeps of the profile beyond the people (onboarding steps 2–6). Names and ages are never copied. */
export interface FamilySnapshot {
  v: 1;
  activities: { category: string; name?: string; memberIds: string[]; days: number[]; startsAt?: string }[];
  responsibilities: { status: 'existing' | 'desired'; category: string; item?: string; ownerIds: string[]; helperIds: string[] }[];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ids = (xs: unknown, max = 20) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string' && x.length <= 80).slice(0, max) : []);

/** The parts of her profile a month uses; undefined when she hasn't answered anything that matters. */
export function familySnapshot(p: FamilyProfile | null | undefined): FamilySnapshot | undefined {
  if (!p) return undefined;
  const snap: FamilySnapshot = {
    v: 1,
    activities: p.activities.slice(0, 20).map((a) => ({
      category: a.category,
      ...(a.name?.trim() ? { name: a.name.trim().slice(0, 40) } : {}),
      memberIds: ids(a.memberIds),
      days: a.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7),
      ...(a.startsAt && TIME.test(a.startsAt) ? { startsAt: a.startsAt } : {}),
    })),
    responsibilities: p.responsibilities
      .filter((r): r is typeof r & { status: 'existing' | 'desired' } => r.status === 'existing' || r.status === 'desired')
      .slice(0, 30)
      .map((r) => ({ status: r.status, category: r.category, ...(r.item ? { item: r.item } : {}), ownerIds: ids(r.ownerIds), helperIds: ids(r.helperIds) })),
  };
  return snap.activities.length || snap.responsibilities.length ? snap : undefined;
}

export function isFamilySnapshot(x: unknown): x is FamilySnapshot {
  const s = x as Partial<FamilySnapshot> | null;
  if (!s || s.v !== 1 || !Array.isArray(s.activities) || !Array.isArray(s.responsibilities)) return false;
  if (s.activities.length > 20 || s.responsibilities.length > 30) return false;
  return s.activities.every((a) => a && typeof a.category === 'string' && Array.isArray(a.memberIds) && Array.isArray(a.days) && (a.startsAt === undefined || TIME.test(a.startsAt)))
    && s.responsibilities.every((r) => r && (r.status === 'existing' || r.status === 'desired') && typeof r.category === 'string' && Array.isArray(r.ownerIds) && Array.isArray(r.helperIds ?? []));
}

/**
 * January's rule: once a month's plan has a snapshot, it is rebuilt from that snapshot, never from newer answers;
 * newer answers come in only when she chooses to start over. Before anything is saved, today's answers are used.
 */
export const settledSnapshot = (saved: FamilySnapshot | undefined, fresh: FamilySnapshot | undefined) => saved ?? fresh;

export interface Person {
  id: string;
  name: string;
  kind: 'adult' | 'child';
  role: MemberRole | string;
  /** Children: whole years on the first day of the resource's month; null for adults or when no birth year is saved. */
  age: number | null;
  /** January's age stages ('child' = a child whose age isn't known). */
  stage: GuideStage;
  /** The adult who holds the account. Never the default owner: she leans last in ties. */
  holder: boolean;
}

export interface FamilyContext {
  month: string;
  /** Current members in household order, archived ones left out. */
  people: Person[];
  adults: Person[];
  children: Person[];
  pets: boolean;
  snapshot?: FamilySnapshot;
}

export interface ContextMember extends Pick<FamilyMember, 'id' | 'firstName' | 'kind' | 'birthYear' | 'birthMonth' | 'archived' | 'isAccountHolder'> {
  role?: MemberRole | string;
}

export function familyContext(members: readonly ContextMember[], prefs: { pets?: boolean } | undefined, month: string, snapshot?: FamilySnapshot): FamilyContext {
  const people: Person[] = members
    .filter((m) => !m.archived && m.firstName?.trim() && (m.kind === 'adult' || m.kind === 'child'))
    .map((m) => ({
      id: m.id,
      name: m.firstName.trim(),
      kind: m.kind,
      role: m.role ?? (m.kind === 'child' ? 'child' : 'parent'),
      age: ageOn(m as FamilyMember, month),
      stage: stageFor(m as FamilyMember, month),
      holder: Boolean(m.isAccountHolder) && m.kind === 'adult',
    }));
  const present = new Set(people.map((p) => p.id));
  // Answers that name people who are no longer here don't count.
  const snap = snapshot && {
    ...snapshot,
    activities: snapshot.activities.map((a) => ({ ...a, memberIds: a.memberIds.filter((i) => present.has(i)) })),
    responsibilities: snapshot.responsibilities.map((r) => ({ ...r, ownerIds: r.ownerIds.filter((i) => present.has(i)), helperIds: (r.helperIds ?? []).filter((i) => present.has(i)) })),
  };
  const pets = Boolean(prefs?.pets) || Boolean(snap?.responsibilities.some((r) => r.category === 'pet-care' || r.item === 'pet-care'));
  return {
    month, people, pets,
    adults: people.filter((p) => p.kind === 'adult'),
    children: people.filter((p) => p.kind === 'child'),
    ...(snap ? { snapshot: snap } : {}),
  };
}

export const personOf = (ctx: FamilyContext, id: string) => ctx.people.find((p) => p.id === id);

/** Who already takes care of an area (owners first, then helpers when asked), from step 3. */
export function existingFor(ctx: FamilyContext, category: string): { owners: string[]; helpers: string[] } {
  const rows = ctx.snapshot?.responsibilities.filter((r) => r.status === 'existing' && r.category === category) ?? [];
  return { owners: [...new Set(rows.flatMap((r) => r.ownerIds))], helpers: [...new Set(rows.flatMap((r) => r.helperIds))] };
}

/** Children she'd like to take on a growth item (step 4); `anyone` when she named it without a child. */
export function wishedFor(ctx: FamilyContext, items: readonly string[]): { ids: string[]; anyone: boolean } {
  const rows = ctx.snapshot?.responsibilities.filter((r) => r.status === 'desired' && ((r.item && items.includes(r.item)) || items.includes(r.category))) ?? [];
  return { ids: [...new Set(rows.flatMap((r) => r.ownerIds))], anyone: rows.some((r) => r.ownerIds.length === 0) };
}

/** A member's activities (step 2). An activity with nobody named counts for every child. */
export function activitiesOf(ctx: FamilyContext, memberId: string, category?: string) {
  const child = personOf(ctx, memberId)?.kind === 'child';
  return (ctx.snapshot?.activities ?? []).filter((a) => (!category || a.category === category) && (a.memberIds.includes(memberId) || (child && a.memberIds.length === 0)));
}

/** When school starts for a child, if she said ('HH:MM'). */
export const schoolStartFor = (ctx: FamilyContext, memberId: string) => activitiesOf(ctx, memberId, 'school').find((a) => a.startsAt)?.startsAt;

/** "Sofia", "Sofia and Mateo", "Sofia, Mateo and Elena". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export const namesOf = (ctx: FamilyContext, memberIds: readonly string[]) =>
  memberIds.map((i) => personOf(ctx, i)?.name).filter((n): n is string => Boolean(n));

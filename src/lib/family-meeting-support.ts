/**
 * How the family calendar supports the existing Family Meeting (src/data/club/meeting-guide.ts: once a week, ten
 * minutes, Our Focus · Let's Talk · Everyone's Part · Let's Practice). It adds no ritual and no step of its own
 * (docs/ios/FAMILY_MEETING_SUPPORT.md):
 *
 *   - Before: the next seven days on the family calendar, and what's new or changed since last week.
 *   - During: the same week, there to look at if the family wants it. Never a step, never required.
 *   - After: everyone's part as the month's meeting already lists it (the meeting engine, src/lib/club/family-meeting.ts,
 *     unchanged), shown in Today, and the cleaning parts in the cleaning companion.
 *
 * Pure: the screens, the meeting page and the tests read the same results. Reads only; saves, assigns and confirms
 * nothing (the meeting's "Suggestions stay suggestions" rule holds: suggestions are never shown here as agreed).
 */
import { addDays, occurrences, timeLabel, weekday, type CalendarEvent } from './calendar/recurrence';
import { buildFamilyMeeting, taskLabel } from './club/family-meeting';
import { STATUS_LABEL } from './club/family-meeting-view';
import { meetingMonth } from '../data/club/family-meeting';
import type { FamilyProfile } from './club/family-profile';
import type { Household } from './club/profile';

// ------------------------------------------------------------------ before and during: the week ahead

export type Change = 'new' | 'changed';

export interface WeekItem {
  id: string;
  date: string;
  /** "4:15 PM", "All day" or "Continues". */
  time: string;
  title: string;
  memberIds: string[];
  ownerId: string | null;
  change?: Change;
}
export interface WeekDay { date: string; label: string; items: WeekItem[] }
export interface WeekAhead {
  from: string;
  to: string;
  days: WeekDay[];
  /** Occurrences in the seven days. */
  count: number;
  /** Each event new or changed in the past seven days that happens in the next seven, once. */
  changes: { id: string; title: string; change: Change }[];
  /** Events nobody has said they'll handle yet (a question to talk over, not a task). */
  unhandled: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = 7 * 86_400_000;

/**
 * New or changed in the past week, from when it was last saved (the server's time, or this phone's before it syncs).
 * Revision 1 is its first save on the server, later revisions are edits; never saved there (0) counts as new.
 */
export function changeOf(e: CalendarEvent, now: Date): Change | undefined {
  if (!e.updated_at) return undefined;
  const at = Date.parse(e.updated_at);
  if (!Number.isFinite(at) || now.getTime() - at > WEEK || at > now.getTime() + 60_000) return undefined;
  return e.revision <= 1 ? 'new' : 'changed';
}

/** Today and the six days after it: whatever day the family meets, it's the week in front of them. */
export function weekAhead(events: CalendarEvent[], today: string, now = new Date()): WeekAhead {
  const to = addDays(today, 6);
  const occ = occurrences(events.filter((e) => !e.deleted), today, to);
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return { date, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[weekday(date)], items: [] };
  });
  const changes = new Map<string, { id: string; title: string; change: Change }>();
  const unhandled = new Set<string>();
  for (const o of occ) {
    const e = o.event;
    const change = changeOf(e, now);
    if (change && !changes.has(e.id)) changes.set(e.id, { id: e.id, title: e.title, change });
    if (!e.owner_member_id && !o.continued) unhandled.add(e.id);
    days[(Date.parse(`${o.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000]?.items.push({
      id: e.id, date: o.date,
      time: o.continued ? 'Continues' : timeLabel(e),
      title: e.title, memberIds: e.member_ids, ownerId: e.owner_member_id ?? null,
      ...(change ? { change } : {}),
    });
  }
  return { from: today, to, days, count: occ.length, changes: [...changes.values()], unhandled: unhandled.size };
}

// ------------------------------------------------------------------ after: everyone's part

export interface PartLine { text: string; label: (typeof STATUS_LABEL)['existing' | 'confirmed'] }
export interface PersonParts { memberId: string; name: string; parts: PartLine[] }
export interface MonthParts {
  /** 'YYYY-MM'. */
  month: string;
  resourceTitle: string;
  /** The month's Family Focus page; the meeting is `${route}?view=meeting`. */
  route: string;
  people: PersonParts[];
}

/**
 * Everyone's Part for the month, exactly as the month's Family Meeting lists it, without the suggestions: what each
 * person already does and what the family agreed. Agreed first. Null without a household or the month's content.
 */
export function monthParts(household: Household | null, profile: FamilyProfile | null, month: string): MonthParts | null {
  if (!household || !meetingMonth(Number(month.slice(5)))) return null;
  const m = buildFamilyMeeting({ household, profile, month });
  return {
    month, resourceTitle: m.resourceTitle, route: m.route,
    people: m.parts.people.map((p) => ({
      memberId: p.memberId,
      name: p.firstName,
      parts: [...p.confirmed, ...p.existing].map((r) => ({ text: r.description, label: STATUS_LABEL[r.status as 'existing' | 'confirmed'] })),
    })),
  };
}

/** Cleaning and laundry parts from the family profile (what each person already does or agreed to), for the companion. */
export const CLEANING_CATEGORIES = ['cleaning', 'laundry'] as const;

export function cleaningParts(household: Household | null, profile: FamilyProfile | null): PersonParts[] {
  if (!household || !profile) return [];
  const members = household.members.filter((m) => !m.archived && m.firstName.trim());
  const owned = profile.responsibilities.filter((r) =>
    (r.status === 'existing' || r.status === 'confirmed') && (CLEANING_CATEGORIES as readonly string[]).includes(r.category));
  return members
    .map((m) => ({
      memberId: m.id,
      name: m.firstName.trim(),
      parts: owned.filter((r) => r.ownerIds.includes(m.id)).map((r): PartLine => ({
        text: `Takes care of ${taskLabel(r).toLowerCase()}`,
        label: STATUS_LABEL[r.status as 'existing' | 'confirmed'],
      })),
    }))
    .filter((p) => p.parts.length);
}

/** The kit month 'YYYY-MM' for a date. */
export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

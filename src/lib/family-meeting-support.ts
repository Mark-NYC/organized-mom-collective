/**
 * How the family calendar supports the existing Family Meeting (src/data/club/meeting-guide.ts: once a week, ten
 * minutes, Our Focus · Let's Talk · Everyone's Part · Let's Practice). It adds no ritual and no step of its own
 * (docs/ios/FAMILY_MEETING_SUPPORT.md):
 *
 *   - Before: the next seven days on the family calendar, and what's new or changed since last week.
 *   - During: the same week, there to look at if the family wants it. Never a step, never required.
 *   - After: what the family agreed ("We agreed" in Everyone's Part, saved as confirmed responsibilities) in Today,
 *     the calendar and the cleaning companion. Suggestions and what was already done are never shown as agreed.
 *
 * Pure: the screens, the meeting page and the tests read the same results. Reads only.
 */
import { addDays, occurrences, timeLabel, weekday, type CalendarEvent } from './calendar/recurrence';
import { buildFamilyMeeting, taskLabel } from './club/family-meeting';
import { meetingMonth } from '../data/club/family-meeting';
import type { FamilyProfile, Responsibility } from './club/family-profile';
import type { ResponsibilityCategory } from '../data/club/family-profile';
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
  /** From a connected calendar: its name ("Lincoln Elementary"). */
  from?: string;
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

/**
 * The seven days the meeting looks at. Today: rolling, today and the six days after it. Ready for later: with the
 * household's Family Meeting day (0 = Sunday … 6), the week from the next meeting day (today, if it's that day), so
 * the week before the meeting is the one the meeting plans. No screen sets a meeting day yet.
 */
export function meetingWindow(today: string, meetingDay: number | null = null): { from: string; to: string } {
  const from = meetingDay === null || !Number.isInteger(meetingDay) || meetingDay < 0 || meetingDay > 6
    ? today
    : addDays(today, (meetingDay - weekday(today) + 7) % 7);
  return { from, to: addDays(from, 6) };
}

/** The meeting's seven days (meetingWindow), by day, with what's new or changed and what nobody is handling. */
export function weekAhead(events: CalendarEvent[], today: string, now = new Date(), meetingDay: number | null = null): WeekAhead {
  const { from, to } = meetingWindow(today, meetingDay);
  const occ = occurrences(events.filter((e) => !e.deleted), from, to);
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    return { date, label: date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : DAY_NAMES[weekday(date)], items: [] };
  });
  const changes = new Map<string, { id: string; title: string; change: Change }>();
  const unhandled = new Set<string>();
  for (const o of occ) {
    const e = o.event;
    const change = changeOf(e, now);
    if (change && !changes.has(e.id)) changes.set(e.id, { id: e.id, title: e.title, change });
    // Connected-calendar events (a school day off, a work meeting) aren't the family's to hand out: not counted.
    if (!e.owner_member_id && !o.continued && !e.external) unhandled.add(e.id);
    days[(Date.parse(`${o.date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000]?.items.push({
      id: e.id, date: o.date,
      time: o.continued ? 'Continues' : timeLabel(e),
      title: e.title, memberIds: e.member_ids, ownerId: e.owner_member_id ?? null,
      ...(e.external ? { from: e.external.sourceName } : {}),
      ...(change ? { change } : {}),
    });
  }
  return { from, to, days, count: occ.length, changes: [...changes.values()], unhandled: unhandled.size };
}

// ------------------------------------------------------------------ after: everyone's part

/**
 * One agreement as the screens show it. Only `confirmed` rows the family agreed to ("We agreed" in the meeting, or
 * edited since) are agreements; what the family already did before (`existing`) and every suggestion are not.
 */
export interface AgreedPart {
  id: string;
  text: string;
  when?: string;
  finished?: string;
  category: ResponsibilityCategory;
  ownerIds: string[];
  month?: string;
}
export interface PersonAgreements { memberId: string; name: string; parts: AgreedPart[] }

const DESCRIBE = (r: Responsibility) => r.agreement?.text ?? `Takes care of ${taskLabel(r).toLowerCase()}`;

/** Every agreement of the household, by person (shared ones under each owner), current members only, family order. */
export function agreementsByPerson(household: Household | null, profile: FamilyProfile | null, only?: (r: Responsibility) => boolean): PersonAgreements[] {
  if (!household || !profile) return [];
  const agreed = profile.responsibilities.filter((r) => r.status === 'confirmed' && r.id && (!only || only(r)));
  return household.members
    .filter((m) => !m.archived && m.firstName.trim())
    .map((m) => ({
      memberId: m.id,
      name: m.firstName.trim(),
      parts: agreed.filter((r) => r.ownerIds.includes(m.id)).map((r): AgreedPart => ({
        id: r.id!, text: DESCRIBE(r), category: r.category, ownerIds: r.ownerIds,
        ...(r.agreement?.when ? { when: r.agreement.when } : {}), ...(r.agreement?.finished ? { finished: r.agreement.finished } : {}),
        ...(r.agreement?.month ? { month: r.agreement.month } : {}),
      })),
    }))
    .filter((p) => p.parts.length);
}

export interface MonthAgreements {
  /** 'YYYY-MM'. */
  month: string;
  resourceTitle: string;
  /** The month's Family Focus page; the meeting is `${route}?view=meeting`. */
  route: string;
  people: PersonAgreements[];
}

/**
 * Everyone's Part for the month after the meeting: the agreements the month's Family Meeting shows as "Agreed by our
 * family" (the meeting engine decides which belong to the month), never its suggestions or what was already done.
 */
export function monthAgreements(household: Household | null, profile: FamilyProfile | null, month: string): MonthAgreements | null {
  if (!household || !meetingMonth(Number(month.slice(5)))) return null;
  const m = buildFamilyMeeting({ household, profile, month });
  const inMeeting = new Set(m.parts.people.flatMap((p) => p.confirmed.map((r) => r.sourceId)));
  return { month, resourceTitle: m.resourceTitle, route: m.route, people: agreementsByPerson(household, profile, (r) => inMeeting.has(r.id)) };
}

/** Cleaning and laundry agreements, for the cleaning companion. */
export const CLEANING_CATEGORIES: readonly ResponsibilityCategory[] = ['cleaning', 'laundry'];
export const cleaningAgreements = (household: Household | null, profile: FamilyProfile | null) =>
  agreementsByPerson(household, profile, (r) => CLEANING_CATEGORIES.includes(r.category));

/** The kit month 'YYYY-MM' for a date. */
export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

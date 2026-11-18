/** One occurrence of an event from a connected calendar, as stored in calendar_imported_events. */
export interface ImportedInstance {
  /** Stable per occurrence within its calendar: Google's instance id, or the feed's UID (+ the original start for repeats). */
  instance_key: string;
  /** The event's iCalendar UID (Google's iCalUID), for spotting the same event in two calendars. */
  uid: string;
  title: string;
  location: string | null;
  notes: string | null;
  all_day: boolean;
  /** All-day: first and last day (inclusive), wall dates. */
  start_date: string | null;
  end_date: string | null;
  /** Timed: instants (ISO, UTC). */
  starts_at: string | null;
  ends_at: string | null;
  /** The zone the organizer used, for reference. */
  timezone: string | null;
  /** Where to open it (Google's htmlLink, or the feed's URL property when it's an https link). */
  url: string | null;
  recurring: boolean;
  /** Marked private/confidential where it came from: the household sees "Busy" only. */
  private: boolean;
}

export const LIMITS = { title: 200, location: 200, notes: 1000, url: 1000, perCalendar: 3000 } as const;

export const clip = (s: string | null | undefined, n: number): string | null => {
  const t = (s ?? '').replace(/\u0000/g, '').trim();
  return t ? (t.length > n ? `${t.slice(0, n - 1)}…` : t) : null;
};

/** Only plain web links are kept as "open in" links. */
export const safeLink = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    const x = new URL(u.trim());
    return x.protocol === 'https:' ? clip(x.toString(), LIMITS.url) : null;
  } catch {
    return null;
  }
};

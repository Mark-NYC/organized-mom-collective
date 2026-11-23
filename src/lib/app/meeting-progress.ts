/**
 * Where the family is with its weekly Family Meeting (two-tab redesign, docs/ios/TWO_TAB_REDESIGN.md), so the
 * Family Meeting tab can say Start, Continue, or that the family met recently, without ever making it up:
 *
 *   - Progress is recorded when the meeting is actually used: the step reached when a part opens, and "finished" only
 *     when the family taps Finish meeting. Nothing is inferred from agreements or the calendar.
 *   - It is kept on THIS phone (localStorage, per household), like the meeting's own draft state. A meeting started on
 *     one phone isn't resumable on the other adult's phone; that would need a shared record (not built: no new
 *     database table for this redesign).
 *   - Missing weeks are never counted or mentioned. An unfinished meeting older than three days simply starts fresh.
 */
import { occurrences, timeLabel, type CalendarEvent } from '../calendar/recurrence';

export interface MeetingProgress {
  /** 0-based index of the part the family reached (MEETING_GUIDE.parts). */
  step: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type MeetingState = 'first' | 'ready' | 'in-progress' | 'recent';

const KEY = 'omc:meeting:progress:v1';
const DAY = 86_400_000;
const keyFor = (scope: string | null) => `${KEY}:${scope ?? 'local'}`;

export function readProgress(scope: string | null): MeetingProgress | null {
  try {
    const p = JSON.parse(localStorage.getItem(keyFor(scope)) ?? 'null') as MeetingProgress | null;
    return p && typeof p.step === 'number' && typeof p.startedAt === 'string' ? p : null;
  } catch { return null; }
}
const write = (scope: string | null, p: MeetingProgress | null) => {
  try { if (p) localStorage.setItem(keyFor(scope), JSON.stringify(p)); else localStorage.removeItem(keyFor(scope)); } catch { /* this visit only */ }
};

/** A part was opened: start a meeting (if none is in progress) or move it along. */
export function recordStep(scope: string | null, step: number, now = new Date()): MeetingProgress {
  const cur = readProgress(scope);
  const at = now.toISOString();
  const open = cur && !cur.completedAt && now.getTime() - Date.parse(cur.updatedAt) < 3 * DAY;
  const next: MeetingProgress = open ? { ...cur!, step, updatedAt: at } : { step, startedAt: at, updatedAt: at, completedAt: null };
  write(scope, next);
  return next;
}

/** The family tapped Finish meeting. */
export function recordFinished(scope: string | null, now = new Date()): MeetingProgress {
  const cur = readProgress(scope);
  const at = now.toISOString();
  const done: MeetingProgress = { step: 3, startedAt: cur?.startedAt ?? at, updatedAt: at, completedAt: at };
  write(scope, done);
  return done;
}

/** Start over: forget an unfinished meeting (a finished one is kept, so "you met on Sunday" stays true). */
export function startOver(scope: string | null) {
  const cur = readProgress(scope);
  if (cur && !cur.completedAt) write(scope, null);
}

/**
 * first: nothing agreed and never met here. in-progress: started in the last three days, not finished (Continue).
 * recent: finished in the last six days. ready: everything else (including after weeks away: no counting, no guilt).
 */
export function meetingState(progress: MeetingProgress | null, hasAgreements: boolean, now = new Date()): MeetingState {
  if (progress && !progress.completedAt && now.getTime() - Date.parse(progress.updatedAt) < 3 * DAY) return 'in-progress';
  if (progress?.completedAt && now.getTime() - Date.parse(progress.completedAt) < 6 * DAY) return 'recent';
  if (!progress?.completedAt && !hasAgreements) return 'first';
  return 'ready';
}

/** "Sunday" / "today" / "yesterday" for a past instant, in this device's zone. */
export function dayWord(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export interface ScheduledMeeting { date: string; time: string | null; title: string }
/**
 * The family's next Family Meeting, only when it's really on the family's calendar: the next occurrence, in the coming
 * two weeks, of an event they named "Family Meeting". None: null (no date or time is ever made up).
 */
export function nextScheduledMeeting(events: CalendarEvent[], today: string, now = new Date(), days = 14): ScheduledMeeting | null {
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const found = occurrences(events.filter((e) => /family meeting/i.test(e.title)), today, end.toISOString().slice(0, 10))
    .filter((o) => !(o.date === today && o.event.start_time && (o.event.end_time ?? o.event.start_time) < hhmm))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.event.start_time ?? '').localeCompare(b.event.start_time ?? ''))[0];
  return found ? { date: found.date, time: found.event.start_time ? timeLabel(found.event) : null, title: found.event.title } : null;
}

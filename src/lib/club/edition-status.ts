/**
 * The editing window in words, for the mobile plan: a date while there's plenty of time, the weekday in the last
 * three days, then "tonight", then closed. No ticking minutes. The cutoff itself comes from clubEditingDeadline (./deadline.ts).
 */
export type WindowPhase = 'open' | 'soon' | 'today' | 'closed';

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...o }).format(d);

export function editingWindow(deadlineIso: string, now: Date = new Date()): { phase: WindowPhase; text: string } {
  const deadline = new Date(deadlineIso);
  if (Number.isNaN(deadline.getTime())) return { phase: 'open', text: 'Editing cutoff not scheduled yet' };
  const ms = deadline.getTime() - now.getTime();
  const day = fmt(deadline, { weekday: 'short', month: 'short', day: 'numeric' });
  if (ms <= 0) return { phase: 'closed', text: `Changes closed ${fmt(deadline, { month: 'short', day: 'numeric' })}` };
  const sameDay = fmt(deadline, { dateStyle: 'short' }) === fmt(now, { dateStyle: 'short' });
  if (sameDay) return { phase: 'today', text: 'Changes close tonight at 11:59 PM ET' };
  if (ms <= 72 * 3600 * 1000) {
    return { phase: 'soon', text: `Changes close ${fmt(deadline, { weekday: 'long' })} at 11:59 PM ET` };
  }
  const year = fmt(deadline, { year: 'numeric' }) !== fmt(now, { year: 'numeric' }) ? `, ${fmt(deadline, { year: 'numeric' })}` : '';
  return { phase: 'open', text: `Changes open until ${day}${year}` };
}

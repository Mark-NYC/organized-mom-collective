/**
 * What the engine has learned, in a mom's words (Account → Household intelligence). Pure, so tests pin the wording.
 *
 * Memory holds opaque ids, never titles, so a sentence describes the rhythm ("A plan that happens every Tuesday"), and
 * names come only from the family's own member list on this device. Observed ownership is described as what happened,
 * never as a judgment or an assignment.
 */
import type { MemoryView } from './client';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const suffix = (n: number) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

export function rhythm(cadence: string | null, anchor: unknown): string | null {
  const a = anchor == null ? '' : String(anchor);
  switch (cadence) {
    case 'daily': return 'most days';
    case 'weekly': return /^[0-6]$/.test(a) ? `every ${WEEKDAY[Number(a)]}` : 'every week';
    case 'biweekly': return /^[0-6]$/.test(a) ? `every other ${WEEKDAY[Number(a)]}` : 'every other week';
    case 'monthly': {
      const nth = a.match(/^([1-5]):([0-6])$/);
      if (nth) return `on the ${ORD[Number(nth[1])]} ${WEEKDAY[Number(nth[2])]} of the month`;
      return /^\d{1,2}$/.test(a) ? `around the ${a}${suffix(Number(a))} of each month` : 'once a month';
    }
    case 'seasonal': return 'about once a season';
    case 'annual': {
      const md = a.match(/^(\d{2})-(\d{2})$/);
      return md ? `every year around ${MONTH[Number(md[1]) - 1]} ${Number(md[2])}` : 'once a year';
    }
    default: return null;
  }
}

const SUBJECT: Record<string, string> = {
  'event-occurred': 'A plan', 'task-done': 'A job', 'handoff-covered': 'A handoff', 'request-asked': 'A request', 'priority-chosen': 'Picking a priority',
  'report-made': 'A check-in', 'agreement-changed': 'Changing an agreement',
};

const hour = (h: number) => (h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h} am` : `${h - 12} pm`);

export function describeMemory(m: Pick<MemoryView, 'category' | 'subject_key' | 'content' | 'cadence' | 'status' | 'source'>, names: Record<string, string>): string {
  const c = m.content ?? {};
  const name = (id: unknown) => (typeof id === 'string' && names[id]) || 'Someone';
  if (m.subject_key.startsWith('owner:')) {
    const agreed = Array.isArray(c.agreed_owners) ? (c.agreed_owners as string[]).map(name).join(' and ') : null;
    return c.differs_from_agreement && agreed
      ? `${name(c.observed_owner)} has been doing one of the jobs ${agreed} agreed to take. Worth a word at your Family Meeting?`
      : `${name(c.observed_owner)} has been doing one of the family's jobs most weeks.`;
  }
  if (m.subject_key === 'load:adults') return `${name(c.carries_most)} has been doing most of the jobs recorded lately. A question for your Family Meeting, not a to-do.`;
  if (m.category === 'timing' && m.subject_key === 'opens' && typeof c.from_hour === 'number' && typeof c.to_hour === 'number')
    return `You usually open the app between ${hour(c.from_hour)} and ${hour(c.to_hour)}. Only you see this.`;
  if (m.category === 'preference') {
    if (c.response === 'already-handled') return 'You usually have this kind of reminder covered already, so it comes up less.';
    if (c.response === 'not-relevant' || c.response === 'never') return 'You said this kind of reminder doesn’t fit your family, so it stays off.';
    if (typeof c.choice === 'string') return `You usually choose “${c.choice.replace(/-/g, ' ')}”.`;
  }
  const what = SUBJECT[m.subject_key.split(':')[0]] ?? 'Something';
  const when = rhythm(m.cadence, c.anchor);
  if (!when) return `${what} your family does regularly.`;
  return `${what} that happens ${when}.`;
}

export const statusLine = (m: Pick<MemoryView, 'status' | 'source'>) =>
  m.status === 'confirmed' ? 'You told us' : m.status === 'observed' ? 'Noticed, not confirmed' : 'Still learning';

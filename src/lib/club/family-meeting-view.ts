/**
 * How a prepared Monthly Family Meeting (./family-meeting.ts) reads on the page and on its one printed page. Pure and
 * deterministic, so the screen, the print and the tests agree.
 *
 * Screen: everything the engine prepared. Print (one US Letter page): the same meeting, shortened by fixed rules
 * instead of shrinking type, so a large family still gets readable text:
 *   - Everyone's Part keeps each person's most important items (agreed, suggested, owns, helps): up to 3 each
 *     for four people or fewer, 2 for up to six, 1 beyond that, and says how many more are on screen.
 *   - "Finished looks like" prints for every item up to six people; beyond that only for each person's first new
 *     (agreed or suggested) item, and only once when several people have the same suggestion.
 *   - Long lines are cut at a word boundary with an ellipsis (descriptions 96 characters, finished 84), never mid-word.
 *   - Seven people or more print in three columns, each name above its items, without the "shared with" notes and
 *     the "For …" names line (everyone is listed in Everyone's Part), the closing "Then use …" line, and with one
 *     "more on screen" note instead of one per person.
 */
import type { FamilyMeeting, PartRecommendation, PersonPart } from './family-meeting';

export const STATUS_LABEL = {
  existing: 'Already doing',
  suggested: 'Suggested for us',
  confirmed: 'Agreed by our family',
} as const;

export interface MeetingItemView {
  status: PartRecommendation['status'];
  label: (typeof STATUS_LABEL)[keyof typeof STATUS_LABEL];
  text: string;
  /** "Shared with Ana" or "Helps when asked", when it applies. */
  detail?: string;
  when?: string;
  finished?: string;
}

export interface MeetingPersonView {
  memberId: string;
  name: string;
  /** "Age 8", "Grown-up", "Under 1". */
  role: string;
  joinsIn: boolean;
  items: MeetingItemView[];
  /** Items left off the printed page (shown on screen). */
  more: number;
}

export interface MeetingView {
  leader: { name: string | null; text: string };
  people: MeetingPersonView[];
  /** Print in two columns. */
  dense: boolean;
}

const ORDER: Record<string, number> = { confirmed: 0, suggested: 1, owns: 2, helps: 3 };
const READ: Record<PartRecommendation['status'], number> = { existing: 0, confirmed: 1, suggested: 2 };
const rank = (r: PartRecommendation) => (r.status === 'existing' ? ORDER[r.involvement] : ORDER[r.status]);

/** Cut at a word boundary, never mid-word; unchanged when it fits. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

export const PRINT_LIMITS = { description: 96, finished: 84 } as const;

export function itemsPerPerson(people: number): number {
  return people <= 4 ? 3 : people <= 6 ? 2 : 1;
}

export function meetingView(meeting: FamilyMeeting, opts: { print: boolean }): MeetingView {
  const named = (id: string) => meeting.parts.people.find((p) => p.memberId === id)?.firstName;
  const people = meeting.parts.people;
  const count = people.length;
  const limit = opts.print ? itemsPerPerson(count) : Infinity;
  const allFinished = !opts.print || count <= 6;

  const finishedSeen = new Set<string>();
  const personView = (p: PersonPart): MeetingPersonView => {
    // Choose by importance (agreed, suggested, owns, helps), then read in order: already doing, agreed, suggested.
    const all = [...p.confirmed, ...p.suggested, ...p.existing].sort((a, b) => rank(a) - rank(b));
    const shown = all.slice(0, limit).sort((a, b) => READ[a.status] - READ[b.status]);
    let finishedLeft = allFinished ? Infinity : 1;
    const items = shown.map((r): MeetingItemView => {
      const others = r.scope === 'shared' && r.status !== 'suggested'
        ? people.filter((x) => x.memberId !== p.memberId && [...x.existing, ...x.confirmed].some((o) => o.sourceId && o.sourceId === r.sourceId && o.involvement === 'owns')).map((x) => x.firstName)
        : [];
      // Seven people or more on paper: "shared with" repeats what the other person's row already says.
      const detail = r.involvement === 'helps' || (opts.print && count > 6) ? undefined : others.length ? `Shared with ${others.join(' and ')}` : undefined;
      const showFinished = finishedLeft > 0 && (allFinished || (r.status !== 'existing' && !finishedSeen.has(r.finished)));
      if (showFinished && !allFinished) finishedSeen.add(r.finished);
      if (showFinished && !allFinished) finishedLeft--;
      const text = opts.print ? clip(r.description, PRINT_LIMITS.description) : r.description;
      return {
        status: r.status, label: STATUS_LABEL[r.status], text,
        ...(detail ? { detail } : {}),
        ...(r.when ? { when: r.when } : {}),
        ...(showFinished && r.finished ? { finished: opts.print ? clip(r.finished, PRINT_LIMITS.finished) : r.finished } : {}),
      };
    });
    return {
      memberId: p.memberId,
      name: p.firstName,
      role: p.kind === 'adult' ? 'Grown-up' : p.age === null ? 'Child' : p.age < 1 ? 'Under 1' : `Age ${p.age}`,
      joinsIn: Boolean(p.joinsIn),
      items,
      more: all.length - shown.length,
    };
  };

  const leaderName = meeting.leaderId ? named(meeting.leaderId) ?? null : null;
  return {
    leader: {
      name: leaderName,
      text: leaderName ? `${leaderName} reads the meeting this month. Anyone can take a turn.` : 'Anyone can read the meeting.',
    },
    people: people.map(personView),
    dense: opts.print && count > 6,
  };
}

/** "January 2027" for a kit month 'YYYY-MM'. */
export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
}

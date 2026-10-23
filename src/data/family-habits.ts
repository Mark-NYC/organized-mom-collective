/**
 * The Family Habit Builder's choices and rules (src/components/site/HabitBuilder.astro and habit-builder.ts beside
 * it): one everyday frustration turned into one shared habit, tied to something the family already does ("After
 * dinner, everyone spends five minutes resetting the kitchen."), with what done looks like and a seven-day practice
 * card. One habit at a time, by design: no streaks, points or reminders.
 */

export interface HabitArea {
  /** Stable once released: saved choices and kits point at it. */
  id: string;
  /** What she'd like to make easier. */
  label: string;
  /** What everyone does, in the plural form ("spend five minutes…"); the statement makes it agree with who. */
  action: string;
  /** What finished looks like, so nobody has to check. */
  doneMeans: string;
  /** The moment it attaches to, best first. */
  when: string;
  /** An illustration from src/data/responsibilities.ts for the card. */
  illustration?: string;
}

export const habitAreas: HabitArea[] = [
  { id: 'out-the-door', label: 'Getting out the door', when: 'before-bed', illustration: 'pack-my-backpack',
    action: 'put shoes, coats and bags by the door', doneMeans: 'Shoes, coats and bags are by the door, ready for the morning.' },
  { id: 'kitchen', label: 'Keeping the kitchen tidy', when: 'after-dinner', illustration: 'wipe-the-counters',
    action: 'spend five minutes resetting the kitchen', doneMeans: 'Dishes are in the dishwasher, the counters are wiped and the table is clear.' },
  { id: 'put-away', label: 'Putting things away', when: 'home-from-school', illustration: 'put-toys-away',
    action: 'put their own things back where they belong', doneMeans: 'Bags, shoes and coats are in their spots, and nothing is left on the floor or the table.' },
  { id: 'bedtime', label: 'Preparing for bedtime', when: 'after-dinner', illustration: 'get-ready-for-bed',
    action: 'turn off screens and start the bedtime steps', doneMeans: 'Screens are off, pajamas are on and teeth are brushed by the time we agreed.' },
  { id: 'tomorrow', label: 'Getting ready for tomorrow', when: 'before-bed', illustration: 'get-dressed',
    action: 'spend five minutes getting ready for tomorrow', doneMeans: 'Tomorrow’s clothes are out, bags are packed, and everyone has looked at tomorrow on the family calendar.' },
];
export const OTHER_AREA = 'other';
export const habitAreaById = (id: string | null | undefined) => habitAreas.find((a) => a.id === id);

/** Things the family already does, to attach the new habit to (habit stacking). */
export const habitMoments: { id: string; label: string; phrase: string }[] = [
  { id: 'after-breakfast', label: 'After breakfast', phrase: 'After breakfast' },
  { id: 'before-leaving', label: 'Before leaving home', phrase: 'Before we leave the house' },
  { id: 'home-from-school', label: 'When we get home', phrase: 'When we get home from school' },
  { id: 'after-dinner', label: 'After dinner', phrase: 'After dinner' },
  { id: 'before-bed', label: 'Before bedtime', phrase: 'Before bedtime' },
];
export const habitMomentById = (id: string | null | undefined) => habitMoments.find((m) => m.id === id);

export type HabitWho = 'everyone' | 'adults' | 'children' | 'some';
export const whoOptions: { id: HabitWho; label: string }[] = [
  { id: 'everyone', label: 'Whole family' },
  { id: 'adults', label: 'Adults' },
  { id: 'children', label: 'Children' },
  { id: 'some', label: 'Specific people' },
];

export const HABIT_REFLECTION = 'Did this make our day easier? What should we change?';
export const PRACTICE_DAYS = 7;
export const MAX_HABIT_TEXT = 160;

/** "Ana, Luis and Sofia" */
export const nameList = (names: readonly string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** Who, as the statement's subject: one word for everyone, else a plural. */
export function whoSubject(who: HabitWho, names: readonly string[] = []): { text: string; singular: boolean } {
  if (who === 'adults') return { text: 'the grown-ups', singular: false };
  if (who === 'children') return { text: 'the kids', singular: false };
  if (who === 'some' && names.length) return { text: nameList(names), singular: names.length === 1 };
  return { text: 'everyone', singular: true };
}

/** "spend five minutes…" → "spends five minutes…" (her own words too: the first word only). */
export function singularVerb(phrase: string): string {
  const [first, ...rest] = phrase.trim().split(/\s+/);
  if (!first) return phrase;
  const lower = first.toLowerCase();
  const verb = lower === 'have' ? 'has' : lower === 'do' ? 'does' : lower === 'go' ? 'goes'
    : /(s|sh|ch|x|z)$/.test(lower) ? `${first}es`
    : /[^aeiou]y$/.test(lower) ? `${first.slice(0, -1)}ies`
    : `${first}s`;
  return [verb, ...rest].join(' ');
}

/** The habit in one sentence: when, who, what. */
export function habitStatement(moment: string, who: HabitWho, action: string, names: readonly string[] = []): string {
  const what = action.trim().replace(/[.!]+$/, '');
  if (!what) return '';
  const subject = whoSubject(who, names);
  const phrase = habitMomentById(moment)?.phrase ?? (moment.trim() || 'Each day');
  return `${phrase}, ${subject.text} ${subject.singular ? singularVerb(what) : what}.`;
}

/** Who, in words for the card ("The whole family", "Ana and Sofia"). */
export function whoLabel(who: HabitWho, names: readonly string[] = []): string {
  if (who === 'adults') return 'The grown-ups';
  if (who === 'children') return 'The kids';
  if (who === 'some' && names.length) return nameList(names);
  return 'The whole family';
}

/** The seven practice days: from her start day when she has one, else Day 1–7. Never more than seven. */
export function practiceDays(start?: string | null): string[] {
  const m = start ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(start) : null;
  if (!m) return Array.from({ length: PRACTICE_DAYS }, (_, i) => `Day ${i + 1}`);
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Array.from({ length: PRACTICE_DAYS }, (_, i) => {
    const d = new Date(base + i * 86_400_000);
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  });
}

/** The habit as plain text, for a note, a message or the family calendar. */
export function habitText(h: { statement: string; when: string; who: string; doneMeans: string; start?: string; checkIn?: string }): string {
  return [
    'Our family’s new rhythm',
    '',
    h.statement,
    '',
    `When: ${h.when}`,
    `Who: ${h.who}`,
    ...(h.doneMeans.trim() ? [`Done means: ${h.doneMeans.trim()}`] : []),
    ...(h.start ? [`We start: ${h.start}${h.checkIn ? ` · We check in: ${h.checkIn}` : ''}`] : []),
    '',
    `Try it for seven days, then ask: ${HABIT_REFLECTION}`,
  ].join('\n');
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const asUtc = (day: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
};
/** "Monday, January 4" for a 'YYYY-MM-DD' day ('' when it isn't one). */
export function dayLabel(day: string): string {
  const d = asUtc(day);
  return d ? `${WEEKDAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}` : '';
}
/** The check-in day: a week after the start, when the seven days are done. */
export function checkInDay(start: string): string {
  const d = asUtc(start);
  if (!d) return '';
  const c = new Date(d.getTime() + PRACTICE_DAYS * 86_400_000);
  return `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, '0')}-${String(c.getUTCDate()).padStart(2, '0')}`;
}

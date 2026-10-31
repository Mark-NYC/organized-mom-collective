/** Print enrollment closes at the end of each month's second Sunday, New York time. */
export const CLUB_TIME_ZONE = 'America/New_York';
function localDate(date: Date) {
 const parts = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
 const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
 return { year: get('year'), month: get('month') - 1, day: get('day') };
}
function cutoff(year: number, month: number) {
 const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
 const sunday = 1 + ((7 - firstDay) % 7) + 7;
 // Exclusive cutoff: midnight immediately after Sunday. Resolve the local time
 // through Intl so both EST and EDT work without hard-coded seasonal dates.
 const wallTime = Date.UTC(year, month, sunday + 1);
 let instant = wallTime;
 for (let i = 0; i < 3; i++) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  const represented = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  instant += wallTime - represented;
 }
 return new Date(instant);
}
export function nextClubPrintDeadline(now = new Date()) {
 const { year, month } = localDate(now);
 const current = cutoff(year, month);
 return now < current ? current : cutoff(year, month + 1);
}
/** The monthly program's first print run, January 2027, closes on December 13, 2026; nothing prints monthly before it. */
const FIRST_PRINT_RUN_DEADLINE = cutoff(2026, 11);
/** The next deadline that prints a monthly plan: never one before the program's first print run. */
export function nextProgramPrintDeadline(now = new Date()) {
 const next = nextClubPrintDeadline(now);
 return next < FIRST_PRINT_RUN_DEADLINE ? FIRST_PRINT_RUN_DEADLINE : next;
}
/** The cutoff month's following month is the resource delivered. */
function printMonth(lastDay: Date) {
 const { year, month } = localDate(lastDay);
 return new Date(Date.UTC(year, month + 1, 15)).getUTCMonth();
}
const MONTHLY_OFFERS = [
 'Help your kids build better morning and bedtime habits. Get January’s Habit Cards',
 'Make more room for family connection. Get February’s Connection Cards',
 'Get the whole family helping with spring cleaning. Get March’s Chore Chart',
 'Make dinner a team effort. Get April’s Dinner Team Kit',
 'Give your family a simple summer rhythm. Get May’s Summer Day Planner',
 'Help your kids make their own snacks. Get June’s Snack Station Kit',
 'Give bored kids ideas they can use on their own. Get July’s Activity Kit',
 'Make back-to-school mornings easier. Get August’s School Routine Kit',
 'Put the whole family on the same page. Get September’s Weekly Plan',
 'Make Sundays easier with a shared family reset. Get October’s Sunday Reset',
 'Share responsibility at home. Get November’s Family Ownership Kit',
 'Help your kids bless someone else. Get December’s Giving Cards',
] as const;

/** Benefit-led monthly message; transitions automatically after the second-Sunday cutoff in New York. */
export function clubPrintMessages(now = new Date(), offer = false) {
 const end = nextProgramPrintDeadline(now);
 const lastDay = new Date(end.getTime() - 1);
 const deadlineDate = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, month: 'short', day: 'numeric' }).format(lastDay);
 const monthIndex = printMonth(lastDay);
 const message = MONTHLY_OFFERS[monthIndex];
 const remainingDays = (end.getTime() - now.getTime()) / 86400000;
 const deadline = remainingDays <= 3 ? 'Order by Sunday' : `Order by ${deadlineDate}`;
 return [
  `${message}. ${deadline} →`,
  offer ? 'Your First Month FREE · Then $5.90/month · Explore the Club →' : 'Personalized printed tools, mailed monthly · $5.90/month · Explore the Club →',
 ];
}

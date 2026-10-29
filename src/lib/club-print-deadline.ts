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
export function clubPrintMessages(now = new Date()) {
 const end = nextClubPrintDeadline(now);
 const lastDay = new Date(end.getTime() - 1);
 const date = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, month: 'short', day: 'numeric' }).format(lastDay);
 const minutes = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 60000));
 const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60);
 const remaining = days ? `${days}d ${hours}h left` : hours ? `${hours}h ${minutes % 60}m left` : `${minutes}m left`;
 return [
  `Next Club print deadline: ${date} · ${remaining} · Closes 11:59 p.m. ET →`,
  'Personalized printed tools, mailed monthly · $5.90/month · Explore the Club →',
 ];
}

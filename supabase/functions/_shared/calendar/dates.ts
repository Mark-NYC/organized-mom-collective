/** Calendar-date arithmetic on 'YYYY-MM-DD' strings (UTC midnight math, no DST). */
const DAY = 86_400_000;
export const toDays = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY;
export const fromDays = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromDays(toDays(d) + n);
export const weekday = (d: string) => new Date(toDays(d) * DAY).getUTCDay();
export const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
export const ymd = (y: number, m0: number, d: number) => `${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

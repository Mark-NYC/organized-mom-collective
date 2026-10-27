/** Monthly Club editing cutoff: the second Sunday, 11:59:59 p.m. America/New_York.
 * Returns an absolute ISO timestamp so browser clocks in other time zones agree.
 * Editing/fulfillment services must enforce this rule separately.
 */
export function clubEditingDeadline(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid Club month');
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDow = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const secondSunday = 1 + (7 - firstDow) % 7 + 7;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Midday UTC is within the same calendar date in New York. Get its DST-aware offset.
  const probe = new Date(Date.UTC(year, monthNumber - 1, secondSunday, 12));
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', timeZoneName: 'shortOffset',
  }).formatToParts(probe).find((part) => part.type === 'timeZoneName')?.value ?? '';
  const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tzName);
  if (!m) throw new Error('Cannot determine New York time zone offset');
  const offset = m[1] + pad(Number(m[2])) + ':' + pad(Number(m[3] ?? 0));
  return year + '-' + pad(monthNumber) + '-' + pad(secondSunday) + 'T23:59:59' + offset;
}

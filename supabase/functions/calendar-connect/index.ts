// Supabase Edge Function entry point. Logic: ../_shared/handlers/calendar.ts. Setup: docs/ios/CALENDAR_INTEGRATION.md.
import { calendarDepsFromEnv } from '../_shared/calendar/deps.ts';
import { createCalendarHandler } from '../_shared/handlers/calendar.ts';

const resolves = async (host: string) => {
  const [a, aaaa] = await Promise.all([Deno.resolveDns(host, 'A').catch(() => []), Deno.resolveDns(host, 'AAAA').catch(() => [])]);
  return [...a, ...aaaa];
};
Deno.serve(createCalendarHandler(calendarDepsFromEnv((key) => Deno.env.get(key), fetch, resolves)));

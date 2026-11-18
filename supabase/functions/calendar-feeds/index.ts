// Supabase Edge Function entry point. Logic: ../_shared/handlers/calendar-feeds.ts.
// Setup (secrets, schedule): docs/calendar/CALENDAR_INTEGRATION.md → "Turning it on".
import { createDb } from '../_shared/db.ts';
import { createCalendarFeedsHandler } from '../_shared/handlers/calendar-feeds.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = env('SUPABASE_ANON_KEY');

Deno.serve(createCalendarFeedsHandler({
  db: createDb(supabaseUrl, serviceKey),
  async getUser(token) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ? { id: u.id } : null;
  },
  fetch,
  now: () => Date.now(),
  cronSecret: env('CALENDAR_CRON_SECRET') || null,
}));

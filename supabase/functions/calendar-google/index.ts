// Supabase Edge Function entry point: Connect Google Calendar. Logic: ../_shared/handlers/calendar-google.ts.
// Setup (Google Cloud OAuth client, secrets): docs/calendar/GOOGLE_CALENDAR.md. Deployed with verify_jwt = false:
// Google's redirect carries no Supabase session; every other action checks the adult's sign-in itself.
import { createDb } from '../_shared/db.ts';
import { createCalendarGoogleHandler } from '../_shared/handlers/calendar-google.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const supabaseUrl = env('SUPABASE_URL');
const clientId = env('CALENDAR_GOOGLE_CLIENT_ID');
const clientSecret = env('CALENDAR_GOOGLE_CLIENT_SECRET');

Deno.serve(createCalendarGoogleHandler({
  db: createDb(supabaseUrl, env('SUPABASE_SERVICE_ROLE_KEY')),
  async getUser(token) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ? { id: u.id } : null;
  },
  fetch,
  google: clientId && clientSecret
    ? { clientId, clientSecret, redirectUri: env('CALENDAR_GOOGLE_REDIRECT_URI') || 'https://www.organizedmomcollective.com/app/google-callback/' }
    : null,
  // Where Google's redirect may send her back to. The first is the default (and the iPhone app's).
  returnOrigins: (env('CALENDAR_GOOGLE_RETURN_ORIGINS') || 'https://www.organizedmomcollective.com,https://organizedmomcollective.com').split(',').map((s) => s.trim()).filter(Boolean),
}));

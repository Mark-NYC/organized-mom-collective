/**
 * Pilot measurement from the app (docs/pilot/ANALYTICS.md): one product moment (an allowlisted kind), the platform and
 * the local day, for a signed-in grown-up, at most once a day per moment (app_open once per hour band). Sent through
 * the household's behavioral log (household_signal_log, supabase/migrations/20261216000000_household_intelligence_engine.sql),
 * which keeps product moments even with learning off and strips anything but the moment. Never a name, a child, a
 * household or anything a family wrote. Not when signed out, not in the demo, never throws, never waits.
 */
import { loadSession } from '../account';
import { signal } from '../intel/client';
import type { ProductKind } from '../intel/signals';

export type AppEvent = ProductKind;

const SENT = 'omc:events:sent:v2';
const slot = (event: AppEvent, d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}${event === 'app_open' ? `@${d.getHours()}` : ''}`;

export function track(event: AppEvent): void {
  try {
    // Signed out or in the demo: nothing is sent, and nothing is marked as sent (signing in later still counts).
    if (typeof window === 'undefined' || !loadSession() || new URLSearchParams(location.search).get('demo') === '1') return;
    const sent = JSON.parse(localStorage.getItem(SENT) ?? '{}') as Record<string, string>;
    const now = slot(event);
    if (sent[event] === now) return;
    sent[event] = now;
    localStorage.setItem(SENT, JSON.stringify(sent));
    signal({ kind: event });
  } catch {
    // Measurement never blocks anything.
  }
}

/**
 * Sanity Saver Starter Kit (/starter-kit): signup call, entry source and analytics.
 * The email goes only to the starter-kit-signup Edge Function, never into analytics or browser storage.
 * Settings and steps: src/data/starter-kit.ts.
 */
import { normalizeEmail, validEmail } from './tool-email';

const SUPABASE = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const ANON = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

/** This browser has signed up (no email kept): /starter-kit offers "Open your kit". */
export const ACCESS_KEY = 'omc:starter-kit:access:v1';
/** Steps ticked done on the kit page. */
export const DONE_KEY = 'omc:starter-kit:done:v1';
const SOURCE_KEY = 'omc:starter-kit:source';
/** The chore chart's download gate (src/lib/tool-email.ts): kit signups aren't asked twice. */
const TOOL_ACCESS_KEY = 'omc:tool-download-access:v1';

export type SignupOutcome =
  | { ok: true; email: 'sent' | 'failed' | 'skipped' | 'recent' }
  | { ok: false; reason: 'invalid' | 'rate_limited' | 'error' };

/** Saves the email and asks for the delivery email. Never throws. */
export async function signUp(email: string, marketing: boolean, website: string): Promise<SignupOutcome> {
  const clean = normalizeEmail(email);
  if (!validEmail(clean)) return { ok: false, reason: 'invalid' };
  if (!SUPABASE || !ANON) return { ok: false, reason: 'error' };
  try {
    const res = await fetch(`${SUPABASE}/functions/v1/starter-kit-signup`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clean, marketing, website }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; email?: string };
    if (data.status === 'ok') {
      const e = data.email;
      return { ok: true, email: e === 'sent' || e === 'skipped' || e === 'recent' ? e : 'failed' };
    }
    if (data.status === 'invalid') return { ok: false, reason: 'invalid' };
    if (data.status === 'rate_limited') return { ok: false, reason: 'rate_limited' };
    return { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

const store = (s: () => Storage) => ({
  get(k: string) { try { return s().getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { s().setItem(k, v); } catch { /* this visit still works */ } },
});
export const local = store(() => localStorage);
const session = store(() => sessionStorage);

export function grantAccess() {
  local.set(ACCESS_KEY, 'yes');
  local.set(TOOL_ACCESS_KEY, 'yes');
}
export const hasAccess = () => local.get(ACCESS_KEY) === 'yes';

const SOURCES = ['qr', 'card', 'email', 'instagram', 'pinterest', 'website'];

/**
 * Where this visit came from: `?source=` (the business-card redirect sends `qr`), else a referral
 * from the old members site (also the card), else 'direct'. Kept for the browser session.
 */
export function entrySource(search: string, referrer: string, saved: string | null): string {
  const raw = new URLSearchParams(search).get('source')?.trim().toLowerCase();
  if (raw) return SOURCES.includes(raw) ? raw : 'other';
  if (saved) return saved;
  if (/^https?:\/\/members\.organizedmomcollective\.com/i.test(referrer)) return 'qr';
  return 'direct';
}

/** Reads, remembers and strips `?source=` from the address bar. */
export function currentSource(): string {
  const src = entrySource(location.search, document.referrer, session.get(SOURCE_KEY));
  session.set(SOURCE_KEY, src);
  const url = new URL(location.href);
  if (url.searchParams.has('source')) {
    url.searchParams.delete('source');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  return src;
}

export type StarterKitEvent = 'starter_kit_view' | 'starter_kit_signup' | 'starter_kit_resource_open';

/**
 * One event to every analytics tool on the page (GA4 via gtag, dataLayer, Plausible, Umami). Never throws.
 * Resolves once GA4 has sent it (or after `waitMs`), so a page can navigate right after without losing it.
 */
export function track(event: StarterKitEvent, props: Record<string, string>, waitMs = 0): Promise<void> {
  let done!: () => void;
  const sent = new Promise<void>((resolve) => { done = resolve; });
  if (waitMs) setTimeout(done, waitMs); else done();
  const w = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (event: string, opts: { props: Record<string, string> }) => void;
    umami?: { track: (event: string, props: Record<string, string>) => void };
  };
  const detail = { ...props, page_path: location.pathname };
  try {
    (w.dataLayer ??= []).push({ event, ...detail });
    if (w.gtag) w.gtag('event', event, { ...detail, transport_type: 'beacon', event_callback: done });
    else done();
    w.plausible?.(event, { props: detail });
    w.umami?.track(event, detail);
    window.dispatchEvent(new CustomEvent('omc:starter-kit', { detail: { event, ...detail } }));
  } catch { done(); /* Tracking must never block the kit. */ }
  return sent;
}

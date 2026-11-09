import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config';
/** Shared consent-aware signup for public printable downloads. No family names or printable contents are submitted. */
const url = SUPABASE_URL;
const key = SUPABASE_ANON_KEY;
export const toolEmailGateEnabled = import.meta.env.PUBLIC_TOOL_EMAIL_GATE_ENABLED === 'true' && Boolean(url && key);
/** Expand after the SQL migration and preview smoke test. Existing chore gate stays independent. */
export const unifiedDownloadGateEnabled = toolEmailGateEnabled && import.meta.env.PUBLIC_UNIFIED_DOWNLOAD_EMAIL_ENABLED === 'true';
/** Its own switch: the database accepts this tool id only after 20261021000000_tool_email_responsibility_chart.sql. */
export const responsibilityChartGateEnabled = toolEmailGateEnabled && import.meta.env.PUBLIC_RESPONSIBILITY_CHART_GATE_ENABLED === 'true';

/** Each gated download: its tool id (stored as first_tool/last_tool) and the dialog's words. */
export const gatedTools = {
  'chore-chart': { title: 'Your chore chart is ready.', button: 'Download my chart', lead: 'Chore chart download' },
  'responsibility-chart': { title: 'Get the free responsibility chart.', button: 'Get my free chart', lead: 'Responsibility chart download' },
} as const;
export type GatedTool = keyof typeof gatedTools;
/** Only public/free pages. Paid downloads, Club and app routes must never ask again. */
const publicPrintablePaths = new Set([
  'chore-chart', 'family-responsibility-builder', 'family-meeting-agenda',
  'routine-chart', 'planner', 'pantry', 'try-the-calendar',
  'back-to-school-checklist', 'screen-time-contract', 'homeschool-rhythm',
  'laundry-system', 'closet-reset', 'lunch-and-snack-station', 'command-center-setup',
  'travel-checklist', 'fall-pantry-stock-up', 'gratitude-tracker', 'holiday-gift-planner',
  'mental-load-worksheet', 'meal-planner', 'december-countdown', 'thanksgiving-plan',
  'paper-clutter-blitz', 'new-year-declutter', 'fall-cleaning-checklist', 'spring-cleaning-checklist',
]);
/** Identify a public free download page; exclude checkout, paid, member and app routes. */
export function publicDownloadId(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean).map(x => x.toLowerCase());
  if (segments.length === 1 && publicPrintablePaths.has(segments[0])) return segments[0];
  if (segments.length === 2 && segments[0] === 'guides') {
    const slug = segments[1];
    return /^[a-z0-9-]+$/.test(slug) ? `guide-${slug.slice(0, 60)}` : null;
  }
  if (segments.length === 2 && segments[0] === 'resources') {
    const slug = segments[1];
    return /^[a-z0-9-]+$/.test(slug) ? `guide-${slug.slice(0, 60)}` : null;
  }
  return null;
}
function publicDownloadTool(): string | null { return publicDownloadId(window.location.pathname); }

function attribution() {
  const qs = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const safe = (key: string) => (qs.get(key) || '').slice(0, 160);
  return { p_source: safe('utm_source'), p_medium: safe('utm_medium'), p_campaign: safe('utm_campaign'), p_content: safe('utm_content') };
}
const DONE = 'omc:tool-download-access:v1';
/**
 * Existing site access is remembered by this same key.
 * Email access is delivered as an opaque #omc_pass= fragment, not a query param.
 * A server-verified pass unlocks ONLY free downloads on this browser.
 * Never treat a URL token as a marketing opt-in.
 */
const PASS_PARAM = 'omc_pass';
let resourcePassVerification: Promise<boolean> | undefined;
function resourcePassFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  const token = new URLSearchParams(hash).get(PASS_PARAM);
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}
function clearResourcePassFragment() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has(PASS_PARAM)) return;
  fragment.delete(PASS_PARAM);
  const rest = fragment.toString();
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + (rest ? '#' + rest : ''));
}
/** Validate before saving access, never store the raw bearer token. */
export function recognizeSubscriberResourceAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (resourcePassVerification) return resourcePassVerification;
  const token = resourcePassFromHash();
  if (!token) return Promise.resolve(false);
  resourcePassVerification = (async () => {
    try {
      const response = await fetch('https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/subscriber-resource-access', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token}),
        signal:AbortSignal.timeout(10000),
        cache:'no-store',
      });
      const result = response.ok ? await response.json() as {ok?:boolean} : {};
      if (result.ok === true) {
        unlocked = true;
        try { localStorage.setItem(DONE, 'yes'); } catch { /* This visit still works. */ }
        return true;
      }
      return false;
    } catch { return false; }
    finally { clearResourcePassFragment(); }
  })();
  return resourcePassVerification;
}

let unlocked = false;
let active: Promise<boolean> | undefined;
export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export async function collectToolEmail(email: string, consent: boolean, website: string, tool: string): Promise<string> {
  const clean = normalizeEmail(email);
  if (!validEmail(clean)) return 'invalid';
  const response = await fetch(`${url}/rest/v1/rpc/tool_email_signup_v2`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_email: clean, p_marketing: consent, p_tool: tool, p_website: website, ...attribution() }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Keep existing first-download gating working while the new migration is rolling out.
    if (response.status === 404 && (tool === 'chore-chart' || tool === 'responsibility-chart')) {
      const fallback = await fetch(`${url}/rest/v1/rpc/tool_email_signup`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_email: clean, p_marketing: consent, p_tool: tool, p_website: website }),
        signal: AbortSignal.timeout(15000),
      });
      return fallback.ok ? await fallback.json() as string : 'error';
    }
    return 'error';
  }
  const result: unknown = await response.json();
  return result === 'ok' || result === 'invalid' || result === 'rate_limited' ? result : 'error';
}
function remembered() {
  if (unlocked) return true;
  try { return localStorage.getItem(DONE) === 'yes'; } catch { return false; }
}
/** A single successful signup per browser; the modal never opens for paid/member routes. */
export async function requireToolEmail(tool?: string): Promise<boolean> {
  if (resourcePassVerification) await resourcePassVerification;
  else if (resourcePassFromHash()) await recognizeSubscriberResourceAccess();
  const publicTool = tool ?? publicDownloadTool();
  const enabled = tool === 'responsibility-chart' ? responsibilityChartGateEnabled :
    publicTool === 'chore-chart' ? toolEmailGateEnabled : unifiedDownloadGateEnabled;
  if (!enabled || !publicTool || remembered()) return true;
  if (active) return active;
  active = showDialog(publicTool).finally(() => { active = undefined; });
  return active;
}
/** Describe the printable without trusting route segments as HTML. */
export function downloadModalCopy(tool: string) {
  const titles: Record<string, string> = {
    'chore-chart': 'Chore Chart',
    'responsibility-chart': 'Responsibility Chart',
    'family-responsibility-builder': 'Family Responsibility Chart',
    'family-meeting-agenda': 'Family Meeting Agenda',
    'routine-chart': 'Routine Chart',
    'planner': 'Weekly Planner',
    'try-the-calendar': 'Family Calendar',
    'pantry': 'Pantry Inventory',
    'mental-load-worksheet': 'Mental Load Worksheet',
    'meal-planner': 'Dinner Planner',
    'laundry-system': 'Laundry Checklist',
    'guide-family-kitchen-reset': 'Kitchen Reset Guide',
    'guide-family-bathroom-reset': 'Bathroom Reset Guide',
    'guide-family-laundry-system': 'Laundry System Guide',
  };
  const isGuide = tool.startsWith('guide-');
  const raw = (titles[tool] ?? (isGuide ? tool.slice(6) : tool).replace(/[^a-z0-9-]/gi, '')
    .split('-').filter(Boolean).slice(0, 10)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')).slice(0, 70);
  const label = isGuide && !/Guide$/.test(raw) ? raw + ' Guide' : raw;
  return {
    title: 'Your ' + label + ' is ready.',
    button: isGuide ? 'Get My Free Guide' : 'Get My Free Printable',
    lead: isGuide ? 'Free guide download' : 'Free printable download',
  };
}
function showDialog(tool: string): Promise<boolean> {
  const copy = downloadModalCopy(tool);
  return new Promise(resolve => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.createElement('dialog');
    dialog.className = 'tool-email-dialog';
    dialog.setAttribute('aria-labelledby', 'tool-email-title');
    dialog.setAttribute('aria-describedby', 'tool-email-intro');
    dialog.innerHTML = `<form class="tool-email-form">
      <div class="tool-email-brand">ORGANIZED MOM COLLECTIVE</div>
      <button type="button" class="tool-email-close" aria-label="Close signup">×</button>
      <div class="tool-email-accent" aria-hidden="true"></div>
      <h2 id="tool-email-title"></h2>
      <p id="tool-email-intro" class="tool-email-intro">Enter your email to take it home. You’ll only need to do this once.</p>
      <label class="tool-email-label" for="tool-email-address">Email address</label>
      <input id="tool-email-address" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com" />
      <div class="tool-email-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
      <label class="tool-email-consent"><input name="marketing" type="checkbox" /> <span>Yes, send me helpful family organization ideas and occasional OMC updates. I can unsubscribe anytime. <strong>Optional.</strong></span></label>
      <p class="tool-email-error" role="alert"></p>
      <button class="tool-email-submit" type="submit"></button>
      <p class="tool-email-note">Free download · No account needed</p>
    </form>`;
    // Use textContent so even newly added resource slugs can never inject markup.
    dialog.querySelector<HTMLElement>('#tool-email-title')!.textContent = copy.title;
    dialog.querySelector<HTMLButtonElement>('.tool-email-submit')!.textContent = copy.button;
    document.body.append(dialog);
    const form = dialog.querySelector<HTMLFormElement>('form')!;
    const submit = dialog.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const error = dialog.querySelector<HTMLElement>('[role="alert"]')!;
    let busy = false;
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      dialog.close(); dialog.remove(); previous?.focus(); resolve(ok);
    };
    dialog.querySelector('button')!.addEventListener('click', () => { if (!busy) finish(false); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) finish(false); });
    dialog.addEventListener('click', event => { if (event.target === dialog && !busy) finish(false); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !form.reportValidity()) return;
      busy = true; submit.disabled = true; submit.textContent = 'Saving…'; error.textContent = '';
      try {
        const data = new FormData(form);
        const result = await collectToolEmail(String(data.get('email') ?? ''), data.get('marketing') === 'on', String(data.get('website') ?? ''), tool);
        if (result === 'ok') {
          unlocked = true;
          try { localStorage.setItem(DONE, 'yes'); } catch { /* this visit still works */ }
          try {
            const pinterest = (window as Window & { pintrk?: (...args: unknown[]) => void }).pintrk;
            pinterest?.('track', 'lead', { lead_type: copy.lead });
          } catch { /* tracking must never block the download */ }
          finish(true); return;
        }
        error.textContent = result === 'rate_limited' ? 'Too many attempts. Please try again later. Your printable is still here.' : result === 'invalid' ? 'Please check your email address.' : 'We couldn’t save your email. Please try again. Your printable is still here.';
      } catch { error.textContent = 'We couldn’t connect. Please try again. Your printable is still here.'; }
      busy = false; submit.disabled = false; submit.textContent = copy.button;
    });
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('[type="email"]')!.focus();
  });
}

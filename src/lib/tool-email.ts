import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config';
/** Printable download signup (chore chart, IF-03's responsibility chart). No emails or chart contents enter analytics/storage. */
const url = SUPABASE_URL;
const key = SUPABASE_ANON_KEY;
export const toolEmailGateEnabled = import.meta.env.PUBLIC_TOOL_EMAIL_GATE_ENABLED === 'true' && Boolean(url && key);
/** Its own switch: the database accepts this tool id only after 20261021000000_tool_email_responsibility_chart.sql. */
export const responsibilityChartGateEnabled = toolEmailGateEnabled && import.meta.env.PUBLIC_RESPONSIBILITY_CHART_GATE_ENABLED === 'true';

/** Each gated download: its tool id (stored as first_tool/last_tool) and the dialog's words. */
export const gatedTools = {
  'chore-chart': { title: 'Your chore chart is ready.', button: 'Download my chart', lead: 'Chore chart download' },
  'responsibility-chart': { title: 'Get the free responsibility chart.', button: 'Get my free chart', lead: 'Responsibility chart download' },
} as const;
export type GatedTool = keyof typeof gatedTools;
const DONE = 'omc:tool-download-access:v1';
let unlocked = false;
let active: Promise<boolean> | undefined;
export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export async function collectToolEmail(email: string, consent: boolean, website: string, tool: GatedTool): Promise<string> {
  const clean = normalizeEmail(email);
  if (!validEmail(clean)) return 'invalid';
  const response = await fetch(`${url}/rest/v1/rpc/tool_email_signup`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_email: clean, p_marketing: consent, p_tool: tool, p_website: website }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return 'error';
  const result: unknown = await response.json();
  return result === 'ok' || result === 'invalid' || result === 'rate_limited' ? result : 'error';
}
function remembered() {
  if (unlocked) return true;
  try { return localStorage.getItem(DONE) === 'yes'; } catch { return false; }
}
/**
 * One signup per browser, shared by every gated tool. With no argument (the shared printable export in
 * src/lib/printable.ts) only /chore-chart is gated; IF-03's article asks for 'responsibility-chart' itself.
 */
export function requireToolEmail(tool?: 'responsibility-chart'): Promise<boolean> {
  const gated = tool ? responsibilityChartGateEnabled : toolEmailGateEnabled && window.location.pathname.replace(/\/$/, '') === '/chore-chart';
  if (!gated || remembered()) return Promise.resolve(true);
  if (active) return active;
  active = showDialog(tool ?? 'chore-chart').finally(() => { active = undefined; });
  return active;
}
function showDialog(tool: GatedTool): Promise<boolean> {
  const copy = gatedTools[tool];
  return new Promise(resolve => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.createElement('dialog');
    dialog.className = 'tool-email-dialog';
    dialog.setAttribute('aria-labelledby', 'tool-email-title');
    dialog.innerHTML = `<form class="tool-email-form">
      <button type="button" class="tool-email-close" aria-label="Close signup">×</button>
      <h2 id="tool-email-title">${copy.title}</h2>
      <p>Enter your email to download it. No account or password needed.</p>
      <label class="tool-email-label" for="tool-email-address">Email address</label>
      <input id="tool-email-address" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com" />
      <div class="tool-email-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
      <label class="tool-email-consent"><input name="marketing" type="checkbox" /> <span>Send me free family tools and occasional product updates. I can unsubscribe anytime.</span></label>
      <p class="tool-email-note">The checkbox is optional. Your chart downloads here after you submit. We don’t collect your child’s name or chart contents.</p>
      <p class="tool-email-error" role="alert"></p>
      <button class="tool-email-submit" type="submit">${copy.button}</button>
    </form>`;
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
        error.textContent = result === 'rate_limited' ? 'Too many attempts. Please try again later. Your chart is still here.' : result === 'invalid' ? 'Please check your email address.' : 'We couldn’t save your email. Please try again. Your chart is still here.';
      } catch { error.textContent = 'We couldn’t connect. Please try again. Your chart is still here.'; }
      busy = false; submit.disabled = false; submit.textContent = copy.button;
    });
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('[type="email"]')!.focus();
  });
}

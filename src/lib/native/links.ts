/**
 * Which links stay inside the iPhone app and which open on the website (docs/ios/OMC_APP_ROADMAP.md → 2.1).
 * Pure: no DOM, no Capacitor. The same patterns decide what scripts/build-app-shell.mjs bundles, so a page
 * is either in the app or opened on the website, never half of each. Shopping, checkout and billing are
 * always on the website.
 */
import shell from '../../data/app/shell-routes.json';

export const SITE = shell.site;
const include = shell.include.map((p) => new RegExp(p));
const never = shell.neverInclude.map((p) => new RegExp(p));
const SITE_HOSTS = new Set(['www.organizedmomcollective.com', 'organizedmomcollective.com']);

/** "/app/cleaning/" → "/app/cleaning"; "/" stays "/". */
export const normalizePath = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path) || '/';

/** True when the page at `path` is part of the app bundle. */
export function inShell(path: string): boolean {
  const p = normalizePath(path);
  return !never.some((r) => r.test(p)) && include.some((r) => r.test(p));
}

export type LinkAction =
  | { kind: 'default' } // let the web view handle it (in-app page, #hash, mailto:, tel:, download)
  | { kind: 'in-app'; href: string } // a bundled page, given as a site-absolute URL from our own website
  | { kind: 'website'; url: string } // one of our pages that isn't bundled: open on the website
  | { kind: 'external'; url: string }; // someone else's site

/**
 * @param href   the anchor's href attribute as written
 * @param here   the current page URL (the app's own origin, e.g. capacitor://localhost/app)
 */
export function classifyLink(href: string, here: string): LinkAction {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || /^(mailto|tel|sms|blob|data|javascript):/i.test(raw)) return { kind: 'default' };
  let url: URL;
  try {
    url = new URL(raw, here);
  } catch {
    return { kind: 'default' };
  }
  const local = new URL(here);
  const ours = url.origin === local.origin;
  const site = /^https?:$/.test(url.protocol) && SITE_HOSTS.has(url.hostname);
  if (!ours && !site) return /^https?:$/.test(url.protocol) ? { kind: 'external', url: url.href } : { kind: 'default' };
  const rest = url.search + url.hash;
  if (inShell(url.pathname)) return ours ? { kind: 'default' } : { kind: 'in-app', href: normalizePath(url.pathname) + rest };
  return { kind: 'website', url: SITE + normalizePath(url.pathname) + rest };
}

import { requireToolEmail } from './tool-email';

/** Gate only PDF links inside public practical guides. Never affect paid downloads or app/Club pages. */
export function installGuideDownloadGate() {
  const pieces = window.location.pathname.split('/').filter(Boolean);
  if (pieces[0] !== 'guides' || pieces.length < 2) return;
  const slug = pieces[1].toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  if (!slug) return;
  document.addEventListener('click', async event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    const anchor = origin.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.dataset.downloadUnlocked === 'true') return;
    let file: URL;
    try { file = new URL(anchor.href, location.href); } catch { return; }
    if (file.origin !== location.origin || !file.pathname.toLowerCase().endsWith('.pdf')) return;
    event.preventDefault();
    const allowed = await requireToolEmail(`guide-${slug}`);
    if (!allowed) return;
    anchor.dataset.downloadUnlocked = 'true';
    try { anchor.click(); }
    finally { delete anchor.dataset.downloadUnlocked; }
  }, { capture: true });
}

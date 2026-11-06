import { publicDownloadId, requireToolEmail } from './tool-email';

/**
 * Intercept actual free PDF/download links on public Guides, Articles and Tools.
 * Previews, article reading, editor controls, paid orders, Club and /app stay untouched.
 * The gate is intentionally a signup UX, not file access control: direct /downloads URLs
 * are public static assets and can be opened without this dialog.
 */
export function installPublicResourceDownloadGate() {
  const tool = publicDownloadId(window.location.pathname);
  if (!tool) return;
  const unlockedLinks = new WeakSet<HTMLAnchorElement>();
  document.addEventListener('click', async event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || unlockedLinks.has(anchor)) return;
    let file: URL;
    try { file = new URL(anchor.href, location.href); } catch { return; }
    if (file.origin !== location.origin) return;
    const downloadPath = file.pathname.toLowerCase();
    const isPdf = downloadPath.endsWith('.pdf');
    const explicitFreeDownload = anchor.hasAttribute('download') && downloadPath.startsWith('/downloads/');
    if (!isPdf && !explicitFreeDownload) return;
    // Never capture unrelated files or links outside the project's free downloads area.
    if (!downloadPath.startsWith('/downloads/')) return;
    event.preventDefault();
    const allowed = await requireToolEmail(tool);
    if (!allowed) return;
    unlockedLinks.add(anchor);
    try { anchor.click(); }
    finally { unlockedLinks.delete(anchor); }
  }, { capture: true });
}

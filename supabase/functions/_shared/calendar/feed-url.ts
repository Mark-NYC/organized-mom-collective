/**
 * Calendar feed links she pastes (webcal://…, https://…ics). Feed links are often secret (Google's and Outlook's
 * "secret address" contain a key), so the full link is stored encrypted, server-side only; the household sees the host.
 *
 * Refused: anything but webcal/https/http, credentials in the link, ports other than 80/443, and hosts that point
 * inside a network (localhost, private and link-local addresses, .local/.internal names), so a link can't make our
 * server fetch something private (SSRF). The fetch itself also refuses redirects to such hosts (./fetch-feed.ts).
 */
export type FeedUrl = { ok: true; url: string; host: string } | { ok: false; error: 'invalid_url' | 'unsupported_url' | 'private_host' };

export function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h || h === 'localhost' || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(h) || !h.includes('.') && !h.includes(':')) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [+v4[1], +v4[2]];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (h.includes(':')) {
    // IPv6 literal: loopback, unspecified, unique-local, link-local, IPv4-mapped.
    return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
  }
  return /^(metadata|metadata\.google\.internal)$/.test(h);
}

export function checkFeedUrl(raw: string): FeedUrl {
  const text = raw.trim();
  if (!text || text.length > 2000) return { ok: false, error: 'invalid_url' };
  let u: URL;
  try {
    u = new URL(text.replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'unsupported_url' };
  if (u.username || u.password) return { ok: false, error: 'unsupported_url' };
  if (u.port && u.port !== '443' && u.port !== '80') return { ok: false, error: 'unsupported_url' };
  if (privateHost(u.hostname)) return { ok: false, error: 'private_host' };
  u.hash = '';
  return { ok: true, url: u.toString(), host: u.hostname.toLowerCase().replace(/^www\./, '') };
}

/** For spotting the same feed added twice by the same adult (stored instead of the link itself). */
export async function feedFingerprint(url: string): Promise<string> {
  const u = new URL(url);
  const norm = `${u.hostname.toLowerCase()}${u.pathname}${u.search}`;
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

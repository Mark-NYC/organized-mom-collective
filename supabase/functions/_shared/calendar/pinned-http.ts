/**
 * A minimal HTTP/1.1 GET over a connection that is ALREADY open to one checked IP address (docs/calendar/SECURITY_REVIEW.md).
 *
 * Why: `fetch` resolves the host name again by itself, so a hostile DNS server could answer "public" to our safety
 * check and "private" to the fetch a moment later (DNS rebinding). Here the caller resolves the name once, checks every
 * address, connects to the checked IP, and (for https) runs TLS over that same connection with the real host name, so
 * the certificate is still verified for it. The address can't change between the check and the request.
 *
 * Transport-agnostic (any object with read/write/close), so it is unit-tested without sockets; the Deno sockets are
 * opened in supabase/functions/calendar-feeds/index.ts. Supports Content-Length, chunked and read-to-close bodies,
 * gzip/deflate, and a byte limit. One request per connection (Connection: close).
 */
export interface ByteConn {
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  close(): void;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const clean = (v: string) => v.replace(/[\r\n\0]/g, '');

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function indexOf(buf: Uint8Array, seq: number[], from = 0): number {
  outer: for (let i = from; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer;
    return i;
  }
  return -1;
}

function dechunk(body: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let size = 0;
  let i = 0;
  for (;;) {
    const eol = indexOf(body, [13, 10], i);
    if (eol < 0) throw new Error('incomplete');
    const n = parseInt(dec.decode(body.subarray(i, eol)).split(';')[0].trim(), 16);
    if (!Number.isFinite(n) || n < 0) throw new Error('bad_response');
    if (n === 0) return concat(parts, size);
    const start = eol + 2;
    if (start + n > body.length) throw new Error('incomplete');
    parts.push(body.subarray(start, start + n));
    size += n;
    i = start + n + 2;
  }
}

async function inflate(body: Uint8Array, kind: 'gzip' | 'deflate', maxBytes: number): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(body)]).stream().pipeThrough(new DecompressionStream(kind));
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error('too_big'); }
    parts.push(value);
  }
  return concat(parts, size);
}

/** GET `url` over `conn`. Returns a standard Response. Throws 'too_big', 'incomplete' or 'bad_response'. */
export async function httpGet(conn: ByteConn, url: URL, headers: Record<string, string>, maxBytes: number): Promise<Response> {
  const defaultPort = url.protocol === 'https:' ? '443' : '80';
  const host = url.port && url.port !== defaultPort ? `${url.hostname}:${url.port}` : url.hostname;
  const lines = [`GET ${url.pathname || '/'}${url.search} HTTP/1.1`, `Host: ${clean(host)}`];
  for (const [k, v] of Object.entries(headers)) if (!/^(host|connection|accept-encoding|content-length|transfer-encoding)$/i.test(k)) lines.push(`${clean(k)}: ${clean(v)}`);
  lines.push('Accept-Encoding: gzip, deflate, identity', 'Connection: close', '', '');
  await conn.write(enc.encode(lines.join('\r\n')));

  // Read to the end (the server closes after one response), never more than the limit plus room for headers.
  const cap = maxBytes + 64 * 1024;
  const parts: Uint8Array[] = [];
  let size = 0;
  const buf = new Uint8Array(64 * 1024);
  for (;;) {
    const n = await conn.read(buf);
    if (n === null) break;
    size += n;
    if (size > cap) throw new Error('too_big');
    parts.push(buf.slice(0, n));
  }
  let raw = concat(parts, size);

  // Skip any 1xx interim responses.
  let head: string;
  let body: Uint8Array;
  for (;;) {
    const end = indexOf(raw, [13, 10, 13, 10]);
    if (end < 0) throw new Error(raw.length ? 'bad_response' : 'incomplete');
    head = dec.decode(raw.subarray(0, end));
    body = raw.subarray(end + 4);
    if (!/^HTTP\/1\.[01] 1\d\d/.test(head)) break;
    raw = body;
  }
  const [statusLine, ...headerLines] = head.split('\r\n');
  const m = /^HTTP\/1\.[01] (\d{3})/.exec(statusLine);
  if (!m) throw new Error('bad_response');
  const status = Number(m[1]);
  const h = new Headers();
  for (const l of headerLines) {
    const i = l.indexOf(':');
    if (i > 0) { try { h.append(l.slice(0, i).trim(), l.slice(i + 1).trim()); } catch { /* skip a malformed header */ } }
  }
  if ((h.get('transfer-encoding') ?? '').toLowerCase().includes('chunked')) body = dechunk(body);
  else if (h.has('content-length')) {
    const len = Number(h.get('content-length'));
    if (!Number.isFinite(len) || len < 0) throw new Error('bad_response');
    if (body.length < len) throw new Error('incomplete');
    body = body.subarray(0, len);
  }
  if (body.length > maxBytes) throw new Error('too_big');
  const coding = (h.get('content-encoding') ?? '').toLowerCase();
  if (coding === 'gzip' || coding === 'x-gzip') body = await inflate(body, 'gzip', maxBytes);
  else if (coding === 'deflate') body = await inflate(body, 'deflate', maxBytes);
  h.delete('content-encoding');
  h.delete('content-length');
  h.delete('transfer-encoding');
  const noBody = status === 204 || status === 304 || (status >= 300 && status < 400);
  return new Response(noBody ? null : new Uint8Array(body), { status: status < 200 || status > 599 ? 502 : status, headers: h });
}

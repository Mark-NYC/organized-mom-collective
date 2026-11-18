/**
 * Encryption for what lets our server read her calendars (a Google refresh token, a secret feed link). AES-256-GCM with
 * CALENDAR_TOKEN_KEY (32 random bytes, base64), a Supabase Edge Function secret: the database only ever holds
 * ciphertext, in a table no signed-in user can read (supabase/migrations/20261205000000_calendar_connections.sql).
 * The connection id is bound in as additional data, so a ciphertext copied onto another connection won't open.
 */
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(secret: string): Promise<CryptoKey> {
  const raw = unb64(secret);
  if (raw.length !== 32) throw new Error('calendar_key_invalid');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(secret: string, plain: string, boundTo: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(boundTo) }, await key(secret), enc.encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function open(secret: string, sealed: string, boundTo: string): Promise<string> {
  const [v, iv, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('calendar_secret_invalid');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc.encode(boundTo) }, await key(secret), unb64(ct));
  return new TextDecoder().decode(pt);
}

/** URL-safe random string (OAuth state, PKCE verifier). */
export function randomToken(bytes = 32): string {
  return b64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  return b64(d).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * A minimal Stripe client over fetch (no SDK), plus webhook signature checks.
 * Only the calls the shop makes: Checkout Sessions, refunds, charges, tax rates.
 */
import { safeEqual } from './http.ts';

export type StripeMode = 'test' | 'live';

/** Which Stripe mode a secret or restricted key belongs to. */
export function stripeMode(key: string): StripeMode {
  return /^(sk|rk)_live_/.test(key) ? 'live' : 'test';
}

export class StripeError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

type Param = string | number | boolean | null | undefined | Param[] | { [key: string]: Param };

/** Stripe's form encoding: a[b][0][c]=1. Null/undefined are left out. */
export function formEncode(params: Record<string, Param>): string {
  const out = new URLSearchParams();
  const add = (key: string, value: Param) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((v, i) => add(`${key}[${i}]`, v));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
    else out.append(key, String(value));
  };
  for (const [k, v] of Object.entries(params)) add(k, v);
  return out.toString();
}

export interface StripeClient {
  mode: StripeMode;
  request<T = Record<string, unknown>>(method: 'GET' | 'POST', path: string, params?: Record<string, Param>, idempotencyKey?: string): Promise<T>;
}

export function createStripe(opts: { secretKey: string; apiVersion: string; apiBase?: string; fetch?: typeof fetch }): StripeClient {
  const base = opts.apiBase ?? 'https://api.stripe.com';
  const fetchFn = opts.fetch ?? fetch;
  return {
    mode: stripeMode(opts.secretKey),
    async request<T>(method: 'GET' | 'POST', path: string, params: Record<string, Param> = {}, idempotencyKey?: string) {
      const body = formEncode(params);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.secretKey}`,
        'Stripe-Version': opts.apiVersion,
      };
      if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const url = method === 'GET' && body ? `${base}${path}?${body}` : `${base}${path}`;
      const res = await fetchFn(url, { method, headers, body: method === 'POST' ? body : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: { message?: string; code?: string } }).error;
        throw new StripeError(err?.message ?? `stripe_${res.status}`, res.status, err?.code);
      }
      return data as T;
    },
  };
}

// ------------------------------------------------------------------ webhooks

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks a Stripe-Signature header (t=…,v1=…) against the raw body: HMAC-SHA256 of
 * "t.body" with the endpoint secret, and a timestamp within `toleranceSeconds`.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const v1 = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || v1.length === 0) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return v1.some((sig) => safeEqual(sig, expected));
}

/** Builds a valid Stripe-Signature header. Used by tests and local webhook replays. */
export async function signStripePayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${payload}`)}`;
}

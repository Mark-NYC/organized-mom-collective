/** Small HTTP helpers shared by the shop functions. */

export type Handler = (req: Request) => Promise<Response>;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

/** CORS headers for an allowed browser origin; none for anything else. */
export function corsHeaders(req: Request, allowed: string[]): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !allowed.includes(origin.replace(/\/$/, ''))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-shop-preview',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/** The caller's IP as forwarded by Supabase's edge, for rate limiting only (hashed in the database). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

/** Constant-time string comparison (secrets, signatures). */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function readJson(req: Request, maxBytes = 20_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

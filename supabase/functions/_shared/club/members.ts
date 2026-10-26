/**
 * Supabase Auth from the Club's functions: who is calling (a verified access token), and the account a paid
 * checkout belongs to. A paid checkout from someone who never signed in gets an account created for that email,
 * unconfirmed: nothing opens until she proves the inbox with the emailed code (Supabase confirms it then).
 */
import type { ClubDeps } from './deps.ts';

export interface AuthUser {
  id: string;
  email: string;
  confirmed: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The caller's account from her access token, checked with Supabase Auth (never trusted from the body). */
export async function userFromRequest(deps: ClubDeps, req: Request): Promise<AuthUser | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === deps.env.anonKey) return null;
  const res = await deps.fetch(`${deps.env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: deps.env.anonKey || deps.env.serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; email?: string; email_confirmed_at?: string | null };
  if (!u.id || !UUID.test(u.id) || !u.email) return null;
  return { id: u.id, email: u.email.toLowerCase(), confirmed: Boolean(u.email_confirmed_at) };
}

const adminHeaders = (deps: ClubDeps) => {
  const h: Record<string, string> = { apikey: deps.env.serviceRoleKey, 'Content-Type': 'application/json' };
  if (deps.env.serviceRoleKey.startsWith('eyJ')) h.Authorization = `Bearer ${deps.env.serviceRoleKey}`;
  return h;
};

/** The account for an email: the existing one, or a new unconfirmed one. Safe to call twice at once. */
export async function findOrCreateUser(deps: ClubDeps, email: string): Promise<string> {
  const e = email.trim().toLowerCase();
  const existing = await deps.db.rpc<string | null>('club_user_by_email', { p_email: e });
  if (existing) return existing;
  const res = await deps.fetch(`${deps.env.supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(deps),
    body: JSON.stringify({ email: e, email_confirm: false, user_metadata: { source: 'club_checkout' } }),
  });
  if (res.ok) {
    const u = (await res.json()) as { id?: string };
    if (u.id) return u.id;
  }
  // Someone (her sign-in, another webhook) created it in between.
  const again = await deps.db.rpc<string | null>('club_user_by_email', { p_email: e });
  if (again) return again;
  throw new Error(`auth_create_failed_${res.status}`);
}

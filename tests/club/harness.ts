/**
 * Runs the Club's Edge Function handlers against a real local Postgres with every migration applied
 * (scripts/test-club.sh creates it), as service_role, the way PostgREST would. No PostgREST needed: db.rpc and
 * db.select become psql calls with the function's own argument types, so the real SQL functions, grants and RLS
 * decide every outcome. Stripe is FakeClubStripe; Supabase Auth and Resend are small fakes in the fetch router.
 */
import { execFileSync } from 'node:child_process';
import { DbError, type Db } from '../../supabase/functions/_shared/db';
import { readClubEnv, type ClubDeps } from '../../supabase/functions/_shared/club/deps';
import { createStripe } from '../../supabase/functions/_shared/stripe';
import { createResendMailer } from '../../supabase/functions/_shared/email';
import { STRIPE_API_VERSION } from '../../supabase/functions/_shared/env';
import { FakeClubStripe } from './fake-stripe';

export const PSQL = process.env.CLUB_E2E_PSQL ?? '';

export function sql(query: string, role = 'postgres'): string {
  const prefix = role === 'postgres' ? '' : `set role ${role}; `;
  try {
    return execFileSync('psql', [PSQL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', prefix + query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    const msg = String((e as { stderr?: string }).stderr ?? e).match(/ERROR:\s+(.*)/)?.[1] ?? String(e);
    throw new DbError(msg.trim(), 400);
  }
}
export const sqlJson = <T>(q: string, role = 'postgres'): T => JSON.parse(sql(`select coalesce(to_jsonb(x), 'null') from (${q}) x`, role) || 'null');
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;

const signatures = new Map<string, { names: string[]; types: string[]; ret: string }>();
function signature(name: string) {
  if (!signatures.has(name)) {
    const row = sql(`select coalesce(array_to_string(proargnames, ','), '') || '|' || coalesce(array_to_string(proargtypes::regtype[], ','), '') || '|' || prorettype::regtype
                       from pg_proc where pronamespace = 'public'::regnamespace and proname = ${lit(name)} limit 1`);
    if (!row) throw new DbError(`Could not find the function public.${name}`, 404);
    const [names, types, ret] = row.split('|');
    signatures.set(name, { names: names ? names.split(',') : [], types: types ? types.split(',') : [], ret });
  }
  return signatures.get(name)!;
}

export const psqlDb: Db = {
  async rpc<T>(name: string, args: Record<string, unknown> = {}) {
    const sig = signature(name);
    const parts = Object.entries(args).map(([k, v]) => {
      const t = sig.types[sig.names.indexOf(k)];
      if (!t) throw new DbError(`unknown argument ${k} for ${name}`, 400);
      if (v === null || v === undefined) return `${k} => null::${t}`;
      const text = t === 'jsonb' || t === 'json' ? JSON.stringify(v) : String(v);
      return `${k} => ${lit(text)}::${t}`;
    });
    const call = `public.${name}(${parts.join(', ')})`;
    if (sig.ret === 'void') {
      sql(`select ${call}`, 'service_role');
      return null as T;
    }
    const out = sql(`select coalesce(to_jsonb(${call}), 'null')`, 'service_role');
    return JSON.parse(out) as T;
  },
  async select<T>(table: string, query: string) {
    const params = new URLSearchParams(query);
    const cols = (params.get('select') ?? '*').split(',').map((c) => (c === '*' ? '*' : `"${c.replace(/"/g, '')}"`)).join(', ');
    const where: string[] = [];
    for (const [k, v] of params) {
      if (k === 'select') continue;
      const m = v.match(/^eq\.(.*)$/);
      if (!m) throw new Error(`fake select: unsupported filter ${k}=${v}`);
      where.push(`"${k}" = ${lit(decodeURIComponent(m[1]))}`);
    }
    return JSON.parse(sql(`select coalesce(json_agg(t), '[]') from (select ${cols} from public.${table}${where.length ? ` where ${where.join(' and ')}` : ''}) t`, 'service_role')) as T[];
  },
};

export interface Mail {
  to: string;
  subject: string;
  text: string;
  key: string | null;
}

/** Wires a handler's deps: fake Stripe, fake Auth (tokens → users), fake Resend inbox, the real database. */
export function makeDeps(opts: { stripe: FakeClubStripe; tokens: Map<string, string>; inbox: Mail[]; env?: Record<string, string>; now?: () => number }): ClubDeps {
  const SUPABASE = 'https://proj.supabase.test';
  const env = readClubEnv((k) => ({
    SUPABASE_URL: SUPABASE,
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
    SUPABASE_ANON_KEY: 'anon-key',
    CLUB_STRIPE_SECRET_KEY: 'sk_test_club',
    RESEND_API_KEY: 're_test',
    SHOP_SITE_URL: 'https://www.organizedmomcollective.com',
    ...opts.env,
  })[k]);
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : '';
    if (url.hostname === 'api.stripe.com') return opts.stripe.handle(init?.method ?? 'GET', url, body, headers);
    if (url.hostname === 'api.resend.com') {
      const b = JSON.parse(body);
      opts.inbox.push({ to: b.to[0], subject: b.subject, text: b.text, key: headers.get('idempotency-key') });
      return new Response(JSON.stringify({ id: `re_${opts.inbox.length}` }), { status: 200 });
    }
    if (url.href === `${SUPABASE}/auth/v1/user`) {
      const token = headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      const uid = opts.tokens.get(token);
      if (!uid) return new Response('{}', { status: 401 });
      return new Response(JSON.stringify(sqlJson(`select id, email, email_confirmed_at from auth.users where id = ${lit(uid)}`)), { status: 200 });
    }
    if (url.href === `${SUPABASE}/auth/v1/admin/users` && init?.method === 'POST') {
      const b = JSON.parse(body);
      const exists = sql(`select id from auth.users where lower(email) = lower(${lit(b.email)})`);
      if (exists) return new Response('{"msg":"exists"}', { status: 422 });
      const id = sql(`insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), ${lit(b.email)}, null) returning id`);
      return new Response(JSON.stringify({ id }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url.href}`);
  }) as typeof fetch;
  return {
    env,
    db: psqlDb,
    stripe: createStripe({ secretKey: env.clubStripeSecretKey, apiVersion: STRIPE_API_VERSION, fetch: fetchFn }),
    mailer: createResendMailer({ apiKey: env.resendApiKey, from: env.clubEmailFrom, fetch: fetchFn }),
    fetch: fetchFn,
    now: opts.now ?? (() => Math.floor(Date.now() / 1000)),
  };
}

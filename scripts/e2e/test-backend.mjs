#!/usr/bin/env node
/**
 * A stand-in for the Supabase project, for end-to-end tests ONLY, on a THROWAWAY local database
 * (docs/ios/FAMILY_E2E.md). Never point it at a real project: it signs anyone in with the test code.
 *
 *   /auth/v1/otp, /verify, /token, /logout   Supabase Auth's email-code flow. The code is always 123456; the user is
 *                                            created in auth.users on first sign-in, like create_user: true.
 *   /rest/v1/rpc/<fn>                        PostgREST's function call: runs public.<fn>(named args) in a transaction
 *                                            as role `authenticated` with request.jwt.claims.sub = the signed-in user
 *                                            (anon without a token), so every grant, RLS policy and security-definer
 *                                            check is the database's own. Errors come back as { message } like PostgREST.
 *   /rest/v1/account_saves                   GET (select) and DELETE (key=eq.) as the user, through RLS.
 *   /__test/sql (POST, localhost only)       test setup and inspection as the database owner.
 *
 * Uses the psql client (no driver dependency). Env: PGHOST, PGPORT, PGUSER, PGPASSWORD, E2E_DB (default omc_family_e2e),
 * E2E_PORT (default 54321).
 */
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';

const DB = process.env.E2E_DB ?? 'omc_family_e2e';
const PORT = Number(process.env.E2E_PORT ?? 54321);
const CODE = '123456';
const TOKEN_SECONDS = 3600;

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function psql(sql) {
  const r = spawnSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', DB], { input: sql, encoding: 'utf8' });
  if (r.status !== 0) {
    const m = /ERROR:\s+(.*)/.exec(r.stderr ?? '');
    const err = new Error(m ? m[1].trim() : (r.stderr || 'psql failed').trim());
    err.permission = /permission denied/.test(r.stderr ?? '');
    throw err;
  }
  return r.stdout.trim();
}

// ------------------------------------------------------------------ auth (tokens are opaque, mapped here)

const tokens = new Map(); // access token -> { sub, email, exp }
const refresh = new Map(); // refresh token -> { sub, email }

function session(sub, email) {
  const access = `e2e.${randomBytes(18).toString('hex')}`;
  const rt = randomBytes(18).toString('hex');
  tokens.set(access, { sub, email, exp: Date.now() + TOKEN_SECONDS * 1000 });
  refresh.set(rt, { sub, email });
  return { access_token: access, refresh_token: rt, expires_in: TOKEN_SECONDS, token_type: 'bearer', user: { id: sub, email } };
}

function userFor(email) {
  const e = email.trim().toLowerCase();
  const found = psql(`select id from auth.users where lower(email) = ${q(e)}`);
  if (found) return found.split('\n')[0];
  const id = randomUUID();
  psql(`insert into auth.users (id, email, email_confirmed_at) values (${q(id)}, ${q(e)}, now())`);
  return id;
}

const who = (req) => {
  const t = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
  const s = t && tokens.get(t);
  return s && s.exp > Date.now() ? s : null;
};

// ------------------------------------------------------------------ database functions, PostgREST-style

let fns = null;
function functions() {
  if (fns) return fns;
  const rows = JSON.parse(psql(`select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname, 'args', coalesce(p.proargnames[1:p.pronargs], '{}'),
      'types', (select coalesce(jsonb_agg(format_type(t, null) order by i), '[]') from unnest(p.proargtypes::oid[]) with ordinality u(t, i)),
      'defaults', p.pronargdefaults, 'set', p.proretset, 'ret', format_type(p.prorettype, null))), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`));
  fns = new Map();
  for (const f of rows) fns.set(f.name, [...(fns.get(f.name) ?? []), f]);
  return fns;
}

function literal(v, type) {
  if (v === null || v === undefined) return `null::${type}`;
  if (type === 'jsonb' || type === 'json') return `${q(JSON.stringify(v))}::${type}`;
  if (type.endsWith('[]')) {
    const base = type.slice(0, -2);
    return `(select coalesce(array_agg(x::${base}), '{}') from jsonb_array_elements_text(${q(JSON.stringify(v))}::jsonb) x)::${type}`;
  }
  return `${q(typeof v === 'object' ? JSON.stringify(v) : v)}::${type}`;
}

function callSql(name, body) {
  const keys = Object.keys(body ?? {});
  const candidates = functions().get(name) ?? [];
  const f = candidates.find((c) => keys.every((k) => c.args.includes(k)) && c.args.length - c.defaults <= keys.length);
  if (!f) { const e = new Error(`Could not find the function public.${name}(${keys.join(', ')})`); e.status = 404; throw e; }
  const call = `public.${name}(${keys.map((k) => `${k} => ${literal(body[k], f.types[f.args.indexOf(k)])}`).join(', ')})`;
  if (f.set) return `select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from ${call} r`;
  if (f.ret === 'void') return `select 'null' from (select ${call}) x`;
  return `select coalesce(to_jsonb(${call}), 'null'::jsonb)`;
}

function asUser(user, sql) {
  const claims = user ? JSON.stringify({ sub: user.sub, email: user.email, role: 'authenticated' }) : '{}';
  return psql(`begin;
set local role ${user ? 'authenticated' : 'anon'};
select set_config('request.jwt.claims', ${q(claims)}, true) \\g /dev/null
${sql};
commit;`);
}

// ------------------------------------------------------------------ http

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer, x-client-info');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, 'http://x');
  let raw = '';
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  try {
    // ---- auth
    if (url.pathname === '/auth/v1/otp') return send(res, 200, {});
    if (url.pathname === '/auth/v1/verify') {
      if (body.token !== CODE) return send(res, 400, { error: 'invalid', msg: 'Token has expired or is invalid' });
      const email = String(body.email).toLowerCase();
      return send(res, 200, session(userFor(email), email));
    }
    if (url.pathname === '/auth/v1/token') {
      const r = refresh.get(body.refresh_token);
      if (!r) return send(res, 400, { error: 'invalid_grant' });
      refresh.delete(body.refresh_token);
      return send(res, 200, session(r.sub, r.email));
    }
    if (url.pathname === '/auth/v1/logout') {
      const t = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
      if (t) tokens.delete(t);
      return send(res, 204);
    }
    // ---- test control (setup/inspection as owner; only from this machine)
    if (url.pathname === '/__test/sql') {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return send(res, 403, {});
      fns = null;
      return send(res, 200, { out: psql(body.sql) });
    }
    // ---- data
    const user = who(req);
    if (req.headers.authorization && !user) return send(res, 401, { message: 'JWT expired' });
    const rpc = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
    if (rpc && req.method === 'POST') return send(res, 200, asUser(user, callSql(rpc[1], body)) || 'null');
    if (url.pathname === '/rest/v1/account_saves') {
      if (req.method === 'GET') return send(res, 200, asUser(user, `select coalesce(jsonb_agg(jsonb_build_object('key', key, 'data', data, 'page', page, 'label', label, 'updated_at', updated_at) order by updated_at desc), '[]') from public.account_saves`));
      if (req.method === 'DELETE') {
        const key = /^eq\.(.*)$/.exec(url.searchParams.get('key') ?? '')?.[1];
        asUser(user, `delete from public.account_saves where key = ${q(key ?? '')}`);
        return send(res, 204);
      }
    }
    return send(res, 404, { message: `not served by the e2e backend: ${req.method} ${url.pathname}` });
  } catch (e) {
    return send(res, e.status ?? (e.permission ? 403 : 400), { message: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`e2e backend on http://127.0.0.1:${PORT} (database ${DB})`));

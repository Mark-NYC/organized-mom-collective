/**
 * A THROWAWAY local database with every migration, and a PostgREST-like `rpc` that calls public.intel_* as the
 * service role (one psql process per call, so concurrent calls are concurrent connections). Tests only.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

export function intelTestDb(DB) {
  const psql = (sql, db = DB) => {
    const r = spawnSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db], { input: sql, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
  };
  psql(`drop database if exists ${DB} with (force); create database ${DB};`, 'postgres');
  spawnSync('psql', ['-X', '-q', '-d', DB, '-f', 'supabase/tests/supabase-stub.sql'], { encoding: 'utf8' });
  for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) spawnSync('psql', ['-X', '-q', '-d', DB, '-f', `supabase/migrations/${f}`], { encoding: 'utf8' });
  const lit = (v) => (v == null ? 'null' : typeof v === 'number' ? String(v) : `'${(typeof v === 'string' ? v : JSON.stringify(v)).replace(/'/g, "''")}'`);
  const ARGS = {
    intel_budget_reserve: ['p_household::uuid', 'p_scope', 'p_request_key', 'p_attempt::int', 'p_estimate_micro_usd::bigint', 'p_job', 'p_model'],
    intel_budget_settle: ['p_id::bigint', 'p_actual_micro_usd::bigint', 'p_usage::jsonb'],
    intel_budget_status: ['p_scope'], intel_cache_get: ['p_fingerprint'], intel_cache_put: ['p_fingerprint', 'p::jsonb'],
  };
  const psqlAsync = (sql) => new Promise((resolve, reject) => {
    const p = spawn('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', DB]);
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
    p.stdin.end(sql);
  });
  const db = {
    async rpc(name, a = {}) {
      const args = ARGS[name].map((spec) => { const [k, cast] = spec.split('::'); return `${k} => ${lit(a[k])}${cast ? `::${cast}` : ''}`; }).join(', ');
      const out = await psqlAsync(`set role service_role; select coalesce(to_jsonb(public.${name}(${args}))::text, 'null');`);
      return JSON.parse(out.split('\n').pop());
    },
  };
  return { db, psql, asOwner: (sql) => psql(sql), drop: () => psql(`drop database ${DB} with (force)`, 'postgres') };
}

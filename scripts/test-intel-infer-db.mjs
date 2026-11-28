#!/usr/bin/env node
/**
 * The inference function against the REAL database rules (docs/intelligence/EVALUATION_PLAN.md): the handler
 * (supabase/functions/_shared/handlers/intel-infer.ts) on a THROWAWAY local database with every migration, calling
 * public.intel_* as the service role, with a scripted provider (no network, no key, no spending anywhere).
 *
 * Checks: replay never reserves; a live call settles its real cost; the server cache answers repeats for free; retries
 * are separate counted reservations; a timeout is charged in full; 30 concurrent live requests against a nearly spent
 * $5.00 never take the total over $5.00; and once the total is reached nothing reaches the provider.
 *
 *   PGHOST=localhost PGUSER=postgres PGPASSWORD=… node scripts/test-intel-infer-db.mjs
 */
import { createJiti } from 'jiti';
import { intelTestDb } from './lib/intel-test-db.mjs';

const jiti = createJiti(import.meta.url);
const { createIntelInferHandler } = await jiti.import('../supabase/functions/_shared/handlers/intel-infer.ts');
const { fakeProvider } = await jiti.import('../supabase/functions/_shared/intel/provider.ts');

const { db, psql, asOwner, drop } = intelTestDb('intel_infer_db');


let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };
const post = (body) => new Request('http://x/intel-infer', { method: 'POST', headers: { 'x-intel-eval': 'eval-secret' }, body: JSON.stringify(body) });
const usage = { input_tokens: 600, cached_tokens: 0, output_tokens: 80, reasoning_tokens: 0 };
const events = (n) => ({ items: [{ id: `e${n}`, title: `S${n} pictures` }] });
const answer = (c) => ({ ok: true, output: { items: c.input.items.map((x) => ({ id: x.id, kind: 'school-event', needs: ['outfit'], is_exception: false, confidence: 0.7 })) }, usage, latencyMs: 2, status: 'completed' });

console.log('intel-infer on the real budget rules');
const spent = () => Number(JSON.parse(asOwner(`select intel_private.budget_status('synthetic')::text`)).spent_micro_usd);

// 1. Replay never reserves
let provider = fakeProvider(answer);
let h = createIntelInferHandler({ db, provider, evalSecret: 'eval-secret', sleep: async () => {} });
let r = await (await h(post({ task: 'interpret-event', input: events(1), run: 'replay-check' }))).json();
check('replay: a miss, no reservation, no provider call', r.source === 'miss' && provider.calls.length === 0 && asOwner('select count(*) from public.intel_usage') === '0');

// 2. Live: real cost settled; repeat answered by the server cache for free
r = await (await h(post({ task: 'interpret-event', input: events(1), live: true, run: 'phase-b-1' }))).json();
const row = asOwner(`select concat(status, ':', actual_micro_usd, ':', input_tokens, ':', job, ':', model) from public.intel_usage`);
check('live: reserved, called, settled at the real cost (tokens only)', r.source === 'live' && r.valid && row === `settled:${r.cost_micro_usd}:600:interpret-event:gpt-6-luna`, row);
r = await (await h(post({ task: 'interpret-event', input: events(1), live: true, run: 'phase-b-2' }))).json();
check('repeat: answered from the server cache, free, provider not called', r.source === 'cache' && r.cost_micro_usd === 0 && provider.calls.length === 1);

// 3. Retries: 503 then success → two counted reservations, the failed one at its full estimate
provider = fakeProvider((c, n) => (n === 1 ? { ok: false, error: 'http-503', sent: true, retry: true, latencyMs: 1 } : answer(c)));
h = createIntelInferHandler({ db, provider, evalSecret: 'eval-secret', sleep: async () => {} });
r = await (await h(post({ task: 'interpret-event', input: events(2), live: true, run: 'phase-b-1' }))).json();
const att = asOwner(`select string_agg(concat(attempt, ':', status, ':', actual_micro_usd = reserved_micro_usd), ',' order by attempt) from public.intel_usage where request_key = '${r.fingerprint.slice(0, 41)}:phase-b-1'`);
check('retry: each attempt is its own counted reservation; the failed one is charged its full estimate', r.attempts === 2 && att === "1:settled:t,2:settled:f", att);

// 4. Concurrency against a nearly spent $5.00: 30 live requests at once
const before = spent();
asOwner(`insert into public.intel_usage (scope, month, request_key, attempt, status, reserved_micro_usd, actual_micro_usd, job, model)
  values ('synthetic', (date_trunc('month', now()) - interval '1 month')::date, 'earlier-phases-xx', 1, 'settled', 50000, ${5_000_000 - before - 1000}, 'eval', 'luna')`);
provider = fakeProvider((c) => answer(c));
h = createIntelInferHandler({ db, provider, evalSecret: 'eval-secret', sleep: async () => {} });
const results = await Promise.all(Array.from({ length: 30 }, (_, i) => h(post({ task: 'interpret-event', input: events(100 + i), live: true, run: `race-${i}` })).then((x) => x.status)));
const total = spent();
check(`30 concurrent requests, $0.001 left: the total stays within $5.00 (${results.filter((s) => s === 200).length} ran, ${results.filter((s) => s === 402).length} stopped)`,
  total <= 5_000_000 && results.filter((s) => s === 402).length > 0 && results.every((s) => s === 200 || s === 402), `${total} micro-USD`);
check('every request that ran was reserved first (no call without a reservation)', provider.calls.length === results.filter((s) => s === 200).length);

// 5. Spent: nothing reaches the provider any more
asOwner(`insert into public.intel_usage (scope, month, request_key, attempt, status, reserved_micro_usd, actual_micro_usd, job, model)
  values ('synthetic', date_trunc('month', now())::date, 'fill-to-the-cap-x', 1, 'settled', 1, ${Math.max(0, 5_000_000 - spent())}, 'eval', 'luna')`);
provider = fakeProvider(answer);
h = createIntelInferHandler({ db, provider, evalSecret: 'eval-secret', sleep: async () => {} });
const stop = await h(post({ task: 'validate', input: { word: 'ready' }, live: true, run: 'after-cap' }));
const body = await stop.json();
check('at $5.00: refused with the budget status, provider never called', stop.status === 402 && body.reason === 'lifetime_budget' && provider.calls.length === 0 && Number(body.budget.spent_micro_usd) === 5_000_000);
r = await (await h(post({ task: 'interpret-event', input: events(1), run: 'replay-after-cap' }))).json();
check('replay still works at the cap (cached answers are free)', r.source === 'cache' && r.valid);

// 6. Grants: families can't reach any of it
const denied = asOwner(`select bool_and(not has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'intel\\_%'`);
check('families cannot call the budget or the cache', denied === 't');

drop();
console.log(failures ? `\n${failures} check(s) failed` : '\nall intel-infer database checks passed');
process.exit(failures ? 1 : 0);

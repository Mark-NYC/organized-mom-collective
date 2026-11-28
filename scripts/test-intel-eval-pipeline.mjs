#!/usr/bin/env node
/**
 * Rehearses the whole progressive evaluation without a provider or any spending (docs/intelligence/EVALUATION_PLAN.md):
 * the real runner (scripts/intel-eval.mjs) in --live mode → a local intel-infer function → the real database budget on
 * a THROWAWAY database → a scripted "model" that answers from the labels with deliberate mistakes on some groups.
 *
 * Checks: plan sends nothing; phases run in order and stop at their gates; only uncached requests are sent; replay
 * afterwards sends nothing and scores the same; escalation targets only the short groups, on the strong tier; a phase
 * that doesn't fit what's left of the budget sends nothing and writes an approval request; and the database total is
 * never exceeded.
 *
 *   PGHOST=localhost PGUSER=postgres PGPASSWORD=… node scripts/test-intel-eval-pipeline.mjs
 */
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { intelTestDb } from './lib/intel-test-db.mjs';

const jiti = createJiti(import.meta.url);
const { createIntelInferHandler } = await jiti.import('../supabase/functions/_shared/handlers/intel-infer.ts');
const { fakeProvider } = await jiti.import('../supabase/functions/_shared/intel/provider.ts');
const { CATALOG } = await jiti.import('../src/lib/intel/eval/catalog.ts');

const { db, asOwner, drop } = intelTestDb('intel_eval_pipeline');
const byTitle = new Map(CATALOG.map((c) => [c.title, c]));
// The scripted "model": right except on school days (cheap tier says "other" for them), always valid.
const provider = fakeProvider((c) => {
  const strong = c.model === 'gpt-6.1-terra';
  const usage = { input_tokens: 700, cached_tokens: 0, output_tokens: 150, reasoning_tokens: 0 };
  if (c.task.name === 'validate') return { ok: true, output: { ok: true, echo: c.input.word }, usage, latencyMs: 1, status: 'completed' };
  if (c.task.name === 'pattern-review') return { ok: true, output: { items: c.input.candidates.map((x) => ({ id: x.id, meaningful: x.support >= 3, ask_family: x.support >= 3, label: 'weekly-activity' })) }, usage, latencyMs: 1, status: 'completed' };
  return { ok: true, usage, latencyMs: 1, status: 'completed', output: { items: c.input.items.map((it) => {
    const t = byTitle.get(it.title);
    const wrong = !strong && t?.group === 'school-day';
    return { id: it.id, kind: wrong ? 'other' : t?.kind ?? 'other', needs: wrong ? [] : t?.needs ?? [], is_exception: false, confidence: 0.8 };
  }) } };
});
const handler = createIntelInferHandler({ db, provider, evalSecret: 'pipeline-secret', sleep: async () => {} });
const srv = createServer(async (req, res) => {
  let body = ''; for await (const ch of req) body += ch;
  const r = await handler(new Request('http://local/intel-infer', { method: 'POST', headers: req.headers, body }));
  res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(await r.text());
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'intel-eval-'));
const env = { ...process.env, INTEL_INFER_URL: `http://127.0.0.1:${srv.address().port}`, INTEL_EVAL_SECRET: 'pipeline-secret',
  INTEL_CACHE_DIR: join(dir, 'cache'), INTEL_RESULTS_DIR: join(dir, 'results'), INTEL_EVAL_LOG: join(dir, 'log.md'), INTEL_APPROVAL_FILE: join(dir, 'approval.md') };
const run = (...args) => new Promise((resolve) => {
  // async child so this process keeps serving the local function while the runner calls it
  import('node:child_process').then(({ spawn }) => {
    const p = spawn('node', ['scripts/intel-eval.mjs', ...args], { env });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code, out }));
  });
});
const result = (p) => JSON.parse(readFileSync(join(dir, 'results', `${p}.json`), 'utf8'));
const files = () => (existsSync(join(dir, 'cache')) ? readdirSync(join(dir, 'cache')).length : 0);
const spent = () => Number(JSON.parse(asOwner(`select intel_private.budget_status('synthetic')::text`)).spent_micro_usd);

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };
console.log('progressive evaluation, rehearsed end to end (scripted model, real budget, no network)');

let r = await run('plan');
check('plan: nothing sent, worst cases shown', r.code === 0 && provider.calls.length === 0 && /Phase B: .* worst case \$0\.\d+/.test(r.out));

r = await run('run', 'B', '--live');
check('B before A passes: refused, nothing sent', r.code === 3 && provider.calls.length === 0);

r = await run('run', 'A', '--live');
check('A: API validation passes with two tiny calls', r.code === 0 && provider.calls.length === 2 && result('A').gate.pass, r.out.slice(-200));

r = await run('run', 'B', '--live');
const b = result('B');
check(`B: five households, cheap model only (${provider.calls.length - 2} calls)`, b.mode === 'live' && provider.calls.slice(2).every((c) => c.model === 'gpt-6-luna'));
check(`B: scored against the labels, rules baseline beside it (model ${Math.round(b.modelKindAccuracy * 100)}%, rules ${Math.round(b.rulesKindAccuracy * 100)}%)`, b.modelKindAccuracy > b.rulesKindAccuracy && b.gate.pass && b.gate.next === 'C');
check('B: the cheap model\'s shortfall is found (school days)', (b.gate.short ?? []).includes('school-day'), JSON.stringify(b.gate.short));

const callsAfterB = provider.calls.length;
const cachedAfterB = files();
r = await run('run', 'B');
check('replay of B: nothing sent, same scores, no cost', provider.calls.length === callsAfterB && JSON.stringify(result('B').groups) === JSON.stringify(b.groups) && result('B').mode === 'replay');
r = await run('run', 'B', '--live');
check('live again: everything cached, nothing sent', provider.calls.length === callsAfterB && files() === cachedAfterB);

r = await run('run', 'C', '--live');
const c = result('C');
check(`C: the other 45 households, after B passed (${provider.calls.length - callsAfterB} calls)`, c.mode === 'live' && c.requests >= 45 && c.gate.next === 'escalate', c.gate.why);

const before = provider.calls.length;
r = await run('run', 'escalate', '--live');
const esc = provider.calls.slice(before);
check(`escalate: strong model, only on school-day titles, each distinct title once (${esc.length} call(s))`, esc.length >= 1 && esc.length <= 2 && esc.every((x) => x.model === 'gpt-6.1-terra' && x.input.items.every((it) => byTitle.get(it.title)?.group === 'school-day')));
check(`escalate: the strong model fixes the shortfall (${Math.round(result('escalate').modelKindAccuracy * 100)}%)`, result('escalate').modelKindAccuracy === 1);

const total = spent();
check(`spent so far is tiny and recorded: ${(total / 1e6).toFixed(4)} USD`, total > 0 && total < 100_000);

// Out of budget: leave less than the next phase needs, clear the cache, ask for B again → approval request, nothing sent
asOwner(`insert into public.intel_usage (scope, month, request_key, attempt, status, reserved_micro_usd, actual_micro_usd, job, model)
  values ('synthetic', date_trunc('month', now())::date, 'earlier-spend-xx', 1, 'settled', 50000, ${5_000_000 - total - 50}, 'eval', 'luna')`);
rmSync(join(dir, 'cache'), { recursive: true });
asOwner('delete from public.intel_inference_cache');
const n = provider.calls.length;
r = await run('run', 'B', '--live');
const approval = existsSync(join(dir, 'approval.md')) ? readFileSync(join(dir, 'approval.md'), 'utf8') : '';
check('over what\'s left: nothing sent, approval request written with results so far and why', r.code === 4 && provider.calls.length === n && /approval needed/.test(approval) && /Results so far/.test(approval) && /Why more inference/.test(approval));
check('the database total never went over $5.00', spent() <= 5_000_000, String(spent()));
const log = readFileSync(join(dir, 'log.md'), 'utf8');
check('every live phase is in the evaluation log', ['| A |', '| B |', '| C |', '| escalate |'].every((x) => log.includes(x)));

srv.close(); drop(); rmSync(dir, { recursive: true, force: true });
console.log(failures ? `\n${failures} check(s) failed` : '\nall evaluation pipeline checks passed');
process.exit(failures ? 1 : 0);

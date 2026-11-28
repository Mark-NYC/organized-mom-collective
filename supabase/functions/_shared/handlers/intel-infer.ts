/**
 * The intel-infer Edge Function: the ONLY place a model is called (docs/intelligence/EVALUATION_PLAN.md).
 *
 *   POST { task, input, tier?: 'cheap' | 'strong', live?: true, run }   with x-intel-eval: <INTEL_EVAL_SECRET>
 *
 * Stage C scope: synthetic evaluation only (budget scope 'synthetic', $5.00 in total). Real households are not served.
 *
 *  1. The task must be in the closed registry (../intel/tasks.ts); its input must pass the task's checks and size limit.
 *  2. Cache first: the same (task, prompt version, model, input) is answered from intel_inference_cache at no cost.
 *  3. Without `live: true` it stops there ("miss"): replay never spends. Live inference is an explicit request.
 *  4. Reserve before calling (intel_budget_reserve): serialized in the database, the $5 total, $0.05 per call. Each
 *     retry is its own counted reservation (max 3 attempts, only for timeouts, 429 and 5xx).
 *  5. Settle after: the real cost from the provider's usage; a call that may have been processed but reported nothing
 *     is settled at its full estimate; only a call that never left (or was refused with a 4xx) is released.
 *  6. The answer is validated against the closed vocabularies and stored in the cache (valid or not, so a replay
 *     reproduces exactly what the model did).
 *
 * The provider key lives only in this function's secrets. No prompt or output is logged; intel_usage keeps tokens only.
 */
import { json, safeEqual } from '../http.ts';
import { DEFAULT_TIERS, costMicroUsd, estimateMicroUsd, type Provider, type Tier } from '../intel/provider.ts';
import { TASKS, fingerprint, type TaskName } from '../intel/tasks.ts';

export interface IntelInferDeps {
  db: { rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> };
  /** null when no provider key is configured: replay still works, live calls are refused. */
  provider: Provider | null;
  evalSecret: string | null;
  tiers?: Record<Tier, string>;
  sleep?(ms: number): Promise<void>;
}

interface Cached { output: { result: unknown; valid: boolean; reason: string | null }; usage: Record<string, number>; model: string; prompt_version: string; cost_micro_usd: number }

const RUN = /^[a-z0-9-]{3,40}$/;

export function createIntelInferHandler(deps: IntelInferDeps) {
  const tiers = deps.tiers ?? DEFAULT_TIERS;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (!deps.evalSecret || !safeEqual(req.headers.get('x-intel-eval') ?? '', deps.evalSecret)) return json({ error: 'unauthorized' }, 401);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'invalid' }, 400); }
    if (body.status === true) return json({ budget: await deps.db.rpc('intel_budget_status', { p_scope: 'synthetic' }) });

    const name = String(body.task) as TaskName;
    const task = TASKS[name];
    const tier = (body.tier ?? 'cheap') as Tier;
    const run = String(body.run ?? '');
    if (!task || !(tier in tiers) || !RUN.test(run)) return json({ error: 'invalid' }, 400);
    const model = tiers[tier];
    const serialized = JSON.stringify(body.input ?? null);
    if (serialized.length > task.maxInputChars) return json({ error: 'input_too_large' }, 413);
    const bad = task.validInput(body.input);
    if (bad) return json({ error: 'invalid_input', detail: bad }, 400);
    const fp = await fingerprint(name, model, body.input);
    const base = { fingerprint: fp, task: name, model, prompt_version: task.promptVersion };

    const hit = await deps.db.rpc<Cached | null>('intel_cache_get', { p_fingerprint: fp });
    if (hit) return json({ ...base, source: 'cache', ...hit.output, cost_micro_usd: 0, original_cost_micro_usd: hit.cost_micro_usd, usage: hit.usage });
    if (body.live !== true) return json({ ...base, source: 'miss', cost_micro_usd: 0 });
    if (!deps.provider) return json({ ...base, error: 'no_provider' }, 503);

    const estimate = estimateMicroUsd(model, task, body.input);
    if (estimate == null) return json({ ...base, error: 'unpriced_model' }, 400);
    const key = `${fp.slice(0, 41)}:${run}`;
    let spent = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await deps.db.rpc<{ ok: boolean; id?: number; reason?: string; spent_micro_usd?: number; cap_micro_usd?: number }>('intel_budget_reserve', {
        p_household: null, p_scope: 'synthetic', p_request_key: key, p_attempt: attempt, p_estimate_micro_usd: estimate, p_job: name, p_model: model,
      });
      if (!r.ok || r.reason === 'existing') {
        const budget = await deps.db.rpc('intel_budget_status', { p_scope: 'synthetic' }).catch(() => null);
        return json({ ...base, error: r.reason === 'existing' ? 'in_flight' : 'budget', reason: r.reason, estimate_micro_usd: estimate, spent_this_request_micro_usd: spent, budget }, r.reason === 'existing' ? 409 : 402);
      }
      const res = await deps.provider.call({ model, task, input: body.input });
      if (res.ok) {
        const cost = costMicroUsd(model, res.usage);
        spent += cost;
        await deps.db.rpc('intel_budget_settle', { p_id: r.id, p_actual_micro_usd: cost, p_usage: { ...res.usage, latency_ms: res.latencyMs, outcome: 'ok', prompt_version: task.promptVersion } });
        const reason = task.validOutput(res.output, body.input);
        const output = { result: res.output, valid: !reason, reason };
        await deps.db.rpc('intel_cache_put', { p_fingerprint: fp, p: { task: name, model, prompt_version: task.promptVersion, output, usage: res.usage, cost_micro_usd: cost } });
        return json({ ...base, source: 'live', ...output, attempts: attempt, cost_micro_usd: spent, usage: res.usage, latency_ms: res.latencyMs });
      }
      // Failed: what did it cost? Reported usage if any; the full estimate if it may have been processed; else nothing.
      const cost = res.usage ? costMicroUsd(model, res.usage) : res.sent ? estimate : null;
      spent += cost ?? 0;
      await deps.db.rpc('intel_budget_settle', { p_id: r.id, p_actual_micro_usd: cost, p_usage: { ...(res.usage ?? {}), latency_ms: res.latencyMs, outcome: res.error.slice(0, 32).replace(/[^a-z0-9-]/g, '-') } });
      if (!res.retry || attempt === 3) return json({ ...base, source: 'live', error: 'provider', detail: res.error, attempts: attempt, cost_micro_usd: spent }, 502);
      await sleep(500 * 2 ** attempt);
    }
    return json({ ...base, error: 'provider' }, 502);
  };
}

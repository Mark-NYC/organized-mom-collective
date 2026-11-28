/**
 * The inference function (supabase/functions/_shared/handlers/intel-infer.ts), its task registry and provider layer:
 * closed tasks and vocabularies, minimized inputs, pricing and reservations, the OpenAI adapter's request and parsing,
 * cache-first replay, explicit live calls, retries and settlement. No network: scripted fetch and providers.
 * The budget rules themselves are the database's (supabase/tests/household-intelligence-engine.sql,
 * scripts/test-intel-budget-concurrency.sh, scripts/test-intel-infer-db.mjs).
 */
import { describe, expect, it } from 'vitest';
import { ALL_NEED_IDS } from '../src/lib/v18/playbooks';
import { createIntelInferHandler } from '../supabase/functions/_shared/handlers/intel-infer';
import { PRICES, costMicroUsd, estimateMicroUsd, fakeProvider, openAiProvider, type ProviderResult } from '../supabase/functions/_shared/intel/provider';
import { EVENT_KINDS, NEED_IDS, TASKS, canonical, fingerprint } from '../supabase/functions/_shared/intel/tasks';

const usage = (i = 900, o = 120, c = 0) => ({ input_tokens: i, cached_tokens: c, output_tokens: o, reasoning_tokens: 0 });
const events = { items: [{ id: 'e1', title: 'P2 birthday', repeats: true, day_part: 'all-day' }, { id: 'e2', title: 'S3 pictures', repeats: false }] };
const good = { items: [{ id: 'e1', kind: 'birthday-reminder', needs: ['card'], is_exception: false, confidence: 0.8 }, { id: 'e2', kind: 'school-event', needs: ['outfit'], is_exception: false, confidence: 0.6 }] };

describe('the task registry', () => {
  it('needs are exactly the playbooks\' (nothing the app can\'t act on); kinds extend the rules\' kinds', () => {
    expect([...NEED_IDS].sort()).toEqual([...ALL_NEED_IDS].sort());
    for (const k of ['field-trip', 'birthday-party', 'party', 'sports-game', 'sports-practice', 'performance', 'appointment', 'routine', 'other']) expect(EVENT_KINDS).toContain(k);
  });
  it('inputs are minimized: no extra fields, no links, emails, phones or addresses, size-limited', () => {
    const t = TASKS['interpret-event'];
    expect(t.validInput(events)).toBeNull();
    expect(t.validInput({ items: [{ id: 'e1', title: 'P2 party', description: 'bring cake' }] })).toBe('fields');
    expect(t.validInput({ items: [{ id: 'e1', title: 'P2 party', age: 7 }] })).toBe('fields');
    for (const title of ['Zoom https://x.co/j', 'Call ann@school.org', 'Call 555-123-4567', 'Party at 12 Oak St']) expect(t.validInput({ items: [{ id: 'e1', title }] }), title).toBe('item');
    expect(t.validInput({ items: Array.from({ length: 21 }, (_, i) => ({ id: `e${i}`, title: 'x' })) })).toBe('items');
  });
  it('outputs are validated: closed kinds and needs, only input ids, each once, all answered', () => {
    const t = TASKS['interpret-event'];
    expect(t.validOutput(good, events)).toBeNull();
    expect(t.validOutput({ items: [{ ...good.items[0], kind: 'sleepover' }, good.items[1]] }, events)).toBe('kind');
    expect(t.validOutput({ items: [{ ...good.items[0], needs: ['buy-a-pony'] }, good.items[1]] }, events)).toBe('needs');
    expect(t.validOutput({ items: [{ ...good.items[0], id: 'e9' }, good.items[1]] }, events)).toBe('id');
    expect(t.validOutput({ items: [good.items[0]] }, events)).toBe('missing');
    expect(t.validOutput({ items: [good.items[0], good.items[0]] }, events)).toBe('id');
  });
  it('fingerprints are stable over key order and change with the model, prompt or input', async () => {
    const a = await fingerprint('interpret-event', 'gpt-6-luna', { items: [{ title: 'x', id: 'e1' }] });
    expect(await fingerprint('interpret-event', 'gpt-6-luna', { items: [{ id: 'e1', title: 'x' }] })).toBe(a);
    expect(await fingerprint('interpret-event', 'gpt-6.1-terra', { items: [{ id: 'e1', title: 'x' }] })).not.toBe(a);
    expect(await fingerprint('interpret-event', 'gpt-6-luna', { items: [{ id: 'e1', title: 'y' }] })).not.toBe(a);
    expect(a).toMatch(/^f[0-9a-f]{40}$/);
    expect(canonical({ b: 1, a: [2, { d: 1, c: 0 }] })).toBe('{"a":[2,{"c":0,"d":1}],"b":1}');
  });
});

describe('pricing and reservations', () => {
  it('the estimate covers the real cost (input generously, output at its ceiling)', () => {
    const t = TASKS['interpret-event'];
    const est = estimateMicroUsd('gpt-6-luna', t, events)!;
    const realistic = costMicroUsd('gpt-6-luna', usage(Math.ceil(JSON.stringify(events).length / 4) + 400, t.maxOutputTokens(events)));
    expect(est).toBeGreaterThanOrEqual(realistic);
    expect(est).toBeLessThan(1000); // well under a tenth of a cent for two events on the cheap model
  });
  it('an unpriced model is never called', () => expect(estimateMicroUsd('gpt-unknown', TASKS.validate, { word: 'hi' })).toBeNull());
  it('cost from usage: cached input at the cached price', () => {
    expect(costMicroUsd('gpt-6-luna', usage(1_000_000, 0))).toBe(100_000);
    expect(costMicroUsd('gpt-6-luna', usage(1_000_000, 0, 1_000_000))).toBe(10_000);
    expect(costMicroUsd('gpt-6.1-terra', usage(0, 1_000_000))).toBe(5_000_000);
    expect(PRICES['gpt-6.1-terra'].output / PRICES['gpt-6-luna'].output).toBe(10);
  });
  it('a validation call costs a few hundredths of a cent at most', () => expect(estimateMicroUsd('gpt-6-luna', TASKS.validate, { word: 'ready' })).toBeLessThan(300));
});

describe('the OpenAI adapter', () => {
  const respond = (status: number, body: unknown) => async (url: string, init: RequestInit) => { sent.push({ url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization }); return new Response(JSON.stringify(body), { status }); };
  let sent: { url: string; body: Record<string, unknown>; auth: string }[] = [];
  it('Responses API, store: false, strict JSON schema, hard output ceiling, key only in the header', async () => {
    sent = [];
    const p = openAiProvider('sk-test', respond(200, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(good) }] }], usage: { input_tokens: 500, output_tokens: 90, input_tokens_details: { cached_tokens: 100 }, output_tokens_details: { reasoning_tokens: 20 } } }) as typeof fetch);
    const r = await p.call({ model: 'gpt-6-luna', task: TASKS['interpret-event'], input: events });
    expect(r).toMatchObject({ ok: true, output: good, usage: { input_tokens: 500, cached_tokens: 100, output_tokens: 90, reasoning_tokens: 20 } });
    expect(sent[0].url).toBe('https://api.openai.com/v1/responses');
    expect(sent[0].auth).toBe('Bearer sk-test');
    expect(sent[0].body).toMatchObject({ model: 'gpt-6-luna', store: false, max_output_tokens: TASKS['interpret-event'].maxOutputTokens(events), text: { format: { type: 'json_schema', strict: true, name: 'interpret_event' } } });
    expect(JSON.stringify(sent[0].body)).not.toContain('sk-test');
  });
  it('4xx is refused before inference (not billed, no retry); 429 and 5xx retry; timeouts count as sent', async () => {
    const r400 = await openAiProvider('k', respond(400, { error: { message: 'bad' } }) as typeof fetch).call({ model: 'm', task: TASKS.validate, input: { word: 'a' } });
    expect(r400).toMatchObject({ ok: false, sent: false, retry: false, error: 'http-400' });
    const r429 = await openAiProvider('k', respond(429, {}) as typeof fetch).call({ model: 'm', task: TASKS.validate, input: { word: 'a' } });
    expect(r429).toMatchObject({ ok: false, sent: false, retry: true });
    const r503 = await openAiProvider('k', respond(503, {}) as typeof fetch).call({ model: 'm', task: TASKS.validate, input: { word: 'a' } });
    expect(r503).toMatchObject({ ok: false, sent: true, retry: true });
    const timeout = await openAiProvider('k', (async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; }) as typeof fetch).call({ model: 'm', task: TASKS.validate, input: { word: 'a' } });
    expect(timeout).toMatchObject({ ok: false, sent: true, retry: true, error: 'timeout' });
  });
  it('an incomplete answer (hit the token ceiling) is a failure with its usage', async () => {
    const r = await openAiProvider('k', respond(200, { status: 'incomplete', output: [], usage: { input_tokens: 50, output_tokens: 64 } }) as typeof fetch).call({ model: 'm', task: TASKS.validate, input: { word: 'a' } });
    expect(r).toMatchObject({ ok: false, error: 'status-incomplete', usage: { output_tokens: 64 } });
  });
});

/** A small in-memory stand-in for the database functions (the real rules are tested in SQL). */
function fakeDb(capMicroUsd = 5_000_000) {
  const usage: { id: number; key: string; attempt: number; reserved: number; actual: number | null; status: string }[] = [];
  const cache = new Map<string, unknown>();
  const spent = () => usage.filter((u) => u.status !== 'released').reduce((a, u) => a + (u.actual ?? u.reserved), 0);
  return {
    usage, cache, spent,
    async rpc<T>(name: string, a: Record<string, unknown> = {}): Promise<T> {
      switch (name) {
        case 'intel_cache_get': return (cache.get(String(a.p_fingerprint)) ?? null) as T;
        case 'intel_cache_put': { const p = a.p as Record<string, unknown>; if (!cache.has(String(a.p_fingerprint))) cache.set(String(a.p_fingerprint), { output: p.output, usage: p.usage, model: p.model, prompt_version: p.prompt_version, cost_micro_usd: p.cost_micro_usd }); return true as T; }
        case 'intel_budget_reserve': {
          if (usage.some((u) => u.key === a.p_request_key && u.attempt === a.p_attempt)) return { ok: true, reason: 'existing' } as T;
          if (spent() + Number(a.p_estimate_micro_usd) > capMicroUsd) return { ok: false, reason: 'lifetime_budget' } as T;
          const id = usage.length + 1;
          usage.push({ id, key: String(a.p_request_key), attempt: Number(a.p_attempt), reserved: Number(a.p_estimate_micro_usd), actual: null, status: 'reserved' });
          return { ok: true, id } as T;
        }
        case 'intel_budget_settle': { const u = usage.find((x) => x.id === a.p_id)!; u.actual = a.p_actual_micro_usd as number | null; u.status = a.p_actual_micro_usd == null ? 'released' : 'settled'; return true as T; }
        case 'intel_budget_status': return { spent_micro_usd: spent(), lifetime_cap_micro_usd: capMicroUsd } as T;
        default: throw new Error(name);
      }
    },
  };
}
const post = (body: unknown, secret = 's3cret') => new Request('https://x/intel-infer', { method: 'POST', headers: { 'x-intel-eval': secret }, body: JSON.stringify(body) });
const ok = (output: unknown, u = usage()): ProviderResult => ({ ok: true, output, usage: u, latencyMs: 5, status: 'completed' });

describe('the inference function', () => {
  it('needs the evaluation secret', async () => {
    const h = createIntelInferHandler({ db: fakeDb(), provider: null, evalSecret: 's3cret' });
    expect((await h(post({ task: 'validate', input: { word: 'hi' }, run: 'phase-a' }, 'nope'))).status).toBe(401);
    expect((await createIntelInferHandler({ db: fakeDb(), provider: null, evalSecret: null })(post({}))).status).toBe(401);
  });
  it('refuses unknown tasks, tiers, oversize and unminimized input', async () => {
    const h = createIntelInferHandler({ db: fakeDb(), provider: null, evalSecret: 's3cret' });
    expect((await h(post({ task: 'write-a-poem', input: {}, run: 'r-1' }))).status).toBe(400);
    expect((await h(post({ task: 'validate', tier: 'best', input: { word: 'hi' }, run: 'r-1' }))).status).toBe(400);
    expect((await h(post({ task: 'interpret-event', input: { items: [{ id: 'e1', title: 'x'.repeat(4000) }] }, run: 'r-1' }))).status).toBe(413);
    expect((await h(post({ task: 'interpret-event', input: { items: [{ id: 'e1', title: 'Party', notes: 'gate code 1234' }] }, run: 'r-1' }))).status).toBe(400);
  });
  it('replay never spends: without live it answers from the cache or reports a miss, and never calls the provider', async () => {
    const db = fakeDb(); const provider = fakeProvider(() => ok(good));
    const h = createIntelInferHandler({ db, provider, evalSecret: 's3cret' });
    const r = await (await h(post({ task: 'interpret-event', input: events, run: 'replay-1' }))).json();
    expect(r).toMatchObject({ source: 'miss', cost_micro_usd: 0 });
    expect(provider.calls).toHaveLength(0);
    expect(db.usage).toHaveLength(0);
  });
  it('a live call reserves, calls the cheap model, settles the real cost, validates and caches; the same request is then free', async () => {
    const db = fakeDb(); const provider = fakeProvider(() => ok(good));
    const h = createIntelInferHandler({ db, provider, evalSecret: 's3cret' });
    const r = await (await h(post({ task: 'interpret-event', input: events, live: true, run: 'phase-b-1' }))).json();
    expect(r).toMatchObject({ source: 'live', valid: true, model: 'gpt-6-luna', prompt_version: 'ie-1', attempts: 1, cost_micro_usd: costMicroUsd('gpt-6-luna', usage()) });
    expect(db.usage).toMatchObject([{ status: 'settled', actual: costMicroUsd('gpt-6-luna', usage()) }]);
    const again = await (await h(post({ task: 'interpret-event', input: events, live: true, run: 'phase-b-2' }))).json();
    expect(again).toMatchObject({ source: 'cache', valid: true, cost_micro_usd: 0, result: good });
    expect(provider.calls).toHaveLength(1);
  });
  it('an answer outside the closed vocabulary is paid for, cached as invalid, and never used', async () => {
    const db = fakeDb();
    const h = createIntelInferHandler({ db, provider: fakeProvider(() => ok({ items: [{ id: 'e1', kind: 'sleepover', needs: [], is_exception: false, confidence: 1 }] })), evalSecret: 's3cret' });
    const r = await (await h(post({ task: 'interpret-event', input: events, live: true, run: 'phase-b-1' }))).json();
    expect(r).toMatchObject({ source: 'live', valid: false, reason: 'kind' });
    expect([...db.cache.values()][0]).toMatchObject({ output: { valid: false, reason: 'kind' } });
  });
  it('retries are counted: a 503 then success reserves twice, settles the failed attempt at its full estimate', async () => {
    const db = fakeDb();
    const provider = fakeProvider((_, n) => (n === 1 ? { ok: false, error: 'http-503', sent: true, retry: true, latencyMs: 3 } : ok(good)));
    const h = createIntelInferHandler({ db, provider, evalSecret: 's3cret', sleep: async () => {} });
    const r = await (await h(post({ task: 'interpret-event', input: events, live: true, run: 'phase-b-1' }))).json();
    const est = estimateMicroUsd('gpt-6-luna', TASKS['interpret-event'], events)!;
    expect(r).toMatchObject({ source: 'live', valid: true, attempts: 2, cost_micro_usd: est + costMicroUsd('gpt-6-luna', usage()) });
    expect(db.usage.map((u) => [u.attempt, u.status, u.actual])).toEqual([[1, 'settled', est], [2, 'settled', costMicroUsd('gpt-6-luna', usage())]]);
  });
  it('a refused request (4xx) is released, never retried; at most three attempts otherwise', async () => {
    let db = fakeDb();
    let h = createIntelInferHandler({ db, provider: fakeProvider(() => ({ ok: false, error: 'http-400', sent: false, retry: false, latencyMs: 1 })), evalSecret: 's3cret', sleep: async () => {} });
    expect((await h(post({ task: 'validate', input: { word: 'hi' }, live: true, run: 'phase-a-1' }))).status).toBe(502);
    expect(db.usage).toMatchObject([{ status: 'released' }]);
    db = fakeDb();
    const p = fakeProvider(() => ({ ok: false, error: 'timeout', sent: true, retry: true, latencyMs: 1 }));
    h = createIntelInferHandler({ db, provider: p, evalSecret: 's3cret', sleep: async () => {} });
    const r = await (await h(post({ task: 'validate', input: { word: 'hi' }, live: true, run: 'phase-a-1' }))).json();
    expect(p.calls).toHaveLength(3);
    expect(r).toMatchObject({ error: 'provider', attempts: 3 });
    expect(db.usage.every((u) => u.status === 'settled' && u.actual === u.reserved)).toBe(true); // timeouts count in full
  });
  it('stops at the budget: 402 with where the budget stands, and the provider is not called', async () => {
    const db = fakeDb(10); const provider = fakeProvider(() => ok(good));
    const h = createIntelInferHandler({ db, provider, evalSecret: 's3cret' });
    const res = await h(post({ task: 'interpret-event', input: events, live: true, run: 'phase-b-1' }));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: 'budget', reason: 'lifetime_budget', budget: { lifetime_cap_micro_usd: 10 } });
    expect(provider.calls).toHaveLength(0);
  });
  it('a live call without a provider key is refused (replay still works)', async () => {
    const h = createIntelInferHandler({ db: fakeDb(), provider: null, evalSecret: 's3cret' });
    expect((await h(post({ task: 'validate', input: { word: 'hi' }, live: true, run: 'phase-a-1' }))).status).toBe(503);
  });
  it('the strong tier is a deliberate choice and maps to the strong model', async () => {
    const db = fakeDb(); const provider = fakeProvider(() => ok(good));
    const h = createIntelInferHandler({ db, provider, evalSecret: 's3cret' });
    await h(post({ task: 'interpret-event', tier: 'strong', input: events, live: true, run: 'escalate-1' }));
    expect(provider.calls[0].model).toBe('gpt-6.1-terra');
  });
});

/**
 * The interpreter's provider layer (docs/intelligence/EVALUATION_PLAN.md): one small interface, OpenAI first.
 *
 * Callers never name a model. They ask for a TIER ('cheap' by default, 'strong' only where the cheap one has shown a
 * meaningful shortcoming); the deployment maps tiers to model ids and our own price table. A model without a price is
 * never called (we couldn't reserve its cost).
 *
 * OpenAI: the Responses API with store: false (nothing kept for later retrieval), strict JSON-schema output, a hard
 * max_output_tokens. The Batch API is not used (it isn't eligible for Zero Data Retention).
 */
import type { TaskSpec } from './tasks.ts';

export type Tier = 'cheap' | 'strong';

/** USD per million tokens. From OpenAI's pricing page, read 2026-11-28 (STAGE_A_AUDIT.md §8). Update with the page. */
export interface Price { input: number; cachedInput: number; output: number }
export const PRICES: Record<string, Price> = {
  'gpt-6-luna': { input: 0.10, cachedInput: 0.01, output: 0.50 },
  'gpt-6.1-terra': { input: 1.00, cachedInput: 0.05, output: 5.00 },
};
export const DEFAULT_TIERS: Record<Tier, string> = { cheap: 'gpt-6-luna', strong: 'gpt-6.1-terra' };

export interface Usage { input_tokens: number; cached_tokens: number; output_tokens: number; reasoning_tokens: number }

/**
 * The most a call can cost, for the reservation: input estimated generously (one token per 3 characters, plus the
 * schema and system prompt), output at its hard ceiling. Micro-USD, rounded up, at least 1.
 */
export function estimateMicroUsd(model: string, task: TaskSpec, input: unknown): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const chars = task.system.length + JSON.stringify(task.schema).length + JSON.stringify(input).length + 200;
  const inTokens = Math.ceil(chars / 3);
  return Math.max(1, Math.ceil(inTokens * p.input + task.maxOutputTokens(input) * p.output));
}

/** What a finished call actually cost (micro-USD), from the provider's usage report. */
export function costMicroUsd(model: string, u: Usage): number {
  const p = PRICES[model];
  if (!p) throw new Error('unpriced_model');
  const fresh = Math.max(0, u.input_tokens - u.cached_tokens);
  return Math.ceil(fresh * p.input + u.cached_tokens * p.cachedInput + u.output_tokens * p.output);
}

export interface ProviderCall { model: string; task: TaskSpec; input: unknown; timeoutMs?: number }
export type ProviderResult =
  | { ok: true; output: unknown; usage: Usage; latencyMs: number; status: string }
  /** sent: the request may have reached the provider (it may bill); retry: worth another attempt. */
  | { ok: false; error: string; sent: boolean; retry: boolean; usage?: Usage; latencyMs: number };

export interface Provider { name: string; call(c: ProviderCall): Promise<ProviderResult> }

export function openAiProvider(apiKey: string, fetchFn: typeof fetch = fetch, base = 'https://api.openai.com/v1'): Provider {
  return {
    name: 'openai',
    async call({ model, task, input, timeoutMs = 45_000 }) {
      const t0 = Date.now();
      const body = {
        model,
        store: false,
        instructions: task.system,
        input: JSON.stringify(input),
        max_output_tokens: task.maxOutputTokens(input),
        text: { format: { type: 'json_schema', name: task.name.replace(/-/g, '_'), schema: task.schema, strict: true } },
      };
      let res: Response;
      try {
        res = await fetchFn(`${base}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      } catch (e) {
        // A timeout or a dropped connection: it may have been processed. Count it as spent; worth one more try.
        return { ok: false, error: (e as Error).name === 'TimeoutError' ? 'timeout' : 'network', sent: true, retry: true, latencyMs: Date.now() - t0 };
      }
      const latencyMs = Date.now() - t0;
      const j = await res.json().catch(() => null) as Record<string, unknown> | null;
      const usage = readUsage(j?.usage);
      if (!res.ok) {
        // 4xx (bad request, auth, unknown model): refused before any inference, not billed. 429/5xx: retry.
        const retry = res.status === 429 || res.status >= 500;
        return { ok: false, error: `http-${res.status}`, sent: res.status >= 500, retry, usage: usage ?? undefined, latencyMs };
      }
      const text = outputText(j);
      if (!usage) return { ok: false, error: 'no-usage', sent: true, retry: false, latencyMs };
      if (j?.status && j.status !== 'completed') return { ok: false, error: `status-${String(j.status)}`, sent: true, retry: false, usage, latencyMs };
      try { return { ok: true, output: JSON.parse(text ?? ''), usage, latencyMs, status: 'completed' }; }
      catch { return { ok: false, error: 'not-json', sent: true, retry: false, usage, latencyMs }; }
    },
  };
}

function readUsage(u: unknown): Usage | null {
  if (!u || typeof u !== 'object') return null;
  const x = u as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : 0);
  if (typeof x.input_tokens !== 'number' || typeof x.output_tokens !== 'number') return null;
  return { input_tokens: n(x.input_tokens), cached_tokens: n((x.input_tokens_details as Record<string, unknown> | undefined)?.cached_tokens),
    output_tokens: n(x.output_tokens), reasoning_tokens: n((x.output_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens) };
}

/** The model's text: the convenience field when present, otherwise the first output_text part of a message. */
function outputText(j: Record<string, unknown> | null): string | null {
  if (!j) return null;
  if (typeof j.output_text === 'string') return j.output_text;
  for (const item of (Array.isArray(j.output) ? j.output : []) as Record<string, unknown>[]) {
    if (item?.type !== 'message') continue;
    for (const c of (Array.isArray(item.content) ? item.content : []) as Record<string, unknown>[]) if (c?.type === 'output_text' && typeof c.text === 'string') return c.text;
  }
  return null;
}

/** A scripted provider for tests and dry runs: never touches the network. */
export function fakeProvider(answer: (c: ProviderCall, attempt: number) => ProviderResult): Provider & { calls: ProviderCall[] } {
  const calls: ProviderCall[] = [];
  return { name: 'fake', calls, async call(c) { calls.push(c); return answer(c, calls.length); } };
}

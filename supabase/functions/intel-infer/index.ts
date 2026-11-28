// Supabase Edge Function entry point. Logic: ../_shared/handlers/intel-infer.ts. Plan and setup:
// docs/intelligence/EVALUATION_PLAN.md. Secrets: OPENAI_API_KEY (provider), INTEL_EVAL_SECRET (who may call),
// optional INTEL_MODEL_CHEAP / INTEL_MODEL_STRONG (model ids; each must have a price in ../_shared/intel/provider.ts).
// Deploy with --no-verify-jwt: it is called by the evaluation runner with x-intel-eval, never by the app.
import { createDb } from '../_shared/db.ts';
import { createIntelInferHandler } from '../_shared/handlers/intel-infer.ts';
import { DEFAULT_TIERS, openAiProvider } from '../_shared/intel/provider.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const key = env('OPENAI_API_KEY');

Deno.serve(createIntelInferHandler({
  db: createDb(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')),
  provider: key ? openAiProvider(key) : null,
  evalSecret: env('INTEL_EVAL_SECRET') || null,
  tiers: { cheap: env('INTEL_MODEL_CHEAP') || DEFAULT_TIERS.cheap, strong: env('INTEL_MODEL_STRONG') || DEFAULT_TIERS.strong },
}));

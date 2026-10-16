// Supabase Edge Function entry point. Logic: ../_shared/handlers/support.ts. Setup: supabase/SUPPORT.md.
import { depsFromEnv } from '../_shared/deps.ts';
import { createSupportHandler } from '../_shared/handlers/support.ts';

Deno.serve(createSupportHandler(depsFromEnv((key) => Deno.env.get(key))));

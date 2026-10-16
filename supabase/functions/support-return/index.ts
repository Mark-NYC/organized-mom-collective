// Supabase Edge Function entry point. Logic: ../_shared/handlers/support-return.ts. Setup: supabase/SUPPORT.md.
import { depsFromEnv } from '../_shared/deps.ts';
import { createSupportReturnHandler } from '../_shared/handlers/support-return.ts';

Deno.serve(createSupportReturnHandler(depsFromEnv((key) => Deno.env.get(key))));

// Supabase Edge Function entry point. Logic: ../_shared/handlers/download.ts. Setup: supabase/SHOP.md.
import { depsFromEnv } from '../_shared/deps.ts';
import { createDownloadHandler } from '../_shared/handlers/download.ts';

Deno.serve(createDownloadHandler(depsFromEnv((key) => Deno.env.get(key))));

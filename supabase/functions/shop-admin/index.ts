// Supabase Edge Function entry point. Logic: ../_shared/handlers/admin.ts. Setup: supabase/SHOP.md.
import { depsFromEnv } from '../_shared/deps.ts';
import { createAdminHandler } from '../_shared/handlers/admin.ts';

Deno.serve(createAdminHandler(depsFromEnv((key) => Deno.env.get(key))));

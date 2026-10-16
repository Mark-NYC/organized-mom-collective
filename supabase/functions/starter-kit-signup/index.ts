// Supabase Edge Function entry point. Logic: ../_shared/handlers/starter-kit.ts. Setup: supabase/TOOL-EMAIL.md.
import { depsFromEnv } from '../_shared/deps.ts';
import { createStarterKitHandler } from '../_shared/handlers/starter-kit.ts';

Deno.serve(createStarterKitHandler(depsFromEnv((key) => Deno.env.get(key))));

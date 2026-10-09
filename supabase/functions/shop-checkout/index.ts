// Supabase Edge Function entry point. Logic: ../_shared/handlers/checkout.ts. Setup: supabase/SHOP.md.
import { depsFromEnv } from '../_shared/deps.ts';
import { createCheckoutHandler } from '../_shared/handlers/checkout.ts';

Deno.serve(createCheckoutHandler(depsFromEnv((key) => Deno.env.get(key))));

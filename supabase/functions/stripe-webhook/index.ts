// Supabase Edge Function entry point. Logic: ../_shared/handlers/webhook.ts. Setup: supabase/SHOP.md.
import { depsFromEnv } from '../_shared/deps.ts';
import { createWebhookHandler } from '../_shared/handlers/webhook.ts';

Deno.serve(createWebhookHandler(depsFromEnv((key) => Deno.env.get(key))));

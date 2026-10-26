// Supabase Edge Function entry point. Logic: ../_shared/handlers/club-webhook.ts. Setup: docs/club/MEMBERSHIP.md.
import { clubDepsFromEnv } from '../_shared/club/deps.ts';
import { createClubWebhookHandler } from '../_shared/handlers/club-webhook.ts';

Deno.serve(createClubWebhookHandler(clubDepsFromEnv((key) => Deno.env.get(key))));

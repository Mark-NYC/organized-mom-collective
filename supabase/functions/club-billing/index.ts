// Supabase Edge Function entry point. Logic: ../_shared/handlers/club-billing.ts. Setup: docs/club/MEMBERSHIP.md.
import { clubDepsFromEnv } from '../_shared/club/deps.ts';
import { createClubBillingHandler } from '../_shared/handlers/club-billing.ts';

Deno.serve(createClubBillingHandler(clubDepsFromEnv((key) => Deno.env.get(key))));

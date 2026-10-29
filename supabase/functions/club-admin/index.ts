// Supabase Edge Function entry point. Logic: ../_shared/handlers/club-admin.ts. Setup: docs/club/MEMBERSHIP.md.
import { clubDepsFromEnv } from '../_shared/club/deps.ts';
import { createClubAdminHandler } from '../_shared/handlers/club-admin.ts';

Deno.serve(createClubAdminHandler(clubDepsFromEnv((key) => Deno.env.get(key))));

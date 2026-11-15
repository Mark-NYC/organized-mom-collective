# Family end-to-end test (isolated test backend)

The whole family experience, run against a **throwaway database**: never the production project.

| Piece | What it is |
| --- | --- |
| `scripts/e2e/family-db.sh` | Creates `omc_family_e2e` on a local Postgres: the Supabase stub plus every migration, including the three pending ones (20261124, 20261125, 20261127) |
| `scripts/e2e/seed.sql` | The Parks (Jen holds the account, Sam the second adult, Maya 11, Leo 7), created through the same database functions the family pages use; this month's kit scheduled and a beta Club grant for Jen, on this database only; plus the Ruizes, a separate household, for isolation |
| `scripts/e2e/test-backend.mjs` | A local stand-in for Supabase on 127.0.0.1:54321: email-code sign-in (code `123456`, no email sent) and PostgREST-style database calls run **as the signed-in user** (`authenticated` role + `request.jwt.claims`), so grants, RLS and every function's checks are the database's own. Never point it at a real project |
| `scripts/e2e/family-e2e.mjs` | The app bundle (built with `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`) in Chromium at iPhone size, two browser contexts as Jen's and Sam's phones |
| `AppLaunchTests.testFamilyFlowWithTestBackend` | The same flow in the real app on the iPhone Simulator (CI job `ios-family-e2e`; skipped elsewhere) |

What it covers: sign-in; four people with four distinct colors; an event with a person and who handles it; the
partner invitation and join (same member ids); "We agreed" in the existing meeting; the agreement on Today, the
calendar and cleaning; edit + reassign from the other adult's phone; close and reopen; offline (app files load, the
backend doesn't answer), changes on two phones, reconnection and the conflict notice; and that neither adult can read
or change another household's calendar or agreements (and the other household can't read theirs).

Run locally (Postgres running; Chromium from Playwright):

```bash
export PGHOST=localhost PGUSER=postgres PGPASSWORD=…
bash scripts/e2e/family-db.sh && psql -X -q -d omc_family_e2e -f scripts/e2e/seed.sql
node scripts/e2e/test-backend.mjs &
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 PUBLIC_SUPABASE_ANON_KEY=e2e-anon npm run build:app
node scripts/e2e/family-e2e.mjs app-www e2e-family
```

Rebuild the app bundle with `npm run build:app` (no overrides) afterwards: the e2e bundle talks only to the local
backend.

Not covered here: real Supabase Auth email delivery and token refresh (the stand-in issues opaque tokens), PostgREST
itself (the stand-in calls the same functions the same way), push notifications, and a physical iPhone.

# Supabase: customer survey

The site is static, so the survey talks to Supabase directly from the browser with the
**anon / publishable key** only. The migration locks everything down:

| Who | Can do |
| --- | --- |
| Anyone (anon key) | Call `survey_track(session, step)` and `survey_submit(session, answers, website)`. No table reads or writes. |
| Signed-in user **not** in `survey_admins` | Nothing. |
| Signed-in user in `survey_admins` | Read `survey_sessions` and `survey_responses` (for `/survey/admin`). No writes. |

Spam and duplicates, all enforced in the database: a hidden honeypot field, submissions under 6 seconds after the start are dropped, a repeat submit of the same session is a no-op, and a salted, daily-rotating IP hash caps 60 new sessions/hour and 5 submissions/day per connection. Out-of-list answers are rejected. The browser also remembers a finished survey and shows the thank-you instead.

## Set up (once)

1. **Run the migration.** Supabase dashboard → SQL Editor → paste and run
   `migrations/20261009000000_customer_survey.sql` (or `supabase db push` with the CLI).
2. **Create your admin login.** Authentication → Users → Add user (email + password, auto-confirm). Then in the SQL editor:
   ```sql
   insert into public.survey_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
3. **Turn off public sign-ups** (Authentication → Sign In / Providers → disable "Allow new users to sign up"). Not required for safety — non-admins see nothing — but there's no reason to allow it.
4. **Set the build variables** on your host (and in `.env` locally; see `.env.example`):
   `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`. Rebuild and deploy.
   Never use the `service_role` / secret key on the site.

Then open `/survey` on your phone, finish it, and check `/survey/admin`.

## Sharing links (`?source=`)

Use a different link per channel so the admin view can compare them:

| Where | Link |
| --- | --- |
| Website | `https://organizedmomcollective.com/survey?source=website` |
| Instagram | `https://organizedmomcollective.com/survey?source=instagram` |
| Card in the calendar box | `https://organizedmomcollective.com/survey?source=customer-insert` |
| No source | `https://organizedmomcollective.com/survey` → recorded as `direct` |

Case and spaces are ignored. Anything else (a typo, a made-up value) is stored as `other`, so a broken link shows up in the admin view instead of vanishing. The source is fixed at the first visit and saved on both the session and the response.

## Data

- `survey_sessions`: one row per visit to `/survey`. `furthest_step`: 0 = saw the intro, 1–7 = reached question n, 8 = sent. Drop-off = sessions that stopped at a step.
- `survey_responses`: one row per finished survey, answers stored as option ids from `src/data/survey.ts` (labels are applied in the admin view and CSV), plus `source`. No names, emails or IPs.
- `q1_other`, `q2_other`, `q3_other`, `q5_other`, `q6_other`: the optional text typed after "Something else" (200 characters max). The database keeps it only when "Something else" was actually picked for that question.
- Adding or renaming an option: keep the id, or add the new id to both `src/data/survey.ts` and `survey_allowed()` in a new migration. Same for sources (`SURVEY_SOURCES` / `survey_source()` and the two `check` constraints). `tests/survey.test.ts` fails if they drift.
- Once the migration has been run against the live project, change it only through new migration files.

# Production database backups

Supabase's Free plan keeps **no backups** of the production database. This system makes one every day, encrypts it,
keeps it in private storage outside GitHub, and proves each one restores before counting it as a backup.

Workflow: `.github/workflows/db-backup.yml`. Scripts: `scripts/db-backup/`. Status 2026-11-17: built and self-tested;
waiting for the one-time setup below before the first production run.

## What happens every day (07:17 UTC)

1. **Dump** with Supabase's own tool, `supabase db dump`, the way Supabase documents a backup: roles, schema, data
   (including every sign-in in `auth.users`), and the migration history (`supabase_migrations`). Plus our own
   triggers and policies on Supabase's `auth` and `storage` schemas, which the dump leaves out. Production is only
   read.
2. **Check completeness:** every table in `public`, `auth`, `storage` and `supabase_migrations` is in the dump.
3. **Encrypt** the files into one archive with [age](https://age-encryption.org) and **upload** it to the private
   bucket as `backups/<UTC time>/backup.tar.age`, with a `manifest.json` (time, size, checksum; no data).
4. **Download it back**, compare its checksum, **decrypt** it, and **restore** it into a throwaway local Supabase
   (Postgres 17 with Supabase's auth and storage) started on the runner, in Supabase's documented order.
5. **Verify** the restored copy: every table's row count equals the backup's, and the structure (functions,
   tables, views, policies, triggers, sign-ins, migration history) equals production's.
6. Only then write `backups/<UTC time>/VERIFIED`. **Retention:** the newest 30 verified backups are kept (never fewer
   than 7); only folders older than the oldest one kept are deleted, so a run of failures never deletes a good backup.

A failure at any step opens a GitHub issue labelled `db-backup-failure` that mentions you, so you get an email. The
issue gets a comment on each further failure and closes itself after the next verified backup.

**Before a migration session:** run it by hand (Actions → **Database backup** → Run workflow, reason "before
Session B") and wait for the green tick. From a `claude/**` branch, a push that changes `.github/db-backup-request`
with `[db-backup]` in the commit message does the same.

## What a backup holds, and what it doesn't

| Included | Not included: where it lives instead |
| --- | --- |
| Every table and row in `public` (families, Club, shop, email, support, admin) | **Storage files** (uploaded images, PDFs): only their records (`storage.objects`) are in the backup. The files themselves stay in Supabase Storage |
| Sign-ins: `auth.users`, identities, sessions and the rest of `auth`'s data | **Auth settings**: email templates, SMTP, redirect URLs, providers (Dashboard → Authentication) |
| Roles, schema, functions, policies, triggers, views | **API keys and JWT secret** (a restore into a new project gets new ones) |
| Our triggers on `auth.users` and policies on `storage.objects` | **Edge Functions**: their code is in this repository; their **secrets** (Stripe, Resend, ...) are in Dashboard → Edge Functions → Secrets |
| Migration history (`supabase_migrations`) | **Scheduled jobs** (`cron` schema) and **Vault** secrets: re-created by the migrations that make them; Vault values must be set again |
| Bucket definitions (`storage.buckets`) | Realtime publications, database webhooks (none in use today) |

Not covered at all: Cloudflare Pages settings, Stripe, Resend, GitHub. Each keeps its own data.

## Security

- **Encrypted before it leaves the runner**, with age. The private key is the GitHub secret `BACKUP_AGE_SECRET_KEY`.
  **Keep a second copy offline** (your password manager): without it the backups can't be read if GitHub is lost.
- **Private storage outside GitHub:** a Cloudflare R2 bucket, reachable only with the backup token. Nothing is ever
  uploaded as a GitHub artifact.
- **Logs hold names and counts only.** The connection string's user, password and host are masked. Tool output
  goes to files on the runner; on failure only error lines are printed, with every quoted value, key=value detail,
  address and URL removed. Postgres' DETAIL and CONTEXT lines, which can quote a row, are never printed. The
  runner's files are deleted at the end of every run.
- The restore test runs only against a local throwaway database (the script refuses anything else).
- Who can read the backups: whoever holds both the R2 token and the age key. Both are GitHub secrets, readable only
  by workflows in this repository. Anyone who can change those workflows can already reach production through
  `SUPABASE_DB_URL`, so the backup adds no new way in.

## Setup (once, the owner)

1. **Cloudflare R2:** Cloudflare dashboard → R2 Object Storage → enable it (the free allowance is 10 GB; a backup is
   well under 1 MB today). Create a bucket named `omc-db-backups` (location: automatic; no public access). Then
   R2 → **Manage API tokens** → Create token: permission **Object Read & Write**, applied to **that bucket only**.
   Note the Access Key ID, the Secret Access Key and the S3 endpoint (`https://<account id>.r2.cloudflarestorage.com`).
2. **Encryption key**, on your computer: `brew install age`, then `age-keygen -o omc-db-backup.key`. Save the whole
   file in your password manager. Delete the file from the computer afterwards.
3. **Database connection string:** Supabase → your project → **Connect** → **Session pooler**, with the database
   password filled in (Database → Settings can reset a forgotten one).
4. **GitHub** → this repository → Settings → Secrets and variables → Actions → New repository secret, six times:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_DB_URL` | the Session pooler connection string |
   | `BACKUP_AGE_SECRET_KEY` | the line starting `AGE-SECRET-KEY-1` from the key file |
   | `BACKUP_S3_ENDPOINT` | `https://<account id>.r2.cloudflarestorage.com` |
   | `BACKUP_S3_BUCKET` | `omc-db-backups` |
   | `BACKUP_S3_ACCESS_KEY_ID` | the R2 token's Access Key ID |
   | `BACKUP_S3_SECRET_ACCESS_KEY` | the R2 token's Secret Access Key |

Never paste any of these into a chat, an issue or a commit.

## Recovery procedure

Use the newest backup with a `VERIFIED` file, from before the problem.

1. **Get it:** Cloudflare → R2 → `omc-db-backups` → `backups/<time>/backup.tar.age` → Download.
2. **Decrypt** (needs the offline key): `age -d -i omc-db-backup.key backup.tar.age | tar -x -C restore/`.
   You get `roles.sql`, `schema.sql`, `auth_storage.sql`, `data.sql`, `history_schema.sql`, `history_data.sql`.
3. **Choose the target.** Prefer a **new** Supabase project (Supabase's documented path): nothing is overwritten,
   you can compare, then point the site at it. Restoring over the current project means emptying it first; only
   do that with a second person checking.
4. **Restore** (Supabase's order; `CONNECTION_STRING` is the target's Session pooler string):

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 --file restore/roles.sql --file restore/schema.sql --file restore/auth_storage.sql --command 'SET session_replication_role = replica' --file restore/data.sql --dbname "$CONNECTION_STRING"
   ```

   If `restore/history.mode` says `separate=yes`, then also:

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 --file restore/history_schema.sql --file restore/history_data.sql --dbname "$CONNECTION_STRING"
   ```

   Known Supabase issues and their fixes (comment out the line): `GRANT "postgres" TO "cli_login_postgres"` in
   `roles.sql`; `ALTER ... OWNER TO "supabase_admin"` lines in `schema.sql` if the restore reports a permission error.
5. **Check:** `restore/backup-counts.tsv` lists every table and its row count; the restored database must match.
6. **Put back what the backup doesn't hold** (table above): Edge Function secrets, Auth settings, Storage files,
   scheduled jobs (re-run the migrations that schedule them), Vault values. A new project has new API keys: update
   `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` in Cloudflare Pages and the Edge Function settings.

## When a backup fails

Open the run linked in the issue. The failing step says where it stopped:

| Step | Usual cause |
| --- | --- |
| The six backup secrets are set | A secret is missing or misnamed |
| Dump production | Wrong or rotated database password; Supabase down. The log shows which dump failed |
| Upload / Download it back | R2 token expired or lacks write access to the bucket |
| Restore ... and verify | A Supabase update changed `auth` or `storage` tables faster than the newest Supabase CLI: run it again the next day. Anything else: the backup may be unusable; don't migrate until one passes |

No migration session starts without a verified backup from the same day.

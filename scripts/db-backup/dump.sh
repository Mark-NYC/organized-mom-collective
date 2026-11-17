#!/usr/bin/env bash
# Back up a Supabase database with Supabase's own tool (`supabase db dump`, docs/operations/DATABASE_BACKUPS.md):
# roles, schema, data (auth users included), migration history, and our triggers/policies on auth and storage.
# Only reads the source. Writes the files to OUT; logs (which stay out of the backup) to LOGS.
#
#   SRC_URL=postgresql://… OUT=/path LOGS=/path bash scripts/db-backup/dump.sh
source "$(dirname "$0")/common.sh"
: "${SRC_URL:?}" "${OUT:?}" "${LOGS:?}"
mkdir -p "$OUT" "$LOGS"
mask_url "$SRC_URL"
export PGCONNECT_TIMEOUT=20
psql_src() { psql "$SRC_URL" -X -q -v ON_ERROR_STOP=1 -At "$@"; }

quiet dump-roles   supabase db dump --db-url "$SRC_URL" -f "$OUT/roles.sql" --role-only
quiet dump-schema  supabase db dump --db-url "$SRC_URL" -f "$OUT/schema.sql"
quiet dump-data    supabase db dump --db-url "$SRC_URL" -f "$OUT/data.sql" --use-copy --data-only \
                     -x storage.buckets_vectors -x storage.vector_indexes
quiet dump-history-schema supabase db dump --db-url "$SRC_URL" -f "$OUT/history_schema.sql" --schema supabase_migrations
quiet dump-history-data   supabase db dump --db-url "$SRC_URL" -f "$OUT/history_data.sql" --use-copy --data-only --schema supabase_migrations
quiet capture-customizations psql_src -f "$HERE/customizations.sql" -o "$OUT/auth_storage.sql"

# What the backup holds, table by table (names and numbers only).
python3 "$HERE/counts.py" dump "$OUT/data.sql" > "$OUT/backup-counts.tsv"
if grep -q $'^supabase_migrations\t' "$OUT/backup-counts.tsv"; then
  echo "separate=no" > "$OUT/history.mode"     # the data dump already holds the history
else
  echo "separate=yes" > "$OUT/history.mode"
  python3 "$HERE/counts.py" dump "$OUT/history_data.sql" >> "$OUT/backup-counts.tsv"
fi
for f in roles schema data history_schema history_data; do
  [[ -s "$OUT/$f.sql" ]] || { echo "FAILED: $f.sql is empty"; exit 1; }
done

# The source right after the dump: the same tables' live counts, and its structure.
python3 "$HERE/counts.py" sql "$OUT/backup-counts.tsv" > "$LOGS/count.sql"
quiet source-counts psql_src -F $'\t' -f "$LOGS/count.sql" -o "$OUT/source-counts.tsv"
quiet source-objects psql_src -F $'\t' -f "$HERE/objects.sql" -o "$OUT/source-objects.tsv"
psql_src -c 'show server_version' > "$OUT/source-version.txt" 2>"$LOGS/version.log" || true

# Completeness: every table of the backed-up schemas has a COPY block (a table missing from the dump fails here).
quiet source-tables psql_src -F $'\t' -o "$LOGS/source-tables.tsv" -c "
  select table_schema, table_name from information_schema.tables
   where table_type = 'BASE TABLE' and table_schema in ('public', 'auth', 'storage', 'supabase_migrations')
     and (table_schema, table_name) not in (('storage', 'buckets_vectors'), ('storage', 'vector_indexes'),
                                            ('auth', 'schema_migrations'), ('storage', 'migrations'))"
missing=$(cut -f1,2 "$OUT/backup-counts.tsv" | sort | comm -13 - <(sort "$LOGS/source-tables.tsv") || true)
tables=$(wc -l < "$OUT/backup-counts.tsv"); rows=$(awk -F'\t' '{ s += $3 } END { print s + 0 }' "$OUT/backup-counts.tsv")
echo "dumped: $tables tables, $rows rows; history in a separate file: $(cut -d= -f2 "$OUT/history.mode")"
if [[ -n "$missing" ]]; then
  echo "Tables in the source but not in the backup (names only):"; echo "$missing" | sed 's/^/  /'
  echo "FAILED: the backup is incomplete"; exit 1
fi
if ! python3 "$HERE/counts.py" diff "$OUT/backup-counts.tsv" "$OUT/source-counts.tsv" "live-now" > "$LOGS/live-diff.txt"; then
  echo "note: rows changed in the source while it was being backed up (expected on a live site):"; cat "$LOGS/live-diff.txt"
fi

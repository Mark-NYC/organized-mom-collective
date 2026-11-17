#!/usr/bin/env bash
# Restore a backup into an EMPTY, isolated Supabase database and prove it's complete: every table's row count equals
# the backup's, and the structure (functions, tables, views, policies, triggers, sign-ins, migration history) equals
# the source's. Supabase's documented restore order (docs/operations/DATABASE_BACKUPS.md → Recovery).
#
#   DIR=/path/with/backup/files TARGET_URL=postgresql://…(throwaway) LOGS=/path bash scripts/db-backup/verify-restore.sh
source "$(dirname "$0")/common.sh"
: "${DIR:?}" "${TARGET_URL:?}" "${LOGS:?}"
mkdir -p "$LOGS"
case "$TARGET_URL" in *127.0.0.1*|*localhost*) ;; *) echo "Refusing: verify-restore only restores into a local throwaway database."; exit 1 ;; esac
psql_t() { psql "$TARGET_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

# Supabase's documented workaround: this grant can't be made by the restoring role.
sed -i.orig -E 's/^(GRANT "postgres" TO "cli_login_postgres".*)$/-- \1/' "$DIR/roles.sql"

quiet restore psql_t --single-transaction \
  -f "$DIR/roles.sql" -f "$DIR/schema.sql" -f "$DIR/auth_storage.sql" \
  -c 'SET session_replication_role = replica' -f "$DIR/data.sql"
if grep -q '^separate=yes' "$DIR/history.mode"; then
  quiet restore-history psql_t --single-transaction -f "$DIR/history_schema.sql" -f "$DIR/history_data.sql"
fi

python3 "$HERE/counts.py" sql "$DIR/backup-counts.tsv" > "$LOGS/count.sql"
quiet restored-counts psql_t -At -F $'\t' -f "$LOGS/count.sql" -o "$LOGS/restored-counts.tsv"
quiet restored-objects psql_t -At -F $'\t' -f "$HERE/objects.sql" -o "$LOGS/restored-objects.tsv"

ok=1
python3 "$HERE/counts.py" diff "$DIR/backup-counts.tsv" "$LOGS/restored-counts.tsv" restored || ok=0
if ! diff -q "$DIR/source-objects.tsv" "$LOGS/restored-objects.tsv" >/dev/null; then
  echo "  structure differs (source | restored):"; paste "$DIR/source-objects.tsv" "$LOGS/restored-objects.tsv" | awk -F'\t' '$2 != $4 { print "    " $1 ": " $2 " | " $4 }'
  ok=0
fi
tables=$(wc -l < "$DIR/backup-counts.tsv"); rows=$(awk -F'\t' '{ s += $3 } END { print s + 0 }' "$DIR/backup-counts.tsv")
if [[ $ok == 1 ]]; then
  echo "restore verified: $tables tables and $rows rows restored exactly; structure identical to the source"
  sed 's/^/  /; s/\t/: /' "$LOGS/restored-objects.tsv"
else
  echo "FAILED: the restored copy differs from the backup"; exit 1
fi

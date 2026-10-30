#!/usr/bin/env bash
# A verified backup of the production database, made from the owner's own computer (Free plan: Supabase keeps no
# backups). One pg_dump file of the schemas that hold the site's data (public, auth, storage, supabase_migrations),
# then a check that the file is complete: every table's row count inside the dump equals its live count, and the
# dump's functions, tables and policies match the live ones. docs/club/PRODUCTION_ROLLOUT.md → Stage 2.
#
#   bash scripts/backup-production-db.sh [output-dir]      (default: ~/omc-backups)
#
# Needs pg_dump, pg_restore and psql at least as new as the server (Postgres 17): on a Mac `brew install libpq`, then
# `export PATH="$(brew --prefix libpq)/bin:$PATH"`. Asks for the connection string without showing it: Supabase →
# Connect → Session pooler, with the database password filled in. Only reads; nothing on the server changes.
#
# The dump holds customer data: keep it on your computer or encrypted storage, never in the repo or a chat. The
# summary it prints (table names, counts, checksum) holds none and is safe to share.
set -euo pipefail

OUT_ROOT=${1:-"$HOME/omc-backups"}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DIR="$OUT_ROOT/$STAMP"
SCHEMAS=(public auth storage supabase_migrations)

for tool in pg_dump pg_restore psql; do
  command -v "$tool" >/dev/null || { echo "Missing $tool. On a Mac: brew install libpq, then add it to PATH (see the top of this script)."; exit 1; }
done

if [[ -z "${DB_URL:-}" ]]; then
  printf 'Paste the Session pooler connection string (postgresql://postgres.<ref>:<password>@…:5432/postgres), then Enter.\nIt will not be shown: '
  IFS= read -rs DB_URL
  echo
fi
[[ "$DB_URL" == postgres*://* ]] || { echo "That doesn't look like a connection string (postgresql://…)."; exit 1; }
export PGCONNECT_TIMEOUT=15

# pg_dump must be at least the server's major version.
server=$(psql "$DB_URL" -X -At -c 'show server_version_num') || { echo "Couldn't connect. Check the password and use the Session pooler string."; exit 1; }
client=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
if (( client < server / 10000 )); then echo "pg_dump $client is older than the server ($((server / 10000))). Install a newer client."; exit 1; fi

mkdir -p "$DIR"; chmod 700 "$OUT_ROOT" "$DIR"
umask 077

# Only the schemas that exist on this server.
present=()
for s in "${SCHEMAS[@]}"; do
  [[ $(psql "$DB_URL" -X -At -c "select 1 from pg_namespace where nspname = '$s'") == 1 ]] && present+=("$s")
done
in_list=$(printf "'%s'," "${present[@]}"); in_list=${in_list%,}

echo "Backing up ${present[*]} to $DIR"
args=(); for s in "${present[@]}"; do args+=(-n "$s"); done
pg_dump "$DB_URL" -Fc --no-comments "${args[@]}" -f "$DIR/database.dump"

# Live counts, right after the dump (exact count(*) per table; read-only).
live_counts() {
  psql "$DB_URL" -X -At -F' ' -c "
    select format('%I.%I', table_schema, table_name),
           (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
      from information_schema.tables
     where table_type = 'BASE TABLE' and table_schema in ($in_list)
     order by 1"
}
live_counts > "$DIR/live-counts.txt"

# Rows inside the dump, per table (COPY blocks of its data section).
pg_restore -f - --data-only "$DIR/database.dump" | awk '
  /^COPY / { split($2, n, "("); t = n[1]; gsub(/"/, "", t); c = 0; on = 1; next }
  on && /^\\\.$/ { print t, c; on = 0; next }
  on { c++ }' | sort > "$DIR/dump-counts.txt"

# Compare: every live table is in the dump with the same count (an empty table may have no COPY block).
fails=0
while read -r t n; do
  d=$(awk -v t="$t" '$1 == t { print $2 }' "$DIR/dump-counts.txt")
  d=${d:-0}
  if [[ "$d" != "$n" ]]; then echo "  MISMATCH $t: live $n, dump $d"; fails=$((fails + 1)); fi
done < "$DIR/live-counts.txt"

# Schema objects: the dump's table of contents against the live catalog.
pg_restore --list "$DIR/database.dump" > "$DIR/contents.txt"
obj() { grep -cE "^[0-9]+; [0-9]+ [0-9]+ $1 $2 " "$DIR/contents.txt" || true; }
live_obj=$(psql "$DB_URL" -X -At -F' ' -c "
  select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
            and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')),
         (select count(*) from pg_policies where schemaname = 'public'),
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v')")
read -r lf lt lp lv <<<"$live_obj"
df=$(obj FUNCTION public); dt=$(obj TABLE public); dp=$(obj POLICY public); dv=$(obj VIEW public)
for pair in "functions $lf $df" "tables $lt $dt" "policies $lp $dp" "views $lv $dv"; do
  read -r what l d <<<"$pair"
  [[ "$l" == "$d" ]] || { echo "  MISMATCH public $what: live $l, dump $d"; fails=$((fails + 1)); }
done

sum=$( (command -v shasum >/dev/null && shasum -a 256 "$DIR/database.dump" || sha256sum "$DIR/database.dump") | cut -d' ' -f1)
size=$(du -h "$DIR/database.dump" | cut -f1)
tables=$(wc -l < "$DIR/live-counts.txt" | tr -d ' ')
rows=$(awk '{ s += $2 } END { print s + 0 }' "$DIR/live-counts.txt")

{
  echo "Organized Mom Collective database backup"
  echo "made:      $STAMP (UTC)"
  echo "server:    Postgres $((server / 10000)), pg_dump $(pg_dump --version | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)"
  echo "schemas:   ${present[*]}"
  echo "file:      database.dump, $size, sha256 $sum"
  echo "contents:  $tables tables, $rows rows; public: $lt tables, $lf functions, $lp policies, $lv views"
  echo "verified:  $([[ $fails == 0 ]] && echo "yes, every table's rows and every public object match the live database" || echo "NO, $fails mismatch(es) above")"
  echo
  echo "Row counts (live = dump):"
  cat "$DIR/live-counts.txt"
} | tee "$DIR/SUMMARY.txt"

echo
if [[ $fails == 0 ]]; then
  echo "Backup verified: $DIR/database.dump"
  echo "Copy $DIR somewhere safe (an encrypted drive or your password manager's file vault). Share SUMMARY.txt only."
else
  echo "Not verified: $fails mismatch(es). If someone was using the site, run it again; otherwise send me SUMMARY.txt."
  exit 2
fi

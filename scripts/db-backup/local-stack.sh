#!/usr/bin/env bash
# A throwaway local Supabase (Postgres 17 with Supabase's auth and storage) on this runner, for restore tests.
# Its own folder, so none of this repository's migrations or settings apply to it.
#
#   bash scripts/db-backup/local-stack.sh up   <workdir>    -> prints the local connection string
#   bash scripts/db-backup/local-stack.sh down <workdir>    -> stops it and deletes its data
set -euo pipefail
cmd=$1 dir=$2
mkdir -p "$dir"; cd "$dir"
case "$cmd" in
  up)
    [[ -f supabase/config.toml ]] || supabase init --force >/dev/null 2>&1 </dev/null
    sed -i -E 's/^project_id = .*/project_id = "omc-restore-test"/; s/^major_version = .*/major_version = 17/' supabase/config.toml
    supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector,postgres-meta,mailpit,postgrest,kong,supavisor \
      >"$dir/start.log" 2>&1 || { echo "local Supabase didn't start:"; tail -n 20 "$dir/start.log" | grep -v -i 'key\|secret\|jwt'; exit 1; }
    echo "postgresql://postgres:postgres@127.0.0.1:54322/postgres" ;;
  down)
    supabase stop --no-backup >/dev/null 2>&1 || true ;;
esac

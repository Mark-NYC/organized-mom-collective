#!/usr/bin/env bash
# End-to-end tests for the direct shop (tests/shop-e2e.test.ts) against a throwaway database.
#
# Needs: a local PostgreSQL 15+ you can connect to as a superuser, `psql`, and the
# PostgREST binary (https://github.com/PostgREST/postgrest/releases) on PATH or in $POSTGREST.
# Optional: `deno` on PATH (or $DENO) to type-check the Edge Function entry points.
#
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres npm run test:shop
#
# Creates (and drops first) the database `shop_e2e`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=shop_e2e
PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
REST_PORT=${SHOP_E2E_REST_PORT:-54330}
JWT_SECRET=shop-e2e-jwt-secret-at-least-32-characters-long
POSTGREST=${POSTGREST:-postgrest}
export PGHOST PGPORT PGUSER

psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "→ fresh database $DB"
psql_ -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null
for f in supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  psql_ -d "$DB" -f "$f" 2>&1 | { grep -v 'already exists, skipping' || true; }
done

if command -v "${DENO:-deno}" >/dev/null 2>&1; then
  echo "→ deno check (Edge Function entry points)"
  (cd supabase/functions && "${DENO:-deno}" check shop-checkout/index.ts stripe-webhook/index.ts shop-admin/index.ts)
fi

CONF=$(mktemp)
cat >"$CONF" <<EOF
db-uri = "postgres://authenticator:authenticator@${PGHOST#/}:${PGPORT}/${DB}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-port = ${REST_PORT}
db-pool = 10
EOF
# A socket directory (PGHOST=/tmp) needs the host as a query parameter instead.
if [[ "$PGHOST" == /* ]]; then
  sed -i "s#^db-uri.*#db-uri = \"postgres://authenticator:authenticator@/${DB}?host=${PGHOST}\&port=${PGPORT}\"#" "$CONF"
fi

if curl -s "http://127.0.0.1:${REST_PORT}/" >/dev/null 2>&1; then
  echo "Port ${REST_PORT} is already in use (another PostgREST?). Stop it or set SHOP_E2E_REST_PORT." >&2
  exit 1
fi
"$POSTGREST" "$CONF" >/tmp/shop-e2e-postgrest.log 2>&1 &
PGRST=$!
trap 'kill $PGRST 2>/dev/null || true; rm -f "$CONF"' EXIT
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${REST_PORT}/" >/dev/null 2>&1 && break
  sleep 0.2
done

SHOP_E2E_REST="http://127.0.0.1:${REST_PORT}" \
SHOP_E2E_JWT_SECRET="$JWT_SECRET" \
SHOP_E2E_PSQL="postgresql:///${DB}?host=${PGHOST}&port=${PGPORT}&user=${PGUSER}" \
  npx vitest run tests/shop-e2e.test.ts "$@"

#!/usr/bin/env bash
# age (encryption) and the Postgres 17 client (dumps from Postgres 17 use psql's \restrict) on an Ubuntu runner.
set -euo pipefail
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null 2>&1
sudo apt-get install -y -qq age postgresql-client-17 >/dev/null
echo "PATH=/usr/lib/postgresql/17/bin:$PATH" >> "$GITHUB_ENV"
export PATH=/usr/lib/postgresql/17/bin:$PATH
echo "tools: $(age --version), $(psql --version), $(supabase --version)"

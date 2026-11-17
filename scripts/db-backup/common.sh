#!/usr/bin/env bash
# Shared helpers for the database backup (docs/operations/DATABASE_BACKUPS.md). Sourced, not run.
# Rule for everything here: nothing that could hold a password, a connection string or a customer's data is printed.
# Tool output goes to log files; on failure only redacted_errors() lines reach the job log.
set -euo pipefail
umask 077
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Hide every part of a connection string from the GitHub job log (user, password raw and URL-decoded, host).
mask_url() {
  [[ -n "${GITHUB_ACTIONS:-}" ]] || return 0
  python3 - "$1" <<'PY'
import sys, urllib.parse
u = urllib.parse.urlsplit(sys.argv[1])
for v in {sys.argv[1], u.username or '', u.password or '', urllib.parse.unquote(u.password or ''), u.hostname or '', u.netloc}:
    if len(v) >= 4: print('::add-mask::' + v)
PY
}

# The ERROR lines of a tool log with every quoted value, every (key)=(value) detail and every URL removed. DETAIL,
# CONTEXT, HINT and LINE lines are never printed: Postgres puts row contents in them.
redacted_errors() {
  grep -aE '(ERROR|FATAL|[Ee]rror|failed)' "$1" 2>/dev/null \
    | grep -avE 'DETAIL|CONTEXT|HINT|LINE [0-9]|^\s*[0-9]+\s*\|' \
    | sed -E "s/'[^']*'/'…'/g; s/\"[^\"]*\"/\"…\"/g; s/\([^)]*\)=\([^)]*\)/(…)=(…)/g; s#[a-z]+://[^ ]*#<url>#g; s/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/<email>/g" \
    | head -20 || true
}

# Run a command with its output in a log file. On failure, print only the redacted error lines and stop.
quiet() {
  local name=$1; shift
  local log="$LOGS/$name.log"
  if ! "$@" >"$log" 2>&1; then
    echo "FAILED: $name"; redacted_errors "$log"; return 1
  fi
}

#!/usr/bin/env python3
"""Row counts for the backup check (docs/operations/DATABASE_BACKUPS.md). Prints table names and numbers only.

  counts.py dump  data.sql            -> "schema<TAB>table<TAB>rows" for every COPY block in a data dump
  counts.py sql   counts.tsv          -> one SQL query returning "schema<TAB>table<TAB>rows" for those tables, live
  counts.py diff  expected.tsv actual.tsv [label]  -> exit 1 and list tables whose counts differ
"""
import re, sys

IDENT = r'(?:"(?:[^"]|"")*"|[^\s."(]+)'
COPY = re.compile(r'^COPY (' + IDENT + r')\.(' + IDENT + r')[ (]')

def unquote(s):
    return s[1:-1].replace('""', '"') if s.startswith('"') else s

def quote(s):
    return '"' + s.replace('"', '""') + '"'

def dump(path):
    rows, cur = {}, None
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            if cur is None:
                m = COPY.match(line)
                if m:
                    cur = (unquote(m.group(1)), unquote(m.group(2)))
                    rows[cur] = rows.get(cur, 0)
            elif line.rstrip('\n') == '\\.':
                cur = None
            else:
                rows[cur] += 1
    for (s, t), n in sorted(rows.items()):
        print(f'{s}\t{t}\t{n}')

def load(path):
    out = {}
    for line in open(path):
        if line.strip():
            s, t, n = line.rstrip('\n').split('\t')
            out[(s, t)] = int(n)
    return out

def sql(path):
    parts = [f"select {lit(s)} || chr(9) || {lit(t)} || chr(9) || (select count(*) from {quote(s)}.{quote(t)})::text"
             for (s, t) in sorted(load(path))]
    print((' union all '.join(parts) or "select ''") + ';')

def lit(s):
    return "'" + s.replace("'", "''") + "'"

def diff(a, b, label='restored'):
    exp, act = load(a), load(b)
    bad = [(k, exp[k], act.get(k)) for k in sorted(exp) if act.get(k) != exp[k]]
    for (s, t), e, g in bad:
        print(f'  MISMATCH {s}.{t}: backup {e}, {label} {g}')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    cmd = sys.argv[1]
    {'dump': lambda: dump(sys.argv[2]), 'sql': lambda: sql(sys.argv[2]),
     'diff': lambda: diff(*sys.argv[2:5])}[cmd]()

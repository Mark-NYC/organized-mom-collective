#!/usr/bin/env node
/**
 * Runs the whole unit suite and fails only on tests that fail and aren't in tests/known-failures.txt (the failures
 * already on the branch before the iPhone app work: kit tests describing earlier drafts, shop, worksheet…; see
 * docs/club/KNOWN_TEST_FAILURES.md). Compares by name, never by count. Prints tests that now pass so the list can
 * shrink. Usage: node scripts/compare-test-failures.mjs
 */
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// vitest writes straight to a file: no pipe buffer limit, and nothing it prints is lost.
const logPath = join(mkdtempSync(join(tmpdir(), 'vitest-')), 'out.txt');
const fd = openSync(logPath, 'w');
const r = spawnSync('npx', ['vitest', 'run', '--reporter=default'], { stdio: ['ignore', fd, fd], env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
closeSync(fd);
const out = readFileSync(logPath, 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
const showTail = () => console.error(`\n--- last 60 lines of vitest output (exit ${r.status}${r.error ? ', ' + r.error.message : ''}) ---\n` + out.split('\n').slice(-60).join('\n'));
const failed = new Set(
  out
    .split('\n')
    .filter((l) => l.startsWith(' FAIL '))
    .map((l) => l.replace(/^ FAIL +/, '').replace(/ \[ .*\]$/, '').trim()),
);
const known = new Set(readFileSync('tests/known-failures.txt', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean));
const summary = out.split('\n').find((l) => /^\s+Tests\s+\d/.test(l))?.trim();
const added = [...failed].filter((t) => !known.has(t));
const fixed = [...known].filter((t) => !failed.has(t));
console.log(summary ?? '(no vitest summary)');
if (!summary) {
  console.error('vitest did not report a result; nothing can be compared.');
  showTail();
  process.exit(1);
}
if (fixed.length) console.log(`\nNow passing (remove from tests/known-failures.txt):\n  ${fixed.join('\n  ')}`);
if (added.length) {
  console.error(`\nNEW failures (not in tests/known-failures.txt):\n  ${added.join('\n  ')}`);
  // Each new failure's own error block from vitest's "Failed Tests" section (the last FAIL line for that name).
  const lines = out.split('\n');
  for (const name of added) {
    const at = lines.findLastIndex((l) => l.startsWith(' FAIL ') && l.includes(name));
    if (at < 0) continue;
    const end = lines.findIndex((l, i) => i > at && /^⎯{5,}/.test(l));
    console.error(`\n--- ${name} ---\n` + lines.slice(at, end > at ? end : at + 60).join('\n'));
  }
  showTail();
  process.exit(1);
}
console.log(`\nNo new failures (${failed.size} known).`);

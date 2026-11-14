#!/usr/bin/env node
/**
 * Runs the whole unit suite and fails only on tests that fail and aren't in tests/known-failures.txt (the failures
 * already on the branch before the iPhone app work: kit tests describing earlier drafts, shop, worksheet…; see
 * docs/club/KNOWN_TEST_FAILURES.md). Compares by name, never by count. Prints tests that now pass so the list can
 * shrink. Usage: node scripts/compare-test-failures.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const r = spawnSync('npx', ['vitest', 'run'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const out = (r.stdout ?? '') + (r.stderr ?? '');
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
if (fixed.length) console.log(`\nNow passing (remove from tests/known-failures.txt):\n  ${fixed.join('\n  ')}`);
if (added.length) {
  console.error(`\nNEW failures (not in tests/known-failures.txt):\n  ${added.join('\n  ')}`);
  process.exit(1);
}
if (!summary) process.exit(1);
console.log(`\nNo new failures (${failed.size} known).`);

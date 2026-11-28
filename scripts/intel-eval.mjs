#!/usr/bin/env node
/**
 * Progressive interpreter evaluation (docs/intelligence/EVALUATION_PLAN.md). Synthetic households only.
 *
 *   node scripts/intel-eval.mjs plan                 what each phase would send, cached vs new, worst-case cost. No network.
 *   node scripts/intel-eval.mjs run <phase>          replay: score from previously generated outputs. No network, no cost.
 *   node scripts/intel-eval.mjs run <phase> --live   send ONLY the uncached requests to the intel-infer function.
 *   node scripts/intel-eval.mjs status               where the $5.00 evaluation budget stands (asks the function).
 *
 * Phases: A (API validation: one tiny call each), B (five representative households, cheap model), C (the other 45,
 * only if B passed its gate), escalate (the strong model, only on title groups where the cheap one fell short).
 *
 * Live mode needs INTEL_INFER_URL (the deployed function) and INTEL_EVAL_SECRET. The key to the provider never leaves
 * the function. Spending is capped three times: this script's per-phase ceiling (worst case, before sending), the
 * function's checks, and the database's $5.00 total (serialized, retries and concurrency included). When a phase needs
 * more than its ceiling or what's left, nothing is sent and an approval request is written instead.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { generateHouseholds } = await jiti.import('../src/lib/intel/synthetic.ts');
const { runLab } = await jiti.import('../src/lib/intel/lab.ts');
const E = await jiti.import('../src/lib/intel/eval/evaluate.ts');
const { TASKS, fingerprint } = await jiti.import('../supabase/functions/_shared/intel/tasks.ts');
const { DEFAULT_TIERS, estimateMicroUsd } = await jiti.import('../supabase/functions/_shared/intel/provider.ts');

const CACHE = process.env.INTEL_CACHE_DIR ?? 'evals/intel/cache';
const RESULTS = process.env.INTEL_RESULTS_DIR ?? 'evals/intel/results';
const LOG = process.env.INTEL_EVAL_LOG ?? 'docs/intelligence/EVAL_LOG.md';
const APPROVAL = process.env.INTEL_APPROVAL_FILE ?? 'docs/intelligence/EVAL_APPROVAL_REQUEST.md';
const TOTAL_APPROVED = 5_000_000; // micro-USD: the owner's $5.00 (the database enforces it; this is for planning)
/** Worst-case ceilings per phase (micro-USD), well inside the $5.00. */
const CEILING = { A: 10_000, B: 100_000, C: 500_000, escalate: 500_000 };
/** Gates (docs/intelligence/EVALUATION_PLAN.md → Gates). */
const GATE = { validRate: 0.95, meaningfulGain: 0.10, groupShortfall: 0.80, minGroupItems: 5 };

const usd = (micro) => `$${(micro / 1e6).toFixed(micro < 10_000 ? 4 : 2)}`;
const [cmd = 'plan', phaseArg, ...flags] = process.argv.slice(2);
const live = flags.includes('--live');
const model = (tier) => (tier === 'strong' ? process.env.INTEL_MODEL_STRONG ?? DEFAULT_TIERS.strong : process.env.INTEL_MODEL_CHEAP ?? DEFAULT_TIERS.cheap);

// ---------------------------------------------------------------- local cache (committed: synthetic data only)
mkdirSync(CACHE, { recursive: true }); mkdirSync(RESULTS, { recursive: true });
const cache = new Map(readdirSync(CACHE).filter((f) => f.endsWith('.json')).map((f) => { const e = JSON.parse(readFileSync(join(CACHE, f), 'utf8')); return [e.fingerprint, e]; }));
const remember = (e) => { cache.set(e.fingerprint, e); writeFileSync(join(CACHE, `${e.fingerprint}.json`), `${JSON.stringify(e, null, 2)}\n`); };

// ---------------------------------------------------------------- the phases' requests
const households = generateHouseholds();
const rep = E.representative(households, 5);
const rest = households.filter((h) => !rep.includes(h));
const labOf = new Map();
const lab = (h) => labOf.get(h.id) ?? labOf.set(h.id, runLab(h)).get(h.id);

function requestsFor(phase) {
  if (phase === 'A') {
    const two = { items: [{ id: 'e1', title: 'P2 birthday', repeats: true, day_part: 'all-day' }, { id: 'e2', title: 'Picture day', day_part: 'morning' }] };
    return [
      { task: 'validate', tier: 'cheap', household: '-', input: { word: 'ready' }, truth: {} },
      { task: 'interpret-event', tier: 'cheap', household: '-', input: two, truth: { e1: { kind: 'birthday-reminder', needs: ['card'] }, e2: { kind: 'school-event', needs: ['outfit'] } } },
    ];
  }
  if (phase === 'B' || phase === 'C') {
    const hs = phase === 'B' ? rep : rest;
    return hs.flatMap((h) => [...E.interpretRequests(h), ...E.patternRequests(h, lab(h).memories)]).map((r) => ({ ...r, tier: 'cheap' }));
  }
  if (phase === 'escalate') {
    // Only the short groups, on the strong tier. The input is just the title (no household context), so each distinct
    // title is asked once, in batches of 20, however many households have it.
    const short = shortGroups();
    const titles = new Map();
    for (const h of [...rep, ...(existsSync(join(RESULTS, 'C.json')) ? rest : [])]) for (const r of E.interpretRequests(h)) for (const it of r.input.items) {
      const t = r.truth[it.id];
      if (short.includes(t.group) && !titles.has(it.title)) titles.set(it.title, { it, t });
    }
    const list = [...titles.values()];
    const out = [];
    for (let i = 0; i < list.length; i += 20) {
      const batch = list.slice(i, i + 20).map(({ it, t }, k) => ({ item: { ...it, id: `e${k + 1}` }, t }));
      out.push({ task: 'interpret-event', tier: 'strong', household: `escalate-${i / 20 + 1}`, input: { items: batch.map((x) => x.item) }, truth: Object.fromEntries(batch.map((x) => [x.item.id, x.t])) });
    }
    return out;
  }
  throw new Error(`unknown phase ${phase}`);
}

async function priced(reqs) {
  const out = [];
  for (const r of reqs) {
    const m = model(r.tier);
    const fp = await fingerprint(r.task, m, r.input);
    out.push({ ...r, model: m, fingerprint: fp, cached: cache.has(fp), worst: estimateMicroUsd(m, TASKS[r.task], r.input) });
  }
  return out;
}

// ---------------------------------------------------------------- scoring
function score(phase, reqs) {
  const items = [];
  const patterns = [];
  let valid = 0, answered = 0;
  for (const r of reqs) {
    const out = E.replay(cache, r.fingerprint);
    if (out) { answered++; if (out.valid) valid++; }
    if (r.task === 'interpret-event') {
      const answers = E.answersOf(out);
      for (const it of r.input.items) {
        const t = r.truth[it.id];
        const a = answers.get(it.id);
        const ok = a && (a.kind === t.kind || (t.alsoOk ?? []).includes(a.kind));
        const rulesKind = E.route(it.title).kind;
        items.push({ household: r.household, id: it.id, title: it.title, group: t.group ?? '-', answered: !!a, kindOk: !!ok, needsOk: !!a && t.needs.every((x) => a.needs.includes(x)) && a.needs.length <= t.needs.length + 2,
          rulesKindOk: rulesKind === t.kind || (t.alsoOk ?? []).includes(rulesKind), model: r.model });
      }
    } else if (r.task === 'pattern-review') {
      const res = out?.valid ? out.result.items : [];
      for (const [id, t] of Object.entries(r.truth)) { const a = res.find((x) => x.id === id); patterns.push({ household: r.household, id, answered: !!a, ok: !!a && a.meaningful === t.meaningful }); }
    } else if (r.task === 'validate') {
      items.push({ household: '-', id: 'validate', title: '-', group: 'validate', answered: !!out, kindOk: !!out?.valid, needsOk: true, rulesKindOk: true, model: r.model });
    }
  }
  const ev = items.filter((x) => x.group !== 'validate');
  const pct = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : null);
  const groups = {};
  for (const x of ev) (groups[x.group] ??= []).push(x);
  return {
    phase, requests: reqs.length, answered, valid, validRate: answered ? valid / answered : null,
    items: ev.length, modelKindAccuracy: pct(ev.filter((x) => x.answered), (x) => x.kindOk), rulesKindAccuracy: pct(ev, (x) => x.rulesKindOk),
    needsAccuracy: pct(ev.filter((x) => x.answered), (x) => x.needsOk), patternAccuracy: pct(patterns.filter((x) => x.answered), (x) => x.ok), patterns: patterns.length,
    groups: Object.fromEntries(Object.entries(groups).map(([g, xs]) => [g, { n: xs.length, model: pct(xs.filter((x) => x.answered), (x) => x.kindOk), rules: pct(xs, (x) => x.rulesKindOk) }])),
    cost_micro_usd: reqs.reduce((a, r) => a + (cache.get(r.fingerprint)?.cost_micro_usd ?? 0), 0),
    misses: items.filter((x) => x.answered && !x.kindOk).map((x) => `${x.title}`),
  };
}

/** Title groups where the cheap model fell meaningfully short (enough items to tell). */
function shortGroups() {
  const res = ['B', 'C'].map((p) => join(RESULTS, `${p}.json`)).filter(existsSync).map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const merged = {};
  for (const r of res) for (const [g, s] of Object.entries(r.groups)) { const m = (merged[g] ??= { n: 0, ok: 0 }); m.n += s.n; m.ok += Math.round((s.model ?? 0) * s.n); }
  return Object.entries(merged).filter(([, m]) => m.n >= GATE.minGroupItems && m.ok / m.n < GATE.groupShortfall).map(([g]) => g);
}

function gate(phase, s) {
  if (phase === 'A') return s.valid === s.requests ? { pass: true, next: 'B', why: 'the key, model names, structured output and usage accounting all work' } : { pass: false, next: null, why: 'validation failed: fix the setup before anything else is sent' };
  if (s.validRate == null) return { pass: false, next: null, why: 'no answers yet (run with --live, or nothing was cached)' };
  if (s.validRate < GATE.validRate) return { pass: false, next: null, why: `only ${(s.validRate * 100).toFixed(0)}% of answers were valid (need ${GATE.validRate * 100}%): fix the prompt or schema first` };
  const gain = (s.modelKindAccuracy ?? 0) - (s.rulesKindAccuracy ?? 0);
  const short = Object.entries(s.groups).filter(([, g]) => g.n >= GATE.minGroupItems && (g.model ?? 1) < GATE.groupShortfall).map(([k]) => k);
  if (gain < GATE.meaningfulGain) return { pass: false, next: null, why: `the model beats the rules by only ${(gain * 100).toFixed(0)} points on these titles (need ${GATE.meaningfulGain * 100}): keep the rules, don't spend more` };
  if (phase === 'B') return { pass: true, next: 'C', short, why: `valid ${(s.validRate * 100).toFixed(0)}%, ${(gain * 100).toFixed(0)} points better than the rules` };
  return { pass: true, next: short.length ? 'escalate' : null, short, why: short.length ? `cheap model short on: ${short.join(', ')}` : 'the cheap model is enough everywhere: no escalation' };
}

// ---------------------------------------------------------------- commands
async function infer(r) {
  const res = await fetch(process.env.INTEL_INFER_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-intel-eval': process.env.INTEL_EVAL_SECRET },
    body: JSON.stringify({ task: r.task, tier: r.tier, input: r.input, live: true, run: `eval-${r.phase.toLowerCase()}-${Date.now().toString(36)}` }) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function status() {
  if (!process.env.INTEL_INFER_URL || !process.env.INTEL_EVAL_SECRET) return null;
  const res = await fetch(process.env.INTEL_INFER_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-intel-eval': process.env.INTEL_EVAL_SECRET }, body: JSON.stringify({ status: true }) });
  return res.ok ? (await res.json()).budget : null;
}

function approvalRequest(phase, need, left, results) {
  const text = [`# Evaluation: approval needed (${new Date().toISOString().slice(0, 10)})`, '',
    `Phase **${phase}** needs up to **${usd(need)}** (worst case), more than ${left != null ? `what's left of the approved $5.00 (${usd(left)})` : `its ceiling (${usd(CEILING[phase])})`}. Nothing was sent.`, '',
    '## Results so far', '', ...results.map((r) => `- **${r.phase}**: ${r.items} titles, model ${fmt(r.modelKindAccuracy)} vs rules ${fmt(r.rulesKindAccuracy)}, valid ${fmt(r.validRate)}, spent ${usd(r.cost_micro_usd)}`), '',
    '## Why more inference', '', `- ${phase === 'escalate' ? 'The cheap model fell short on some title groups; the strong model is needed to tell whether escalation is worth it.' : 'The previous phase passed its gate; this phase checks the result holds on more households.'}`, '',
    '## To approve', '', '- Raise the cap (owner, SQL):', '', '```sql', `update public.intel_budget_scopes set lifetime_cap_micro_usd = <new total>, approved_note = 'Owner, <date>: <why>' where scope = 'synthetic';`, '```', ''].join('\n');
  writeFileSync(APPROVAL, text);
}
const fmt = (x) => (x == null ? 'n/a' : `${(x * 100).toFixed(0)}%`);

if (cmd === 'status') { console.log(JSON.stringify(await status(), null, 2) ?? 'set INTEL_INFER_URL and INTEL_EVAL_SECRET'); process.exit(0); }

if (cmd === 'plan') {
  console.log(`Representative households for phase B: ${rep.map((h) => `${h.id} (${h.shape}, ${h.engagement})`).join(', ')}\n`);
  let total = 0;
  for (const p of ['A', 'B', 'C']) {
    const reqs = await priced(requestsFor(p));
    const fresh = reqs.filter((r) => !r.cached);
    const worst = fresh.reduce((a, r) => a + r.worst, 0);
    total += worst;
    console.log(`Phase ${p}: ${reqs.length} requests (${reqs.length - fresh.length} cached, ${fresh.length} new), ${reqs.reduce((a, r) => a + JSON.stringify(r.input).length, 0)} input chars, worst case ${usd(worst)} (ceiling ${usd(CEILING[p])})`);
  }
  console.log(`\nWorst case for A + B + C: ${usd(total)} of the approved ${usd(TOTAL_APPROVED)}. Escalation is planned only after B/C show a shortfall.`);
  const all = households.flatMap((h) => E.eventsFor(h));
  console.log(`Deterministic first: the rules settle ${all.filter((p) => E.route(p.event.title).route === 'rules').length} of ${all.length} titles with no model at all.`);
  process.exit(0);
}

if (cmd === 'run') {
  const phase = phaseArg;
  if (!['A', 'B', 'C', 'escalate'].includes(phase)) { console.error('phase: A | B | C | escalate'); process.exit(2); }
  const reqs = (await priced(requestsFor(phase))).map((r) => ({ ...r, phase }));
  const fresh = reqs.filter((r) => !r.cached);
  const worst = fresh.reduce((a, r) => a + r.worst, 0);
  const prior = ['A', 'B', 'C', 'escalate'].filter((p) => p !== phase).map((p) => join(RESULTS, `${p}.json`)).filter(existsSync).map((f) => JSON.parse(readFileSync(f, 'utf8')));
  if (live && fresh.length) {
    if (!process.env.INTEL_INFER_URL || !process.env.INTEL_EVAL_SECRET) { console.error('live needs INTEL_INFER_URL and INTEL_EVAL_SECRET'); process.exit(2); }
    if (phase !== 'A' && !prior.some((r) => r.phase === (phase === 'B' ? 'A' : phase === 'C' ? 'B' : 'B') && r.gate?.pass)) { console.error(`phase ${phase} waits for the previous phase to pass its gate`); process.exit(3); }
    const b = await status();
    const left = b ? Number(b.lifetime_cap_micro_usd) - Number(b.spent_micro_usd) : null;
    if (worst > CEILING[phase] || (left != null && worst > left)) {
      approvalRequest(phase, worst, left, prior);
      console.error(`Phase ${phase} needs up to ${usd(worst)}: over ${left != null && worst > left ? `what's left (${usd(left)})` : `its ceiling (${usd(CEILING[phase])})`}. Nothing sent. Wrote ${APPROVAL}.`);
      process.exit(4);
    }
    console.log(`Phase ${phase}: sending ${fresh.length} uncached requests (worst case ${usd(worst)}; budget left ${left != null ? usd(left) : 'unknown'})`);
    for (const r of fresh) {
      const { status: st, body } = await infer(r);
      if (st === 200 && (body.source === 'live' || body.source === 'cache') && body.result !== undefined) {
        remember({ fingerprint: body.fingerprint, task: r.task, model: body.model, prompt_version: body.prompt_version, input: r.input, output: { result: body.result, valid: body.valid, reason: body.reason ?? null }, usage: body.usage, cost_micro_usd: body.cost_micro_usd ?? 0, at: new Date().toISOString() });
        if (body.fingerprint !== r.fingerprint) console.warn(`  fingerprint mismatch for ${r.household} (prompt or model changed?)`);
      } else if (st === 402) { console.error(`  stopped by the budget: ${body.reason} (${usd(Number(body.budget?.spent_micro_usd ?? 0))} spent)`); approvalRequest(phase, worst, 0, prior); break; }
      else console.error(`  ${r.household} ${r.task}: ${st} ${body.error ?? ''} ${body.detail ?? ''}`);
    }
  } else if (fresh.length) console.log(`Replay: ${fresh.length} of ${reqs.length} requests have no cached answer (scored with the rules' fallback). Add --live to send them.`);
  const s = score(phase, reqs);
  s.gate = gate(phase, s);
  s.at = new Date().toISOString();
  s.mode = live ? 'live' : 'replay';
  writeFileSync(join(RESULTS, `${phase}.json`), `${JSON.stringify(s, null, 2)}\n`);
  const line = `| ${s.at.slice(0, 10)} | ${phase} | ${s.mode} | ${s.requests} | ${s.items} | ${fmt(s.modelKindAccuracy)} | ${fmt(s.rulesKindAccuracy)} | ${fmt(s.needsAccuracy)} | ${fmt(s.validRate)} | ${usd(s.cost_micro_usd)} | ${s.gate.pass ? 'pass' : 'stop'}: ${s.gate.why} |`;
  if (!existsSync(LOG)) writeFileSync(LOG, '# Interpreter evaluation log\n\nGenerated by `scripts/intel-eval.mjs` (docs/intelligence/EVALUATION_PLAN.md). Synthetic households only.\n\n| Date | Phase | Mode | Requests | Titles | Model kind | Rules kind | Needs | Valid | Cost | Gate |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n');
  if (live) appendFileSync(LOG, `${line}\n`);
  console.log(JSON.stringify({ phase, mode: s.mode, requests: s.requests, titles: s.items, model: fmt(s.modelKindAccuracy), rules: fmt(s.rulesKindAccuracy), needs: fmt(s.needsAccuracy), valid: fmt(s.validRate), cost: usd(s.cost_micro_usd), gate: s.gate }, null, 2));
  process.exit(0);
}
console.error('usage: plan | run <A|B|C|escalate> [--live] | status');
process.exit(2);

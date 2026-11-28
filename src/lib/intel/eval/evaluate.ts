/**
 * Progressive, deterministic-first evaluation of the interpreter (docs/intelligence/EVALUATION_PLAN.md).
 *
 * Pure functions shared by the runner (scripts/intel-eval.mjs), the Lab and the tests:
 *   - eventsFor(): each synthetic household's labeled calendar titles (stable per household)
 *   - route(): rules first; only what the rules can't settle goes to a model (and only ambiguous birthdays are
 *     second-guessed, because the rules are confidently wrong about them)
 *   - interpretRequests(): minimized, batched requests (≤ 20 titles, ids e1…, no other fields)
 *   - patternRequests(): only TENTATIVE statistical beliefs (confident ones need no model)
 *   - representative(): five households that together cover the shapes, engagement levels and scenarios
 *   - score*(): accuracy against the labels, with the rules-only baseline beside it
 *   - replay(): answers from previously generated outputs, at no cost; a miss falls back to the rules
 */
import { classify } from '../../v18/playbooks';
import type { MemoryRecord } from '../memory';
import { rng, type SyntheticHousehold } from '../synthetic';
import { CATALOG, type CatalogEvent } from './catalog';

export interface PlannedEvent { id: string; event: CatalogEvent }
export interface Request { task: 'interpret-event' | 'pattern-review'; household: string; input: Record<string, unknown>; truth: Record<string, unknown> }

const seedOf = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

/** 12–16 labeled titles for a household, always including a few hard cases. Stable for the same household id. */
export function eventsFor(h: Pick<SyntheticHousehold, 'id'>): PlannedEvent[] {
  const r = rng(seedOf(h.id));
  const pool = [...CATALOG];
  const out: CatalogEvent[] = [];
  const hard = pool.filter((x) => x.group !== 'clear');
  for (let i = 0; i < 6; i++) out.push(hard.splice(Math.floor(r.next() * hard.length), 1)[0]);
  const rest = pool.filter((x) => !out.includes(x));
  const n = r.int(6, 10);
  for (let i = 0; i < n && rest.length; i++) out.push(rest.splice(Math.floor(r.next() * rest.length), 1)[0]);
  return out.map((event, i) => ({ id: `e${i + 1}`, event }));
}

const AMBIGUOUS_BIRTHDAY = /birthday|b-?day/i;
const PARTY_WORDS = /party|bash|bowling|sleepover|celebrat|turns \d/i;

/** Rules first. 'rules' = the rules settle it (no model); 'model' = ask the interpreter. */
export function route(title: string): { route: 'rules' | 'model'; kind: string; confidence: number } {
  const c = classify(title);
  if (c.kind === 'birthday-party' && AMBIGUOUS_BIRTHDAY.test(title) && !PARTY_WORDS.test(title)) return { route: 'model', kind: c.kind, confidence: 0.5 };
  return { route: c.confidence >= 0.75 ? 'rules' : 'model', kind: c.kind, confidence: c.confidence };
}

export function interpretRequests(h: Pick<SyntheticHousehold, 'id'>): Request[] {
  const routed = eventsFor(h).filter((p) => route(p.event.title).route === 'model');
  const out: Request[] = [];
  for (let i = 0; i < routed.length; i += 20) {
    const batch = routed.slice(i, i + 20);
    out.push({
      task: 'interpret-event', household: h.id,
      input: { items: batch.map((p) => ({ id: p.id, title: p.event.title, ...(p.event.repeats != null ? { repeats: p.event.repeats } : {}), ...(p.event.dayPart ? { day_part: p.event.dayPart } : {}) })) },
      truth: Object.fromEntries(batch.map((p) => [p.id, p.event])),
    });
  }
  return out;
}

/** Tentative statistical beliefs only (observed / confirmed ones are settled without a model). ≤ 10 per request. */
export function patternRequests(h: SyntheticHousehold, memories: MemoryRecord[]): Request[] {
  const expected = new Map(h.scenarios.flatMap((s) => s.expect.map((x) => [x.subject_key, x] as const)));
  const cands = memories.filter((m) => m.status === 'tentative' && m.source === 'stats' && m.cadence && m.cadence !== 'irregular' && !m.visible_to && m.category !== 'preference' && m.category !== 'timing').slice(0, 10);
  if (!cands.length) return [];
  const weeks = (m: MemoryRecord) => (m.first_seen && m.last_seen ? Math.max(1, Math.round((Date.parse(m.last_seen) - Date.parse(m.first_seen)) / (7 * 86_400_000))) : 1);
  return [{
    task: 'pattern-review', household: h.id,
    input: { candidates: cands.map((m, i) => ({ id: `c${i + 1}`, signal: m.subject_key.split(':')[0].slice(0, 32), cadence: m.cadence!, ...(m.content.anchor != null ? { anchor: String(m.content.anchor) } : {}), support: m.support, regularity: Number(m.content.regularity ?? 0), weeks_seen: weeks(m) })) },
    truth: Object.fromEntries(cands.map((m, i) => [`c${i + 1}`, { meaningful: !!expected.get(m.subject_key) && !expected.get(m.subject_key)!.status.includes('absent') }])),
  }];
}

/** Five households that together cover family shapes, engagement levels and as many scenarios as possible. */
export function representative(hs: SyntheticHousehold[], n = 5): SyntheticHousehold[] {
  const picked: SyntheticHousehold[] = [];
  const covered = new Set<string>();
  const features = (h: SyntheticHousehold) => [`shape:${h.shape}`, `engagement:${h.engagement}`, ...h.scenarios.map((s) => `scenario:${s.kind}`), ...eventsFor(h).map((p) => `group:${p.event.group}`)];
  while (picked.length < n) {
    const best = hs.filter((h) => !picked.includes(h)).map((h) => ({ h, gain: features(h).filter((f) => !covered.has(f)).length })).sort((a, b) => b.gain - a.gain || a.h.id.localeCompare(b.h.id))[0];
    if (!best) break;
    picked.push(best.h);
    features(best.h).forEach((f) => covered.add(f));
  }
  return picked;
}

export interface ItemScore { id: string; key: string; group: string; source: 'rules' | 'model' | 'fallback'; kindOk: boolean; needsOk: boolean; rulesKindOk: boolean }

const kindOk = (ev: CatalogEvent, kind: string) => kind === ev.kind || (ev.alsoOk ?? []).includes(kind as never);

/** Score one household's events: rules where they settle it, the model's answer (or the rules, on a miss) elsewhere. */
export function scoreInterpret(h: Pick<SyntheticHousehold, 'id'>, answers: Map<string, { kind: string; needs: string[] } | null>): ItemScore[] {
  return eventsFor(h).map((p) => {
    const r = route(p.event.title);
    const rulesKindOk = kindOk(p.event, r.kind);
    if (r.route === 'rules') return { id: p.id, key: p.event.key, group: p.event.group, source: 'rules', kindOk: rulesKindOk, needsOk: true, rulesKindOk };
    const a = answers.get(p.id) ?? null;
    if (!a) return { id: p.id, key: p.event.key, group: p.event.group, source: 'fallback', kindOk: rulesKindOk, needsOk: p.event.needs.length === 0, rulesKindOk };
    return { id: p.id, key: p.event.key, group: p.event.group, source: 'model', kindOk: kindOk(p.event, a.kind), needsOk: p.event.needs.every((x) => a.needs.includes(x)) && a.needs.length <= p.event.needs.length + 2, rulesKindOk };
  });
}

// ---------------------------------------------------------------- replay (no cost)

export interface CacheEntry { fingerprint: string; task: string; model: string; prompt_version: string; input: unknown; output: { result: unknown; valid: boolean; reason: string | null }; usage?: Record<string, number>; cost_micro_usd: number; at: string }

/** A previously generated answer, or null (the caller falls back to the rules; nothing is ever called from here). */
export function replay(cache: Map<string, CacheEntry>, fingerprint: string): CacheEntry['output'] | null {
  return cache.get(fingerprint)?.output ?? null;
}

/** The interpret-event answers in a cached output, by item id (only valid outputs count). */
export function answersOf(out: CacheEntry['output'] | null): Map<string, { kind: string; needs: string[] }> {
  const m = new Map<string, { kind: string; needs: string[] }>();
  if (!out?.valid) return m;
  for (const it of ((out.result as { items?: { id: string; kind: string; needs: string[] }[] })?.items ?? [])) m.set(it.id, { kind: it.kind, needs: it.needs });
  return m;
}

/**
 * The model's job descriptions (docs/intelligence/EVALUATION_PLAN.md). A closed registry: the inference function runs
 * ONLY these tasks, each with a versioned prompt, a strict JSON schema, an output-token ceiling, an input-size ceiling
 * and a validator that rejects anything outside the closed vocabularies (and any id that wasn't in the input).
 *
 * Inputs are minimized before they get here: pseudonymous tokens instead of names (P2, S4), no descriptions, notes,
 * addresses, contact details, ages or household ids. validInput() refuses obvious leaks anyway.
 *
 * Plain TypeScript (no Deno APIs) so the Edge Function, the evaluation runner, the Lab and the tests share it.
 * The kinds and needs mirror src/lib/v18/playbooks.ts (tests/intel-infer.test.ts keeps them in step).
 */

export const EVENT_KINDS = ['field-trip', 'birthday-party', 'party', 'sports-game', 'sports-practice', 'performance', 'appointment', 'routine', 'other',
  // finer kinds the rules can't tell apart (Stage A §6)
  'birthday-reminder', 'tournament', 'school-event'] as const;
export const NEED_IDS = ['lunch', 'pickup', 'rsvp', 'gift', 'ride', 'gear', 'outfit', 'card'] as const; // exactly the playbooks' needs: nothing the app can't act on
export const PATTERN_LABELS = ['weekly-activity', 'chore-rhythm', 'monthly-errand', 'occasion', 'handoff', 'not-meaningful'] as const;

export type TaskName = 'validate' | 'interpret-event' | 'pattern-review';

export interface TaskSpec {
  name: TaskName;
  promptVersion: string;
  system: string;
  /** JSON schema for the Responses API's strict structured output. */
  schema: Record<string, unknown>;
  /** Hard ceiling on output tokens (reasoning included); also the basis of the reservation estimate. */
  maxOutputTokens: (input: unknown) => number;
  /** The most input (serialized characters) the task accepts. */
  maxInputChars: number;
  validInput(input: unknown): string | null;
  validOutput(output: unknown, input: unknown): string | null;
}

const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const LEAK = /https?:\/\/|www\.|@[a-z0-9-]+\.|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Dr|Ln)\b/;
const shortText = (s: unknown, max: number) => typeof s === 'string' && s.length >= 1 && s.length <= max && !LEAK.test(s);
const ID = /^[a-z0-9-]{1,16}$/;

export const TASKS: Record<TaskName, TaskSpec> = {
  // Phase A: is the key, model name, structured output and usage accounting working? A few tokens.
  validate: {
    name: 'validate', promptVersion: 'v-1',
    system: 'Reply with JSON only. Set ok to true and echo the word you were given.',
    schema: obj({ ok: { type: 'boolean' }, echo: { type: 'string' } }),
    maxOutputTokens: () => 64,
    maxInputChars: 60,
    validInput: (i) => (isObj(i) && shortText(i.word, 20) && Object.keys(i).length === 1 ? null : 'input'),
    validOutput: (o, i) => (isObj(o) && o.ok === true && typeof o.echo === 'string' && isObj(i) && o.echo.toLowerCase().includes(String(i.word).toLowerCase()) ? null : 'output'),
  },

  // Event titles the rules couldn't classify with confidence ≥ 0.75, batched (≤ 20).
  'interpret-event': {
    name: 'interpret-event', promptVersion: 'ie-1',
    system: [
      'You classify family calendar events for a family-planning app. Titles use codes instead of names (P1 is a person, S1 a series).',
      'For each item choose the single best kind and the needs a parent typically has to handle beforehand, only from the allowed lists.',
      'birthday-reminder = someone\'s birthday to remember (a text, a card), not a party. birthday-party = a party to attend or host.',
      'Set is_exception when this occurrence looks unusual for a repeating series. Use confidence 0–1 honestly; prefer "other" with low confidence over guessing.',
      'Never invent ids. Output JSON only.',
    ].join(' '),
    schema: obj({ items: { type: 'array', items: obj({
      id: { type: 'string' }, kind: { type: 'string', enum: [...EVENT_KINDS] }, needs: { type: 'array', items: { type: 'string', enum: [...NEED_IDS] } },
      is_exception: { type: 'boolean' }, confidence: { type: 'number' },
    }) } }),
    maxOutputTokens: (i) => 40 + 48 * (isObj(i) && Array.isArray(i.items) ? i.items.length : 0),
    maxInputChars: 3000,
    validInput(i) {
      if (!isObj(i) || !Array.isArray(i.items) || i.items.length < 1 || i.items.length > 20) return 'items';
      for (const it of i.items) {
        if (!isObj(it) || !ID.test(String(it.id)) || !shortText(it.title, 80)) return 'item';
        if (it.repeats != null && typeof it.repeats !== 'boolean') return 'item';
        if (it.day_part != null && !['morning', 'afternoon', 'evening', 'all-day'].includes(String(it.day_part))) return 'item';
        const extra = Object.keys(it).filter((k) => !['id', 'title', 'repeats', 'day_part'].includes(k));
        if (extra.length) return 'fields'; // nothing else (no descriptions, no ages, no locations)
      }
      return null;
    },
    validOutput(o, i) {
      if (!isObj(o) || !Array.isArray(o.items) || !isObj(i) || !Array.isArray(i.items)) return 'shape';
      const ids = new Set((i.items as { id: string }[]).map((x) => x.id));
      const seen = new Set<string>();
      for (const it of o.items) {
        if (!isObj(it) || !ids.has(String(it.id)) || seen.has(String(it.id))) return 'id';
        seen.add(String(it.id));
        if (!(EVENT_KINDS as readonly string[]).includes(String(it.kind))) return 'kind';
        if (!Array.isArray(it.needs) || it.needs.some((n) => !(NEED_IDS as readonly string[]).includes(String(n)))) return 'needs';
        if (typeof it.is_exception !== 'boolean' || typeof it.confidence !== 'number' || it.confidence < 0 || it.confidence > 1) return 'fields';
      }
      return seen.size === ids.size ? null : 'missing';
    },
  },

  // Statistical candidates from learn() that are tentative: worth asking the family about, or noise?
  'pattern-review': {
    name: 'pattern-review', promptVersion: 'pr-1',
    system: [
      'You review statistical patterns noticed in a family\'s app activity. Each candidate gives what happened (a signal kind), its rhythm and how much evidence there is.',
      'Decide whether it is a meaningful family rhythm worth confirming with the family, and label it from the allowed list. Be conservative: little evidence or an odd rhythm is not-meaningful.',
      'Never invent ids. Output JSON only.',
    ].join(' '),
    schema: obj({ items: { type: 'array', items: obj({ id: { type: 'string' }, meaningful: { type: 'boolean' }, ask_family: { type: 'boolean' }, label: { type: 'string', enum: [...PATTERN_LABELS] } }) } }),
    maxOutputTokens: (i) => 40 + 32 * (isObj(i) && Array.isArray(i.candidates) ? i.candidates.length : 0),
    maxInputChars: 2500,
    validInput(i) {
      if (!isObj(i) || !Array.isArray(i.candidates) || i.candidates.length < 1 || i.candidates.length > 10) return 'candidates';
      for (const c of i.candidates) {
        if (!isObj(c) || !ID.test(String(c.id)) || !/^[a-z-]{3,32}$/.test(String(c.signal)) || !/^[a-z]{4,12}$/.test(String(c.cadence))) return 'candidate';
        if (typeof c.support !== 'number' || typeof c.regularity !== 'number' || typeof c.weeks_seen !== 'number') return 'candidate';
        if (Object.keys(c).some((k) => !['id', 'signal', 'cadence', 'anchor', 'support', 'regularity', 'weeks_seen'].includes(k))) return 'fields';
      }
      return null;
    },
    validOutput(o, i) {
      if (!isObj(o) || !Array.isArray(o.items) || !isObj(i) || !Array.isArray(i.candidates)) return 'shape';
      const ids = new Set((i.candidates as { id: string }[]).map((x) => x.id));
      const seen = new Set<string>();
      for (const it of o.items) {
        if (!isObj(it) || !ids.has(String(it.id)) || seen.has(String(it.id))) return 'id';
        seen.add(String(it.id));
        if (typeof it.meaningful !== 'boolean' || typeof it.ask_family !== 'boolean' || !(PATTERN_LABELS as readonly string[]).includes(String(it.label))) return 'fields';
      }
      return seen.size === ids.size ? null : 'missing';
    },
  },
};

/** Canonical JSON (sorted keys), so the same request always has the same fingerprint. */
export function canonical(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((x as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(x);
}

/** The cache key: task, prompt version, the exact model and the exact minimized input. */
export async function fingerprint(task: TaskName, model: string, input: unknown): Promise<string> {
  const data = new TextEncoder().encode(canonical({ task, v: TASKS[task].promptVersion, model, input }));
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return `f${[...h.slice(0, 20)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

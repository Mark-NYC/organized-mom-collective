/**
 * The app's side of the Household Intelligence Engine (docs/intelligence/STAGE_B_REPORT.md → Client).
 *
 *  - signal(): queue a behavioral signal and send it in small batches (household_signal_log). Closed kinds, opaque
 *    ids, short enum values only: validSignal() drops anything else before it leaves the device. Signed-out and demo
 *    sessions send nothing. Never throws, never waits: learning must not get in a mom's way.
 *  - signalsFor(): what a V21 write teaches (pure, so it's tested without a browser).
 *  - settings, memory and erase: thin wrappers over the household's RPCs for Account → Household intelligence.
 *
 * The server decides what is kept: learning off, a missing family or a withdrawn personal-calendar consent all drop
 * learning signals there too, so the device's own view never has to be trusted.
 */
import { accountRpc, loadSession } from '../account';
import { appShellBuild } from '../native/platform';
import type { Write } from '../v20/live';
import type { MemoryRecord } from './memory';
import { localStamp, validSignal, type SignalInput } from './signals';

const QUEUE = 'omc:intel:queue:v1';
const MAX_QUEUE = 200;
const BATCH = 50;
const MAX_AGE_MS = 3 * 86_400_000; // the server ignores signals older than three days

type Pending = Omit<SignalInput, 'local_day' | 'local_hour' | 'local_dow' | 'at'> & Partial<Pick<SignalInput, 'local_day' | 'local_hour' | 'local_dow' | 'at'>>;

const readQueue = (): SignalInput[] => { try { return JSON.parse(localStorage.getItem(QUEUE) ?? '[]') as SignalInput[]; } catch { return []; } };
const writeQueue = (q: SignalInput[]) => { try { if (q.length) localStorage.setItem(QUEUE, JSON.stringify(q.slice(-MAX_QUEUE))); else localStorage.removeItem(QUEUE); } catch { /* full or blocked: fine */ } };
const active = () => typeof window !== 'undefined' && !!loadSession() && new URLSearchParams(globalThis.location?.search ?? '').get('demo') !== '1';

let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

/** Queue signals for this signed-in adult; they're sent on the next tick, in batches. */
export function signal(...items: Pending[]): void {
  try {
    if (!active() || !items.length) return;
    const platform = appShellBuild() ? 'ios' : 'web';
    const stamped = items.map((s) => validSignal({ ...localStamp(), platform, ...s } as SignalInput)).filter((s): s is SignalInput => !!s);
    if (!stamped.length) return;
    writeQueue([...readQueue(), ...stamped]);
    if (!timer) timer = setTimeout(() => { timer = null; void flush(); }, 0);
  } catch {
    // Learning never blocks anything.
  }
}

/** Send what's queued. Failures keep the queue (offline, or the database doesn't have the engine yet). */
export async function flush(): Promise<void> {
  if (sending || !active()) return;
  sending = true;
  try {
    const now = Date.now();
    let q = readQueue().filter((s) => !s.at || now - Date.parse(s.at) < MAX_AGE_MS);
    while (q.length) {
      const batch = q.slice(0, BATCH);
      await accountRpc('household_signal_log', { p_signals: batch });
      q = q.slice(batch.length);
      writeQueue(q);
    }
  } catch {
    // keep the queue for next time
  } finally {
    sending = false;
  }
}

/** A stable, opaque reference for an id that may carry personal text (an imported calendar UID can hold an email). */
export function opaqueRef(prefix: string, raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${prefix}${(h >>> 0).toString(36)}`;
}

const SAFE = /^[A-Za-z0-9:_@.-]{1,96}$/;
const ref = (prefix: string, id: string) => (/^[0-9a-f-]{36}$/i.test(id) || (SAFE.test(id) && !id.includes('@')) ? id : opaqueRef(prefix, id));
const slug = (v: string | null | undefined) => (v ? v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 32) : undefined);

/**
 * What one V21 write teaches the engine. Only the moment and opaque ids: never a title, a note, a name or an event's
 * text. (Meeting steps and plans already arrive as product moments through track().)
 */
export function signalsFor(w: Write, ctx: { existingAgreements: Set<string> }): Pending[] {
  switch (w.kind) {
    case 'agreement-save': {
      const changed = !!w.id && ctx.existingAgreements.has(w.id);
      return [{ kind: changed ? 'agreement_changed' : 'agreement_saved', subject_kind: 'agreement', subject_ref: ref('a', w.id ?? 'new'), value: slug(w.category) }];
    }
    case 'task-done': return [{ kind: 'task_done', subject_kind: 'task', subject_ref: ref('t', w.id) }];
    case 'cleaning-check': return [{ kind: 'task_done', subject_kind: 'cleaning', subject_ref: ref('c', w.key) }];
    case 'priority-add': return w.ref ? [{ kind: 'priority_chosen', subject_kind: 'priority', subject_ref: opaqueRef('e', `${w.ref.source}:${w.ref.event_uid}`), value: w.ref.source }] : [{ kind: 'priority_chosen', subject_kind: 'priority', subject_ref: 'note' }];
    case 'development': {
      const last = w.after.history[w.after.history.length - 1];
      return last ? [{ kind: 'development_decided', subject_kind: 'development', subject_ref: ref('d', w.after.id), value: slug(last.decision), member_id: /^[0-9a-f-]{36}$/i.test(w.after.memberId) ? w.after.memberId : undefined }] : [];
    }
    default: return [];
  }
}

// ---------------------------------------------------------------- settings, memory, erase (Account)

export interface IntelSettings {
  learning_enabled: boolean;
  ai_enabled: boolean;
  ai_consent_version: number | null;
  ai_consented_at: string | null;
  ai_consented_by_me: boolean | null;
  ai_withdrawn_at: string | null;
  personal_calendars: boolean;
  budget_micro_usd: number;
}

/** The consent text version the app shows. Bump it when the wording in AI_CONSENT changes materially. */
export const AI_CONSENT_VERSION = 1;

export const intelSettings = (household: string, patch?: Partial<Pick<IntelSettings, 'learning_enabled' | 'ai_enabled' | 'personal_calendars'>>) =>
  accountRpc<IntelSettings>('household_intel_settings', { p_household: household, p_patch: patch ? { ...patch, ...(patch.ai_enabled ? { ai_consent_version: AI_CONSENT_VERSION } : {}) } : null });

export type MemoryView = Pick<MemoryRecord, 'category' | 'subject_key' | 'content' | 'status' | 'source' | 'cadence' | 'confidence' | 'last_seen' | 'review_after' | 'expires_at'> & { id: string; private?: boolean };

export const householdMemory = (household: string) => accountRpc<MemoryView[]>('household_memory', { p_household: household });
export const forgetMemory = (household: string, id: string) => accountRpc<boolean>('household_memory_forget', { p_household: household, p_id: id });
export const correctMemory = (household: string, id: string, content: Record<string, unknown>) => accountRpc<MemoryView>('household_memory_correct', { p_household: household, p_id: id, p_content: content });
export const eraseIntelligence = (household: string) => accountRpc<Record<string, number>>('household_intel_erase', { p_household: household });

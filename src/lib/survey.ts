/**
 * Survey plumbing: talks to Supabase over its REST API with plain fetch (no SDK),
 * and holds the pure stats/CSV logic behind the admin view.
 *
 * Config (build time, public by design — see .env.example):
 *   PUBLIC_SUPABASE_URL       https://<project>.supabase.co
 *   PUBLIC_SUPABASE_ANON_KEY  the anon / publishable key (never the service_role key)
 * The anon key can only call survey_track and survey_submit; everything else
 * is locked down in supabase/migrations/*_customer_survey.sql.
 */
import { cleanAnswers, otherKey, surveyQuestions, type SurveyAnswers, type SurveySource } from '../data/survey';

const URL_ = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

export const surveyConfigured = () => Boolean(URL_ && KEY);

const DONE_KEY = 'omc:v1:survey:done';

/** Remembers that this browser finished the survey, so a revisit thanks her instead of asking again. */
export function markSurveyDone() {
  try {
    localStorage.setItem(DONE_KEY, new Date().toISOString().slice(0, 10));
  } catch {
    /* storage blocked: the server still ignores repeats of the same session */
  }
}

export function surveyDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) !== null;
  } catch {
    return false;
  }
}

export function newSessionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Older Safari: RFC 4122 v4 from getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function rpc(name: string, body: object, keepalive = false) {
  return fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  });
}

/** Progress beacon (0 = saw the intro, n = reached question n). Fire-and-forget. The source is kept from the first beacon. */
export function trackStep(session: string, step: number, source: SurveySource) {
  if (!surveyConfigured()) return;
  rpc('survey_track', { p_session: session, p_step: step, p_source: source }, true).catch(() => {
    /* analytics never gets in her way */
  });
}

export type SubmitResult = 'ok' | 'rate_limited' | 'invalid' | 'error';

export async function submitSurvey(session: string, answers: SurveyAnswers, website: string, source: SurveySource): Promise<SubmitResult> {
  if (!surveyConfigured()) return 'error';
  const payload = cleanAnswers(answers);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await rpc('survey_submit', { p_session: session, p_answers: payload, p_website: website, p_source: source });
      if (res.ok) {
        const result = (await res.json()) as SubmitResult;
        return result === 'ok' || result === 'rate_limited' || result === 'invalid' ? result : 'error';
      }
      if (res.status < 500) return 'error';
    } catch {
      /* network: retry once */
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return 'error';
}

// ------------------------------------------------------------------ admin

export interface AdminSession {
  access_token: string;
  expires_at: number;
  email: string;
}

export async function adminSignIn(email: string, password: string): Promise<AdminSession> {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(res.status === 400 ? 'That email and password didn’t match.' : `Sign-in failed (${res.status}).`);
  const data = await res.json();
  return { access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000, email: data.user?.email ?? email };
}

export interface SessionRow {
  id: string;
  created_at: string;
  furthest_step: number;
  completed_at: string | null;
  source: SurveySource;
}

export interface ResponseRow {
  session_id: string;
  created_at: string;
  q1: string[];
  q2: string;
  q3: string[];
  q4: string;
  q5: string;
  q6: string;
  q7: string | null;
  q1_other: string | null;
  q2_other: string | null;
  q3_other: string | null;
  q5_other: string | null;
  q6_other: string | null;
  source: SurveySource;
  duration_seconds: number | null;
}

/** Every row of a table between two dates (inclusive, YYYY-MM-DD, local time), paged past the API's row cap. */
async function selectAll<T>(token: string, table: string, columns: string, from?: string, to?: string): Promise<T[]> {
  const params = new URLSearchParams({ select: columns, order: 'created_at.asc' });
  if (from) params.append('created_at', `gte.${new Date(`${from}T00:00:00`).toISOString()}`);
  if (to) params.append('created_at', `lt.${new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString()}`);
  const rows: T[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    params.set('limit', String(page));
    params.set('offset', String(offset));
    const res = await fetch(`${URL_}/rest/v1/${table}?${params}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) throw new Error('expired');
    if (!res.ok) throw new Error(`Couldn’t load ${table} (${res.status}).`);
    const batch = (await res.json()) as T[];
    rows.push(...batch);
    if (batch.length < page) return rows;
  }
}

export async function loadSurveyData(token: string, from?: string, to?: string) {
  const [sessions, responses] = await Promise.all([
    selectAll<SessionRow>(token, 'survey_sessions', 'id,created_at,furthest_step,completed_at,source', from, to),
    selectAll<ResponseRow>(token, 'survey_responses', 'session_id,created_at,q1,q2,q3,q4,q5,q6,q7,q1_other,q2_other,q3_other,q5_other,q6_other,source,duration_seconds', from, to),
  ]);
  return { sessions, responses };
}

// ------------------------------------------------------------------ stats (pure)

export interface Funnel {
  /** Saw the intro. */
  views: number;
  /** Tapped "Let's do it". */
  starts: number;
  completions: number;
  /** completions / starts, 0–1. */
  completionRate: number;
  /** For each question: how many reached it, and how many left there without finishing. */
  steps: { step: number; label: string; reached: number; leftHere: number }[];
}

export function funnel(sessions: Pick<SessionRow, 'furthest_step'>[]): Funnel {
  const reached = (n: number) => sessions.filter((s) => s.furthest_step >= n).length;
  const starts = reached(1);
  const completions = reached(8);
  return {
    views: sessions.length,
    starts,
    completions,
    completionRate: starts ? completions / starts : 0,
    steps: surveyQuestions.map((q, i) => ({
      step: i + 1,
      label: q.short,
      reached: reached(i + 1),
      leftHere: sessions.filter((s) => s.furthest_step === i + 1).length,
    })),
  };
}

export interface OptionCount {
  id: string;
  label: string;
  count: number;
  /** Share of respondents, 0–1 (multi-select shares add up to more than 1). */
  share: number;
}

export function answerCounts(responses: ResponseRow[]) {
  return surveyQuestions.flatMap((q) => {
    if (q.kind === 'text') return [];
    const key = otherKey(q.id) as keyof ResponseRow;
    /** What "Something else" meant, newest first. */
    const otherTexts = responses
      .map((r) => ({ text: r[key] as string | null | undefined, at: r.created_at }))
      .filter((x): x is { text: string; at: string } => Boolean(x.text))
      .reverse();
    const counts: OptionCount[] = q.options.map((o) => {
      const count = responses.filter((r) => {
        const a = r[q.id];
        return Array.isArray(a) ? a.includes(o.id) : a === o.id;
      }).length;
      return { id: o.id, label: o.label, count, share: responses.length ? count / responses.length : 0 };
    });
    return [{ question: q, counts, otherTexts }];
  });
}

const csvCell = (v: string) => {
  // Neutralize spreadsheet formulas from free text, then quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function responsesCsv(responses: ResponseRow[]): string {
  // Each question, followed by its "Something else" text where it has that option.
  const hasOther = (q: (typeof surveyQuestions)[number]) => q.kind !== 'text' && q.options.some((o) => o.id === 'other');
  const header = [
    'submitted_at',
    'response_id',
    'source',
    ...surveyQuestions.flatMap((q) => [`${q.id} ${q.short}`, ...(hasOther(q) ? [`${q.id} something else`] : [])]),
    'seconds_to_complete',
  ];
  const rows = responses.map((r) => [
    r.created_at,
    r.session_id,
    r.source ?? '',
    ...surveyQuestions.flatMap((q) => {
      const a = r[q.id];
      if (q.kind === 'text') return [(a as string | null) ?? ''];
      const ids = Array.isArray(a) ? a : [a];
      const labels = ids.map((id) => q.options.find((o) => o.id === id)?.label ?? id).join('; ');
      return hasOther(q) ? [labels, (r[otherKey(q.id) as keyof ResponseRow] as string | null) ?? ''] : [labels];
    }),
    r.duration_seconds == null ? '' : String(r.duration_seconds),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

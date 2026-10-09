import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  adminSignIn,
  answerCounts,
  funnel,
  loadSurveyData,
  responsesCsv,
  surveyConfigured,
  type AdminSession,
  type ResponseRow,
  type SessionRow,
} from '../../lib/survey';

const TOKEN_KEY = 'omc:v1:survey-admin';
const pct = (x: number) => `${Math.round(x * 100)}%`;

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

/**
 * Survey results for signed-in admins (Supabase Auth users listed in
 * survey_admins). Row-level security does the protecting: without an admin
 * token the database returns nothing, whatever this page does.
 */
export default function SurveyAdmin() {
  const [auth, setAuth] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as AdminSession | null;
      if (saved && saved.expires_at > Date.now() + 60_000) setAuth(saved);
    } catch {
      /* sign in again */
    }
    setReady(true);
  }, []);

  const signOut = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing saved */
    }
    setAuth(null);
  };

  if (!ready) return null;
  if (!surveyConfigured()) {
    return <p className="mt-8 text-[1.0625rem]">Supabase isn’t configured for this build. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY (see .env.example).</p>;
  }
  if (!auth) {
    return (
      <SignIn
        onSignedIn={(s) => {
          try {
            sessionStorage.setItem(TOKEN_KEY, JSON.stringify(s));
          } catch {
            /* this tab only */
          }
          setAuth(s);
        }}
      />
    );
  }
  return <Dashboard auth={auth} onSignOut={signOut} />;
}

function SignIn({ onSignedIn }: { onSignedIn: (s: AdminSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignedIn(await adminSignIn(email.trim(), password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 max-w-sm space-y-4">
      <Field label="Email">
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Password">
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </Field>
      {error && (
        <p role="alert" className="text-[0.95rem] font-semibold">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

const inputClass = 'mt-1.5 block min-h-11 w-full rounded-[3px] border border-rule-strong bg-paper px-3 text-[1rem] focus:border-ink';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label text-soft">{label}</span>
      {children}
    </label>
  );
}

function Dashboard({ auth, onSignOut }: { auth: AdminSession; onSignOut: () => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<{ sessions: SessionRow[]; responses: ResponseRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    loadSurveyData(auth.access_token, from || undefined, to || undefined)
      .then((d) => live && setData(d))
      .catch((err: Error) => {
        if (!live) return;
        if (err.message === 'expired') onSignOut();
        else setError(err.message);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [auth.access_token, from, to]);

  const stats = useMemo(() => (data ? funnel(data.sessions) : null), [data]);
  const counts = useMemo(() => (data ? answerCounts(data.responses) : []), [data]);
  const stories = useMemo(() => (data ? data.responses.filter((r) => r.q7).reverse() : []), [data]);
  const medianSeconds = useMemo(() => {
    const t = (data?.responses ?? []).map((r) => r.duration_seconds).filter((x): x is number => x != null).sort((a, b) => a - b);
    return t.length ? t[Math.floor(t.length / 2)] : null;
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const blob = new Blob([responsesCsv(data.responses)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `survey-responses-${from || 'start'}-to-${to || isoDay(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const preset = (days: number | null) => {
    setFrom(days === null ? '' : daysAgo(days - 1));
    setTo('');
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.9rem] text-soft">
        <span>Signed in as {auth.email}</span>
        <button type="button" onClick={onSignOut} className="text-link">
          Sign out
        </button>
      </div>

      {/* Filters: one row above the numbers. */}
      <div className="mt-6 flex flex-wrap items-end gap-3 border-y border-rule py-4">
        <Field label="From">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </Field>
        <Field label="To">
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => preset(7)}>
            7 days
          </button>
          <button type="button" className="btn-secondary" onClick={() => preset(30)}>
            30 days
          </button>
          <button type="button" className="btn-secondary" onClick={() => preset(null)}>
            All time
          </button>
        </div>
        <button type="button" className="btn-primary ml-auto" onClick={exportCsv} disabled={!data?.responses.length}>
          Export CSV
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 font-semibold">
          {error}
        </p>
      )}
      {loading && !data && <p className="mt-6">Loading…</p>}

      {stats && data && (
        <div aria-busy={loading} className={loading ? 'opacity-60' : undefined}>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-rule bg-rule sm:grid-cols-4">
            <Stat label="Completed" value={String(stats.completions)} />
            <Stat label="Completion rate" value={stats.starts ? pct(stats.completionRate) : '—'} note={`of ${stats.starts} who started`} />
            <Stat label="Started" value={String(stats.starts)} note={stats.views ? `${pct(stats.starts / stats.views)} of ${stats.views} visits` : undefined} />
            <Stat label="Median time" value={medianSeconds == null ? '—' : `${Math.floor(medianSeconds / 60)}:${String(medianSeconds % 60).padStart(2, '0')}`} note="min:sec" />
          </dl>

          <h2 className="section-title mt-14 text-[1.4rem] sm:text-[1.6rem]">Where people stop</h2>
          <p className="mt-2 text-[0.95rem] text-soft">“Left here” = reached this question and never sent the survey. Shares are of everyone who started.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-[0.95rem]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <Th>Question</Th>
                  <Th right>Reached</Th>
                  <Th right>Left here</Th>
                  <Th right>Drop-off</Th>
                </tr>
              </thead>
              <tbody>
                {stats.steps.map((s) => (
                  <tr key={s.step} className="border-b border-rule">
                    <td className="py-2.5 pr-3">
                      <span className="text-soft tabular-nums">Q{s.step}</span> {s.label}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{s.reached}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{s.leftHere}</td>
                    <td className="py-2.5 text-right tabular-nums">{stats.starts ? pct(s.leftHere / stats.starts) : '—'}</td>
                  </tr>
                ))}
                <tr className="border-b border-rule font-semibold">
                  <td className="py-2.5 pr-3">Sent</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{stats.completions}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.85rem] text-soft">{stats.views - stats.starts} visits saw the intro and didn’t start.</p>

          <h2 className="section-title mt-14 text-[1.4rem] sm:text-[1.6rem]">Answers</h2>
          <p className="mt-2 text-[0.95rem] text-soft">
            {data.responses.length} completed responses. Q1 and Q3 allow several answers, so their shares add up to more than 100%.
          </p>
          {counts.map(({ question, counts: rows }) => (
            <section key={question.id} className="mt-8">
              <h3 className="text-[1.05rem] leading-snug font-bold">
                <span className="text-soft">{question.id.toUpperCase()}</span> {question.prompt}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {[...rows]
                  .sort((a, b) => b.count - a.count)
                  .map((r) => (
                    <li key={r.id}>
                      <div className="flex items-baseline justify-between gap-3 text-[0.95rem]">
                        <span>{r.label}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className="font-semibold">{r.count}</span> <span className="text-soft">· {pct(r.share)}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-band" aria-hidden="true">
                        {r.count > 0 && <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(r.share * 100, 1)}%` }} />}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}

          <h2 className="section-title mt-14 text-[1.4rem] sm:text-[1.6rem]">What slipped through the cracks</h2>
          <p className="mt-2 text-[0.95rem] text-soft">
            {stories.length} of {data.responses.length} answered the open question. Newest first.
          </p>
          {stories.length === 0 ? (
            <p className="mt-4">Nothing yet for these dates.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {stories.map((r) => (
                <li key={r.session_id} className="border-l-[3px] border-month bg-band px-4 py-3">
                  <p className="text-[1rem] leading-relaxed whitespace-pre-line">{r.q7}</p>
                  <p className="mt-2 text-[0.8rem] text-soft">{new Date(r.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-paper px-4 py-4">
      <dt className="label text-soft">{label}</dt>
      <dd className="mt-1.5 text-[1.9rem] leading-none font-bold tabular-nums">{value}</dd>
      {note && <dd className="mt-1.5 text-[0.8rem] text-soft">{note}</dd>}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`py-2 pr-3 text-[0.68rem] font-semibold tracking-[0.16em] uppercase ${right ? 'text-right' : ''}`}>{children}</th>;
}

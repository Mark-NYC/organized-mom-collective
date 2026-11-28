/**
 * /admin/club → Pilot (owner admins): the pilot funnel as numbers (pilot_funnel) and what testers told us from inside
 * the app, with the screen they were on (pilot_feedback). Both are owner-checked database functions
 * (supabase/migrations/20261216000000_household_intelligence_engine.sql, 20261210000000_app_feedback.sql); nothing here shows a family's data. docs/pilot/ANALYTICS.md.
 */
import { useEffect, useState } from 'react';
import { adminInput, type AdminContext } from './AdminGate';
import { adminRpc } from '../../lib/admin/session';

export const FUNNEL_ROWS: [string, string][] = [
  ['accounts_created', 'Accounts created'],
  ['onboarding_started', 'Started family setup'],
  ['onboarding_completed', 'Finished family setup'],
  ['first_meaningful_action', 'First useful action (cleaning, a plan or an agreement)'],
  ['first_responsibility', 'First family responsibility'],
  ['meeting_started', 'Started a Family Meeting'],
  ['meeting_completed', 'Finished a Family Meeting'],
  ['second_adult_invited', 'Invited the other grown-up'],
  ['second_adult_joined', 'Other grown-up joined'],
  ['returned_day_1', 'Came back the next day'],
  ['returned_day_7', 'Came back in week 2'],
  ['returned_day_30', 'Came back after a month'],
  ['club_preview_viewed', 'Looked at the Club preview'],
  ['club_trial_started', 'Started a Club trial'],
  ['club_subscribed', 'Subscribed to the Club'],
  ['feedback_sent', 'Sent feedback'],
];
interface Feedback { reference: string; at: string; status: string; email: string; kind: string; screen: string; platform: string; width: string; message: string }
const KIND: Record<string, string> = { confusing: 'Confusing', broken: 'Not working', idea: 'Idea' };
const daysAgo = (n: number) => new Date(Date.now() - n * 86400e3).toLocaleDateString('en-CA');

export default function PilotAdmin({ session, signOut }: AdminContext) {
  const [since, setSince] = useState(daysAgo(30));
  const [funnel, setFunnel] = useState<Record<string, unknown> | null>(null);
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [err, setErr] = useState('');
  const load = async () => {
    setErr('');
    try {
      const [f, fb] = await Promise.all([adminRpc<Record<string, unknown>>(session, 'pilot_funnel', { p_since: since }), adminRpc<Feedback[]>(session, 'pilot_feedback', { p_since: since })]);
      setFunnel(f); setFeedback(fb);
    } catch (e) { if ((e as Error).message === 'expired') signOut(); else setErr('Couldn’t load the pilot numbers. Is the 20261210 migration applied?'); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const screens = Object.entries((feedback ?? []).reduce<Record<string, number>>((a, f) => ({ ...a, [f.screen]: (a[f.screen] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  return (
    <div data-pilot-admin>
      <p className="text-[0.9rem] text-soft">How pilot families get on: numbers only, from accounts created since the date below (demo accounts left out), and what they told us from the app.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <label className="block"><span className="label">Since</span><input type="date" className={adminInput} value={since} onChange={(e) => setSince(e.target.value)} data-pilot-since /></label>
        <button type="submit" className="btn-primary">Show</button>
      </form>
      {err && <p role="alert" className="mt-3">{err}</p>}
      {funnel && (
        <table className="mt-5 w-full max-w-xl text-left text-[0.92rem]" data-pilot-funnel>
          <tbody>
            {FUNNEL_ROWS.map(([k, label]) => (
              <tr key={k} className="border-b border-rule"><td className="py-1.5">{label}</td><td className="text-right font-semibold" data-funnel={k}>{String(funnel[k] ?? 0)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {feedback && (
        <section className="mt-8" aria-labelledby="pilot-feedback-h">
          <h3 id="pilot-feedback-h" className="font-semibold">Feedback from the app ({feedback.length})</h3>
          {screens.length > 0 && <p className="mt-1 text-[0.88rem] text-soft" data-pilot-screens>Most mentioned: {screens.slice(0, 5).map(([s, n]) => `${s} (${n})`).join(' · ')}</p>}
          {feedback.length === 0 ? <p className="mt-2 text-soft">Nothing yet.</p> : (
            <ul className="mt-3 space-y-3" data-pilot-feedback>
              {feedback.map((f) => (
                <li key={f.reference} className="border-b border-rule pb-3">
                  <p className="text-[0.82rem] text-soft">{new Date(f.at).toLocaleString()} · {KIND[f.kind] ?? f.kind} · {f.screen} · {f.platform === 'ios' ? 'iPhone app' : 'website'} · {f.width}px · {f.reference} · <a className="underline" href={`mailto:${f.email}?subject=${encodeURIComponent(`Your feedback ${f.reference}`)}`}>{f.email}</a></p>
                  <p className="mt-1 whitespace-pre-wrap">{f.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

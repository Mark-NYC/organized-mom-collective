/**
 * /app/feedback: pilot feedback from inside the app (website and iPhone app). Three kinds, a sentence or two, sent as a
 * support request through app_feedback (supabase/migrations/20261210000000_app_feedback.sql) with only where it came
 * from (the screen's path, platform, screen width). Nothing about the family is attached. docs/pilot/PILOT_TESTING.md.
 */
import { track } from '../../lib/app/events';
import { useEffect, useState } from 'react';
import { accountRpc, loadSession } from '../../lib/account';
import { appShellBuild } from '../../lib/native/platform';

const KINDS = [
  { id: 'confusing', label: 'Something’s confusing' },
  { id: 'broken', label: 'Something isn’t working' },
  { id: 'idea', label: 'An idea or wish' },
] as const;
type Kind = (typeof KINDS)[number]['id'];

/** The screen she came from: ?from=/app/cleaning (set by the links), never a full URL. */
export function screenFrom(search: string): string {
  const from = new URLSearchParams(search).get('from') ?? '';
  return /^\/[a-z0-9/_-]{0,79}$/.test(from) ? from : '/app';
}
const NAMES: Record<string, string> = {
  '/app': 'Today', '/app/family-calendar': 'Calendar', '/app/cleaning': 'Cleaning', '/app/family': 'Family',
  '/app/family/meeting': 'the Family Meeting', '/app/family/setup': 'family setup', '/app/club': 'Club', '/app/account': 'Account',
};

export default function AppFeedback() {
  const [screen] = useState(() => (typeof location === 'undefined' ? '/app' : screenFrom(location.search)));
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  useEffect(() => setSignedIn(Boolean(loadSession())), []);

  const send = async () => {
    setErr('');
    if (!kind) return setErr('Pick what kind of feedback it is.');
    if (text.trim().length < 10) return setErr('Tell us a little more: a sentence is plenty.');
    setState('sending');
    try {
      await accountRpc('app_feedback', { p_kind: kind, p_message: text.trim(), p_screen: screen, p_platform: appShellBuild() ? 'ios' : 'web', p_width: Math.round(window.innerWidth) });
      setState('sent');
      track('feedback_sent'); // the moment only, never the message
    } catch (e) {
      setState('error');
      setErr((e as Error).message === 'rate_limited' ? 'That’s a lot of messages today. Try again tomorrow.' : 'We couldn’t send it just now. Check your connection and try again.');
    }
  };

  if (signedIn === null) return null;
  if (!signedIn) {
    return (
      <div data-feedback-signed-out>
        <p className="of-page-lede">Sign in first, so we can reply if we need to.</p>
        <a href={`/app/sign-in?next=${encodeURIComponent(`/app/feedback?from=${screen}`)}`} className="of-btn mt-4">Sign in</a>
      </div>
    );
  }
  if (state === 'sent') {
    return (
      <div role="status" data-feedback-sent>
        <h2 className="of-tile-title">Thank you. We read every one.</h2>
        <p className="of-page-lede">It helps us make the app simpler for every family.</p>
        <a href={screen} className="of-btn mt-5">Back to {NAMES[screen] ?? 'the app'}</a>
      </div>
    );
  }
  return (
    <form className="max-w-xl" onSubmit={(e) => { e.preventDefault(); void send(); }} data-feedback-form>
      <fieldset>
        <legend className="of-eyebrow">What is it?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}
              className={`min-h-11 rounded-full border px-4 text-[0.95rem] ${kind === k.id ? 'border-warm-ink bg-warm-ink text-white' : 'border-[var(--of-rule-strong)] bg-white text-warm-ink'}`}
              data-feedback-kind={k.id}>{k.label}</button>
          ))}
        </div>
      </fieldset>
      <label className="mt-6 block">
        <span className="of-eyebrow">What happened?</span>
        <span className="mt-1 block text-[0.9rem] text-warm-soft">In your own words. You don’t need any technical details: we can see you were on {NAMES[screen] ?? 'the app'}.</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={3800}
          className="mt-2 block w-full rounded-[8px] border border-[var(--of-rule-strong)] bg-white p-3 text-[1rem] text-warm-ink" data-feedback-text />
      </label>
      {err && <p role="alert" className="mt-3 text-[0.95rem]" data-feedback-error>{err}</p>}
      <button type="submit" className="of-btn mt-5" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send feedback'}</button>
      <p className="mt-3 text-[0.85rem] text-warm-soft">We get your message, your email (to reply) and which screen you were on. Nothing about your family.</p>
    </form>
  );
}

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  adminConfigured,
  adminRpc,
  auditLog,
  clearSession,
  cleanCode,
  createAdminAuth,
  isCode,
  loadSession,
  markActive,
  needsRefresh,
  saveSession,
  type AdminSession,
  type Enrollment,
  type Factor,
} from '../../lib/admin/session';

const auth = createAdminAuth();
export const adminInput = 'mt-1.5 block min-h-11 w-full rounded-[3px] border border-rule-strong bg-paper px-3 text-[1rem] focus:border-ink';

export interface AdminContext {
  /** Kept current in place when the token refreshes, so read `session.access_token` at call time. */
  session: AdminSession;
  role: string | null;
  signOut: () => void;
  /** False until the admin database migration is applied (supabase/ADMIN.md). */
  databaseReady: boolean;
}

type Step =
  | { kind: 'loading' }
  | { kind: 'signin' }
  | { kind: 'enroll'; enrollment: Enrollment }
  | { kind: 'verify'; factor: Factor }
  | { kind: 'denied' }
  | { kind: 'ready'; role: string | null; databaseReady: boolean };

/**
 * Signs in to /admin: email + password, then an authenticator code. The first sign-in adds the
 * authenticator (QR code). Children render only with an MFA-verified session; the database and
 * Edge Functions refuse anything less, whatever this component does.
 */
export default function AdminGate({ children }: { children: (ctx: AdminContext) => React.ReactNode }) {
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [error, setError] = useState('');
  const session = useRef<AdminSession | null>(null);

  const store = (s: AdminSession) => {
    if (session.current) Object.assign(session.current, s);
    else session.current = { ...s };
    saveSession(session.current);
  };

  const signOut = (why = '') => {
    void auth.signOut(session.current);
    session.current = null;
    clearSession();
    setError(why);
    setStep({ kind: 'signin' });
  };

  /** After the password: verify or add the authenticator. */
  const secondFactor = async (s: AdminSession) => {
    const factors = await auth.factors(s);
    const verified = factors.find((f) => f.status === 'verified');
    if (verified) setStep({ kind: 'verify', factor: verified });
    else setStep({ kind: 'enroll', enrollment: await auth.enroll(s, factors) });
  };

  /** With an aal2 session: is this account an admin? */
  const finish = async (s: AdminSession, fresh: boolean) => {
    try {
      const who = await adminRpc<{ admin: boolean; role: string | null }>(s, 'admin_whoami');
      if (!who.admin) {
        setStep({ kind: 'denied' });
        return;
      }
      if (fresh) void auditLog(s, 'admin.sign_in');
      setStep({ kind: 'ready', role: who.role, databaseReady: true });
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.message === 'expired') return signOut('Your session ended. Sign in again.');
      // 404: admin_whoami doesn't exist yet (migration not applied). Row-level security still decides.
      if (e.status === 404) setStep({ kind: 'ready', role: null, databaseReady: false });
      else setError(`Couldn’t check your account: ${e.message}`);
    }
  };

  useEffect(() => {
    if (!adminConfigured()) return;
    const saved = loadSession();
    if (!saved) {
      setStep({ kind: 'signin' });
      return;
    }
    (async () => {
      try {
        const s = needsRefresh(saved) ? await auth.refresh(saved) : saved;
        store(s);
        if (s.aal === 'aal2') await finish(session.current!, false);
        else await secondFactor(session.current!);
      } catch {
        signOut();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the token fresh, sign out when idle, and note activity.
  useEffect(() => {
    if (step.kind !== 'ready') return;
    let last = 0;
    const active = () => {
      const now = Date.now();
      if (now - last > 30_000) {
        last = now;
        markActive();
      }
    };
    const tick = async () => {
      if (!session.current) return;
      if (!loadSession()) return signOut('Signed out after 30 minutes without activity.');
      if (needsRefresh(session.current)) {
        try {
          store(await auth.refresh(session.current));
        } catch {
          signOut('Your session ended. Sign in again.');
        }
      }
    };
    const timer = setInterval(tick, 60_000);
    window.addEventListener('pointerdown', active);
    window.addEventListener('keydown', active);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', active);
      window.removeEventListener('keydown', active);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  if (!adminConfigured()) {
    return <p className="mt-8 text-[1.0625rem]">Supabase isn’t configured for this build. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY (see .env.example).</p>;
  }
  if (step.kind === 'loading') return <p className="mt-8 text-muted">Loading…</p>;

  if (step.kind === 'ready' && session.current) {
    return (
      <>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem] text-muted">
          <span>Signed in as {session.current.email}</span>
          <button type="button" className="text-link" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
        {!step.databaseReady && (
          <p role="status" className="mt-4 rounded-[3px] bg-band p-4 text-[0.95rem]">
            <strong>Database update pending.</strong> The admin migration isn’t applied yet, so sections that need it show as unavailable. Steps: supabase/ADMIN.md.
          </p>
        )}
        {children({ session: session.current, role: step.role, signOut: () => signOut(), databaseReady: step.databaseReady })}
      </>
    );
  }

  return (
    <div className="mt-8 max-w-sm">
      {step.kind === 'signin' && (
        <PasswordForm
          error={error}
          onSubmit={async (email, password) => {
            setError('');
            const s = await auth.signIn(email, password);
            session.current = null;
            store(s);
            await secondFactor(session.current!);
          }}
        />
      )}
      {step.kind === 'enroll' && (
        <>
          <h2 className="text-[1.25rem] font-bold">Add an authenticator app</h2>
          <p className="mt-2 text-[0.95rem]">
            The admin needs a second step at every sign-in. Scan this with an authenticator app (1Password, Google Authenticator, Authy…), then type the
            6-digit code it shows.
          </p>
          <img src={step.enrollment.qr} alt="QR code for your authenticator app" width={200} height={200} className="mt-4 h-[200px] w-[200px] bg-paper" />
          <details className="mt-2 text-[0.9rem]">
            <summary className="cursor-pointer">Can’t scan? Enter this key instead</summary>
            <code className="mt-1 block break-all select-all">{step.enrollment.secret}</code>
          </details>
          <CodeForm
            error={error}
            onSubmit={async (code) => {
              setError('');
              store(await auth.verify(session.current!, step.enrollment.id, code));
              void auditLog(session.current!, 'admin.mfa_enrolled');
              await finish(session.current!, true);
            }}
          />
        </>
      )}
      {step.kind === 'verify' && (
        <>
          <h2 className="text-[1.25rem] font-bold">Authenticator code</h2>
          <p className="mt-2 text-[0.95rem]">Open your authenticator app and type the 6-digit code for Organized Mom Collective.</p>
          <CodeForm
            error={error}
            onSubmit={async (code) => {
              setError('');
              store(await auth.verify(session.current!, step.factor.id, code));
              await finish(session.current!, true);
            }}
          />
        </>
      )}
      {step.kind === 'denied' && (
        <>
          <p role="alert" className="text-[1.0625rem] font-semibold">
            This account isn’t an admin.
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => signOut()}>
            Sign out
          </button>
        </>
      )}
      {(step.kind === 'enroll' || step.kind === 'verify') && (
        <button type="button" className="text-link mt-6 text-[0.9rem]" onClick={() => signOut()}>
          Cancel and sign out
        </button>
      )}
    </div>
  );
}

function useSubmit(run: () => Promise<void>, setLocalError: (e: string) => void) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setLocalError('');
    try {
      await run();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, submit };
}

function PasswordForm({ error, onSubmit }: { error: string; onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { busy, submit } = useSubmit(() => onSubmit(email.trim(), password), setLocalError);
  const shown = localError || error;
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="label text-soft">Email</span>
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={adminInput} />
      </label>
      <label className="block">
        <span className="label text-soft">Password</span>
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={adminInput} />
      </label>
      {shown && (
        <p role="alert" className="text-[0.95rem] font-semibold">
          {shown}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function CodeForm({ error, onSubmit }: { error: string; onSubmit: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const { busy, submit } = useSubmit(() => onSubmit(cleanCode(code)), setLocalError);
  const shown = localError || error;
  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <label className="block">
        <span className="label text-soft">6-digit code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${adminInput} tracking-[0.3em]`}
        />
      </label>
      {shown && (
        <p role="alert" className="text-[0.95rem] font-semibold">
          {shown}
        </p>
      )}
      <button type="submit" disabled={busy || !isCode(code)} className="btn-primary w-full">
        {busy ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}

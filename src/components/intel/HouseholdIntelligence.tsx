/**
 * Household intelligence: consent and controls (docs/intelligence/STAGE_B_REPORT.md → Consent).
 *
 *  - 'onboarding' (after the family is created): one explicit, understandable choice about AI help. Off unless she
 *    says yes. Learning from what the family does is explained in the same card, with where to change it.
 *  - 'account' (Account): learning on/off, AI help on/off (turning it off erases what the AI worked out), this adult's
 *    own personal-calendar consent (individual: the other grown-up decides for themselves), what has been learned with
 *    Confirm / Forget / change the day, and erase everything.
 *
 * Everything the app does works the same with all of it off (the deterministic rules). If the database doesn't have
 * the engine yet, the component renders nothing.
 */
import { useEffect, useState } from 'react';
import { AI_CONSENT_VERSION, eraseIntelligence, forgetMemory, correctMemory, householdMemory, intelSettings, type IntelSettings, type MemoryView } from '../../lib/intel/client';
import { describeMemory, statusLine } from '../../lib/intel/describe';
import { accountRpc } from '../../lib/account';

/** The words she agrees to. Changing their meaning means bumping AI_CONSENT_VERSION (lib/intel/client.ts). */
export const AI_CONSENT = {
  title: 'AI help (optional)',
  body: [
    'We’re getting AI help ready to read the names of your plans, like “Maya’s recital” or “Grandpa’s birthday,” so the suggestions on Today can be more specific to your family.',
    'If you say yes, only plan names are sent to our AI provider, with people’s names swapped for codes. Never descriptions, notes, addresses, or your children’s ages. It isn’t used to train anyone’s AI.',
    'It stays off unless you turn it on, and you can turn it off anytime in Account. Turning it off also erases what the AI worked out. Everything else works the same either way.',
  ],
  learning: 'Organized Family also learns your family’s rhythms from what you do here, like which day practice usually is, so Today can get ahead of it. You can see it, correct it or erase it in Account.',
};

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HouseholdIntelligence({ household, mode, names = {} }: { household: string; mode: 'onboarding' | 'account'; names?: Record<string, string> }) {
  const [st, setSt] = useState<IntelSettings | null>(null);
  const [mem, setMem] = useState<MemoryView[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [answered, setAnswered] = useState(false);
  const [erase, setErase] = useState(false);

  useEffect(() => {
    let live = true;
    intelSettings(household).then((s) => { if (live) setSt(s); }).catch(() => undefined); // no engine yet: render nothing
    if (mode === 'account') householdMemory(household).then((m) => { if (live) setMem(m ?? []); }).catch(() => undefined);
    return () => { live = false; };
  }, [household, mode]);

  if (!st) return null;
  const patch = async (p: Parameters<typeof intelSettings>[1], done?: string) => {
    setBusy(true); setNote('');
    try {
      setSt(await intelSettings(household, p));
      if (p && ('personal_calendars' in p || 'ai_enabled' in p || 'learning_enabled' in p)) setMem(await householdMemory(household).catch(() => mem));
      if (done) setNote(done);
    } catch { setNote('That didn’t save. Check your connection and try again.'); }
    setBusy(false);
  };

  if (mode === 'onboarding') {
    if (answered || st.ai_consented_at) return answered ? <p role="status" className="text-sm text-warm-soft" data-ai-consent-answered>{st.ai_enabled ? 'AI help is on. You can turn it off in Account.' : 'No AI help. You can change this in Account anytime.'}</p> : null;
    return (
      <section className="family-note" aria-labelledby="ai-consent-h" data-ai-consent="onboarding">
        <h2 id="ai-consent-h" className="text-base font-semibold">{AI_CONSENT.title}</h2>
        {AI_CONSENT.body.map((p) => <p key={p} className="mt-2 text-sm leading-relaxed">{p}</p>)}
        <p className="mt-2 text-sm leading-relaxed text-warm-soft">{AI_CONSENT.learning}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="family-action" disabled={busy} onClick={async () => { await patch({ ai_enabled: true }); setAnswered(true); }} data-ai-consent-yes>Yes, use AI help</button>
          <button type="button" className="family-link min-h-[48px]" disabled={busy} onClick={() => setAnswered(true)} data-ai-consent-no>Not now</button>
        </div>
        {note && <p role="alert" className="mt-3 text-sm">{note}</p>}
      </section>
    );
  }

  const confirm = async (m: MemoryView) => {
    setBusy(true);
    try {
      await accountRpc('household_memory_confirm', { p_household: household, p: { category: m.category, subject_key: m.subject_key, content: m.content, cadence: m.cadence, private: m.private ?? false } });
      setMem(await householdMemory(household));
    } catch { setNote('That didn’t save. Try again.'); }
    setBusy(false);
  };
  const forget = async (m: MemoryView) => {
    setBusy(true);
    try { await forgetMemory(household, m.id); setMem((xs) => xs.filter((x) => x.id !== m.id)); } catch { setNote('That didn’t save. Try again.'); }
    setBusy(false);
  };
  const moveDay = async (m: MemoryView, day: string) => {
    setBusy(true);
    try { await correctMemory(household, m.id, { ...m.content, anchor: day }); setMem(await householdMemory(household)); } catch { setNote('That didn’t save. Try again.'); }
    setBusy(false);
  };

  return (
    <div className="v16-section" data-household-intelligence>
      <h2 className="v16-h3">Household intelligence</h2>
      <p className="v16-meta mt-1">How Organized Family learns your family’s rhythms. Everything works with all of this off.</p>
      <ul className="v16-rows mt-2">
        <li className="v16-row">
          <label className="v16-row-main flex items-center justify-between gap-3">
            <span><span className="block">Learn our family’s rhythms</span><span className="v16-meta">From what you do here: which day practice is, who usually covers what. Off: nothing new is learned.</span></span>
            <input type="checkbox" className="v20-switch" checked={st.learning_enabled} disabled={busy} onChange={(e) => patch({ learning_enabled: e.target.checked })} data-intel-learning />
          </label>
        </li>
        <li className="v16-row">
          <label className="v16-row-main flex items-center justify-between gap-3">
            <span><span className="block">{AI_CONSENT.title.replace(' (optional)', '')}</span><span className="v16-meta">Off unless you turn it on. Only plan names go to our AI provider, with people’s names swapped for codes; never descriptions, notes, addresses or your children’s ages. Turning it off erases what the AI worked out.</span></span>
            <input type="checkbox" className="v20-switch" checked={st.ai_enabled} disabled={busy} onChange={(e) => patch({ ai_enabled: e.target.checked }, e.target.checked ? 'AI help is on.' : 'AI help is off, and what it worked out is erased.')} data-intel-ai />
          </label>
        </li>
        <li className="v16-row">
          <label className="v16-row-main flex items-center justify-between gap-3">
            <span><span className="block">Learn from my personal calendars</span><span className="v16-meta">Just you: the other grown-up decides for themselves. What’s learned from them is visible only to you.</span></span>
            <input type="checkbox" className="v20-switch" checked={st.personal_calendars} disabled={busy} onChange={(e) => patch({ personal_calendars: e.target.checked }, e.target.checked ? undefined : 'Done. What was learned from your personal calendars is erased.')} data-intel-personal />
          </label>
        </li>
      </ul>
      {st.ai_consented_at && <p className="v16-meta mt-1" data-ai-consent-record>AI help {st.ai_enabled ? 'agreed' : 'last agreed'} on {st.ai_consented_at.slice(0, 10)} (consent version {st.ai_consent_version ?? AI_CONSENT_VERSION}).</p>}

      <h3 className="v16-h3 mt-4">Rhythms we’ve noticed</h3>
      {!mem.length && <p className="v16-meta mt-1">Nothing yet. A rhythm shows up only after it’s happened a few times, and you can confirm, fix or forget each one here.</p>}
      <ul className="v16-rows">{mem.map((m) => (
        <li key={m.id} className="v16-row" data-intel-memory={m.status}>
          <span className="v16-row-main"><span className="block">{describeMemory(m, names)}</span><span className="v16-meta">{statusLine(m)}{m.private ? ' · only you see this' : ''}</span>
            {(m.cadence === 'weekly' || m.cadence === 'biweekly') && (
              <label className="v16-meta mt-1 block">Wrong day?{' '}
                <select className="v16-input" value={String(m.content.anchor ?? '')} disabled={busy} onChange={(e) => moveDay(m, e.target.value)} data-intel-day>
                  {WEEKDAY.map((d, i) => <option key={d} value={String(i)}>{d}</option>)}
                </select>
              </label>
            )}
          </span>
          {m.status !== 'confirmed' && <button type="button" className="v16-link" disabled={busy} onClick={() => confirm(m)} data-intel-confirm>That’s right</button>}
          <button type="button" className="v16-link" disabled={busy} onClick={() => forget(m)} data-intel-forget>Forget</button>
        </li>
      ))}</ul>

      <div className="mt-4">
        {!erase
          ? <button type="button" className="v16-link" onClick={() => setErase(true)} data-intel-erase>Erase everything learned</button>
          : <p className="text-sm">Erase everything learned about your family, for both grown-ups? Your calendar, agreements and plans stay.{' '}
              <button type="button" className="v16-link" disabled={busy} onClick={async () => { setBusy(true); try { await eraseIntelligence(household); setMem([]); setNote('Erased.'); } catch { setNote('That didn’t erase. Try again.'); } setBusy(false); setErase(false); }} data-intel-erase-yes>Erase</button>{' '}
              <button type="button" className="v16-link" onClick={() => setErase(false)}>Keep it</button></p>}
      </div>
      {note && <p role="status" className="v16-meta mt-2" data-intel-note>{note}</p>}
    </div>
  );
}

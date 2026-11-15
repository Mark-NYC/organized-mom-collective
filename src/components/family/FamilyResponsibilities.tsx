/**
 * /app/family/responsibilities: who does what in this family, from the one household profile.
 *
 * - Agreed by our family: the agreements made with "We agreed" in the Family Meeting. Either grown-up can edit the
 *   words, reassign them to other people (stable family-member ids) or remove them. Saved to the household
 *   (household_agreement_save / _remove; supabase/migrations/20261127000000_family_agreements.sql).
 * - Already doing: the responsibilities from the family profile. Shown here, changed on the family page as before.
 *
 * Suggestions never appear here: an agreement exists only because someone tapped "We agreed".
 */
import { useState } from 'react';
import { useCalendar, isDemo } from '../../lib/calendar/client';
import { changeAgreement, useFamilyProfileState } from '../../lib/family-meeting-client';
import { taskLabel } from '../../lib/club/family-meeting';
import type { Responsibility } from '../../lib/club/family-profile';
import type { MarkerColor } from '../../data/club/family-colors';
import type { FamilyMember } from '../../lib/club/profile';

const ERRORS: Record<string, string> = {
  invalid: 'That didn’t save: give it some words and at least one person from your family.',
  not_found: 'Someone already changed or removed this one. It’s been refreshed.',
  not_signed_in: 'Sign in to change your family’s agreements.',
};
const errorText = (e: unknown) => ERRORS[(e as Error).message] ?? 'That didn’t save. Check your connection and try again.';

export default function FamilyResponsibilities() {
  const cal = useCalendar();
  const scope = cal.state.scope !== 'local' ? cal.state.scope : null;
  const [profile, setProfile] = useFamilyProfileState(scope);
  const [msg, setMsg] = useState('');
  const people = (cal.household?.members ?? []).filter((m) => !m.archived && m.firstName.trim());
  const agreed = (profile?.responsibilities ?? []).filter((r) => r.status === 'confirmed' && r.id);
  const existing = (profile?.responsibilities ?? []).filter((r) => r.status === 'existing');

  const run = async (change: Parameters<typeof changeAgreement>[1], done: string) => {
    setMsg('');
    try {
      setProfile(await changeAgreement(scope, change));
      setMsg(done);
      return true;
    } catch (e) {
      setMsg(errorText(e));
      return false;
    }
  };

  return (
    <div className="family-brand mx-auto max-w-3xl space-y-8" data-family-responsibilities>
      <header>
        <a href="/app/family" className="family-link !min-h-0">← Family</a>
        <p className="label mt-5 text-[#71866c]">FAMILY RESPONSIBILITIES</p>
        <h1 className="family-title mt-3 !text-[2.1rem]">Who does what.</h1>
        <p className="family-lede mt-3">What your family agreed in your Family Meeting, and what everyone already does.</p>
      </header>
      {isDemo() && (
        <div className="family-note" data-responsibilities-demo><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm">A made-up family, to show how this page works. Changes stay in this tab. <a href="/app/family/responsibilities" className="underline">Leave the demo</a>.</p></div>
      )}
      {!cal.household ? (
        <section className="family-panel">
          <h2 className="family-panel-title">Sign in to see your family</h2>
          <p className="mt-2 text-sm text-warm-soft">Your family’s responsibilities are kept with your household, shared by the grown-ups in your home.</p>
          <a href="/app/account" className="family-link mt-4">Go to your account →</a>
        </section>
      ) : (
        <>
          <p role="status" className="text-sm text-[#536e4e]" data-responsibilities-status>{msg}</p>
          <section aria-labelledby="agreed-h">
            <p id="agreed-h" className="label text-[#71866c]">AGREED BY OUR FAMILY</p>
            {agreed.length ? (
              <ul className="mt-3 space-y-3">
                {agreed.map((r) => (
                  <Agreement key={r.id} r={r} people={people} colors={cal.colors}
                    onSave={(text, ownerIds, when) => run({ save: { id: r.id, category: r.category, text, ownerIds, ...(r.agreement?.finished ? { finished: r.agreement.finished } : {}), ...(when.trim() ? { when } : {}) } }, 'Saved.')}
                    onRemove={() => run({ remove: r.id! }, 'Removed.')} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-warm-soft" data-no-agreements>Nothing agreed yet. In your Family Meeting’s Everyone’s Part, tap “We agreed” next to a part your family says yes to.</p>
            )}
          </section>
          <section aria-labelledby="existing-h">
            <p id="existing-h" className="label text-[#71866c]">ALREADY DOING</p>
            {existing.length ? (
              <ul className="mt-3 space-y-1.5 text-[0.95rem]">
                {existing.map((r, i) => (
                  <li key={r.id ?? i}>{taskLabel(r)} <span className="text-sm text-warm-soft">· {names(r.ownerIds, people) || 'not assigned yet'}{r.helperIds.length ? `, ${names(r.helperIds, people)} helps` : ''}</span></li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-warm-soft">Nothing listed yet.</p>}
            {!isDemo() && <a href="/club/family" className="family-link mt-4">Change these on your family page →</a>}
          </section>
        </>
      )}
    </div>
  );
}

const names = (ids: string[], people: FamilyMember[]) => ids.map((id) => people.find((m) => m.id === id)?.firstName).filter(Boolean).join(' and ');

function Agreement({ r, people, colors, onSave, onRemove }: {
  r: Responsibility; people: FamilyMember[]; colors: Record<string, MarkerColor>;
  onSave: (text: string, ownerIds: string[], when: string) => Promise<boolean>; onRemove: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(r.agreement?.text ?? taskLabel(r));
  const [owners, setOwners] = useState<string[]>(r.ownerIds);
  const [when, setWhen] = useState(r.agreement?.when ?? '');
  const shown = r.agreement?.text ?? `Takes care of ${taskLabel(r).toLowerCase()}`;
  const toggle = (id: string) => setOwners((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <li className="bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]" data-agreement-row={shown}>
      {!editing ? (
        <>
          <p className="font-semibold text-warm-ink">{shown}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-warm-soft">
            {r.ownerIds.map((id) => {
              const m = people.find((x) => x.id === id);
              return m ? <span key={id} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colors[id]?.hex }} />{m.firstName}</span> : null;
            })}
            {r.agreement?.when && <span>· {r.agreement.when}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5">
            <button type="button" className="family-link !min-h-[44px]" onClick={() => setEditing(true)} data-edit-agreement>Edit or reassign</button>
            {!confirming
              ? <button type="button" className="family-link !min-h-[44px]" onClick={() => setConfirming(true)} data-remove-agreement>Remove</button>
              : <span className="inline-flex items-center gap-3 text-sm">Remove this agreement?
                  <button type="button" className="family-link !min-h-[44px]" disabled={busy} onClick={async () => { setBusy(true); await onRemove(); setBusy(false); setConfirming(false); }} data-confirm-remove>Yes, remove</button>
                  <button type="button" className="family-link !min-h-[44px]" onClick={() => setConfirming(false)}>Keep</button></span>}
          </div>
        </>
      ) : (
        <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); if (await onSave(text, owners, when)) setEditing(false); setBusy(false); }} data-agreement-form>
          <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">What we agreed
            <textarea value={text} maxLength={160} rows={2} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full border border-warm-rule bg-white p-2 text-[0.95rem] normal-case tracking-normal text-warm-ink" data-agreement-text />
          </label>
          <label className="mt-3 block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">When (optional)
            <input value={when} maxLength={80} onChange={(e) => setWhen(e.target.value)} placeholder="Before bed" className="mt-1 block min-h-[44px] w-full border border-warm-rule bg-white px-2 text-[0.95rem] normal-case tracking-normal text-warm-ink" data-agreement-when />
          </label>
          <fieldset className="mt-3">
            <legend className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">Whose part</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {people.map((m) => (
                <button key={m.id} type="button" aria-pressed={owners.includes(m.id)} onClick={() => toggle(m.id)} data-owner-chip={m.firstName}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-sm ${owners.includes(m.id) ? 'border-warm-ink bg-[#f3f6f1] font-semibold' : 'border-warm-rule bg-white'}`}>
                  <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colors[m.id]?.hex }} />{m.firstName}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-3 flex gap-3">
            <button type="submit" className="family-action !mt-0" disabled={busy || !text.trim() || !owners.length} data-save-agreement>Save</button>
            <button type="button" className="family-link" onClick={() => { setEditing(false); setText(r.agreement?.text ?? taskLabel(r)); setOwners(r.ownerIds); setWhen(r.agreement?.when ?? ''); }}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}

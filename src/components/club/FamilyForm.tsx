/**
 * The family form: /club/start (first time, welcoming) and /club/family (editing). One screen: you, other grown-ups,
 * kids (first name and age; birthday month optional), and optional household details. People can be added, edited
 * and removed; removing someone archives them (their jobs keep pointing at them and say "Needs a new owner").
 * No mailing address, no last names, nothing else.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ADULT_ROLES, CHILD_AGES, MONTH_NAMES, PRIORITIES } from '../../data/club/onboarding';
import { ageNow, birthFromAge, monthOf, validateHousehold, type Household, type MemberRole } from '../../lib/club/profile';
import type { HouseholdInput, MemberInput } from '../../lib/club/store';

interface Draft {
  key: string;
  id?: string;
  firstName: string;
  kind: 'adult' | 'child';
  role: MemberRole;
  age: number | '';
  birthMonth: number | '';
  /** What was saved, so an unchanged child keeps their exact birth year and month. */
  saved?: { birthYear?: number; birthMonth?: number; age: number | null };
}

let seq = 0;
const newKey = () => `p${++seq}`;

export function draftsFrom(h: Household | null, today: string): { me: Draft; adults: Draft[]; kids: Draft[] } {
  const active = (h?.members ?? []).filter((m) => !m.archived);
  const toDraft = (m: (typeof active)[number]): Draft => {
    const age = ageNow(m, today);
    return {
      key: newKey(), id: m.id, firstName: m.firstName, kind: m.kind, role: m.role,
      age: age ?? '', birthMonth: m.birthMonth ?? '',
      saved: { birthYear: m.birthYear, birthMonth: m.birthMonth, age },
    };
  };
  const adults = active.filter((m) => m.kind === 'adult');
  const holder = adults.find((m) => m.isAccountHolder) ?? adults[0];
  return {
    me: holder ? toDraft(holder) : { key: newKey(), firstName: '', kind: 'adult', role: 'parent', age: '', birthMonth: '' },
    adults: adults.filter((m) => m !== holder).map(toDraft),
    kids: active.filter((m) => m.kind === 'child').map(toDraft),
  };
}

/** The drafts as the store wants them. Exported for tests. */
export function toInput(me: Draft, adults: Draft[], kids: Draft[], extras: { displayName: string; pets: boolean; priorities: string[] }, base: Household['preferences'], today: string): HouseholdInput {
  const member = (d: Draft, holder = false): MemberInput => {
    const common = { ...(d.id ? { id: d.id } : {}), firstName: d.firstName.trim(), kind: d.kind, role: d.role, ...(holder ? { isAccountHolder: true } : {}) };
    if (d.kind === 'adult') return common;
    const age = d.age === '' ? NaN : d.age;
    const month = d.birthMonth === '' ? undefined : d.birthMonth;
    // Unchanged age and month: keep exactly what was saved (so a December birthday doesn't drift).
    if (d.saved && d.saved.age === age && (d.saved.birthMonth ?? undefined) === month && d.saved.birthYear !== undefined) {
      return { ...common, birthYear: d.saved.birthYear, ...(d.saved.birthMonth ? { birthMonth: d.saved.birthMonth } : {}) };
    }
    return Number.isNaN(age) ? common : { ...common, ...birthFromAge(age, today, month) };
  };
  const { priorities: _p, pets: _pets, ...keep } = base;
  return {
    ...(extras.displayName.trim() ? { displayName: extras.displayName.trim() } : {}),
    preferences: { ...keep, ...(extras.pets ? { pets: true } : {}), ...(extras.priorities.length ? { priorities: extras.priorities } : {}) },
    members: [member(me, true), ...adults.map((a) => member(a)), ...kids.map((k) => member(k))],
  };
}

interface Props {
  household: Household | null;
  mode: 'start' | 'edit';
  readOnly?: boolean;
  /** The save button's words (the start page names the kit it opens). */
  submitLabel: string;
  /** Start only: "The Rivera Family" from the name she gave at checkout, used only when she has no family name yet. */
  suggestedName?: string;
  onSave: (input: HouseholdInput) => Promise<void>;
}

const input = 'block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem] text-warm-ink focus:border-warm-ink focus:outline-none';
const select = `${input} pr-8`;

export default function FamilyForm({ household, mode, readOnly, submitLabel, suggestedName, onSave }: Props) {
  const today = useMemo(() => monthOf(new Date()), []);
  const initial = useMemo(() => draftsFrom(household, today), [household, today]);
  const [me, setMe] = useState<Draft>(initial.me);
  const [adults, setAdults] = useState<Draft[]>(initial.adults);
  // A blank first child to fill in, unless she already saved her family (the household row exists, empty, from checkout).
  const [kids, setKids] = useState<Draft[]>(initial.kids.length || household?.members.length ? initial.kids : [{ key: newKey(), firstName: '', kind: 'child', role: 'child', age: '', birthMonth: '' }]);
  // Never over a name she already chose; the suggestion only fills an empty one, and she can change it.
  const [displayName, setDisplayName] = useState(household?.displayName ?? (mode === 'start' ? suggestedName ?? '' : ''));
  const [pets, setPets] = useState(Boolean(household?.preferences.pets));
  const [priorities, setPriorities] = useState<string[]>(household?.preferences.priorities ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);

  const missing = (d: Draft) => !d.firstName.trim() || (d.kind === 'child' && d.age === '');
  const filledKids = kids.filter((k) => k.firstName.trim() || k.age !== '');
  const problems = [me, ...adults, ...filledKids].filter(missing);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setTried(true);
    setError('');
    if (problems.length) return setError('Add a first name for everyone, and an age for each child.');
    // Her welcome print and printed resources carry it, so the welcome flow asks for it.
    if (mode === 'start' && !displayName.trim()) return setError('Add what you call your family. It goes on your welcome print.');
    const data = toInput(me, adults, filledKids, { displayName, pets, priorities }, household?.preferences ?? {}, today);
    const check = validateHousehold({ id: household?.id ?? 'new', preferences: data.preferences, profileVersion: 0, members: data.members.map((m, i) => ({ id: m.id ?? `new-${i}`, ...m })) }, today);
    if (check.length) return setError('Something doesn’t look right. Check each name (up to 30 letters) and age.');
    setBusy(true);
    try {
      await onSave(data);
    } catch {
      setError('We couldn’t save just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const update = (list: Draft[], set: (l: Draft[]) => void, key: string, patch: Partial<Draft>) => set(list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const flag = (d: Draft) => (tried && missing(d) ? 'border-rose' : '');

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl">
      {mode === 'start' ? (
        <>
          <h1 className="font-serif text-[2.1rem] leading-[1.1] text-warm-ink sm:text-[2.6rem]">Tell us about your family</h1>
          <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-warm-soft">
            First names and ages are all we need. We use them to prepare your welcome gift and your monthly family resources.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-[2rem] leading-tight text-warm-ink sm:text-[2.4rem]">Your family</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-warm-soft">
            Changes here never rewrite a chart you’ve made. Your kits will offer suggestions for what changed instead.
          </p>
        </>
      )}

      <fieldset disabled={readOnly} className="mt-8 space-y-9">
        {mode === 'start' && (
          <section>
            <label className="block">
              <span className="text-[0.95rem] font-semibold text-warm-ink">What do you call your family?</span>
              <span className="block text-[0.88rem] text-warm-soft">It goes on your welcome print. “The Rivera Family”, “Team Rivera”.</span>
              <input className={`${input} mt-1.5 ${tried && !displayName.trim() ? 'border-rose' : ''}`} value={displayName} maxLength={45} autoComplete="family-name" onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          </section>
        )}
        <section>
          <h2 className="label text-warm-soft">You</h2>
          <label className="mt-3 block">
            <span className="text-[0.95rem] font-semibold text-warm-ink">Your first name</span>
            <input className={`${input} mt-1.5 ${flag(me)}`} value={me.firstName} maxLength={30} autoComplete="given-name" onChange={(e) => setMe({ ...me, firstName: e.target.value })} />
          </label>
        </section>

        <section>
          <h2 className="label text-warm-soft">Other grown-ups at home</h2>
          <p className="mt-1.5 text-[0.92rem] text-warm-soft">A partner, a grandparent, anyone who shares the house. Leave it empty if it’s just you.</p>
          <ul className="mt-3 space-y-3">
            {adults.map((a) => (
              <li key={a.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-[6px] border border-warm-rule bg-white p-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <label className="col-span-2 sm:col-span-1">
                  <span className="text-[0.85rem] text-warm-soft">First name</span>
                  <input className={`${input} mt-1 ${flag(a)}`} value={a.firstName} maxLength={30} onChange={(e) => update(adults, setAdults, a.key, { firstName: e.target.value })} />
                </label>
                <label>
                  <span className="text-[0.85rem] text-warm-soft">Who they are</span>
                  <select className={`${select} mt-1`} value={a.role} onChange={(e) => update(adults, setAdults, a.key, { role: e.target.value as MemberRole })}>
                    {ADULT_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </label>
                <button type="button" className="min-h-12 self-end px-2 text-[0.88rem] text-warm-soft underline underline-offset-4" onClick={() => setAdults(adults.filter((x) => x.key !== a.key))}>
                  Remove<span className="sr-only"> {a.firstName || 'this person'}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-3 min-h-11 text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => setAdults([...adults, { key: newKey(), firstName: '', kind: 'adult', role: 'partner', age: '', birthMonth: '' }])}>
            + Add a grown-up
          </button>
        </section>

        <section>
          <h2 className="label text-warm-soft">Kids</h2>
          <p className="mt-1.5 text-[0.92rem] text-warm-soft">Kids don’t get accounts. A birthday month keeps their age right all year; it’s optional.</p>
          <ul className="mt-3 space-y-3">
            {kids.map((k) => (
              <li key={k.key} className="grid grid-cols-2 gap-2 rounded-[6px] border border-warm-rule bg-white p-3 sm:grid-cols-[1fr_7rem_10rem_auto] sm:items-end">
                <label className="col-span-2 sm:col-span-1">
                  <span className="text-[0.85rem] text-warm-soft">First name</span>
                  <input className={`${input} mt-1 ${flag(k)}`} value={k.firstName} maxLength={30} onChange={(e) => update(kids, setKids, k.key, { firstName: e.target.value })} />
                </label>
                <label>
                  <span className="text-[0.85rem] text-warm-soft">Age</span>
                  <select className={`${select} mt-1 ${tried && k.firstName.trim() && k.age === '' ? 'border-rose' : ''}`} value={k.age} onChange={(e) => update(kids, setKids, k.key, { age: e.target.value === '' ? '' : Number(e.target.value) })}>
                    <option value="">Age</option>
                    {CHILD_AGES.map((n) => <option key={n} value={n}>{n === 0 ? 'Under 1' : n}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-[0.85rem] text-warm-soft">Birthday month</span>
                  <select className={`${select} mt-1`} value={k.birthMonth} onChange={(e) => update(kids, setKids, k.key, { birthMonth: e.target.value === '' ? '' : Number(e.target.value) })}>
                    <option value="">Optional</option>
                    {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
                  </select>
                </label>
                <button type="button" className="col-span-2 min-h-11 justify-self-start px-1 text-[0.88rem] text-warm-soft underline underline-offset-4 sm:col-span-1 sm:min-h-12" onClick={() => setKids(kids.filter((x) => x.key !== k.key))}>
                  Remove<span className="sr-only"> {k.firstName || 'this child'}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-3 min-h-11 text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => setKids([...kids, { key: newKey(), firstName: '', kind: 'child', role: 'child', age: '', birthMonth: '' }])}>
            + Add a child
          </button>
        </section>

        <Optional collapsed={mode === 'start'}>
          <h2 className="label text-warm-soft">Your household <span className="normal-case tracking-normal">(optional)</span></h2>
          <label className="mt-3 flex min-h-11 items-center gap-3 text-[0.98rem] text-warm-ink">
            <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} className="h-5 w-5 accent-[var(--color-warm-ink)]" />
            We have a pet (adds feeding to the jobs)
          </label>
          <fieldset className="mt-4">
            <legend className="text-[0.95rem] font-semibold text-warm-ink">What matters most right now?</legend>
            <p className="text-[0.88rem] text-warm-soft">Pick any. It’s for you; your suggestions come from ages and roles.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {PRIORITIES.map((p) => {
                const on = priorities.includes(p.id);
                return (
                  <label key={p.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[0.92rem] ${on ? 'border-warm-ink bg-sage-wash text-warm-ink' : 'border-warm-rule bg-white text-warm-soft'}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setPriorities(on ? priorities.filter((x) => x !== p.id) : [...priorities, p.id])} />
                    {p.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {mode === 'edit' && (
            <label className="mt-5 block">
              <span className="text-[0.95rem] font-semibold text-warm-ink">A name for your team</span>
              <span className="block text-[0.88rem] text-warm-soft">It goes at the top of your printed chart. “The Rivera Family”, “Team Rivera”.</span>
              <input className={`${input} mt-1.5`} value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          )}
        </Optional>
      </fieldset>

      {error && <p role="alert" className="mt-6 border-l-[3px] border-rose bg-rose-wash px-4 py-3 text-warm-ink">{error}</p>}
      {!readOnly && (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
            {busy ? 'Saving…' : submitLabel}
          </button>
          <p className="text-[0.85rem] text-warm-soft">We only use first names and ages to suggest jobs.</p>
        </div>
      )}
    </form>
  );
}

/** The optional household details: open on the family page, a closed "More about your household" in the welcome flow. */
function Optional({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (!collapsed) return <section>{children}</section>;
  return (
    <details className="group">
      <summary className="min-h-11 cursor-pointer text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4">More about your household (optional)</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

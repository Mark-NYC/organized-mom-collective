/**
 * The family profile's steps 2–6 (step 1 is the family form): her typical week, who already takes care of what,
 * what she'd like the kids to own, where the family struggles to stay on the same page, and the one thing she'd love
 * to stop managing alone. Two ways in:
 *   - mode 'wizard': the welcome flow and "Finish your family profile". Starts at the first open step, saves each
 *     step as she leaves it (so an interrupted setup picks up where she stopped), and every step can be skipped.
 *   - mode 'single': /club/family's Edit links. One step, Save and Cancel.
 * Every detail is optional. Kids have no accounts; they're chosen by first name.
 */
import { useState, type ReactNode } from 'react';
import {
  ACTIVITY_CATEGORIES, CHALLENGES, GROWTH_ITEMS, PRIORITIES, PROFILE_ICONS, RESPONSIBILITY_CATEGORIES, WEEK_DAYS,
  type ActivityCategory, type Choice, type ResponsibilityCategory,
} from '../../data/club/family-profile';
import type { FamilyMember } from '../../lib/club/profile';
import {
  byStatus, MAX_ACTIVITY_NAME, MAX_LABEL, MAX_NOTE, nextOpenStep, SETUP_STEPS, STEP_TITLES, stepNumber, TOTAL_STEPS,
  type Activity, type FamilyProfile, type Responsibility, type SetupStep,
} from '../../lib/club/family-profile';
import type { ClubStore } from '../../lib/club/store';

interface Props {
  store: ClubStore;
  members: FamilyMember[];
  profile: FamilyProfile;
  mode: 'wizard' | 'single';
  /** Single mode: the step to edit. Wizard: where to start (default: the first open step). */
  step?: SetupStep;
  /** Wizard: after the last step. Single: after Save. */
  onDone: (profile: FamilyProfile) => void;
  /** Wizard: "Finish later". Single: Cancel. Answers already saved stay saved. */
  onExit: (profile: FamilyProfile) => void;
}

const STEP_ICON: Record<SetupStep, string> = {
  week: ACTIVITY_CATEGORIES.find((c) => c.id === 'appointments')!.icon!,
  responsibilities: PROFILE_ICONS.owns,
  growth: PROFILE_ICONS.shared,
  challenges: PROFILE_ICONS.meeting,
  priority: PROFILE_ICONS.family,
};

const input = 'block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem] text-warm-ink focus:border-warm-ink focus:outline-none';

export default function FamilySetup({ store, members, profile: initial, mode, step: start, onDone, onExit }: Props) {
  const [profile, setProfile] = useState(initial);
  const [step, setStep] = useState<SetupStep>(start ?? nextOpenStep(initial) ?? 'week');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = members.filter((m) => !m.archived);

  /** Save this step's answer, then move on (or finish). */
  const commit = async (save: () => Promise<FamilyProfile>) => {
    setBusy(true);
    setError('');
    try {
      const next = await save();
      setProfile(next);
      const at = SETUP_STEPS.indexOf(step);
      if (mode === 'single' || at === SETUP_STEPS.length - 1) return onDone(next);
      setStep(SETUP_STEPS[at + 1]);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    } catch {
      setError('We couldn’t save just now. Your other answers are safe. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const back = mode === 'wizard' && SETUP_STEPS.indexOf(step) > 0 ? () => setStep(SETUP_STEPS[SETUP_STEPS.indexOf(step) - 1]) : undefined;
  const nav = { busy, mode, back, exit: () => onExit(profile), last: step === 'priority' };

  return (
    <section className="max-w-2xl" aria-labelledby="setup-title">
      {mode === 'wizard' && <Progress step={step} />}
      <div className="mt-5 flex items-start gap-4">
        <img src={STEP_ICON[step]} alt="" width={64} height={64} className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
        <div>
          <h1 id="setup-title" className="font-serif text-[1.9rem] leading-[1.12] text-warm-ink sm:text-[2.3rem]">{HEADINGS[step]}</h1>
          <p className="mt-2 leading-relaxed text-warm-soft">{INTROS[step]}</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-5 border-l-[3px] border-rose bg-rose-wash px-4 py-3 text-warm-ink">{error}</p>}
      <div className="mt-6">
        {step === 'week' && <WeekStep key={step} members={active} initial={profile.activities} nav={nav} onSave={(list) => commit(() => store.saveActivities(list))} />}
        {step === 'responsibilities' && <OwnershipStep key={step} members={active} initial={byStatus(profile, 'existing')} nav={nav} onSave={(list) => commit(() => store.saveResponsibilities('existing', list))} />}
        {step === 'growth' && <GrowthStep key={step} kids={active.filter((m) => m.kind === 'child')} initial={byStatus(profile, 'desired')} nav={nav} onSave={(list) => commit(() => store.saveResponsibilities('desired', list))} />}
        {step === 'challenges' && (
          <PickStep key={step} choices={CHALLENGES} multi initial={profile.challenges} note={profile.challengeNote} noteLabel="Tell us more (optional)" nav={nav}
            onSave={(ids, note) => commit(() => store.saveFocus('challenges', { challenges: ids, challengeNote: note, priority: profile.priority, priorityNote: profile.priorityNote }))} />
        )}
        {step === 'priority' && (
          <PickStep key={step} choices={PRIORITIES} initial={profile.priority ? [profile.priority] : []} note={profile.priorityNote} noteLabel="In your own words (optional)" alwaysNote nav={nav}
            onSave={(ids, note) => commit(() => store.saveFocus('priority', { challenges: profile.challenges, challengeNote: profile.challengeNote, priority: ids[0], priorityNote: note }))} />
        )}
      </div>
    </section>
  );
}

const HEADINGS: Record<SetupStep, string> = {
  week: 'What does a typical week look like?',
  responsibilities: 'What does everyone already take care of?',
  growth: 'What would you like your kids to take on?',
  challenges: 'Where is it hard to stay on the same page?',
  priority: 'What’s one thing you’d love to stop managing alone?',
};
const INTROS: Record<SetupStep, string> = {
  week: 'Tap what’s part of your week. Add days and times only if you want to; you can change this anytime.',
  responsibilities: 'Tap a name once if they take care of it without being asked, twice if they help when asked. Leave anything blank.',
  growth: 'Pick any. We’ll suggest ways to hand these over a little at a time.',
  challenges: 'Pick any that sound like your house.',
  priority: 'We’ll start here. It becomes your family’s first focus, and you can change it later.',
};

function Progress({ step }: { step: SetupStep }) {
  const n = stepNumber(step);
  return (
    <div>
      <p className="text-[0.88rem] font-semibold text-warm-soft">
        Step {n} of {TOTAL_STEPS} · {STEP_TITLES[step]}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-warm-rule" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={n} aria-label="Family setup progress">
        <div className="h-full rounded-full bg-sage" style={{ width: `${(n / TOTAL_STEPS) * 100}%` }} />
      </div>
    </div>
  );
}

interface Nav {
  busy: boolean;
  mode: 'wizard' | 'single';
  last: boolean;
  back?: () => void;
  exit: () => void;
}

/** Next / Skip for now / Back / Finish later (wizard); Save / Cancel (single). Skip re-saves what was there. */
function Actions({ nav, onNext, onSkip }: { nav: Nav; onNext: () => void; onSkip: () => void }) {
  const primary = nav.mode === 'single' ? 'Save' : nav.last ? 'Finish' : 'Next';
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <button type="button" disabled={nav.busy} className="btn-primary w-full sm:w-auto" onClick={onNext}>{nav.busy ? 'Saving…' : primary}</button>
      {nav.mode === 'wizard' ? (
        <>
          <button type="button" disabled={nav.busy} className="min-h-11 text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4" onClick={onSkip}>Skip for now</button>
          <span className="flex gap-5 sm:ml-auto">
            {nav.back && <button type="button" disabled={nav.busy} className="min-h-11 text-[0.92rem] text-warm-soft underline underline-offset-4" onClick={nav.back}>Back</button>}
            <button type="button" disabled={nav.busy} className="min-h-11 text-[0.92rem] text-warm-soft underline underline-offset-4" onClick={nav.exit}>Finish later</button>
          </span>
        </>
      ) : (
        <button type="button" disabled={nav.busy} className="min-h-11 text-[0.95rem] text-warm-soft underline underline-offset-4" onClick={nav.exit}>Cancel</button>
      )}
    </div>
  );
}

function Tile({ choice, on, onToggle }: { choice: Choice; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onToggle}
      className={`flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-[6px] border p-3 text-center text-[0.92rem] leading-snug ${on ? 'border-warm-ink bg-sage-wash text-warm-ink' : 'border-warm-rule bg-white text-warm-soft'}`}>
      {choice.icon ? <img src={choice.icon} alt="" width={56} height={56} className="h-14 w-14" /> : <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border border-warm-rule text-[1.4rem] text-warm-soft">+</span>}
      <span className="font-semibold">{choice.label}</span>
    </button>
  );
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[0.92rem] ${on ? 'border-warm-ink bg-sage-wash text-warm-ink' : 'border-warm-rule bg-white text-warm-soft'}`}>
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// ------------------------------------------------------------------ step 2: the week

type ActivityDraft = Activity & { key: string; open?: boolean };
let seq = 0;
const key = () => `d${++seq}`;

function WeekStep({ members, initial, nav, onSave }: { members: FamilyMember[]; initial: Activity[]; nav: Nav; onSave: (list: Activity[]) => void }) {
  const [list, setList] = useState<ActivityDraft[]>(() => initial.map((a) => ({ ...a, key: key() })));
  const chosen = new Set(list.map((a) => a.category));
  const blank = (category: ActivityCategory): ActivityDraft => ({ key: key(), category, memberIds: [], days: [], open: true });
  const patch = (k: string, p: Partial<ActivityDraft>) => setList(list.map((a) => (a.key === k ? { ...a, ...p } : a)));
  const clean = (): Activity[] =>
    list.map(({ key: _k, open: _o, ...a }) => ({ ...a, name: a.name?.trim().slice(0, MAX_ACTIVITY_NAME) || undefined, startsAt: a.startsAt || undefined }));

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {ACTIVITY_CATEGORIES.map((c) => (
          <Tile key={c.id} choice={c} on={chosen.has(c.id)}
            onToggle={() => setList(chosen.has(c.id) ? list.filter((a) => a.category !== c.id) : [...list, { ...blank(c.id), open: false }])} />
        ))}
      </div>
      {list.length > 0 && (
        <div className="mt-7 space-y-5">
          <p className="text-[0.92rem] text-warm-soft">Want to add who, which days or a time? It’s optional and helps us plan around your week.</p>
          {ACTIVITY_CATEGORIES.filter((c) => chosen.has(c.id)).map((c) => (
            <div key={c.id} className="rounded-[6px] border border-warm-rule bg-white p-3 sm:p-4">
              <h3 className="text-[0.98rem] font-semibold text-warm-ink">{c.label}</h3>
              <ul className="mt-2 space-y-3">
                {list.filter((a) => a.category === c.id).map((a, i, same) => (
                  <li key={a.key} className={i ? 'border-t border-warm-rule pt-3' : ''}>
                    {!a.open ? (
                      <button type="button" className="min-h-11 text-left text-[0.92rem] text-warm-ink underline underline-offset-4" onClick={() => patch(a.key, { open: true })}>
                        {summary(a, members) || 'Add details (optional)'}
                      </button>
                    ) : (
                      <ActivityDetails a={a} members={members} onChange={(p) => patch(a.key, p)} />
                    )}
                    {same.length > 1 && (
                      <button type="button" className="mt-1 min-h-11 text-[0.85rem] text-warm-soft underline underline-offset-4" onClick={() => setList(list.filter((x) => x.key !== a.key))}>
                        Remove<span className="sr-only"> this {c.label.toLowerCase()} entry</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-2 min-h-11 text-[0.9rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => setList([...list, blank(c.id)])}>
                + Add another
              </button>
            </div>
          ))}
        </div>
      )}
      <Actions nav={nav} onNext={() => onSave(clean())} onSkip={() => onSave(initial)} />
    </>
  );
}

function ActivityDetails({ a, members, onChange }: { a: ActivityDraft; members: FamilyMember[]; onChange: (p: Partial<ActivityDraft>) => void }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[0.85rem] text-warm-soft">Name (optional)</span>
        <input className={`${input} mt-1`} value={a.name ?? ''} maxLength={MAX_ACTIVITY_NAME} placeholder="Soccer practice" onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      {members.length > 1 && (
        <fieldset>
          <legend className="text-[0.85rem] text-warm-soft">Who goes?</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {members.map((m) => <Chip key={m.id} on={a.memberIds.includes(m.id)} onClick={() => onChange({ memberIds: toggle(a.memberIds, m.id) })}>{m.firstName}</Chip>)}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="text-[0.85rem] text-warm-soft">Which days?</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((d) => (
            <button key={d.day} type="button" aria-pressed={a.days.includes(d.day)} aria-label={d.label} onClick={() => onChange({ days: toggle(a.days, d.day) })}
              className={`h-11 w-11 rounded-full border text-[0.92rem] font-semibold ${a.days.includes(d.day) ? 'border-warm-ink bg-sage-wash text-warm-ink' : 'border-warm-rule bg-white text-warm-soft'}`}>
              {d.short}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block max-w-[12rem]">
        <span className="text-[0.85rem] text-warm-soft">Time, if you know it</span>
        <input type="time" className={`${input} mt-1`} value={a.startsAt ?? ''} onChange={(e) => onChange({ startsAt: e.target.value })} />
      </label>
    </div>
  );
}

/** "Ava · Tue, Thu · 5:30 PM": what she already told us, on one line. */
export function summary(a: Activity, members: FamilyMember[]): string {
  const who = a.memberIds.map((id) => members.find((m) => m.id === id)?.firstName).filter(Boolean).join(' & ');
  const days = WEEK_DAYS.filter((d) => a.days.includes(d.day)).map((d) => d.label.slice(0, 3)).join(', ');
  return [a.name, who, days, a.startsAt ? clock(a.startsAt) : ''].filter(Boolean).join(' · ');
}

export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ------------------------------------------------------------------ step 3: who already takes care of what

type Role = 'owns' | 'helps' | null;

function OwnershipStep({ members, initial, nav, onSave }: { members: FamilyMember[]; initial: Responsibility[]; nav: Nav; onSave: (list: Responsibility[]) => void }) {
  const [rows, setRows] = useState<Record<string, { ownerIds: string[]; helperIds: string[]; label?: string; id?: string }>>(() =>
    Object.fromEntries(initial.map((r) => [r.category, { ownerIds: r.ownerIds, helperIds: r.helperIds, label: r.label, id: r.id }])));
  const roleOf = (cat: string, id: string): Role => (rows[cat]?.ownerIds.includes(id) ? 'owns' : rows[cat]?.helperIds.includes(id) ? 'helps' : null);
  // none → owns → helps → none
  const cycle = (cat: string, id: string) => {
    const r = rows[cat] ?? { ownerIds: [], helperIds: [] };
    const now = roleOf(cat, id);
    const ownerIds = now === null ? [...r.ownerIds, id] : r.ownerIds.filter((x) => x !== id);
    const helperIds = now === 'owns' ? [...r.helperIds, id] : r.helperIds.filter((x) => x !== id);
    setRows({ ...rows, [cat]: { ...r, ownerIds, helperIds } });
  };
  const result = (): Responsibility[] =>
    RESPONSIBILITY_CATEGORIES.flatMap((c) => {
      const r = rows[c.id];
      const label = r?.label?.trim().slice(0, MAX_LABEL) || undefined;
      if (!r || (!r.ownerIds.length && !r.helperIds.length && !(c.id === 'other' && label))) return [];
      return [{ ...(r.id ? { id: r.id } : {}), status: 'existing' as const, category: c.id as ResponsibilityCategory, ownerIds: r.ownerIds, helperIds: r.helperIds, ...(c.id === 'other' && label ? { label } : {}) }];
    });

  return (
    <>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.88rem] text-warm-soft">
        <span className="inline-flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-full bg-warm-ink" />Takes care of it</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-warm-ink bg-white" />Helps when asked</span>
      </div>
      <ul className="mt-4 divide-y divide-warm-rule rounded-[6px] border border-warm-rule bg-white">
        {RESPONSIBILITY_CATEGORIES.map((c) => (
          <li key={c.id} className="p-3 sm:p-4">
            <p className="text-[0.98rem] font-semibold text-warm-ink">{c.label}</p>
            {c.id === 'other' && (
              <input className={`${input} mt-2`} value={rows.other?.label ?? ''} maxLength={MAX_LABEL} placeholder="What is it?" aria-label="Another responsibility"
                onChange={(e) => setRows({ ...rows, other: { ...(rows.other ?? { ownerIds: [], helperIds: [] }), label: e.target.value } })} />
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {members.map((m) => {
                const role = roleOf(c.id, m.id);
                return (
                  <button key={m.id} type="button" onClick={() => cycle(c.id, m.id)}
                    aria-label={`${m.firstName}, ${c.label}: ${role === 'owns' ? 'takes care of it' : role === 'helps' ? 'helps when asked' : 'not set'}. Tap to change.`}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-[0.92rem] ${role === 'owns' ? 'border-warm-ink bg-warm-ink text-white' : role === 'helps' ? 'border-warm-ink bg-white text-warm-ink' : 'border-warm-rule bg-white text-warm-soft'}`}>
                    {m.firstName}
                    {role && <span className="text-[0.8rem]">· {role === 'owns' ? 'owns' : 'helps'}</span>}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <Actions nav={nav} onNext={() => onSave(result())} onSkip={() => onSave(initial)} />
    </>
  );
}

// ------------------------------------------------------------------ step 4: what the kids could take on

function GrowthStep({ kids, initial, nav, onSave }: { kids: FamilyMember[]; initial: Responsibility[]; nav: Nav; onSave: (list: Responsibility[]) => void }) {
  const [picked, setPicked] = useState<Record<string, { ownerIds: string[]; id?: string }>>(() =>
    Object.fromEntries(initial.filter((r) => r.item).map((r) => [r.item!, { ownerIds: r.ownerIds, id: r.id }])));
  const custom0 = initial.find((r) => !r.item && r.label);
  const [custom, setCustom] = useState(custom0?.label ?? '');
  const result = (): Responsibility[] => [
    ...GROWTH_ITEMS.filter((g) => picked[g.id]).map((g) => ({
      ...(picked[g.id].id ? { id: picked[g.id].id } : {}), status: 'desired' as const, category: g.category, item: g.id, ownerIds: picked[g.id].ownerIds, helperIds: [],
    })),
    ...(custom.trim() ? [{ ...(custom0?.id ? { id: custom0.id } : {}), status: 'desired' as const, category: 'other' as const, label: custom.trim().slice(0, MAX_LABEL), ownerIds: [], helperIds: [] }] : []),
  ];

  if (!kids.length) {
    return (
      <>
        <p className="leading-relaxed text-warm-ink">There are no kids on your family profile, so there’s nothing to pick here. You can add kids on your family page anytime.</p>
        <Actions nav={nav} onNext={() => onSave([])} onSkip={() => onSave(initial)} />
      </>
    );
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {GROWTH_ITEMS.map((g) => (
          <Chip key={g.id} on={Boolean(picked[g.id])} onClick={() => {
            const { [g.id]: had, ...rest } = picked;
            setPicked(had ? rest : { ...picked, [g.id]: { ownerIds: [] } });
          }}>{g.label}</Chip>
        ))}
      </div>
      {kids.length > 1 && Object.keys(picked).length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="text-[0.92rem] text-warm-soft">Is it for one of the kids in particular? Optional.</p>
          {GROWTH_ITEMS.filter((g) => picked[g.id]).map((g) => (
            <fieldset key={g.id}>
              <legend className="text-[0.92rem] font-semibold text-warm-ink">{g.label}</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {kids.map((k) => (
                  <Chip key={k.id} on={picked[g.id].ownerIds.includes(k.id)} onClick={() => setPicked({ ...picked, [g.id]: { ...picked[g.id], ownerIds: toggle(picked[g.id].ownerIds, k.id) } })}>{k.firstName}</Chip>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      <label className="mt-6 block">
        <span className="text-[0.95rem] font-semibold text-warm-ink">Something else? (optional)</span>
        <input className={`${input} mt-1.5`} value={custom} maxLength={MAX_LABEL} onChange={(e) => setCustom(e.target.value)} />
      </label>
      <Actions nav={nav} onNext={() => onSave(result())} onSkip={() => onSave(initial)} />
    </>
  );
}

// ------------------------------------------------------------------ steps 5 and 6: pick, plus a short note

function PickStep({ choices, multi, initial, note: note0, noteLabel, alwaysNote, nav, onSave }: {
  choices: Choice[]; multi?: boolean; initial: string[]; note?: string; noteLabel: string; alwaysNote?: boolean; nav: Nav;
  onSave: (ids: string[], note?: string) => void;
}) {
  const [ids, setIds] = useState(initial);
  const [note, setNote] = useState(note0 ?? '');
  const showNote = alwaysNote || ids.includes('other');
  return (
    <>
      <div className="flex flex-wrap gap-2" role={multi ? 'group' : 'radiogroup'}>
        {choices.map((c) => (
          <Chip key={c.id} on={ids.includes(c.id)} onClick={() => setIds(multi ? toggle(ids, c.id) : ids.includes(c.id) ? [] : [c.id])}>{c.label}</Chip>
        ))}
      </div>
      {showNote && (
        <label className="mt-6 block">
          <span className="text-[0.95rem] font-semibold text-warm-ink">{noteLabel}</span>
          <input className={`${input} mt-1.5`} value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      <Actions nav={nav} onNext={() => onSave(ids, showNote ? note.trim() || undefined : undefined)} onSkip={() => onSave(initial, note0)} />
    </>
  );
}

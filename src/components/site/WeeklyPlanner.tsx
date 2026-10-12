import { useEffect, useState } from 'react';
import ConfirmationDialog from '../ConfirmationDialog';
import { readFlag, writeFlag, isSaving } from '../../lib/storage';
import { DAYS, emptyPlanner, type PlannerData, type PlannerPreset } from '../../data/planner';

/**
 * The Weekly Planner Generator (/planner, and the upgraded page with example weeks).
 * Everything typed here is saved on this device only. "Print / Save as PDF" prints just the
 * planner, on one landscape page.
 */
interface Props {
  /** Example weeks (the upgraded planner only). */
  presets?: PlannerPreset[];
}

const STORAGE_NAME = 'planner';

function load(): PlannerData {
  const blank = emptyPlanner();
  try {
    const raw = readFlag(STORAGE_NAME);
    if (!raw) return blank;
    const p = JSON.parse(raw) as Partial<PlannerData>;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const week = (v: unknown) => DAYS.map((_, i) => (Array.isArray(v) ? str(v[i]) : ''));
    return {
      weekOf: str(p.weekOf),
      days: week(p.days),
      meals: week(p.meals),
      selfCare: str(p.selfCare),
      word: str(p.word),
      family: str(p.family),
      grateful: str(p.grateful),
      groceries: str(p.groceries),
      todo: str(p.todo),
      notes: str(p.notes),
    };
  } catch {
    return blank;
  }
}

const hasContent = (d: PlannerData) =>
  [d.selfCare, d.word, d.family, d.grateful, d.groceries, d.todo, d.notes, ...d.days, ...d.meals].some((v) => v.trim() !== '');

type Pending = { kind: 'clear' } | { kind: 'preset'; preset: PlannerPreset };

const box = 'rounded-[8px] bg-paper ring-1 ring-warm-rule';
const head = 'block rounded-t-[8px] px-3 py-1.5 text-center text-[0.68rem] font-semibold tracking-[0.18em] text-warm-ink uppercase';
const area =
  'block w-full resize-none bg-transparent px-3 py-2 text-[0.9rem] leading-[1.6] text-warm-ink placeholder:text-warm-soft/60 focus:outline-none focus-visible:bg-cream/60';

export default function WeeklyPlanner({ presets }: Props) {
  const [data, setData] = useState<PlannerData>(emptyPlanner);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    setData(load());
    setSaving(isSaving());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) writeFlag(STORAGE_NAME, JSON.stringify(data));
  }, [data, loaded]);

  const set = <K extends keyof PlannerData>(key: K, value: PlannerData[K]) => setData((d) => ({ ...d, [key]: value }));
  const setAt = (key: 'days' | 'meals', i: number, value: string) =>
    setData((d) => ({ ...d, [key]: d[key].map((v, j) => (j === i ? value : v)) }));

  const applyPreset = (p: PlannerPreset) => {
    setData((d) => ({ ...p.data, days: [...p.data.days], meals: [...p.data.meals], weekOf: d.weekOf }));
    setApplied(p.label);
  };
  const choosePreset = (p: PlannerPreset) => (hasContent(data) ? setPending({ kind: 'preset', preset: p }) : applyPreset(p));

  const print = () => {
    const html = document.documentElement;
    html.classList.add('print-planner');
    // One landscape page, for this print only (a named @page splits the textareas across pages).
    const page = document.createElement('style');
    page.textContent = '@page { size: letter landscape; margin: 8mm; }';
    document.head.append(page);
    const done = () => {
      html.classList.remove('print-planner');
      page.remove();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return (
    <div>
      {presets && (
        <section aria-labelledby="presets-h" className="no-print mb-8 rounded-[10px] bg-sage-wash p-5 sm:p-6">
          <h2 id="presets-h" className="label text-warm-ink">
            Start From an Example Week
          </h2>
          <p className="mt-1.5 text-[0.95rem] text-warm-soft">Tap a week to fill the planner with ideas, then change anything to fit your family.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => choosePreset(p)}
                  className="w-full rounded-[8px] bg-paper px-4 py-3 text-left ring-1 ring-warm-rule transition hover:ring-rose focus-visible:ring-2 focus-visible:ring-rose-deep focus-visible:outline-none"
                >
                  <span className="block font-serif text-[1.1rem] text-warm-ink">{p.label}</span>
                  <span className="mt-0.5 block text-[0.82rem] text-warm-soft">{p.hint}</span>
                </button>
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-[0.85rem] text-warm-soft">
            {applied && `Filled in: ${applied}. Edit anything you like.`}
          </p>
        </section>
      )}

      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={print} className="btn-primary">
          Print / Save as PDF
        </button>
        <button type="button" onClick={() => setPending({ kind: 'clear' })} className="btn-secondary">
          Clear the Week
        </button>
        <p className="text-[0.85rem] text-warm-soft">
          {saving ? 'Saved on this device as you type.' : 'This browser isn’t saving: print or save as PDF before you leave.'}
        </p>
      </div>

      {/* The planner. data-print-planner: the only thing printed. */}
      <div data-print-planner className="planner-sheet rounded-[12px] bg-cream p-3 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-3">
          <p className="font-serif text-[1.6rem] leading-none text-warm-ink">Weekly Planner</p>
          <label className="flex items-center gap-2 text-[0.75rem] font-semibold tracking-[0.18em] text-warm-ink uppercase">
            Week of
            <input
              value={data.weekOf}
              onChange={(e) => set('weekOf', e.target.value)}
              placeholder="e.g. Oct 12–18"
              className="w-40 border-b border-warm-rule bg-transparent px-1 py-1 text-[0.95rem] font-normal tracking-normal normal-case focus:border-rose-deep focus:outline-none"
            />
          </label>
        </div>

        {/* The week */}
        <div className="planner-days grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {DAYS.map((day, i) => (
            <label key={day} className={box}>
              <span className={`${head} bg-sage-wash`}>{day}</span>
              <textarea rows={6} value={data.days[i]} onChange={(e) => setAt('days', i, e.target.value)} className={area} />
            </label>
          ))}
        </div>

        <div className="planner-row3 mt-2 grid gap-2 md:grid-cols-3">
          <label className={box}>
            <span className={`${head} bg-sage-wash`}>Self-Care</span>
            <textarea rows={3} value={data.selfCare} onChange={(e) => set('selfCare', e.target.value)} className={area} />
          </label>
          <label className={box}>
            <span className={`${head} bg-blush-wash`}>Word of the Week</span>
            <textarea rows={3} value={data.word} onChange={(e) => set('word', e.target.value)} className={`${area} planner-word text-center font-serif text-[1.25rem]`} />
          </label>
          <label className={box}>
            <span className={`${head} bg-sage-wash`}>Family &amp; Friends</span>
            <textarea rows={3} value={data.family} onChange={(e) => set('family', e.target.value)} className={area} />
          </label>
        </div>

        <div className="planner-row4 mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <label className={box}>
            <span className={`${head} bg-sage-wash`}>Grateful For</span>
            <textarea rows={8} value={data.grateful} onChange={(e) => set('grateful', e.target.value)} className={area} />
          </label>
          <fieldset className={box}>
            <legend className="sr-only">Family menu</legend>
            <span aria-hidden="true" className={`${head} bg-blush-wash`}>
              Family Menu
            </span>
            <ul className="planner-menu px-3 py-1.5">
              {DAYS.map((day, i) => (
                <li key={day} className="flex items-baseline gap-2 border-b border-warm-rule/70 last:border-0">
                  <span className="w-9 shrink-0 text-[0.68rem] font-semibold tracking-[0.12em] text-warm-soft uppercase">{day.slice(0, 3)}</span>
                  <input
                    aria-label={`${day} dinner`}
                    value={data.meals[i]}
                    onChange={(e) => setAt('meals', i, e.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-1 text-[0.9rem] text-warm-ink focus:outline-none focus-visible:bg-cream/60"
                  />
                </li>
              ))}
            </ul>
          </fieldset>
          <label className={box}>
            <span className={`${head} bg-sage-wash`}>Groceries</span>
            <textarea rows={8} value={data.groceries} onChange={(e) => set('groceries', e.target.value)} className={area} />
          </label>
          <label className={box}>
            <span className={`${head} bg-sage-wash`}>To Do</span>
            <textarea rows={8} value={data.todo} onChange={(e) => set('todo', e.target.value)} className={area} />
          </label>
        </div>

        <label className={`${box} planner-notes mt-2 block`}>
          <span className={`${head} bg-sage-wash`}>Notes</span>
          <textarea rows={3} value={data.notes} onChange={(e) => set('notes', e.target.value)} className={area} />
        </label>
      </div>

      <ConfirmationDialog
        open={pending !== null}
        title={pending?.kind === 'clear' ? 'Clear this week?' : `Fill in ${pending?.kind === 'preset' ? pending.preset.label : ''}?`}
        message={
          pending?.kind === 'clear'
            ? 'Everything on the planner will be erased from this device.'
            : 'This replaces what’s on the planner now (your “Week of” date stays).'
        }
        confirmLabel={pending?.kind === 'clear' ? 'Clear' : 'Fill It In'}
        onConfirm={() => {
          if (pending?.kind === 'clear') {
            setData(emptyPlanner());
            setApplied(null);
          } else if (pending?.kind === 'preset') applyPreset(pending.preset);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

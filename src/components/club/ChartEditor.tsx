/**
 * One engine-filled printable in a kit (November's family chart and team reset): opens
 * already filled in for her family,
 * then every job can be reassigned, reworded, re-timed, swapped, removed or added, and the engine's suggestions
 * (a new child's jobs, an owner for an open job, an optional workload move) are accepted or dismissed. Saved
 * explicitly; prints on US Letter. All the rules live in src/lib/club/edits.ts; this file is the screen.
 *
 * `printable.editor` picks the layout: 'chart' (people and their jobs), 'command' (who owns each school job, plus
 * the family's own recurring commitments). The printout follows `printable.component`. Routine charts aren't here:
 * kits open the site's own routine chart (src/data/club/tools.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import { ADULT_ROLES } from '../../data/club/onboarding';
import { coachLine, FREQUENCY_LABEL, LEVEL_LABEL } from '../../data/club/labels';
import { FREQUENCIES, OWNERSHIP_LEVELS, type ChartSection, type Frequency, type KitConfig, type KitItem, type KitPrintable, type OwnershipLevel } from '../../data/club/types';
import { defaultToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import {
  acceptSuggestion, addRow, assign, dismissSuggestion, EditError, initialEdits, readEdits, remove, rename, replace, resolveDocument,
  restore, setCoach, setDoneMeans, setFrequency, setLevel, suggestionId, type ChartRow, type DocumentEdits, type Suggestion,
} from '../../lib/club/edits';
import { eligible, type GenerateOptions } from '../../lib/club/engines/responsibilities';
import { CommandCenterSheet } from './print/SchoolPrintables';
import { printDocument } from '../../lib/club/print';
import { planMembers, type Household, type PlannedMember } from '../../lib/club/profile';
import { ConflictError, type ClubStore, type SavedDocument } from '../../lib/club/store';
import PalettePicker from './PalettePicker';
import PrintFrame from './PrintFrame';
import ResponsibilityChart, { JobArt, type ChartPerson } from './print/ResponsibilityChart';
import { OwnedChecklist } from './print/Worksheet';
import { clubNav } from '../../lib/club/nav';

interface Props {
  store: ClubStore;
  kit: KitConfig;
  printable: KitPrintable;
  items: KitItem[];
  household: Household;
  saved?: SavedDocument;
  readOnly: boolean;
  intro: string;
  /** Text on each row's chip, on screen and in print (default: how often). August uses due dates. */
  chip?: (r: ChartRow) => string;
  /** Live rows, for the kit's overview. */
  onRows?: (rows: ChartRow[]) => void;
}

type Status = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

const field = 'block min-h-11 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[0.98rem] text-warm-ink focus:border-warm-ink focus:outline-none';

export const roleLabel = (p: PlannedMember, household: Household) => {
  if (p.stage !== 'adult') return `Age ${p.age}`;
  const role = household.members.find((m) => m.id === p.id)?.role;
  return ADULT_ROLES.find((r) => r.id === role)?.label ?? 'Grown-up';
};

/** How the engine places rows for each editor: the launch checklist lists every task that fits a child. */
export function placementFor(printable: KitPrintable): GenerateOptions {
  if (printable.component === 'LaunchChecklist') return { personal: 'all' };
  if (printable.perPerson) return { perPerson: printable.perPerson, balance: false };
  return {};
}

const SAVE_LABEL = { chart: 'Save our chart', command: 'Save command center' } as const;

export default function ChartEditor({ store, kit, printable, items, household, saved, readOnly, intro, chip, onRows }: Props) {
  const variant = printable.editor ?? 'chart';
  const options = useMemo(() => placementFor(printable), [printable]);
  const [edits, setEdits] = useState<DocumentEdits>(() => (saved ? readEdits(saved.edits) : initialEdits(household, items, kit.month, options)));
  const [palette, setPalette] = useState<ToolPaletteId>(saved?.palette ?? (household.preferences.palette as ToolPaletteId | undefined) ?? defaultToolPalette);
  const [revision, setRevision] = useState(saved?.revision ?? 0);
  // What's on file (or, never saved, what it opened with): "unsaved changes" means she changed something.
  const [snapshot, setSnapshot] = useState(() => JSON.stringify({ edits, palette }));
  const [savedProfile, setSavedProfile] = useState(saved?.profileVersion ?? household.profileVersion);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const people = useMemo(() => planMembers(household, kit.month), [household, kit.month]);
  const names = useMemo(() => new Map(household.members.map((m) => [m.id, m.firstName])), [household]);
  const resolved = useMemo(() => resolveDocument(household, items, kit.month, edits, options), [household, items, kit.month, edits, options]);
  const current = JSON.stringify({ edits, palette });
  const dirty = current !== snapshot;
  const neverSaved = revision === 0;
  const familyChanged = !neverSaved && savedProfile < household.profileVersion;

  // Never saved and untouched: still just suggestions, so they follow the family (a school setup change) as it changes.
  useEffect(() => {
    if (!neverSaved || dirty) return;
    const fresh = initialEdits(household, items, kit.month, options);
    setEdits(fresh);
    setSnapshot(JSON.stringify({ edits: fresh, palette }));
  }, [household]);

  useEffect(() => {
    onRows?.(resolved.rows);
  }, [resolved.rows]);

  useEffect(() => {
    if (!dirty || readOnly) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, readOnly]);

  const act = (fn: (e: DocumentEdits) => DocumentEdits) => {
    try {
      setEdits(fn(edits));
      setNotice('');
      if (status === 'saved') setStatus('idle');
    } catch (err) {
      setNotice(err instanceof EditError && err.message === 'invalid_title' ? 'A job needs a name, up to 80 letters.' : err instanceof EditError && err.message === 'invalid_done' ? 'Keep “done means” to 160 letters.' : 'That change didn’t work. Try again.');
    }
  };

  const save = async () => {
    setStatus('saving');
    try {
      const next = await store.saveDocument(kit.slug, printable.id, { edits, palette, engineVersion: kit.engineVersion, profileVersion: household.profileVersion }, revision);
      setRevision(next);
      setSnapshot(current);
      setSavedProfile(household.profileVersion);
      setStatus('saved');
    } catch (err) {
      setStatus(err instanceof ConflictError ? 'conflict' : 'error');
    }
  };

  const onChart = new Set([...resolved.rows, ...resolved.hidden].map((r) => r.itemId).filter(Boolean));
  const unused = items.filter((i) => i.scope === 'household' && !onChart.has(i.id));
  const chartPeople: ChartPerson[] = people.map((p) => ({ ...p, roleLabel: roleLabel(p, household) }));
  const familyName = household.displayName ?? `${people.find((p) => p.isAccountHolder)?.firstName ?? people[0]?.firstName ?? 'Our'}’s family`;
  const orientation = printable.page === 'letter-landscape' ? 'landscape' : 'portrait';
  const commitmentRows = resolved.rows.filter((r) => r.section === 'commitment');
  const jobRows = resolved.rows.filter((r) => r.section !== 'commitment');
  const openRows = jobRows.filter((r) => r.needsOwner);
  const chipText = chip ?? ((r: ChartRow) => FREQUENCY_LABEL[r.frequency]);
  const rowProps = { prefix: printable.id, people, names, items, readOnly, household, act, chipText, variant };

  return (
    <div>
      <div className="club-screen">
        <p className="max-w-2xl leading-relaxed text-warm-soft">{intro}</p>

        {readOnly && <p className="mt-4 border-l-[3px] border-rose bg-rose-wash px-4 py-3 text-warm-ink">This kit is yours to view and print. Editing ended with your membership.</p>}
        {neverSaved && !readOnly && <p className="mt-4 border-l-[3px] border-sage bg-sage-wash px-4 py-3 text-warm-ink">These are suggestions for your family. Change anything, then save to keep it.</p>}

        {!readOnly && resolved.suggestions.length > 0 && (
          <Suggestions
            id={`${printable.id}-suggestions`}
            suggestions={resolved.suggestions}
            names={names}
            familyChanged={familyChanged}
            onAccept={(s) => act((e) => acceptSuggestion(e, s))}
            onDismiss={(s) => act((e) => dismissSuggestion(e, s))}
            onAcceptAll={() => act((e) => resolved.suggestions.filter((s) => s.kind !== 'balance').reduce((x, s) => acceptSuggestion(x, s), e))}
          />
        )}

        <div className="mt-8 space-y-10">
          {people.map((p) => {
            const mine = jobRows.filter((r) => !r.needsOwner && r.ownerId === p.id);
            return (
              <section key={p.id} aria-labelledby={`who-${printable.id}-${p.id}`}>
                <div className="flex items-baseline justify-between gap-3 border-b border-warm-rule pb-2">
                  <h3 id={`who-${printable.id}-${p.id}`} className="font-serif text-[1.5rem] text-warm-ink">{p.firstName}</h3>
                  <span className="text-[0.85rem] text-warm-soft">
                    {roleLabel(p, household)} · {mine.length} {mine.length === 1 ? 'job' : 'jobs'}
                  </span>
                </div>
                <ul className="divide-y divide-warm-rule">
                  {mine.map((r) => (
                    <Row key={r.rowId} {...rowProps} row={r} unused={unused} open={open === r.rowId} onToggle={() => setOpen(open === r.rowId ? null : r.rowId)} />
                  ))}
                </ul>
                {!readOnly && <AddJob person={p} household={household} unused={unused.filter((i) => eligible(i, p, household.preferences))} act={act} />}
              </section>
            );
          })}

          {openRows.length > 0 && (
            <section aria-labelledby={`who-${printable.id}-open`}>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-warm-rule pb-2">
                <h3 id={`who-${printable.id}-open`} className="font-serif text-[1.5rem] text-warm-ink">Needs an owner</h3>
                <span className="text-[0.85rem] text-warm-soft">Up for grabs</span>
              </div>
              <p className="mt-2 text-[0.92rem] text-warm-soft">Nobody had room for these, or their owner left the family. Pick someone, or leave them open for your team meeting.</p>
              <ul className="divide-y divide-warm-rule">
                {openRows.map((r) => (
                  <Row key={r.rowId} {...rowProps} row={r} unused={unused} open={open === r.rowId} onToggle={() => setOpen(open === r.rowId ? null : r.rowId)} />
                ))}
              </ul>
            </section>
          )}

          {variant === 'command' && (
            <Commitments rows={commitmentRows} people={people} names={names} household={household} readOnly={readOnly} act={act} />
          )}

          {resolved.hidden.length > 0 && (
            <details className="border-t border-warm-rule pt-4">
              <summary className="cursor-pointer text-[0.95rem] font-semibold text-warm-ink">Removed jobs ({resolved.hidden.length})</summary>
              <ul className="mt-2 divide-y divide-warm-rule">
                {resolved.hidden.map((r) => (
                  <li key={r.rowId} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-warm-soft line-through decoration-warm-rule">{r.title}</span>
                    {!readOnly && <button type="button" className="min-h-11 text-[0.9rem] font-semibold underline underline-offset-4" onClick={() => act((e) => restore(e, r.rowId))}>Put back</button>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <section className="mt-12 border-t border-warm-rule pt-6">
          <h3 className="label text-warm-soft">Print</h3>
          <div className="mt-3">
            <PalettePicker value={palette} onChange={(p) => { setPalette(p); if (status === 'saved') setStatus('idle'); }} disabled={readOnly} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            {clubNav().canPrint ? (
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => printDocument(printable.id, orientation)}>
                Print or save as PDF
              </button>
            ) : (
              <PreviewOnlyNote />
            )}
            <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" aria-expanded={preview} onClick={() => setPreview(!preview)}>
              {preview ? 'Hide the preview' : 'Preview the printout'}
            </button>
          </div>
          <p className="mt-2 text-[0.85rem] text-warm-soft">US Letter, {orientation}. On a phone, choose Print, then share or save the PDF.</p>
        </section>
        {notice && <p role="alert" className="mt-4 border-l-[3px] border-rose bg-rose-wash px-4 py-3">{notice}</p>}
      </div>

      <PrintFrame open={preview} orientation={orientation}>
        {printable.component === 'ResetChecklist' ? (
          <OwnedChecklist doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} palette={palette} rows={resolved.rows} names={names}
            intro="This month’s team reset. Each job has one owner; tick it off when it’s done." preview={preview} />
        ) : printable.component === 'CommandCenter' ? (
          <CommandCenterSheet doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} palette={palette} preview={preview} rows={resolved.rows} names={names}
            checklist={printable.content?.items ?? []} intro={printable.content?.intro ?? ''} />
        ) : printable.component === 'LaunchChecklist' ? (
          <ResponsibilityChart doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} people={chartPeople} rows={resolved.rows} palette={palette} preview={preview}
            orientation="portrait" checkboxes chip={chipText} promise="Every task has one owner" footer={[`Organized Family Club · ${kit.theme}`, 'Tick it off when it’s done']} />
        ) : (
          <ResponsibilityChart doc={printable.id} title={printable.perPerson ? kit.theme : 'Our Family Team'} familyName={familyName} month={kit.month} people={chartPeople} rows={resolved.rows} palette={palette} preview={preview}
            {...(printable.perPerson ? { labels: true, promise: 'Each of us owns our part' } : {})} />
        )}
      </PrintFrame>

      {!readOnly && (
        <div data-club-chrome className="club-screen fixed inset-x-0 bottom-0 z-20 border-t border-warm-rule bg-ivory/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <p role="status" className="text-[0.88rem] text-warm-soft">
              {status === 'saving' ? 'Saving…'
                : status === 'conflict' ? 'This was changed on another device or tab.'
                : status === 'error' ? 'Couldn’t save. Check your connection.'
                : dirty ? 'Unsaved changes'
                : neverSaved ? 'Suggestions, not saved yet'
                : 'All changes saved'}
            </p>
            {status === 'conflict' ? (
              <button type="button" className="btn-secondary" onClick={() => clubNav().reload()}>Load the newest</button>
            ) : (
              <button type="button" className="btn-primary min-h-11 px-5" disabled={status === 'saving' || (!dirty && !neverSaved)} onClick={save}>
                {neverSaved ? (printable.component === 'LaunchChecklist' ? 'Save our plan' : SAVE_LABEL[variant]) : 'Save changes'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Suggestions({ id, suggestions, names, familyChanged, onAccept, onDismiss, onAcceptAll }: {
  id: string;
  suggestions: Suggestion[];
  names: Map<string, string>;
  familyChanged: boolean;
  onAccept: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
  onAcceptAll: () => void;
}) {
  const who = (id: string | null) => (id ? names.get(id) ?? 'someone' : 'nobody yet');
  const text = (s: Suggestion) =>
    s.kind === 'add' ? <>Add <strong>{s.row.title}</strong> {s.row.ownerId ? <>for {who(s.row.ownerId)}</> : <>(needs an owner)</>}</>
      : s.kind === 'owner' ? <>Give <strong>{s.title}</strong> to {who(s.ownerId)}</>
      : <>Move <strong>{s.title}</strong> from {who(s.fromId)} to {who(s.toId)}. It evens out the week.</>;
  const additions = suggestions.filter((s) => s.kind !== 'balance').length;
  return (
    <section aria-labelledby={id} className="mt-6 bg-sage-wash p-5 sm:p-6">
      <h3 id={id} className="font-serif text-[1.3rem] text-warm-ink">Suggested changes</h3>
      <p className="mt-1 text-[0.92rem] text-warm-soft">
        {familyChanged ? 'Your family changed since you last saved. ' : ''}Nothing changes until you say so.
      </p>
      <ul className="mt-3 divide-y divide-[#dfe6d8]">
        {suggestions.map((s) => (
          <li key={suggestionId(s)} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[0.98rem] text-warm-ink">{text(s)}</span>
            <span className="flex shrink-0 gap-4">
              <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => onAccept(s)}>{s.kind === 'balance' ? 'Move it' : 'Add'}</button>
              <button type="button" className="min-h-11 text-[0.92rem] text-warm-soft underline underline-offset-4" onClick={() => onDismiss(s)}>Not now</button>
            </span>
          </li>
        ))}
      </ul>
      {additions > 1 && <button type="button" className="mt-2 min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" onClick={onAcceptAll}>Add all {additions}</button>}
    </section>
  );
}

type RowShared = {
  prefix: string;
  people: PlannedMember[];
  names: Map<string, string>;
  items: KitItem[];
  readOnly: boolean;
  household: Household;
  act: (fn: (e: DocumentEdits) => DocumentEdits) => void;
  chipText: (r: ChartRow) => string;
  variant: 'chart' | 'command';
};

function Row({ prefix, row, people, names, items, unused, open, readOnly, household, onToggle, act, chipText }: {
  prefix: string;
  chipText: (r: ChartRow) => string;
  variant: 'chart' | 'command';
  row: ChartRow;
  people: PlannedMember[];
  names: Map<string, string>;
  items: KitItem[];
  unused: KitItem[];
  open: boolean;
  readOnly: boolean;
  household: Household;
  onToggle: () => void;
  act: (fn: (e: DocumentEdits) => DocumentEdits) => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [done, setDone] = useState(row.doneMeans ?? '');
  useEffect(() => { setTitle(row.title); setDone(row.doneMeans ?? ''); }, [row.title, row.doneMeans, open]);
  const owner = row.ownerId ? people.find((p) => p.id === row.ownerId) : undefined;
  const coach = coachLine(row.level, row.coachId ? names.get(row.coachId) ?? null : null);
  const item = row.itemId ? items.find((i) => i.id === row.itemId) : undefined;
  const wasOwner = row.needsOwner && row.ownerId ? names.get(row.ownerId) : null;
  const id = `row-${prefix}-${row.rowId}`;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 [&_.club-job-art]:h-10 [&_.club-job-art]:w-10 [&_img]:h-9 [&_img]:w-9">
          <JobArt illustration={row.illustration} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-warm-ink">{row.title}</p>
          <p className="mt-0.5 text-[0.86rem] text-warm-soft">
            {chipText(row)}
            {owner && owner.stage !== 'adult' && row.level ? ` · ${LEVEL_LABEL[row.level]}` : ''}
            {coach ? ` · ${coach}` : ''}
            {wasOwner ? ` · was ${wasOwner}’s` : ''}
            {row.belowSuggestedAge && item?.minAge ? ` · suggested from age ${item.minAge}` : ''}
          </p>
          {row.doneMeans && <p className="mt-0.5 text-[0.86rem] italic text-warm-soft">Done means: {row.doneMeans}</p>}
        </div>
        {!readOnly && (
          <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="min-h-11 shrink-0 px-1 text-[0.9rem] font-semibold text-warm-ink underline underline-offset-4">
            {open ? 'Close' : 'Change'}<span className="sr-only"> {row.title}</span>
          </button>
        )}
      </div>

      {open && !readOnly && (
        <div id={id} className="mt-3 grid gap-3 rounded-[6px] bg-white p-4 ring-1 ring-warm-rule sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-[0.85rem] text-warm-soft">The job</span>
            <input className={`${field} mt-1`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() !== row.title && act((e) => rename(e, row.rowId, title))} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-[0.85rem] text-warm-soft">Done means</span>
            <textarea className={`${field} mt-1 py-2`} rows={2} value={done} maxLength={160} onChange={(e) => setDone(e.target.value)} onBlur={() => done.trim() !== (row.doneMeans ?? '') && act((e) => setDoneMeans(e, row.rowId, done))} />
          </label>
          <>
          <label>
            <span className="text-[0.85rem] text-warm-soft">Whose job</span>
            <select className={`${field} mt-1`} value={owner ? owner.id : ''} onChange={(e) => act((x) => assign(x, household, row.rowId, e.target.value || null))}>
              <option value="">Needs an owner</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[0.85rem] text-warm-soft">How often</span>
            <select className={`${field} mt-1`} value={row.frequency} onChange={(e) => act((x) => setFrequency(x, row.rowId, e.target.value as Frequency))}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
            </select>
          </label>
          </>
          {owner && owner.stage !== 'adult' && (
            <>
              <label>
                <span className="text-[0.85rem] text-warm-soft">How much is theirs</span>
                <select className={`${field} mt-1`} value={row.level ?? 'learning'} onChange={(e) => act((x) => setLevel(x, row.rowId, e.target.value as OwnershipLevel))}>
                  {OWNERSHIP_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                </select>
              </label>
              {row.level !== 'owns' && (
                <label>
                  <span className="text-[0.85rem] text-warm-soft">{row.level === 'learning' ? 'Who they learn it with' : 'Who checks'}</span>
                  <select className={`${field} mt-1`} value={row.coachId ?? ''} onChange={(e) => act((x) => setCoach(x, household, row.rowId, e.target.value || null))}>
                    <option value="">Nobody</option>
                    {people.filter((p) => p.id !== owner.id && (p.stage === 'adult' || (p.age ?? 0) >= 14)).map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}
                  </select>
                </label>
              )}
            </>
          )}
          {unused.length > 0 && row.itemId && (
            <label className="sm:col-span-2">
              <span className="text-[0.85rem] text-warm-soft">Swap for another job</span>
              <select className={`${field} mt-1`} value="" onChange={(e) => e.target.value && act((x) => replace(x, items, row.rowId, e.target.value))}>
                <option value="">Choose a job…</option>
                {unused.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
            </label>
          )}
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <button type="button" className="min-h-11 text-[0.9rem] text-warm-soft underline underline-offset-4" onClick={() => { act((e) => remove(e, row.rowId)); onToggle(); }}>
              Remove from the chart
            </button>
            <button type="button" className="btn-secondary" onClick={() => {
              act((e) => {
                let x = e;
                if (title.trim() && title.trim() !== row.title) x = rename(x, row.rowId, title);
                if (done.trim() !== (row.doneMeans ?? '')) x = setDoneMeans(x, row.rowId, done);
                return x;
              });
              onToggle();
            }}>Done</button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddJob({ person, household, unused, act, section, label = `+ Add a job for ${person.firstName}`, noun = 'job' }: {
  person: PlannedMember;
  household: Household;
  unused: KitItem[];
  act: (fn: (e: DocumentEdits) => DocumentEdits) => void;
  /** Routines: which part the new step goes in (its frequency is school days). */
  section?: ChartSection;
  label?: string;
  noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [frequency, setFreq] = useState<Frequency>(section ? 'weekdays' : 'weekly');
  const add = (item?: KitItem) => {
    act((e) => addRow(e, household, item ? { title: item.title, item, ownerId: person.id } : { title, frequency, ownerId: person.id, ...(section ? { section } : {}) }));
    setTitle('');
    setOpen(false);
  };
  if (!open) {
    return <button type="button" className="mt-2 min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => setOpen(true)}>{label}</button>;
  }
  return (
    <div className={`mt-3 grid gap-3 rounded-[6px] bg-white p-4 ring-1 ring-warm-rule sm:items-end ${section ? 'sm:grid-cols-[1fr_auto]' : 'sm:grid-cols-[1fr_11rem_auto]'}`}>
      <label>
        <span className="text-[0.85rem] text-warm-soft">A {noun} for {person.firstName}</span>
        <input className={`${field} mt-1`} value={title} maxLength={80} placeholder={section ? 'Feed the fish' : 'Walk the dog after school'} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {!section && (
        <label>
          <span className="text-[0.85rem] text-warm-soft">How often</span>
          <select className={`${field} mt-1`} value={frequency} onChange={(e) => setFreq(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
          </select>
        </label>
      )}
      <button type="button" className="btn-secondary" disabled={!title.trim()} onClick={() => add()}>{noun === 'job' ? 'Add job' : `Add ${noun}`}</button>
      {unused.length > 0 && (
        <label className="sm:col-span-3">
          <span className="text-[0.85rem] text-warm-soft">Or pick one we suggest</span>
          <select className={`${field} mt-1`} value="" onChange={(e) => { const item = unused.find((i) => i.id === e.target.value); if (item) add(item); }}>
            <option value="">Choose a job…</option>
            {unused.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </label>
      )}
      <button type="button" className={`justify-self-start text-[0.88rem] text-warm-soft underline underline-offset-4 ${section ? 'sm:col-span-2' : 'sm:col-span-3'}`} onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

/** Where printing isn't possible (the hosted preview's frame blocks the print dialog). */
export function PreviewOnlyNote() {
  return (
    <p className="max-w-md text-[0.9rem] leading-relaxed text-warm-soft">
      Printing opens the print dialog on the site. In this preview, use <strong className="text-warm-ink">Preview the printout</strong> to see the exact US Letter page.
    </p>
  );
}

/** Command center: the family's own recurring commitments (practices, lessons, clubs), typed in by her. */
function Commitments({ rows, people, names, household, readOnly, act }: {
  rows: ChartRow[];
  people: PlannedMember[];
  names: Map<string, string>;
  household: Household;
  readOnly: boolean;
  act: (fn: (e: DocumentEdits) => DocumentEdits) => void;
}) {
  const [title, setTitle] = useState('');
  const [who, setWho] = useState('');
  const [frequency, setFreq] = useState<Frequency>('weekly');
  return (
    <section aria-labelledby="club-commitments">
      <div className="flex items-baseline justify-between gap-3 border-b border-warm-rule pb-2">
        <h3 id="club-commitments" className="font-serif text-[1.5rem] text-warm-ink">Every week</h3>
        <span className="text-[0.85rem] text-warm-soft">Practices, lessons, clubs</span>
      </div>
      <p className="mt-2 text-[0.92rem] text-warm-soft">Add the things that happen every week, with the day and time. They print beside who owns what, ready to copy onto your family calendar each Sunday.</p>
      {rows.length > 0 && (
        <ul className="mt-2 divide-y divide-warm-rule">
          {rows.map((r) => (
            <li key={r.rowId} className="flex items-center justify-between gap-3 py-3">
              <span>
                <span className="font-semibold text-warm-ink">{r.title}</span>
                <span className="block text-[0.86rem] text-warm-soft">{r.ownerId ? names.get(r.ownerId) : 'Everyone'} · {FREQUENCY_LABEL[r.frequency]}</span>
              </span>
              {!readOnly && <button type="button" className="min-h-11 text-[0.9rem] text-warm-soft underline underline-offset-4" onClick={() => act((e) => remove(e, r.rowId))}>Remove<span className="sr-only"> {r.title}</span></button>}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="mt-3 grid gap-3 rounded-[6px] bg-white p-4 ring-1 ring-warm-rule sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
          <label>
            <span className="text-[0.85rem] text-warm-soft">What and when</span>
            <input id="club-commitment-title" className={`${field} mt-1`} value={title} maxLength={80} placeholder="Soccer practice, Tue & Thu 5:30" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span className="text-[0.85rem] text-warm-soft">For</span>
            <select className={`${field} mt-1`} value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Everyone</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[0.85rem] text-warm-soft">How often</span>
            <select className={`${field} mt-1`} value={frequency} onChange={(e) => setFreq(e.target.value as Frequency)}>
              {FREQUENCIES.filter((f) => f !== 'once').map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" disabled={!title.trim()} onClick={() => {
            act((e) => addRow(e, household, { title, ownerId: who || null, frequency, section: 'commitment' }));
            setTitle('');
          }}>Add</button>
        </div>
      )}
    </section>
  );
}

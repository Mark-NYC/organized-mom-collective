/**
 * /club/kits/<slug>: a monthly kit, opened already filled in for her family. Engine-filled printables get the chart
 * editor; the activity and worksheets print with her family's names; the field guide reads on screen. Everything comes
 * from the kit's config (src/data/club/kits/), so later kits reuse this page.
 *
 * Kits with an `overview` (August) open on it: the school setup and 5–8 first actions, with the full plan, routines
 * and command center a tab away; the mailer's printable twins sit under "In the mail". A month switcher links every
 * kit she can open. Kits without those (November) look as they always have.
 */
import { useEffect, useMemo, useState } from 'react';
import { kitBySlug, kitItems } from '../../data/club/kits';
import { FREQUENCY_LABEL, LEAD_LABEL, monthLabel, SCHOOL_LABEL } from '../../data/club/labels';
import { defaultToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { SCHOOL_TYPES, type KitConfig, type KitItem, type KitPrintable, type SchoolType } from '../../data/club/types';
import type { ChartRow } from '../../lib/club/edits';
import { topActions } from '../../lib/club/overview';
import { dueLabel, earliestStart, inSchool, readSetup, schoolSetupFor, SETUP_DOC, startLabel, withSchool, type SchoolSetup } from '../../lib/club/school';
import { GuideSheet } from './print/SchoolPrintables';
import { JobArt } from './print/ResponsibilityChart';
import { printDocument } from '../../lib/club/print';
import { planMembers, type Household } from '../../lib/club/profile';
import { ConflictError, type KitDocuments } from '../../lib/club/store';
import { routes } from '../../routes';
import ChartEditor from './ChartEditor';
import ClubGate, { type ClubContext } from './ClubGate';
import PalettePicker from './PalettePicker';
import PrintFrame from './PrintFrame';
import { ChecklistSheet, MeetingCard } from './print/Worksheet';
import { clubNav } from '../../lib/club/nav';
import { PreviewOnlyNote } from './ChartEditor';

export default function KitPage({ slug }: { slug: string }) {
  return <ClubGate page="kit">{(ctx) => <Kit ctx={ctx} slug={slug} />}</ClubGate>;
}

const INTRO: Record<string, string> = {
  flagship: 'We’ve suggested jobs for everyone, by age, so no one person carries the house. Every job has one owner, start to finish.',
  reset: 'This month’s team reset, from the cleaning companion’s monthly project, split into jobs with owners.',
  'school-launch': 'Each child’s own prep for their school and first day, plus the shared prep, each with one owner. Dates count back from each child’s first day.',
  'school-routines': 'A morning and after-school routine for each child, from their age and school. Reorder, reword or remove any step; each child’s page prints on its own.',
  'command-center': 'Who owns each school job, all year, and your family’s weekly commitments. It prints on one page to hang beside your family calendar, where the week’s details go.',
};

/** Text on a row's chip: a due date counted back from the child's first day (or the earliest one), else how often. */
function chipFor(items: Map<string, KitItem>, setup: SchoolSetup) {
  const earliest = earliestStart(setup);
  return (r: ChartRow) => {
    const lead = r.itemId ? items.get(r.itemId)?.lead : undefined;
    if (!lead) return FREQUENCY_LABEL[r.frequency];
    const due = dueLabel((r.ownerId && setup[r.ownerId]?.start) || earliest, lead);
    if (!due) return LEAD_LABEL[lead];
    return lead === 'first-day' ? `On ${due}` : `By ${due}`;
  };
}

function Kit({ ctx, slug }: { ctx: ClubContext; slug: string }) {
  const kit = kitBySlug(slug);
  const [data, setData] = useState<{ household: Household; docs: KitDocuments; kits: string[] } | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(() => (typeof location !== 'undefined' && location.hash.slice(1)) || '');
  const [saved, setSaved] = useState<SchoolSetup>({});
  const [setupRevision, setSetupRevision] = useState(0);
  const [setupStatus, setSetupStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [rows, setRows] = useState<Record<string, ChartRow[]>>({});

  useEffect(() => {
    if (!kit) return;
    Promise.all([ctx.store.household(), ctx.store.me()])
      .then(async ([household, me]) => {
        if (!household) return clubNav().go(ctx.href(routes.clubStart), { replace: true });
        const docs = await ctx.store.documents(slug);
        const setupDoc = docs.documents[SETUP_DOC];
        if (setupDoc) {
          setSaved(readSetup(setupDoc.edits));
          setSetupRevision(setupDoc.revision);
        }
        setData({ household, docs, kits: me.kits.map((k) => k.slug) });
      })
      .catch((e: Error) => setError(e.message === 'not_found' ? 'closed' : 'load'));
  }, [slug]);

  const household = data?.household;
  const setup = useMemo(() => (kit?.setup && household ? schoolSetupFor(household, kit.month, saved) : {}), [kit, household, saved]);
  const kitHousehold = useMemo(() => (household && kit?.setup ? withSchool(household, setup) : household), [household, setup, kit]);
  const itemMap = useMemo(() => new Map((kit ? [...kit.items, ...Object.values(kit.itemSets ?? {}).flat()] : []).map((i) => [i.id, i])), [kit]);
  const chip = useMemo(() => chipFor(itemMap, setup), [itemMap, setup]);

  // The school setup saves itself a moment after each change (it's settings, not a chart to review).
  const saveSetup = (next: SchoolSetup) => {
    setSaved(next);
    setSetupStatus('saving');
  };
  useEffect(() => {
    if (setupStatus !== 'saving' || !kit || !household) return;
    const t = setTimeout(() => {
      ctx.store
        .saveDocument(kit.slug, SETUP_DOC, { edits: { children: saved }, palette: 'warm-neutrals', engineVersion: kit.engineVersion, profileVersion: household.profileVersion }, setupRevision)
        .then((rev) => { setSetupRevision(rev); setSetupStatus('saved'); })
        .catch((e) => setSetupStatus(e instanceof ConflictError ? 'conflict' : 'error'));
    }, 600);
    return () => clearTimeout(t);
  }, [saved, setupStatus]);

  if (!kit || error === 'closed') {
    return (
      <div className="max-w-xl">
        <h1 className="font-serif text-[2rem] text-warm-ink">This kit isn’t open</h1>
        <p className="mt-3 text-warm-soft">It may not be released yet, or it isn’t part of your membership.</p>
        <a className="mt-6 inline-block font-semibold underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>Back to your kits</a>
      </div>
    );
  }
  if (error) return <p role="alert">We couldn’t open this kit. Check your connection and reload the page.</p>;
  if (!data || !kitHousehold) return <p className="text-warm-soft">Opening your kit…</p>;

  const readOnly = data.docs.can === 'read';
  const primary = kit.printables.filter((p) => !p.secondary);
  const mail = kit.printables.filter((p) => p.secondary);
  const tabs: { id: string; label: string }[] = [
    ...(kit.overview ? [{ id: 'overview', label: 'Overview' }] : []),
    ...primary.map((p) => ({ id: p.id, label: p.tabLabel ?? shortLabel(p) })),
    ...(mail.length ? [{ id: 'in-the-mail', label: 'In the mail' }] : []),
    ...(kit.printables.some((p) => p.component === 'Guide') ? [] : [{ id: 'field-guide', label: 'Field guide' }]),
  ];
  // An old or mistyped #hash opens the first tab.
  const shown = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const choose = (id: string) => {
    setTab(id);
    history.replaceState(null, '', `#${id}`);
  };
  const otherKits = data.kits.map((s) => kitBySlug(s)).filter((k): k is KitConfig => Boolean(k)).sort((a, b) => (a.month < b.month ? -1 : 1));

  return (
    <>
      <div className="club-screen">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href={ctx.href(routes.clubDashboard)} className="text-[0.9rem] text-warm-soft underline underline-offset-4">Your kits</a>
          {otherKits.length > 1 && (
            <nav aria-label="Monthly kits" className="flex rounded-full bg-white p-1 ring-1 ring-warm-rule">
              {otherKits.map((k) => (
                <a key={k.slug} href={ctx.href(routes.clubKit(k.slug))} aria-current={k.slug === kit.slug ? 'page' : undefined}
                  className="rounded-full px-4 py-2 text-[0.85rem] font-semibold text-warm-soft aria-[current=page]:bg-warm-ink aria-[current=page]:text-white">
                  {monthLabel(k.month)}
                </a>
              ))}
            </nav>
          )}
        </div>
        <p className="label mt-5 text-warm-soft">{monthLabel(kit.month)}</p>
        <h1 className="mt-2 font-serif text-[2.1rem] leading-[1.1] text-warm-ink sm:text-[2.7rem]">{kit.theme}</h1>
        <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-warm-soft">{kit.shift}</p>

        <nav aria-label="In this kit" className="-mx-4 mt-7 overflow-x-auto border-b border-warm-rule px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-5">
            {tabs.map((t) => (
              <button key={t.id} type="button" aria-current={shown === t.id ? 'true' : undefined} onClick={() => choose(t.id)}
                className="min-h-11 border-b-2 border-transparent pb-2 text-[0.92rem] font-semibold text-warm-soft aria-[current=true]:border-warm-ink aria-[current=true]:text-warm-ink">
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Every part stays mounted (unsaved edits survive switching tabs); only the chosen one shows. */}
      <div className="mt-6">
        {kit.overview && (
          <div hidden={shown !== 'overview'}>
            <Overview kit={kit} household={kitHousehold} setup={setup} onSetup={saveSetup} setupStatus={setupStatus} readOnly={readOnly}
              rows={rows} itemMap={itemMap} chip={chip} choose={(id) => { choose(id); window.scrollTo(0, 0); }} />
          </div>
        )}
        {primary.map((p) => (
          <div key={p.id} hidden={shown !== p.id}>
            {p.items ? (
              <ChartEditor
                store={ctx.store}
                kit={kit}
                printable={p}
                items={kitItems(kit, p.items) ?? []}
                household={kitHousehold}
                saved={data.docs.documents[p.id]}
                readOnly={readOnly}
                intro={INTRO[p.id] ?? INTRO[p.kind] ?? ''}
                chip={kit.setup ? chip : undefined}
                setup={setup}
                onRows={(r) => setRows((all) => ({ ...all, [p.id]: r }))}
              />
            ) : (
              <Sheet kit={kit} printable={p} household={kitHousehold} />
            )}
          </div>
        ))}
        {mail.length > 0 && (
          <div hidden={shown !== 'in-the-mail'}>
            <InTheMail kit={kit} printables={mail} household={kitHousehold} />
          </div>
        )}
        {!kit.printables.some((p) => p.component === 'Guide') && (
          <div hidden={shown !== 'field-guide'}>
            <FieldGuide kit={kit} />
          </div>
        )}
      </div>
    </>
  );
}

const shortLabel = (p: KitPrintable) =>
  p.kind === 'flagship' ? 'Family chart' : p.kind === 'reset' ? 'Team reset' : p.kind === 'activity' ? 'Team meeting' : p.title;

/** The activity and worksheets: shown on screen, printed with her family's names. */
function Sheet({ kit, printable, household }: { kit: KitConfig; printable: KitPrintable; household: Household }) {
  const [palette, setPalette] = useState<ToolPaletteId>((household.preferences.palette as ToolPaletteId | undefined) ?? defaultToolPalette);
  const [preview, setPreview] = useState(false);
  const people = planMembers(household, kit.month).map((p) => p.firstName);
  const familyName = household.displayName ?? 'Our family';
  const isActivity = printable.kind === 'activity';
  const isGuide = printable.component === 'Guide';
  const steps = isActivity ? kit.mailer.activity.steps : printable.content?.items ?? [];
  const activityIntro = printable.content?.intro ?? `About ${kit.mailer.activity.minutes} minutes, everyone together, with the family chart on the table.`;
  return (
    <div>
      <div className="club-screen max-w-2xl">
        <h2 className="font-serif text-[1.6rem] text-warm-ink">{printable.title}</h2>
        {isGuide ? (
          kit.mailer.fieldGuide.sections.map((g) => (
            <section key={g.heading} className="mt-5">
              <h3 className="text-[1.05rem] font-bold text-warm-ink">{g.heading}</h3>
              <p className="mt-1.5 leading-relaxed text-warm-soft">{g.body}</p>
            </section>
          ))
        ) : (
          <>
            <p className="mt-2 leading-relaxed text-warm-soft">{isActivity ? activityIntro : printable.content?.intro}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-warm-ink">
              {steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </>
        )}
        <div className="mt-8 border-t border-warm-rule pt-6">
          <PalettePicker value={palette} onChange={setPalette} />
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            {clubNav().canPrint ? (
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => printDocument(printable.id, 'portrait')}>Print or save as PDF</button>
            ) : (
              <PreviewOnlyNote />
            )}
            <button type="button" className="min-h-11 text-[0.92rem] font-semibold underline underline-offset-4" aria-expanded={preview} onClick={() => setPreview(!preview)}>
              {preview ? 'Hide the preview' : 'Preview the printout'}
            </button>
          </div>
        </div>
      </div>
      <PrintFrame open={preview} orientation="portrait">
        {isGuide ? (
          <GuideSheet doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} palette={palette} preview={preview} sections={kit.mailer.fieldGuide.sections} />
        ) : isActivity ? (
          <MeetingCard doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} palette={palette} steps={steps} minutes={kit.mailer.activity.minutes} people={people} preview={preview}
            {...(printable.content ? { intro: activityIntro, lineLabel: printable.content.lineLabel } : {})} />
        ) : (
          <ChecklistSheet doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} palette={palette} intro={printable.content?.intro ?? ''} items={steps} preview={preview} />
        )}
      </PrintFrame>
    </div>
  );
}

function FieldGuide({ kit }: { kit: KitConfig }) {
  const g = kit.mailer.fieldGuide;
  return (
    <article className="club-screen max-w-2xl">
      {kit.mailer.letter && (
        <section className="mb-10 bg-blush-wash p-6">
          <h2 className="font-serif text-[1.5rem] text-warm-ink">{kit.mailer.letter.title}</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-warm-ink">{kit.mailer.letter.body}</p>
        </section>
      )}
      <h2 className="font-serif text-[1.7rem] text-warm-ink">{g.title}</h2>
      {g.sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h3 className="text-[1.05rem] font-bold text-warm-ink">{s.heading}</h3>
          <p className="mt-2 leading-relaxed text-warm-soft">{s.body}</p>
        </section>
      ))}
    </article>
  );
}

/** A kit's front door: her family's situation, the school setup, and the few things to do first. */
function Overview({ kit, household, setup, onSetup, setupStatus, readOnly, rows, itemMap, chip, choose }: {
  kit: KitConfig;
  household: Household;
  setup: SchoolSetup;
  onSetup: (s: SchoolSetup) => void;
  setupStatus: string;
  readOnly: boolean;
  rows: Record<string, ChartRow[]>;
  itemMap: Map<string, KitItem>;
  chip: (r: ChartRow) => string;
  choose: (tab: string) => void;
}) {
  const o = kit.overview!;
  const source = kit.printables.find((p) => p.items === o.from);
  const plan = (source && rows[source.id]) ?? [];
  const actions = topActions(plan, kitItems(kit, o.from) ?? [], o);
  const people = planMembers(household, kit.month);
  const names = new Map(household.members.map((m) => [m.id, m.firstName]));
  const kids = people.filter((p) => p.stage !== 'adult');
  const inSchoolKids = kids.filter((k) => inSchool(setup[k.id]));
  const routinePrintable = kit.printables.find((p) => p.editor === 'routine');
  const commandPrintable = kit.printables.find((p) => p.editor === 'command');
  const routineKids = routinePrintable ? new Set((rows[routinePrintable.id] ?? []).map((r) => r.ownerId)).size : 0;
  const commandRows = commandPrintable ? (rows[commandPrintable.id] ?? []).filter((r) => r.section !== 'commitment') : [];
  const commandOwners = [...new Set(commandRows.filter((r) => !r.needsOwner).map((r) => names.get(r.ownerId ?? '')))].filter(Boolean);
  const field = 'min-h-11 rounded-[4px] border border-warm-rule bg-white px-2.5 text-[0.95rem] text-warm-ink';
  const missingDates = inSchoolKids.some((k) => !setup[k.id]?.start);
  const [editing, setEditing] = useState(false);

  return (
    <div className="club-screen max-w-3xl">
      <p className="text-[1.08rem] leading-relaxed text-warm-ink">{o.intro}</p>

      {inSchoolKids.length > 0 ? (
        <section aria-labelledby="club-first" className="mt-6 bg-sage-wash p-5 sm:p-7">
          <h2 id="club-first" className="font-serif text-[1.55rem] leading-tight text-warm-ink">Start with these {actions.length}</h2>
          <p className="mt-1 text-[0.92rem] text-warm-soft">Already shared out. Everything else is in the full plan.</p>
          <ol className="mt-4 space-y-3">
            {actions.map((r) => (
              <li key={r.rowId} className="grid grid-cols-[auto_1fr] gap-3 rounded-[6px] bg-white p-3.5 ring-1 ring-[#dfe6d8]">
                <span className="mt-0.5 [&_.club-job-art]:h-9 [&_.club-job-art]:w-9 [&_img]:h-8 [&_img]:w-8"><JobArt illustration={r.illustration} /></span>
                <span>
                  <span className="block font-semibold leading-snug text-warm-ink">{r.title}</span>
                  <span className="mt-0.5 block text-[0.88rem] text-warm-soft">
                    <strong className="font-semibold text-warm-ink">{r.needsOwner ? 'Needs an owner' : names.get(r.ownerId ?? '')}</strong> · {chip(r)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {source && (
            <button type="button" className="btn-primary mt-6 w-full sm:w-auto" onClick={() => choose(source.id)}>
              See the whole launch plan ({plan.length})
            </button>
          )}
        </section>
      ) : (
        <p className="mt-8 border-l-[3px] border-sage bg-sage-wash px-4 py-3 text-warm-ink">Nobody’s starting school this year, so there’s nothing to prep. Change a child above if that’s not right.</p>
      )}

      <section aria-labelledby="club-setup" className="mt-9">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="club-setup" className="label text-warm-soft">Who’s starting what</h2>
          <span role="status" className="text-[0.82rem] text-warm-soft">
            {setupStatus === 'saving' ? 'Saving…' : setupStatus === 'saved' ? 'Saved' : setupStatus === 'conflict' ? 'Changed on another device. Reload to see it.' : setupStatus === 'error' ? 'Couldn’t save. Check your connection.' : ''}
          </span>
        </div>
        {kids.length === 0 ? (
          <p className="mt-3 text-warm-soft">No children on your family profile yet.</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-warm-rule border-y border-warm-rule">
              {kids.map((k) => {
                const c = setup[k.id];
                return (
                  <li key={k.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-semibold text-warm-ink">{k.firstName} <span className="font-normal text-warm-soft">· {k.age}</span></span>
                      <span className="text-[0.9rem] text-warm-soft">
                        {SCHOOL_LABEL[c?.type ?? 'none']}{inSchool(c) ? ` · ${c?.start ? `starts ${startLabel(c.start)}` : 'first day not set'}` : ''}
                      </span>
                    </div>
                    {editing && !readOnly && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select aria-label={`Where ${k.firstName} goes to school`} className={field} value={c?.type ?? 'none'}
                          onChange={(e) => onSetup({ ...setup, [k.id]: { ...c, type: e.target.value as SchoolType } })}>
                          {SCHOOL_TYPES.map((t) => <option key={t} value={t}>{SCHOOL_LABEL[t]}</option>)}
                        </select>
                        {inSchool(c) && (
                          <label className="flex items-center gap-2 text-[0.88rem] text-warm-soft">
                            First day
                            <input type="date" className={field} value={c?.start ?? ''} min={`${kit.month.slice(0, 4)}-07-01`} max={`${kit.month.slice(0, 4)}-10-31`}
                              onChange={(e) => onSetup({ ...setup, [k.id]: { ...c!, ...(e.target.value ? { start: e.target.value } : { start: undefined }) } })} />
                          </label>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {!readOnly && (
              <button type="button" className="mt-2 min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" aria-expanded={editing} onClick={() => setEditing(!editing)}>
                {editing ? 'Done' : missingDates ? 'Add first days and schools' : 'Change schools or first days'}
              </button>
            )}
            <p className="text-[0.85rem] text-warm-soft">We guessed schools from ages. Every child can have their own school and first day; the plan follows.</p>
          </>
        )}
      </section>

      <section aria-label="More in this kit" className="mt-9 grid gap-4 sm:grid-cols-2">
        {routinePrintable && (
          <button type="button" onClick={() => choose(routinePrintable.id)} className="bg-white p-5 text-left ring-1 ring-warm-rule hover:ring-warm-ink">
            <span className="label text-warm-soft">When you want more</span>
            <span className="mt-2 block font-serif text-[1.3rem] text-warm-ink">Morning and after-school routines</span>
            <span className="mt-1.5 block text-[0.92rem] text-warm-soft">{routineKids ? `${routineKids} ${routineKids === 1 ? 'chart' : 'charts'}, one per child, ready to print.` : 'One chart per child in school.'}</span>
          </button>
        )}
        {commandPrintable && (
          <button type="button" onClick={() => choose(commandPrintable.id)} className="bg-white p-5 text-left ring-1 ring-warm-rule hover:ring-warm-ink">
            <span className="label text-warm-soft">For the whole year</span>
            <span className="mt-2 block font-serif text-[1.3rem] text-warm-ink">School-year command center</span>
            <span className="mt-1.5 block text-[0.92rem] text-warm-soft">Rides, school email, lunches and papers{commandOwners.length ? `, shared between ${commandOwners.join(', ')}` : ''}.</span>
          </button>
        )}
      </section>
    </div>
  );
}

/** The mailer's printable twins, plus where Megan's letter goes. */
function InTheMail({ kit, printables, household }: { kit: KitConfig; printables: KitPrintable[]; household: Household }) {
  return (
    <div>
      <div className="club-screen max-w-2xl">
        <p className="leading-relaxed text-warm-soft">Everything here also comes in your printed {monthLabel(kit.month).split(' ')[0]} mailer, with a QR code back to this kit. Print another copy any time.</p>
        <section className="mt-6 bg-blush-wash p-6">
          <p className="label text-warm-soft">A letter from Megan</p>
          {kit.mailer.letter ? (
            <>
              <h2 className="mt-2 font-serif text-[1.5rem] text-warm-ink">{kit.mailer.letter.title}</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-warm-ink">{kit.mailer.letter.body}</p>
            </>
          ) : (
            <p className="mt-2 leading-relaxed text-warm-ink">Placeholder. Megan writes this letter herself; it opens the printed mailer.</p>
          )}
        </section>
      </div>
      {printables.map((p) => (
        <div key={p.id} className="mt-12 border-t border-warm-rule pt-8">
          <Sheet kit={kit} printable={p} household={household} />
        </div>
      ))}
    </div>
  );
}

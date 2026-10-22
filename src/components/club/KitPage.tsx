/**
 * /club/kits/<slug>: a monthly kit, opened already filled in for her family. Everything comes from the kit's config
 * (src/data/club/kits/), so later kits reuse this page.
 *
 * Three-part kits (August on: `action` and `tool`) open on one calm screen: the month's title, its one action as a
 * checklist (check off, note who's helping, print), and one button to the optional tool; the letter reads on screen and
 * prints front and back. A month switcher links every kit she can open. Kits without those (November) keep their tabs:
 * engine-filled printables get the chart editor, the activity and worksheets print with her family's names, the field
 * guide reads on screen.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { kitBySlug, kitItems } from '../../data/club/kits';
import { monthLabel } from '../../data/club/labels';
import { defaultToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import type { KitConfig, KitPrintable } from '../../data/club/types';
import { readAction, MAX_HELPER, type ActionState } from '../../lib/club/action';
import { schoolSetupFor, withSchool } from '../../lib/club/school';
import { GuideSheet } from './print/SchoolPrintables';
import { ActionSheet, LetterSheets } from './print/LetterPrintables';
import { printDocument } from '../../lib/club/print';
import { planMembers, type Household } from '../../lib/club/profile';
import { ConflictError, type ClubStore, type KitDocuments } from '../../lib/club/store';
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
};

function Kit({ ctx, slug }: { ctx: ClubContext; slug: string }) {
  const kit = kitBySlug(slug);
  const [data, setData] = useState<{ household: Household; docs: KitDocuments; kits: string[] } | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(() => (typeof location !== 'undefined' && location.hash.slice(1)) || '');

  useEffect(() => {
    if (!kit) return;
    Promise.all([ctx.store.household(), ctx.store.me()])
      .then(async ([household, me]) => {
        if (!household) return clubNav().go(ctx.href(routes.clubStart), { replace: true });
        const docs = await ctx.store.documents(slug);
        setData({ household, docs, kits: me.kits.map((k) => k.slug) });
      })
      .catch((e: Error) => setError(e.message === 'not_found' ? 'closed' : 'load'));
  }, [slug]);

  // Kits that care where children go to school guess it from age and the family's homeschool preference: no setup step.
  const household = data?.household;
  const kitHousehold = useMemo(() => (household && kit?.setup ? withSchool(household, schoolSetupFor(household, kit.month)) : household), [household, kit]);

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
  const choose = (id: string) => {
    setTab(id);
    history.replaceState(null, '', `#${id}`);
  };
  const otherKits = data.kits.map((s) => kitBySlug(s)).filter((k): k is KitConfig => Boolean(k)).sort((a, b) => (a.month < b.month ? -1 : 1));
  const top = (
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
  );

  if (kit.action) {
    return <ThreePartKit kit={kit} store={ctx.store} household={kitHousehold} docs={data.docs} readOnly={readOnly} top={top} view={tab} choose={choose} />;
  }

  const tabs: { id: string; label: string }[] = [
    ...kit.printables.map((p) => ({ id: p.id, label: p.tabLabel ?? shortLabel(p) })),
    ...(kit.printables.some((p) => p.component === 'Guide') ? [] : [{ id: 'field-guide', label: 'Field guide' }]),
  ];
  // An old or mistyped #hash opens the first tab.
  const shown = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <>
      <div className="club-screen">
        {top}
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
        {kit.printables.map((p) => (
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
              />
            ) : (
              <Sheet kit={kit} printable={p} household={kitHousehold} />
            )}
          </div>
        ))}
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
  const steps = isActivity ? kit.mailer.activity?.steps ?? [] : printable.content?.items ?? [];
  const activityIntro = printable.content?.intro ?? `About ${kit.mailer.activity?.minutes ?? 20} minutes, everyone together, with the family chart on the table.`;
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
          <MeetingCard doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} palette={palette} steps={steps} minutes={kit.mailer.activity?.minutes ?? 20} people={people} preview={preview}
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


/**
 * Three-part kits: the month's title, its one action, and one button to the optional tool. The letter reads on screen
 * and prints front and back. The tool opens in place (#tool) and stays mounted, so unsaved edits survive going back.
 */
function ThreePartKit({ kit, store, household, docs, readOnly, top, view, choose }: {
  kit: KitConfig;
  store: ClubStore;
  household: Household;
  docs: KitDocuments;
  readOnly: boolean;
  top: ReactNode;
  view: string;
  choose: (id: string) => void;
}) {
  const tool = kit.tool ? kit.printables.find((p) => p.id === kit.tool!.printable) : undefined;
  const actionDoc = kit.printables.find((p) => p.component === 'Countdown');
  const letterDoc = kit.printables.find((p) => p.component === 'Letter');
  const [action, setAction] = useState<ActionState>(() => readAction(actionDoc && docs.documents[actionDoc.id]?.edits, kit.action!.items.length));
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterPreview, setLetterPreview] = useState(false);
  const showTool = Boolean(tool) && view === 'tool';
  const kids = planMembers(household, kit.month).filter((p) => p.stage !== 'adult' && (p.age ?? 0) >= 3);
  const open = (id: string) => {
    choose(id);
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* Screen-only parts carry .club-screen; each printout's frame sits outside them so it can print. */}
      <div hidden={showTool} className="max-w-3xl">
        <div className="club-screen">
        {top}
        <p className="label mt-6 text-warm-soft">{monthLabel(kit.month)}</p>
        <h1 className="mt-2 font-serif text-[2.2rem] leading-[1.08] text-warm-ink sm:text-[2.8rem]">{kit.theme}</h1>
        {kit.subtitle && <p className="mt-2 font-serif text-[1.25rem] italic text-rose-deep">{kit.subtitle}</p>}
        {kit.mailer.letter && (
          <button type="button" className="mt-4 min-h-11 text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4" aria-expanded={letterOpen} onClick={() => setLetterOpen(!letterOpen)}>
            {letterOpen ? 'Close the letter' : 'Read this month’s letter'}
          </button>
        )}
        {letterOpen && kit.mailer.letter && (
          <article className="mt-3 bg-cream p-6 font-serif text-[1.05rem] leading-relaxed text-warm-ink ring-1 ring-warm-rule sm:p-8">
            {kit.mailer.letter.greeting && <p className="italic">{kit.mailer.letter.greeting}</p>}
            {kit.mailer.letter.body.split(/\n\n+/).map((p) => <p key={p} className="mt-3">{p}</p>)}
            {kit.mailer.letter.signoff && <p className="mt-4 italic">Warmly, <span className="club-hand not-italic text-[1.5rem] text-warm-soft">{kit.mailer.letter.signoff}</span></p>}
          </article>
        )}
        </div>

        {actionDoc && (
          <ActionChecklist kit={kit} doc={actionDoc} store={store} household={household} saved={docs.documents[actionDoc.id]} readOnly={readOnly} state={action} onChange={setAction} />
        )}

        {tool && kit.tool && (
          <section aria-labelledby="club-tool" className="club-screen mt-10 border-t border-warm-rule pt-8">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-wash font-serif text-[1.1rem] text-warm-ink ring-1 ring-sage">2</span>
              <div>
                <h2 id="club-tool" className="font-serif text-[1.6rem] leading-tight text-warm-ink">{kit.tool.title}</h2>
                <p className="mt-2 leading-relaxed text-warm-soft">{kit.tool.blurb}</p>
                {kids.length > 0 && <p className="mt-2 text-[0.92rem] text-warm-soft">Ready for {kids.map((k) => k.firstName).join(', ')}. Optional: the countdown works without it.</p>}
                <button type="button" className="btn-primary mt-5 w-full sm:w-auto" onClick={() => open('tool')}>{kit.tool.cta}</button>
              </div>
            </div>
          </section>
        )}

        {letterDoc && (
          <section aria-labelledby="club-letter" className="club-screen mt-12 border-t border-warm-rule pt-6">
            <h2 id="club-letter" className="label text-warm-soft">Your printed letter</h2>
            <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-warm-soft">It comes in the mail, front and back. Lost it, or want one for the fridge? Print another.</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
              {clubNav().canPrint ? (
                <button type="button" className="btn-secondary" onClick={() => printDocument(letterDoc.id, 'portrait')}>Print the letter</button>
              ) : (
                <PreviewOnlyNote />
              )}
              <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" aria-expanded={letterPreview} onClick={() => setLetterPreview(!letterPreview)}>
                {letterPreview ? 'Hide the letter' : 'See the letter, front and back'}
              </button>
            </div>
          </section>
        )}
      </div>
      {letterDoc && (
        <div hidden={showTool}>
          <PrintFrame open={letterPreview} orientation="portrait">
            <LetterSheets doc={letterDoc.id} kit={kit} preview={letterPreview} helpers={action.helpers} done={action.done} />
          </PrintFrame>
        </div>
      )}

      {tool && kit.tool && (
        <div hidden={!showTool}>
          <div className="club-screen">
            <button type="button" className="min-h-11 text-[0.92rem] text-warm-soft underline underline-offset-4" onClick={() => open('')}>← Back to {kit.theme}</button>
            <h2 className="mt-3 font-serif text-[2rem] leading-tight text-warm-ink">{kit.tool.title}</h2>
          </div>
          <div className="mt-4">
            <ChartEditor store={store} kit={kit} printable={tool} items={kitItems(kit, tool.items) ?? []} household={household} saved={docs.documents[tool.id]} readOnly={readOnly}
              intro="Pick a child, then morning or after school. Change, reorder or add steps, then print the chart for where it happens." setup={schoolSetupFor(household, kit.month)} />
          </div>
        </div>
      )}
    </>
  );
}

/** The month's action: check lines off, note who's helping, print it. Saves itself a moment after each change. */
function ActionChecklist({ kit, doc, store, household, saved, readOnly, state, onChange }: {
  kit: KitConfig;
  doc: KitPrintable;
  store: ClubStore;
  household: Household;
  saved?: KitDocuments['documents'][string];
  readOnly: boolean;
  state: ActionState;
  onChange: (s: ActionState) => void;
}) {
  const action = kit.action!;
  const palette = (household.preferences.palette as ToolPaletteId | undefined) ?? defaultToolPalette;
  const [revision, setRevision] = useState(saved?.revision ?? 0);
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'conflict' | 'error'>('idle');
  const [preview, setPreview] = useState(false);
  const done = state.done.filter(Boolean).length;

  const update = (next: ActionState) => {
    onChange(next);
    setStatus('pending');
  };
  useEffect(() => {
    if (status !== 'pending') return;
    const t = setTimeout(() => {
      store
        .saveDocument(kit.slug, doc.id, { edits: state, palette, engineVersion: kit.engineVersion, profileVersion: household.profileVersion }, revision)
        .then((rev) => { setRevision(rev); setStatus('saved'); })
        .catch((e) => setStatus(e instanceof ConflictError ? 'conflict' : 'error'));
    }, 600);
    return () => clearTimeout(t);
  }, [state, status]);

  return (
    <section aria-labelledby="club-action" className="mt-10">
      <div className="club-screen">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-wash font-serif text-[1.1rem] text-warm-ink ring-1 ring-sage">1</span>
        <div className="min-w-0 flex-1">
          <h2 id="club-action" className="font-serif text-[1.6rem] leading-tight text-warm-ink">{action.title.replace(/^Our /, 'Your ')}</h2>
          <p className="mt-2 leading-relaxed text-warm-soft">{action.intro}</p>
        </div>
      </div>
      <ol className="mt-5 divide-y divide-[#dfe6d8] bg-sage-wash px-4 sm:px-6">
        {action.items.map((t, i) => (
          <li key={t} className="py-3.5">
            <label className="flex min-h-11 cursor-pointer items-start gap-3.5">
              <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[#7f9274]" checked={state.done[i]} disabled={readOnly}
                onChange={(e) => update({ ...state, done: state.done.map((d, n) => (n === i ? e.target.checked : d)) })} />
              <span className={`text-[1.02rem] leading-snug text-warm-ink ${state.done[i] ? 'line-through decoration-sage' : ''}`}>{t}</span>
            </label>
            {action.helperLabel && (
              <input type="text" aria-label={`${action.helperLabel} ${t}`} placeholder={action.helperLabel} maxLength={MAX_HELPER} disabled={readOnly}
                className="ml-[2.4rem] mt-1 block min-h-10 w-[calc(100%-2.4rem)] max-w-xs border-0 border-b border-[#c9d3c0] bg-transparent px-0 text-[0.95rem] text-warm-ink placeholder:text-warm-soft focus:border-warm-ink focus:outline-none"
                value={state.helpers[i]} onChange={(e) => update({ ...state, helpers: state.helpers.map((h, n) => (n === i ? e.target.value : h)) })} />
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p role="status" className="text-[0.88rem] text-warm-soft">
          {status === 'pending' ? 'Saving…' : status === 'conflict' ? 'Changed on another device. Reload to see it.' : status === 'error' ? 'Couldn’t save. Check your connection.' : `${done} of ${action.items.length} done`}
        </p>
        <div className="flex flex-wrap items-center gap-x-6">
          {clubNav().canPrint && <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => printDocument(doc.id, 'portrait')}>Print it</button>}
          <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" aria-expanded={preview} onClick={() => setPreview(!preview)}>
            {preview ? 'Hide the preview' : 'Preview the printout'}
          </button>
        </div>
      </div>
      </div>
      <PrintFrame open={preview} orientation="portrait">
        <ActionSheet doc={doc.id} kit={kit} palette={palette} preview={preview} helpers={state.helpers} done={state.done} />
      </PrintFrame>
    </section>
  );
}

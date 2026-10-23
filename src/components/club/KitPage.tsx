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
import {
  addDays, basisStart, countdownIcs, countdownText, FAMILY_START, isDay, localToday, longLabel, MAX_HELPER, MAX_STARTS, planCountdown, readCountdown, resetChanges,
  shortLabel as shortDay, lineText, MAX_TEXT, type CountdownPlan, type CountdownState, type SchoolStart,
} from '../../lib/club/countdown';
import { schoolSetupFor, withSchool } from '../../lib/club/school';
import { GuideSheet } from './print/SchoolPrintables';
import { ActionSheet, LetterSheets, type ActionFill } from './print/LetterPrintables';
import { printDocument } from '../../lib/club/print';
import { planMembers, type Household } from '../../lib/club/profile';
import { ConflictError, type ClubStore, type KitDocuments } from '../../lib/club/store';
import { routes } from '../../routes';
import { clubToolById, type ClubTool } from '../../data/club/tools';
import { setToolHandoff } from '../../lib/tool-handoff';
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
    return <ThreePartKit kit={kit} store={ctx.store} household={kitHousehold} docs={data.docs} readOnly={readOnly} top={top} href={ctx.href} />;
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
 * Three-part kits: the month's title, when school starts, the dated countdown, and one button to the optional tool;
 * the letter last. The tool is one of the site's own (src/data/club/tools.ts), opened on its Club page for the child
 * she picks. The countdown saves itself a moment after each change (first days, checks, dates, helpers).
 */
function ThreePartKit({ kit, store, household, docs, readOnly, top, href }: {
  kit: KitConfig;
  store: ClubStore;
  household: Household;
  docs: KitDocuments;
  readOnly: boolean;
  top: ReactNode;
  href: (path: string) => string;
}) {
  const action = kit.action!;
  const tool = kit.tool ? clubToolById(kit.tool.tool) : undefined;
  const actionDoc = kit.printables.find((p) => p.component === 'Action');
  const letterDoc = kit.printables.find((p) => p.component === 'Letter');
  const saved = actionDoc ? docs.documents[actionDoc.id] : undefined;
  const [state, setState] = useState<CountdownState>(() => readCountdown(saved?.edits, action.items.length));
  const [revision, setRevision] = useState(saved?.revision ?? 0);
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'conflict' | 'error'>('idle');
  const [today] = useState(localToday);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterPreview, setLetterPreview] = useState(false);
  const children = planMembers(household, kit.month).filter((p) => p.stage !== 'adult');
  const chartKids = children.filter((p) => (p.age ?? 0) >= 3);
  // Her first name for the letter only when the profile says who she is: never a guess.
  const recipient = household.members.find((m) => m.isAccountHolder && !m.archived)?.firstName;
  const start = basisStart(state);
  const plan = planCountdown(action.items, start.date, today, state.dates);
  const palette = (household.preferences.palette as ToolPaletteId | undefined) ?? defaultToolPalette;

  const update = (next: CountdownState) => {
    setState(next);
    setStatus('pending');
  };
  useEffect(() => {
    if (status !== 'pending' || !actionDoc || readOnly) return;
    const t = setTimeout(() => {
      store
        .saveDocument(kit.slug, actionDoc.id, { edits: state, palette, engineVersion: kit.engineVersion, profileVersion: household.profileVersion }, revision)
        .then((rev) => { setRevision(rev); setStatus('saved'); })
        .catch((e) => setStatus(e instanceof ConflictError ? 'conflict' : 'error'));
    }, 600);
    return () => clearTimeout(t);
  }, [state, status]);

  const toTool = tool && kit.tool ? () => document.getElementById('club-tool')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined;

  return (
    <>
      {/* Screen-only parts carry .club-screen; each printout's frame sits outside them so it can print. */}
      <div className="max-w-3xl">
        <div className="club-screen">
          {top}
          <p className="label mt-6 text-warm-soft">{monthLabel(kit.month)}</p>
          <h1 className="mt-2 font-serif text-[2.2rem] leading-[1.08] text-warm-ink sm:text-[2.8rem]">{kit.theme}</h1>
          {kit.subtitle && <p className="mt-2 font-serif text-[1.25rem] italic text-rose-deep">{kit.subtitle}</p>}
          {kit.mailer.letterLinkTop && kit.mailer.letter && (
            <button type="button" className="mt-3 min-h-11 text-[0.95rem] font-semibold text-warm-ink underline underline-offset-4"
              onClick={() => { setLetterOpen(true); requestAnimationFrame(() => document.getElementById('club-letter')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>
              Read this month’s letter
            </button>
          )}
        </div>

        {action.kind === 'countdown' && <SchoolStarts state={state} update={update} kids={children} readOnly={readOnly} kitYear={Number(kit.month.slice(0, 4))} />}

        {actionDoc && (
          <Countdown kit={kit} doc={actionDoc} state={state} update={update} plan={plan} start={start} today={today} household={household}
            readOnly={readOnly} status={status} palette={palette} toTool={toTool} />
        )}

        {tool && kit.tool && (
          <section aria-labelledby="club-tool" className="club-screen mt-10 border-t border-warm-rule pt-8">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-wash font-serif text-[1.1rem] text-warm-ink ring-1 ring-sage">2</span>
              <div>
                <h2 id="club-tool" className="font-serif text-[1.6rem] leading-tight text-warm-ink">{kit.tool.title}</h2>
                <p className="mt-2 leading-relaxed text-warm-soft">{kit.tool.blurb}</p>
                {kit.tool.note && <p className="mt-2 text-[0.92rem] text-warm-soft">{kit.tool.note}</p>}
                <ToolLauncher tool={tool} cta={kit.tool.cta} kids={chartKids} household={household.id} back={{ href: href(routes.clubKit(kit.slug)), label: kit.theme }} href={href} />
              </div>
            </div>
          </section>
        )}

        {letterDoc && kit.mailer.letter && (
          <section aria-labelledby="club-letter" className="club-screen mt-12 border-t border-warm-rule pt-6">
            <h2 id="club-letter" className="label text-warm-soft">This month’s letter</h2>
            <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-warm-soft">
              {kit.mailer.screenNote}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-6">
              <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" aria-expanded={letterOpen} onClick={() => setLetterOpen(!letterOpen)}>
                {letterOpen ? 'Close the letter' : 'Read it here'}
              </button>
              <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" aria-expanded={letterPreview} onClick={() => setLetterPreview(!letterPreview)}>
                {letterPreview ? 'Hide the printed letter' : 'See it printed, front and back'}
              </button>
              {clubNav().canPrint && (
                <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" onClick={() => printDocument(letterDoc.id, 'portrait')}>Print another copy</button>
              )}
            </div>
            {letterOpen && (
              <article className="mt-3 bg-cream p-6 font-serif text-[1.05rem] leading-relaxed text-warm-ink ring-1 ring-warm-rule sm:p-8">
                <p className="italic">{recipient && kit.mailer.letter.namedGreeting ? kit.mailer.letter.namedGreeting.replace('{name}', recipient) : kit.mailer.letter.greeting}</p>
                {kit.mailer.letter.body.split(/\n\n+/).map((p) => <p key={p} className="mt-3">{p}</p>)}
                {kit.mailer.letter.signoff && <p className="mt-4 italic">Warmly, <span className="club-hand not-italic text-[1.5rem] text-warm-soft">{kit.mailer.letter.signoff}</span></p>}
              </article>
            )}
          </section>
        )}
      </div>
      {letterDoc && (
        <div>
          <PrintFrame open={letterPreview} orientation="portrait">
            <LetterSheets doc={letterDoc.id} kit={kit} preview={letterPreview} recipient={recipient} />
          </PrintFrame>
        </div>
      )}

    </>
  );
}

const link = 'min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4';
const dateField = 'min-h-11 rounded-[4px] border border-warm-rule bg-white px-2.5 text-[1rem] text-warm-ink focus:border-warm-ink focus:outline-none';

/**
 * "When does school start?": one family date by default; a first day per child only if she adds one, and then a
 * plain choice of which date the countdown counts back from.
 */
function SchoolStarts({ state, update, kids, readOnly, kitYear }: {
  state: CountdownState;
  update: (s: CountdownState) => void;
  kids: { id: string; firstName: string }[];
  readOnly: boolean;
  kitYear: number;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const set = (id: string, patch: Partial<SchoolStart>) => update({ ...state, starts: state.starts.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const remove = (id: string) => update({ ...state, starts: state.starts.filter((s) => s.id !== id), basis: state.basis === id ? FAMILY_START : state.basis });
  const free = kids.filter((c) => !state.starts.some((s) => s.childId === c.id));
  const add = (label: string, childId?: string) => {
    const id = childId ? `child-${childId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60) : `extra-${Date.now().toString(36)}`;
    update({ ...state, starts: [...state.starts, { id, label, ...(childId ? { childId } : {}), date: '' }] });
    setAdding(false);
    setName('');
  };
  const dated = state.starts.filter((s) => s.date);
  const many = state.starts.length > 1;
  const family = state.starts.find((s) => s.id === FAMILY_START)!;
  const extras = state.starts.filter((s) => s.id !== FAMILY_START);

  return (
    <section aria-labelledby="club-start" className="club-screen mt-8 bg-white p-5 ring-1 ring-warm-rule sm:p-6">
      <h2 id="club-start" className="font-serif text-[1.45rem] leading-tight text-warm-ink">When does school start?</h2>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-warm-soft">We’ll work backward and suggest when to get each thing done.</p>
      <div className="mt-4 grid gap-3">
        <label className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={many ? 'min-w-[6.5rem] font-semibold text-warm-ink' : 'sr-only'}>{many ? 'Everyone else' : 'First day of school'}</span>
          <input type="date" className={dateField} value={family.date} disabled={readOnly} min={`${kitYear - 1}-01-01`} max={`${kitYear + 1}-12-31`}
            onChange={(e) => set(FAMILY_START, { date: isDay(e.target.value) ? e.target.value : '' })} />
        </label>
        {extras.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex flex-wrap items-center gap-x-3">
              <span className="min-w-[6.5rem] font-semibold text-warm-ink">{s.label}</span>
              <input type="date" className={dateField} value={s.date} disabled={readOnly} min={`${kitYear - 1}-01-01`} max={`${kitYear + 1}-12-31`}
                onChange={(e) => set(s.id, { date: isDay(e.target.value) ? e.target.value : '' })} />
            </label>
            {!readOnly && <button type="button" className="min-h-11 text-[0.88rem] text-warm-soft underline underline-offset-4" onClick={() => remove(s.id)}>Remove<span className="sr-only"> {s.label}’s first day</span></button>}
          </div>
        ))}
      </div>
      {!readOnly && state.starts.length < MAX_STARTS && (
        adding ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {free.length > 0 ? (
              free.map((c) => <button key={c.id} type="button" className="btn-secondary" onClick={() => add(c.firstName, c.id)}>{c.firstName}</button>)
            ) : (
              <>
                <label>
                  <span className="block text-[0.85rem] text-warm-soft">Child’s first name</span>
                  <input className={`${dateField} mt-1 w-44`} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
                </label>
                <button type="button" className="btn-secondary" disabled={!name.trim()} onClick={() => add(name.trim())}>Add</button>
              </>
            )}
            <button type="button" className="min-h-11 text-[0.88rem] text-warm-soft underline underline-offset-4" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className={`${link} mt-2`} onClick={() => setAdding(true)}>+ A child starts on a different day</button>
        )
      )}
      {dated.length > 1 && (
        <fieldset className="mt-4 border-t border-warm-rule pt-3">
          <legend className="text-[0.92rem] text-warm-soft">Dates count back from</legend>
          <div className="mt-1 flex flex-wrap gap-x-5">
            {dated.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-2 text-[0.95rem] text-warm-ink">
                <input type="radio" name="club-basis" className="h-5 w-5 accent-[#7f9274]" checked={basisStart(state).id === s.id} disabled={readOnly} onChange={() => update({ ...state, basis: s.id })} />
                {s.id === FAMILY_START ? 'Everyone' : s.label} · {shortDay(s.date as string)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}

/** The countdown: six lines, each with its box, its suggested day (hers to change) and who's helping. */
function Countdown({ kit, doc, state, update, plan, start, today, household, readOnly, status, palette, toTool }: {
  kit: KitConfig;
  doc: KitPrintable;
  state: CountdownState;
  update: (s: CountdownState) => void;
  plan: CountdownPlan;
  start: SchoolStart;
  today: string;
  household: Household;
  readOnly: boolean;
  status: string;
  palette: ToolPaletteId;
  toTool?: () => void;
}) {
  const action = kit.action!;
  const countdown = action.kind === 'countdown';
  const [editing, setEditing] = useState<number | null>(null);
  const [wording, setWording] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [preview, setPreview] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');
  const done = state.done.filter(Boolean).length;
  const changes = resetChanges(action.items, plan);
  const names = household.members.filter((m) => !m.archived).map((m) => m.firstName);
  const dated = plan.lines.some((l) => l.date);
  const text = countdownText(action.title, action.items, plan, state);
  const whenLabel = (i: number) => {
    const l = plan.lines[i];
    return l.date ? shortDay(l.date) : l.later ? 'When you can' : '';
  };
  const fill: ActionFill = { done: state.done, helpers: state.helpers, texts: state.texts, whens: action.items.map((_, i) => whenLabel(i)), ...(plan.start ? { firstDay: longLabel(plan.start) } : {}) };
  const counting = start.id !== FAMILY_START || state.starts.filter((s) => s.date).length > 1 ? ` (${start.id === FAMILY_START ? 'everyone' : start.label})` : '';
  const message =
    plan.status === 'undated' ? 'Add your first day above and each line gets a suggested day. Or just use the list.'
    : plan.status === 'ahead' ? `Suggested days, counting back from ${longLabel(plan.start!)}${counting}. They’re suggestions: change any of them.`
    : plan.status === 'tight' ? `${plan.daysLeft} days to go${counting}, so a few things share a day. Suggestions, not deadlines.`
    : plan.status === 'last-minute' ? `School starts ${plan.daysLeft === 1 ? 'tomorrow' : 'in two days'}${counting}. Just the essentials for now; the rest can wait.`
    : plan.status === 'today' ? `School starts today${counting}. You’re there: the countdown has done its job.`
    : `School has already started${counting}, so you don’t need the countdown now.`;

  const download = () => {
    const now = new Date();
    const stamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
    const blob = new Blob([countdownIcs(kit.slug, action.title, action.items, plan, state, stamp)], { type: 'text/calendar' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'back-to-school-countdown.ics' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copyText = () => {
    navigator.clipboard?.writeText(text).then(() => setCopy('copied'), () => setCopy('manual')) ?? setCopy('manual');
  };

  return (
    <section aria-labelledby="club-action" className="mt-10">
      <div className="club-screen">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-wash font-serif text-[1.1rem] text-warm-ink ring-1 ring-sage">1</span>
          <div className="min-w-0 flex-1">
            <h2 id="club-action" className="font-serif text-[1.6rem] leading-tight text-warm-ink">{action.screenTitle ?? action.title}</h2>
            <p className="mt-2 leading-relaxed text-warm-soft">{action.intro}</p>
          </div>
        </div>
        {countdown && (
          <p role="status" className={`mt-4 border-l-[3px] px-4 py-2.5 text-[0.95rem] leading-relaxed text-warm-ink ${plan.status === 'undated' ? 'border-warm-rule' : 'border-sage bg-sage-wash'}`}>
            {message}
            {(plan.status === 'today' || plan.status === 'started') && toTool && (
              <> <button type="button" className="font-semibold underline underline-offset-4" onClick={toTool}>Make a routine chart for school days</button></>
            )}
          </p>
        )}

        <datalist id="club-family-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <ol className="mt-4 divide-y divide-[#dfe6d8] bg-sage-wash px-4 sm:px-6">
          {action.items.map((item, i) => {
            const l = plan.lines[i];
            const words = lineText(action.items, state, i);
            return (
              <li key={item.text} className="py-3.5">
                <label className="flex min-h-11 cursor-pointer items-start gap-3.5">
                  <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[#7f9274]" checked={state.done[i]} disabled={readOnly}
                    onChange={(e) => update({ ...state, done: state.done.map((d, n) => (n === i ? e.target.checked : d)) })} />
                  <span className={`text-[1.02rem] leading-snug text-warm-ink ${state.done[i] ? 'line-through decoration-sage' : ''}`}>{words}</span>
                </label>
                {wording === i && (
                  <div className="ml-[2.4rem] mt-1 flex flex-wrap items-center gap-3">
                    <input type="text" aria-label={`Your wording for: ${item.text}`} className={`${dateField} w-full`} maxLength={MAX_TEXT} value={words}
                      onChange={(e) => update({ ...state, texts: state.texts.map((t, n) => (n === i ? (e.target.value.trim() && e.target.value !== item.text ? e.target.value : null) : t)) })} />
                    {state.texts[i] !== null && (
                      <button type="button" className="min-h-10 text-[0.85rem] text-warm-soft underline underline-offset-4" onClick={() => update({ ...state, texts: state.texts.map((t, n) => (n === i ? null : t)) })}>Use our wording</button>
                    )}
                    <button type="button" className="btn-secondary" onClick={() => setWording(null)}>Done</button>
                  </div>
                )}
                <div className="ml-[2.4rem] mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
                  {countdown && (l.date || l.later || (!readOnly && (plan.start || l.edited))) && (
                    <span className="flex min-h-10 flex-wrap items-baseline gap-x-2 text-[0.92rem]">
                      {(l.date || l.later) && <span className={`font-semibold ${l.later ? 'text-warm-soft' : 'text-warm-ink'}`}>{l.date ? `By ${shortDay(l.date)}` : 'When you can'}</span>}
                      {l.date && <span className="text-[0.82rem] text-warm-soft">{l.edited ? 'your date' : l.moved ? 'moved up' : 'suggested'}</span>}
                      {!readOnly && (plan.start || l.edited) && editing !== i && (
                        <button type="button" className="text-[0.82rem] text-warm-soft underline underline-offset-4" onClick={() => setEditing(i)}>
                          {l.date ? 'change' : 'pick a date'}<span className="sr-only"> for {words}</span>
                        </button>
                      )}
                    </span>
                  )}
                  {action.helperLabel && (
                    <input type="text" list="club-family-names" aria-label={`${action.helperLabel} ${words}`} placeholder={action.helperLabel} maxLength={MAX_HELPER} disabled={readOnly}
                      className="block min-h-10 w-full max-w-[12rem] border-0 border-b border-[#c9d3c0] bg-transparent px-0 text-[0.95rem] text-warm-ink placeholder:text-warm-soft focus:border-warm-ink focus:outline-none"
                      value={state.helpers[i]} onChange={(e) => update({ ...state, helpers: state.helpers.map((h, n) => (n === i ? e.target.value : h)) })} />
                  )}
                  {action.editable && !readOnly && wording !== i && (
                    <button type="button" className="min-h-10 text-[0.82rem] text-warm-soft underline underline-offset-4" onClick={() => setWording(i)}>
                      {state.texts[i] !== null ? 'your wording · change' : 'reword'}<span className="sr-only"> {words}</span>
                    </button>
                  )}
                </div>
                {countdown && editing === i && (
                  <div className="ml-[2.4rem] mt-2 flex flex-wrap items-center gap-3">
                    <input type="date" aria-label={`Date for ${words}`} className={dateField} value={l.date ?? ''} min={addDays(today, -60)}
                      onChange={(e) => update({ ...state, dates: state.dates.map((d, n) => (n === i ? (isDay(e.target.value) ? e.target.value : null) : d)) })} />
                    {l.edited && (
                      <button type="button" className="min-h-10 text-[0.85rem] text-warm-soft underline underline-offset-4" onClick={() => update({ ...state, dates: state.dates.map((d, n) => (n === i ? null : d)) })}>
                        {l.suggested ? `Use the suggestion (${shortDay(l.suggested)})` : 'Clear my date'}
                      </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Done</button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <p className="text-[0.88rem] text-warm-soft">
            {status === 'pending' ? 'Saving…' : status === 'conflict' ? 'Changed on another device. Reload to see it.' : status === 'error' ? 'Couldn’t save. Check your connection.' : `${done} of ${action.items.length} done`}
          </p>
          {!readOnly && changes.length > 0 && !confirmReset && (
            <button type="button" className="min-h-11 text-[0.88rem] text-warm-soft underline underline-offset-4" onClick={() => setConfirmReset(true)}>Go back to the suggested dates</button>
          )}
        </div>
        {confirmReset && (
          <div className="mt-2 bg-white p-4 ring-1 ring-warm-rule">
            <p className="text-[0.95rem] text-warm-ink">These dates you chose would change:</p>
            <ul className="mt-2 space-y-1 text-[0.92rem] text-warm-ink">
              {changes.map((c) => <li key={c.text}>{c.text.replace(/\.$/, '')}: {shortDay(c.from!)} → {c.to ? shortDay(c.to) : 'no date'}</li>)}
            </ul>
            <div className="mt-3 flex flex-wrap gap-4">
              <button type="button" className="btn-secondary" onClick={() => { update({ ...state, dates: state.dates.map(() => null) }); setConfirmReset(false); }}>Change them</button>
              <button type="button" className={link} onClick={() => setConfirmReset(false)}>Keep my dates</button>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-warm-rule pt-5">
          <h3 className="label text-warm-soft">Print or copy your {countdown ? 'countdown' : 'list'}</h3>
          {dated && <p className="mt-2 text-[0.95rem] leading-relaxed text-warm-ink">Write these dates on your family wall calendar so everyone can see what’s coming.</p>}
          {!countdown && kit.mailer.calendarNote && <p className="mt-2 text-[0.95rem] leading-relaxed text-warm-ink">{kit.mailer.calendarNote}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-6">
            {clubNav().canPrint && <button type="button" className={link} onClick={() => printDocument(doc.id, 'portrait')}>Print it</button>}
            <button type="button" className={link} aria-expanded={preview} onClick={() => setPreview(!preview)}>{preview ? 'Hide the preview' : 'Preview the printout'}</button>
            <button type="button" className={link} onClick={copyText}>{copy === 'copied' ? 'Copied' : 'Copy as text'}</button>
            {countdown && dated && <button type="button" className={link} onClick={download}>Add to a phone calendar (.ics)</button>}
          </div>
          {copy === 'manual' && (
            <label className="mt-2 block">
              <span className="text-[0.85rem] text-warm-soft">Select the text and copy it:</span>
              <textarea readOnly rows={action.items.length + 3} className="mt-1 block w-full rounded-[4px] border border-warm-rule bg-white p-2 font-mono text-[0.85rem] text-warm-ink" value={text} onFocus={(e) => e.target.select()} />
            </label>
          )}
        </div>
      </div>
      <PrintFrame open={preview} orientation="portrait">
        <ActionSheet doc={doc.id} kit={kit} palette={palette} preview={preview} fill={fill} />
      </PrintFrame>
    </section>
  );
}

/**
 * Opens one of the site's tools inside the Club for one of her children, with their name, age and a starting choice
 * handed over (src/lib/tool-handoff.ts), so she doesn't retype what her family profile says. With one child it opens
 * straight away; with several it asks who it's for; with none it opens the tool as any visitor would see it.
 */
function ToolLauncher({ tool, cta, kids, household, back, href }: {
  tool: ClubTool;
  cta: string;
  /** Saved copies are kept per family, so two families in one browser (or two samples) never share a chart. */
  household: string;
  kids: { id: string; firstName: string; age: number | null }[];
  back: { href: string; label: string };
  href: (path: string) => string;
}) {
  const [choosing, setChoosing] = useState(false);
  const [variant, setVariant] = useState(tool.variants?.[0]?.id);
  const go = (kid?: { id: string; firstName: string; age: number | null }) => {
    setToolHandoff({
      tool: tool.id,
      key: `${household}-${kid ? `${kid.id}-${variant ?? 'chart'}` : 'family'}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 120),
      ...(kid ? { name: kid.firstName, ...(kid.age !== null ? { age: kid.age } : {}) } : {}),
      ...(variant ? { variant } : {}),
      back,
    });
    clubNav().go(href(tool.path));
  };
  const tab = 'min-h-11 border-b-2 border-transparent pb-1 text-[0.95rem] font-semibold text-warm-soft aria-[pressed=true]:border-warm-ink aria-[pressed=true]:text-warm-ink';

  if (!tool.perChild || kids.length === 0) {
    return <button type="button" className="btn-primary mt-5 w-full sm:w-auto" onClick={() => go()}>{cta}</button>;
  }
  if (!choosing) {
    return <button type="button" className="btn-primary mt-5 w-full sm:w-auto" onClick={() => (kids.length === 1 ? go(kids[0]) : setChoosing(true))}>{cta}</button>;
  }
  return (
    <div className="mt-5 bg-white p-4 ring-1 ring-warm-rule sm:p-5">
      {tool.variants && (
        <div role="group" aria-label="Which routine" className="flex gap-x-6 border-b border-warm-rule">
          {tool.variants.map((v) => <button key={v.id} type="button" aria-pressed={v.id === variant} className={tab} onClick={() => setVariant(v.id)}>{v.label}</button>)}
        </div>
      )}
      <p className="mt-4 text-[0.95rem] text-warm-ink">Who’s it for?</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {kids.map((k) => (
          <button key={k.id} type="button" className="btn-secondary" onClick={() => go(k)}>
            {k.firstName}{k.age !== null ? <span className="ml-1.5 font-normal opacity-70">{k.age}</span> : null}
          </button>
        ))}
      </div>
      <button type="button" className="mt-3 min-h-11 text-[0.88rem] text-warm-soft underline underline-offset-4" onClick={() => go()}>Someone else</button>
    </div>
  );
}

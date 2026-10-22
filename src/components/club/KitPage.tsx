/**
 * /club/kits/<slug>: a monthly kit, opened already filled in for her family. Engine-filled printables get the chart
 * editor; the activity and worksheets print with her family's names; the field guide reads on screen. Everything comes
 * from the kit's config (src/data/club/kits/), so later kits reuse this page.
 */
import { useEffect, useState } from 'react';
import { kitBySlug } from '../../data/club/kits';
import { monthLabel } from '../../data/club/labels';
import { defaultToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import type { KitConfig, KitPrintable } from '../../data/club/types';
import { printDocument } from '../../lib/club/print';
import { planMembers, type Household } from '../../lib/club/profile';
import type { KitDocuments } from '../../lib/club/store';
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
  const [data, setData] = useState<{ household: Household; docs: KitDocuments } | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(() => (typeof location !== 'undefined' && location.hash.slice(1)) || kit?.printables[0]?.id || '');

  useEffect(() => {
    if (!kit) return;
    ctx.store.household()
      .then(async (household) => {
        if (!household) return clubNav().go(ctx.href(routes.clubStart), { replace: true });
        setData({ household, docs: await ctx.store.documents(slug) });
      })
      .catch((e: Error) => setError(e.message === 'not_found' ? 'closed' : 'load'));
  }, [slug]);

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
  if (!data) return <p className="text-warm-soft">Opening your kit…</p>;

  const readOnly = data.docs.can === 'read';
  const tabs: { id: string; label: string }[] = [...kit.printables.map((p) => ({ id: p.id, label: shortLabel(p) })), { id: 'field-guide', label: 'Field guide' }];
  // An old or mistyped #hash opens the first printable.
  const shown = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const choose = (id: string) => {
    setTab(id);
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <>
      <div className="club-screen">
        <a href={ctx.href(routes.clubDashboard)} className="text-[0.9rem] text-warm-soft underline underline-offset-4">Your kits</a>
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

      {/* Every printable stays mounted (unsaved edits survive switching tabs); only the chosen one shows. */}
      <div className="mt-6">
        {kit.printables.map((p) => (
          <div key={p.id} hidden={shown !== p.id}>
            {p.items ? (
              <ChartEditor
                store={ctx.store}
                kit={kit}
                printable={p}
                items={p.items === 'reset' ? kit.reset!.items : kit.items}
                household={data.household}
                saved={data.docs.documents[p.id]}
                readOnly={readOnly}
                intro={INTRO[p.kind] ?? ''}
              />
            ) : (
              <Sheet kit={kit} printable={p} household={data.household} />
            )}
          </div>
        ))}
        <div hidden={shown !== 'field-guide'}>
          <FieldGuide kit={kit} />
        </div>
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
  const steps = isActivity ? kit.mailer.activity.steps : printable.content?.items ?? [];
  return (
    <div>
      <div className="club-screen max-w-2xl">
        <h2 className="font-serif text-[1.6rem] text-warm-ink">{printable.title}</h2>
        <p className="mt-2 leading-relaxed text-warm-soft">
          {isActivity ? `About ${kit.mailer.activity.minutes} minutes, everyone together, with the family chart on the table.` : printable.content?.intro}
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-warm-ink">
          {steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
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
        {isActivity ? (
          <MeetingCard doc={printable.id} title={printable.title} familyName={familyName} month={kit.month} palette={palette} steps={steps} minutes={kit.mailer.activity.minutes} people={people} preview={preview} />
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

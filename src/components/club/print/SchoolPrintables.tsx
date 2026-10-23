/**
 * School-year printables from August's first draft, kept for the item sets in src/data/club/libraries/school-year.ts:
 * the School-Year Command Center and a one-page guide. Same print system as November: US Letter, the tool palettes,
 * Kalam headings, the card illustrations. Styles: src/styles/club.css.
 */
import { FREQUENCY_LABEL, monthLabel } from '../../../data/club/labels';
import { toolPalettes, type ToolPaletteId } from '../../../data/tool-palettes';
import type { ChartRow } from '../../../lib/club/edits';

interface Base {
  doc: string;
  familyName: string;
  month: string;
  palette: ToolPaletteId;
  preview?: boolean;
}

/** The School-Year Command Center: who owns each school job, the family's weekly commitments, Sunday planning. */
export function CommandCenterSheet({ doc, title, familyName, month, palette, preview, rows, names, checklist, intro }: Base & {
  title: string;
  rows: ChartRow[];
  names: Map<string, string>;
  checklist: string[];
  intro: string;
}) {
  const [swipe, card, chip] = toolPalettes[palette].colors;
  const jobs = rows.filter((r) => r.section !== 'commitment');
  const commitments = rows.filter((r) => r.section === 'commitment');
  const year = Number(month.slice(0, 4));
  // Blank lines to write in, so a family that hasn't typed theirs yet still gets a useful page.
  const blanks = Math.max(0, 7 - commitments.length);
  return (
    <div className="club-print club-chart club-command" data-doc={doc} data-preview={preview ? '' : undefined}>
      <header className="club-chart-head">
        <div>
          <div className="club-hand club-chart-title"><span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{title}</span></div>
          <div className="club-chart-family">{familyName} · {year}–{String(year + 1).slice(2)} school year</div>
        </div>
        <div className="club-chart-promise">One owner for every school job</div>
      </header>
      <div className="club-command-grid">
        <section className="club-card">
          <div className="club-card-head"><div className="club-hand club-card-name"><span className="club-swipe" style={{ ['--swipe' as string]: card }}>Who owns what</span></div></div>
          {jobs.map((r) => (
            <div key={r.rowId} className="club-command-row">
              <span className="club-command-job">{r.title}</span>
              <span className="club-chip" style={{ ['--chip' as string]: chip }}>{FREQUENCY_LABEL[r.frequency]}</span>
              <span className="club-hand club-command-owner">{r.needsOwner ? 'Up for grabs' : names.get(r.ownerId ?? '') ?? ''}</span>
            </div>
          ))}
        </section>
        <div className="club-command-side">
          <section className="club-card">
            <div className="club-card-head"><div className="club-hand club-card-name"><span className="club-swipe" style={{ ['--swipe' as string]: card }}>Every week</span></div><div className="club-card-meta">Practices, lessons, clubs</div></div>
            {commitments.map((r) => (
              <div key={r.rowId} className="club-command-row">
                <span className="club-command-job">{r.title}</span>
                <span className="club-chip" style={{ ['--chip' as string]: chip }}>{FREQUENCY_LABEL[r.frequency]}</span>
                <span className="club-hand club-command-owner">{r.ownerId ? names.get(r.ownerId) ?? '' : 'Everyone'}</span>
              </div>
            ))}
            {Array.from({ length: blanks }, (_, i) => <div key={i} className="club-command-blank" />)}
          </section>
          <section className="club-card">
            <div className="club-card-head"><div className="club-hand club-card-name"><span className="club-swipe" style={{ ['--swipe' as string]: card }}>Sunday planning</span></div></div>
            <p className="club-command-intro">{intro}</p>
            {checklist.map((t) => (
              <div key={t} className="club-command-check"><span className="club-box" /><span>{t}</span></div>
            ))}
          </section>
        </div>
      </div>
      <footer className="club-chart-foot">
        <span>Organized Family Club · Ready for the School Year</span>
        <span>The week’s plans go on the family calendar</span>
      </footer>
    </div>
  );
}

/** The mailer's one-page guide, printable at home too. */
export function GuideSheet({ doc, title, familyName, month, palette, preview, sections }: Base & {
  title: string;
  sections: { heading: string; body: string }[];
}) {
  const [swipe] = toolPalettes[palette].colors;
  return (
    <div className="club-print club-sheet" data-doc={doc} data-preview={preview ? '' : undefined}>
      <div className="club-hand club-sheet-title"><span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{title}</span></div>
      <div className="club-sheet-sub">{familyName} · {monthLabel(month)}</div>
      <div className="club-guide">
        {sections.map((s) => (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            <p>{s.body}</p>
          </section>
        ))}
      </div>
      <div className="club-sheet-foot">Organized Family Club · {monthLabel(month)}</div>
    </div>
  );
}

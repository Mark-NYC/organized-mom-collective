/**
 * The Family Responsibility Chart: US Letter landscape, a card per person with their jobs, illustrations on their
 * fixed category colors, the chosen tool palette for the swipes and chips, Kalam names. Styles: src/styles/club.css.
 * Layout and density: chartLayout() in src/lib/club/print.ts.
 */
import { coachLine, FREQUENCY_LABEL, monthLabel, SECTION_LABEL } from '../../../data/club/labels';
import { responsibilityById, responsibilityColor, responsibilityImage } from '../../../data/responsibilities';
import { toolPalettes, type ToolPaletteId } from '../../../data/tool-palettes';
import type { ChartSection } from '../../../data/club/types';
import type { ChartRow } from '../../../lib/club/edits';
import { chartLayout } from '../../../lib/club/print';
import type { PlannedMember } from '../../../lib/club/profile';

export interface ChartPerson extends PlannedMember {
  roleLabel: string;
}

interface Props {
  doc: string;
  title: string;
  familyName: string;
  month: string;
  people: ChartPerson[];
  rows: ChartRow[];
  palette: ToolPaletteId;
  /** Shown on screen as a preview (scaled by the parent). */
  preview?: boolean;
}

const SECTIONS: ChartSection[] = ['family', 'space', 'self'];

export function JobArt({ illustration }: { illustration?: string }) {
  const r = illustration ? responsibilityById(illustration) : undefined;
  const src = r ? responsibilityImage(r, 128) : null;
  if (!r || !src) return <span className="club-job-art"><span className="club-job-dot" /></span>;
  return (
    <span className="club-job-art" style={{ background: responsibilityColor(r) }}>
      <img src={src} alt="" width={64} height={64} loading="eager" decoding="sync" />
    </span>
  );
}

export default function ResponsibilityChart({ doc, title, familyName, month, people, rows, palette, preview }: Props) {
  const [swipe, card, chip] = toolPalettes[palette].colors;
  const names = new Map(people.map((p) => [p.id, p.firstName]));
  const byPerson = people
    .map((p) => ({ person: p, rows: rows.filter((r) => !r.needsOwner && r.ownerId === p.id) }))
    .filter((x) => x.rows.length > 0);
  const open = rows.filter((r) => r.needsOwner);
  const cards = [...byPerson.map((x) => x.rows.length + new Set(x.rows.map((r) => r.section)).size - 1), ...(open.length ? [open.length] : [])];
  // A first guess from row counts; fitChart() (src/lib/club/print.ts) measures and settles it before printing.
  const layout = chartLayout(cards);

  const job = (r: ChartRow) => {
    const coach = coachLine(r.level, r.coachId ? names.get(r.coachId) ?? null : null);
    return (
      <div key={r.rowId} className="club-job" style={{ ['--dot' as string]: card }}>
        <JobArt illustration={r.illustration} />
        <div>
          <div className="club-job-title">{r.title}</div>
          <div className="club-job-meta">
            <span className="club-chip" style={{ ['--chip' as string]: chip }}>{FREQUENCY_LABEL[r.frequency]}</span>
            {coach && <span> · {coach}</span>}
          </div>
          {r.doneMeans && <div className="club-job-done">{r.doneMeans}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className={`club-print club-chart club-density-${layout.density}`} data-doc={doc} data-pages={layout.pages} data-preview={preview ? '' : undefined}>
      <header className="club-chart-head">
        <div>
          <div className="club-hand club-chart-title">
            <span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{title}</span>
          </div>
          <div className="club-chart-family">
            {familyName} · {monthLabel(month)}
          </div>
        </div>
        <div className="club-chart-promise">Every job has one owner</div>
      </header>

      <div className="club-chart-grid" style={{ columnCount: layout.columns }}>
        {byPerson.map(({ person, rows: mine }) => (
          <section key={person.id} className="club-card" style={{ borderColor: card === '#E6EEEA' ? '#d5dfd9' : undefined }}>
            <div className="club-card-head">
              <div className="club-hand club-card-name">
                <span className="club-swipe" style={{ ['--swipe' as string]: card }}>{person.firstName}</span>
              </div>
              <div className="club-card-meta">{person.roleLabel}</div>
            </div>
            {SECTIONS.map((s) => {
              const list = mine.filter((r) => r.section === s);
              if (!list.length) return null;
              const label = person.stage !== 'adult' && new Set(mine.map((r) => r.section)).size > 1 ? SECTION_LABEL[s] : null;
              return (
                <div key={s}>
                  {label && <div className="club-card-section">{label}</div>}
                  {list.map(job)}
                </div>
              );
            })}
          </section>
        ))}
        {open.length > 0 && (
          <section className="club-card club-needs-owner">
            <div className="club-card-head">
              <div className="club-hand club-card-name">Needs an owner</div>
              <div className="club-card-meta">Up for grabs</div>
            </div>
            {open.map(job)}
          </section>
        )}
      </div>

      <footer className="club-chart-foot">
        <span>Organized Family Club · Family Ownership Builder</span>
        <span>Check the chart first</span>
      </footer>
    </div>
  );
}

/**
 * The kit's portrait printables (US Letter): the team reset with owners, the Team Meeting card with a line for
 * every person, and the grown-ups' "Handing Over a Whole Job" checklist. Each one works printed on its own.
 */
import type { ReactNode } from 'react';
import { coachLine, FREQUENCY_LABEL, monthLabel } from '../../../data/club/labels';
import { toolPalettes, type ToolPaletteId } from '../../../data/tool-palettes';
import type { ChartRow } from '../../../lib/club/edits';
import { JobArt } from './ResponsibilityChart';

interface Base {
  doc: string;
  title: string;
  familyName: string;
  month: string;
  palette: ToolPaletteId;
  preview?: boolean;
}

function Sheet({ doc, title, familyName, month, palette, preview, children }: Base & { children: ReactNode }) {
  const [swipe] = toolPalettes[palette].colors;
  return (
    <div className="club-print club-sheet" data-doc={doc} data-preview={preview ? '' : undefined}>
      <div className="club-hand club-sheet-title">
        <span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{title}</span>
      </div>
      <div className="club-sheet-sub">
        {familyName} · {monthLabel(month)}
      </div>
      {children}
      <div className="club-sheet-foot">Organized Family Club · {monthLabel(month)}</div>
    </div>
  );
}

/** A checklist of owned jobs (the team reset). */
export function OwnedChecklist({ rows, names, intro, ...base }: Base & { rows: ChartRow[]; names: Map<string, string>; intro: string }) {
  return (
    <Sheet {...base}>
      <p className="club-sheet-intro">{intro}</p>
      <div className="club-sheet-lines">
        {rows.map((r) => {
          const owner = r.needsOwner ? null : names.get(r.ownerId ?? '') ?? null;
          const coach = coachLine(r.level, r.coachId ? names.get(r.coachId) ?? null : null);
          return (
            <div key={r.rowId} className="club-sheet-row" style={{ gridTemplateColumns: '0.3in 0.32in 1fr auto' }}>
              <span className="club-box" />
              <JobArt illustration={r.illustration} />
              <div>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: '8.5pt', color: '#6e6461' }}>
                  {FREQUENCY_LABEL[r.frequency]}
                  {coach ? ` · ${coach}` : ''}
                </div>
              </div>
              <div className="club-hand club-sheet-owner">{owner ?? 'Needs an owner'}</div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Steps, then a line per person (the Team Meeting card). */
export function MeetingCard({ steps, minutes, people, intro, lineLabel, ...base }: Base & { steps: string[]; minutes: number; people: string[]; intro?: string; lineLabel?: string }) {
  return (
    <Sheet {...base}>
      <p className="club-sheet-intro">
        {intro ?? `About ${minutes} minutes, everyone together, with the family chart on the table.`}
      </p>
      <ol style={{ marginTop: '0.18in', paddingLeft: '0.25in', listStyle: 'decimal', fontSize: '11pt', lineHeight: 1.5 }}>
        {steps.map((s) => (
          <li key={s} style={{ marginBottom: '0.06in' }}>{s}</li>
        ))}
      </ol>
      {/* Big families: shorter write-in lines, so everyone still fits on one page. */}
      <div className={`club-sheet-lines${people.length > 5 ? ' club-sheet-lines-tight' : ''}`}>
        <div className="club-card-section" style={{ marginBottom: '0.05in' }}>{lineLabel ?? 'The job I’m choosing to own this month'}</div>
        {people.map((n) => (
          <div key={n} className="club-sheet-line">
            <span className="club-hand" style={{ fontSize: '15pt' }}>{n}</span>
            <span />
          </div>
        ))}
        <div className="club-sheet-line">
          <span style={{ fontSize: '9pt', color: '#6e6461' }}>Check-in day</span>
          <span />
        </div>
      </div>
    </Sheet>
  );
}

/** Intro and a checklist (Handing Over a Whole Job). */
export function ChecklistSheet({ intro, items, ...base }: Base & { intro: string; items: string[] }) {
  return (
    <Sheet {...base}>
      <p className="club-sheet-intro">{intro}</p>
      <div className="club-sheet-lines">
        {items.map((t) => (
          <div key={t} className="club-sheet-row" style={{ gridTemplateColumns: '0.3in 1fr' }}>
            <span className="club-box" />
            <span>{t}</span>
          </div>
        ))}
      </div>
      <div className="club-sheet-lines">
        <div className="club-sheet-line">
          <span style={{ fontSize: '9pt', color: '#6e6461' }}>The job</span>
          <span />
        </div>
        <div className="club-sheet-line">
          <span style={{ fontSize: '9pt', color: '#6e6461' }}>Its new owner</span>
          <span />
        </div>
        <div className="club-sheet-line">
          <span style={{ fontSize: '9pt', color: '#6e6461' }}>“Done” looks like</span>
          <span />
        </div>
      </div>
    </Sheet>
  );
}

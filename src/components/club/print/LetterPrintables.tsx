/**
 * Three-part kits' printables (August on): the monthly letter (front: the letter and the month's action; back:
 * guidance, a worked example, the QR code and one calendar reminder), the action on its own page, and the tool's
 * routine chart, one child and one routine per page. US Letter portrait, same print system as November.
 *
 * The letter is the mailer's printable twin: stationery, not a worksheet. Georgia for the editorial voice, Montserrat
 * for labels, Kalam only for the signature, warm ivory paper, muted brand colors. Styles: src/styles/club.css.
 */
import { monthLabel } from '../../../data/club/labels';
import { toolPalettes, type ToolPaletteId } from '../../../data/tool-palettes';
import type { KitConfig } from '../../../data/club/types';
import type { ChartRow } from '../../../lib/club/edits';
import { qrPath } from '../../../lib/club/qr';
import { exampleRoutine, qrUrl, readableUrl } from '../../../lib/club/routines';
import { JobArt } from './ResponsibilityChart';

const DAYS = ['M', 'T', 'W', 'T', 'F'];

/** The QR code as crisp SVG modules. */
function QrCode({ url, label }: { url: string; label: string }) {
  const { path, size } = qrPath(url);
  return (
    <svg className="club-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#3d3834" />
    </svg>
  );
}

/** The month's action as a checklist: a box, the line, and an optional "Who's helping?" blank (filled when she typed one). */
function ActionList({ items, helperLabel, helpers = [], done = [] }: { items: string[]; helperLabel?: string; helpers?: string[]; done?: boolean[] }) {
  return (
    <ol className="club-action">
      {items.map((t, i) => (
        <li key={t} className="club-action-row">
          <span className={`club-box club-action-box${done[i] ? ' is-done' : ''}`} />
          <span className="club-action-text">{t}</span>
          {helperLabel && (
            <span className="club-action-helper">
              <span className="club-action-helper-label">{helperLabel}</span>
              <span className="club-action-helper-line">{helpers[i] ?? ''}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The two-page letter. `helpers`/`done` fill in what she's entered on screen; the mailed copy prints them blank. */
export function LetterSheets({ doc, kit, preview, helpers, done }: { doc: string; kit: KitConfig; preview?: boolean; helpers?: string[]; done?: boolean[] }) {
  const letter = kit.mailer.letter;
  const action = kit.action;
  const example = exampleRoutine(kit);
  const month = monthLabel(kit.month);
  const head = (
    <div className="club-letter-head">
      <span>Organized Family Club</span>
      <span>{month}</span>
    </div>
  );
  return (
    <div className="club-print club-letter" data-doc={doc} data-preview={preview ? '' : undefined}>
      <section className="club-letter-page" aria-label="Front">
        {head}
        <h1 className="club-letter-title">{kit.theme}</h1>
        {kit.subtitle && <p className="club-letter-subtitle">{kit.subtitle}</p>}
        <div className="club-letter-body">
          {letter ? (
            <>
              {letter.greeting && <p className="club-letter-greeting">{letter.greeting}</p>}
              {letter.body.split(/\n\n+/).map((para) => <p key={para}>{para}</p>)}
              {letter.signoff && (
                <p className="club-letter-signoff">
                  Warmly,<span className="club-hand club-letter-signature">{letter.signoff}</span>
                </p>
              )}
            </>
          ) : (
            <p className="club-letter-placeholder">Megan’s letter goes here.</p>
          )}
        </div>
        {action && (
          <div className="club-letter-action">
            <h2>{action.title}</h2>
            <ActionList items={action.items} helperLabel={action.helperLabel} helpers={helpers} done={done} />
          </div>
        )}
      </section>

      <section className="club-letter-page" aria-label="Back">
        {head}
        <h2 className="club-letter-back-title">{kit.mailer.fieldGuide.title}</h2>
        <div className="club-letter-tips">
          {kit.mailer.fieldGuide.sections.map((s) => (
            <div key={s.heading}>
              <h3>{s.heading}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
        {kit.mailer.example && example.length > 0 && (
          <div className="club-letter-example">
            <div className="club-letter-example-head">
              <span className="club-letter-label">For example</span>
              <h3>{kit.mailer.example.title}</h3>
            </div>
            <ol>
              {example.map((s) => (
                <li key={s.id}>
                  <JobArt illustration={s.illustration} />
                  <span>{s.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {kit.mailer.invite && (
          <div className="club-letter-invite">
            <QrCode url={qrUrl(kit.mailer.qrPath)} label={`QR code for ${readableUrl(kit.mailer.qrPath)}`} />
            <div>
              <h3>{kit.mailer.invite.title}</h3>
              <p>{kit.mailer.invite.body}</p>
              <p className="club-letter-url">{readableUrl(kit.mailer.qrPath)}</p>
            </div>
          </div>
        )}
        {kit.mailer.calendarNote && (
          <p className="club-letter-calendar"><span className="club-letter-label">On the family calendar</span>{kit.mailer.calendarNote}</p>
        )}
      </section>
    </div>
  );
}

/** The action alone, to hang beside the family calendar. */
export function ActionSheet({ doc, kit, palette, preview, helpers, done }: { doc: string; kit: KitConfig; palette: ToolPaletteId; preview?: boolean; helpers?: string[]; done?: boolean[] }) {
  const [swipe] = toolPalettes[palette].colors;
  const action = kit.action!;
  return (
    <div className="club-print club-sheet club-action-sheet" data-doc={doc} data-preview={preview ? '' : undefined}>
      <div className="club-hand club-sheet-title"><span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{action.title}</span></div>
      {kit.subtitle && <div className="club-sheet-sub">{kit.subtitle}</div>}
      <p className="club-sheet-intro">{action.intro}</p>
      <ActionList items={action.items} helperLabel={action.helperLabel} helpers={helpers} done={done} />
      <div className="club-sheet-foot">Organized Family Club · {monthLabel(kit.month)} · Hang it beside the family calendar</div>
    </div>
  );
}

/** One child's routine: big pictures, four to six steps, a box per school day. Simple enough to run without a grown-up. */
export function RoutineChartSheet({ doc, name, label, rows, palette, preview }: {
  doc: string;
  name: string;
  /** "Morning", "After school", "After lessons". */
  label: string;
  rows: ChartRow[];
  palette: ToolPaletteId;
  preview?: boolean;
}) {
  const [swipe, , chip] = toolPalettes[palette].colors;
  return (
    <div className="club-print club-sheet club-routine-chart" data-doc={doc} data-preview={preview ? '' : undefined} data-long={rows.length > 6 ? '' : undefined}>
      <div className="club-hand club-routine-chart-title">
        <span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{name}’s {label}</span>
      </div>
      <div className="club-routine-chart-head">
        <span>My school days</span>
        <span className="club-routine-days">{DAYS.map((d, i) => <span key={i}>{d}</span>)}</span>
      </div>
      <ol className="club-routine-chart-steps">
        {rows.map((r, n) => (
          <li key={r.rowId} className="club-routine-chart-step">
            <span className="club-routine-chart-num" style={{ background: chip }}>{n + 1}</span>
            <JobArt illustration={r.illustration} />
            <span className="club-routine-chart-text">{r.title}</span>
            <span className="club-routine-boxes">{DAYS.map((_, i) => <span key={i} className="club-box" />)}</span>
          </li>
        ))}
      </ol>
      <div className="club-routine-chart-foot">My routine. I check it myself.</div>
    </div>
  );
}

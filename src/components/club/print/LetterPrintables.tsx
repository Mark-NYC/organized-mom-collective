/**
 * Three-part kits' printables (August on): the monthly letter (front: the letter and the month's action; back:
 * guidance, a worked example, the QR code and one calendar reminder) and the action on its own page. US Letter portrait, same print system as November.
 *
 * The letter is the mailer's printable twin: stationery, not a worksheet. Georgia for the editorial voice, Montserrat
 * for labels, Kalam only for the signature, warm ivory paper, muted brand colors. Styles: src/styles/club.css.
 */
import { monthLabel } from '../../../data/club/labels';
import { toolPalettes, type ToolPaletteId } from '../../../data/tool-palettes';
import type { KitConfig } from '../../../data/club/types';
import type { CountdownItem } from '../../../lib/club/countdown';
import { qrPath } from '../../../lib/club/qr';
import { exampleRoutine, qrUrl, readableUrl } from '../../../lib/club/routines';
import { JobArt } from './ResponsibilityChart';

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

/** What she's filled in online, for her own printout: done, who's helping, when (a date, "When you can", or ''), her wording. */
export interface ActionFill {
  done: boolean[];
  helpers: string[];
  whens: string[];
  texts?: (string | null)[];
  /** "Wednesday, August 25" */
  firstDay?: string;
}

/**
 * The month's action as a checklist: a box, the line, a "By" blank (a countdown only) and a "Who's helping?" blank.
 * The mailed copy prints the blanks; her printout fills in what she chose online.
 */
function ActionList({ items, helperLabel, fill, dated }: { items: CountdownItem[]; helperLabel?: string; fill?: ActionFill; dated: boolean }) {
  return (
    <ol className={`club-action${dated ? '' : ' club-action-undated'}`}>
      {items.map((t, i) => (
        <li key={t.text} className="club-action-row">
          <span className={`club-box club-action-box${fill?.done[i] ? ' is-done' : ''}`} />
          <span className="club-action-text">{fill?.texts?.[i] ?? t.text}</span>
          {dated && (
            <span className="club-action-helper club-action-when">
              <span className="club-action-helper-label">By</span>
              <span className="club-action-helper-line">{fill?.whens[i] ?? ''}</span>
            </span>
          )}
          {helperLabel && (
            <span className="club-action-helper">
              <span className="club-action-helper-label">{helperLabel}</span>
              <span className="club-action-helper-line">{fill?.helpers[i] ?? ''}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * The two-page letter, as mailed: the action's blanks stay blank (her filled-in copy is the action printout).
 * `recipient`: her first name, only when it's reliably known; otherwise the warm generic greeting.
 */
export function LetterSheets({ doc, kit, preview, recipient }: { doc: string; kit: KitConfig; preview?: boolean; recipient?: string }) {
  const letter = kit.mailer.letter;
  const greeting = letter && (recipient?.trim() && letter.namedGreeting ? letter.namedGreeting.replace('{name}', recipient.trim()) : letter.greeting);
  const action = kit.action;
  const example = exampleRoutine(kit);
  const month = monthLabel(kit.month);
  const conversation = kit.mailer.conversation;
  const conversationBlock = conversation && (
    <div className="club-letter-conversation">
      <span className="club-letter-label">{conversation.label}</span>
      <p className="club-letter-question">{conversation.question}</p>
      {conversation.note && <p className="club-letter-question-note">{conversation.note}</p>}
    </div>
  );
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
              {greeting && <p className="club-letter-greeting">{greeting}</p>}
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
            <ActionList items={action.items} helperLabel={action.helperLabel} dated={action.kind === 'countdown'} />
          </div>
        )}
      </section>

      <section className="club-letter-page" aria-label="Back">
        {head}
        {conversation?.placement !== 'after-example' && conversationBlock}
        <h2 className="club-letter-back-title">{kit.mailer.fieldGuide.title}</h2>
        {kit.mailer.fieldGuide.intro && <p className="club-letter-back-intro">{kit.mailer.fieldGuide.intro}</p>}
        <div className="club-letter-tips">
          {kit.mailer.fieldGuide.sections.map((s) => (
            <p key={s.heading}><strong>{s.heading}</strong> {s.body}</p>
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
                <li key={s.title}>
                  <JobArt illustration={s.illustration} />
                  <span>{s.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {kit.mailer.story && (
          <div className="club-letter-example club-letter-story">
            <span className="club-letter-label">For example</span>
            <h3>{kit.mailer.story.title}</h3>
            <p>{kit.mailer.story.body}</p>
          </div>
        )}
        {conversation?.placement === 'after-example' && conversationBlock}
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

/** The action alone, with her helpers and wording (and dates, for a countdown), to hang beside the family calendar. */
export function ActionSheet({ doc, kit, palette, preview, fill }: { doc: string; kit: KitConfig; palette: ToolPaletteId; preview?: boolean; fill?: ActionFill }) {
  const [swipe] = toolPalettes[palette].colors;
  const action = kit.action!;
  return (
    <div className="club-print club-sheet club-action-sheet" data-doc={doc} data-preview={preview ? '' : undefined}>
      <div className="club-hand club-sheet-title"><span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{action.title}</span></div>
      <div className="club-sheet-sub">{fill?.firstDay ? `First day of school: ${fill.firstDay}` : kit.subtitle}</div>
      <p className="club-sheet-intro">{action.intro}</p>
      <ActionList items={action.items} helperLabel={action.helperLabel} fill={fill} dated={action.kind === 'countdown'} />
      <p className="club-action-sheet-note">
        {action.kind === 'countdown' ? 'Write these dates on your family wall calendar so everyone can see what’s coming.' : kit.mailer.calendarNote}
      </p>
      <div className="club-sheet-foot">Organized Family Club · {monthLabel(kit.month)}</div>
    </div>
  );
}

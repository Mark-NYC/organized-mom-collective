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

/** December's one seasonal touch: a small evergreen sprig in fine line, muted evergreen with a clay berry or two. */
function Sprig({ small }: { small?: boolean }) {
  return (
    <svg className={`club-sprig${small ? ' club-sprig-small' : ''}`} viewBox="0 0 120 48" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 30 C 34 24, 66 22, 112 14" stroke="#5f7563" strokeWidth="1.6" />
      {[[16, 28], [28, 26], [40, 24.5], [52, 23], [64, 21.5], [76, 20], [88, 18], [100, 16]].map(([x, y], i) => (
        <g key={x} stroke="#6f8a72" strokeWidth="1.3">
          <path d={`M${x} ${y} l ${7 - i * 0.3} ${-9 + i * 0.4}`} />
          <path d={`M${x} ${y} l ${8 - i * 0.3} ${7 - i * 0.3}`} />
        </g>
      ))}
      <circle cx="46" cy="31" r="2.6" fill="#b4826b" />
      <circle cx="52" cy="33.5" r="2.2" fill="#c49a84" />
    </svg>
  );
}

/** February's one touch: a single fine-line heart, drawn in one stroke, in muted rose. Not a Valentine. */
function Heart({ small }: { small?: boolean }) {
  return (
    <svg className={`club-heart${small ? ' club-heart-small' : ''}`} viewBox="0 0 40 36" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 32 C 12 26, 3 19, 4 11 C 5 5, 12 3, 16 6 C 18 7.5, 19.3 9.5, 20 11 C 20.7 9.5, 22 7.5, 24 6 C 28 3, 35 5, 36 11 C 37 19, 28 26, 20 32" stroke="#b98a8e" strokeWidth="1.4" />
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
  /** January: her one thing, plan and days, already in words. */
  focus?: { thing: string; plan: string; start: string; checkIn: string };
}

/** The one-thing line: a blank on the mailed letter, her words on her copy. */
function FocusLine({ label, value }: { label: string; value?: string }) {
  return (
    <p className="club-focus-line">
      <span className="club-action-helper-label">{label}</span>
      <span className="club-action-helper-line">{value ?? ''}</span>
    </p>
  );
}

/**
 * The month's action as a checklist: a box, the line, a "By" blank (a countdown only) and a "Who's helping?" blank.
 * The mailed copy prints the blanks; her printout fills in what she chose online.
 */
function ActionList({ items, helperLabel, fill, dated, below }: { items: CountdownItem[]; helperLabel?: string; fill?: ActionFill; dated: boolean; below?: boolean }) {
  return (
    <ol className={`club-action${dated ? '' : ' club-action-undated'}${helperLabel ? '' : ' club-action-plain'}${below ? ' club-action-below' : ''}`}>
      {items.map((t, i) => (
        <li key={t.text} className="club-action-row">
          <span className={`club-box club-action-box${fill?.done[i] ? ' is-done' : ''}`} />
          <span className="club-action-text">
            {fill?.texts?.[i] ?? t.text}
            {t.detail && !fill?.texts?.[i] && <span className="club-action-detail">{t.detail}</span>}
          </span>
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
      {conversation.prompts ? (
        <ol className="club-letter-prompts">{conversation.prompts.map((q) => <li key={q}>{q}</li>)}</ol>
      ) : (
        <p className="club-letter-question">{conversation.question}</p>
      )}
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
    <div className="club-print club-letter" data-doc={doc} data-preview={preview ? '' : undefined} data-accent={kit.mailer.accent}
      data-dense={action?.helperLabel && action.helperPlacement !== 'below' && action.items.some((t) => t.detail) ? '' : undefined}>
      <section className="club-letter-page" aria-label="Front">
        {head}
        {kit.mailer.accent === 'evergreen' && <Sprig />}
        {kit.mailer.accent === 'blush' && <Heart />}
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
            {action.note && <p className="club-letter-action-note">{action.note}</p>}
            {action.focus && <FocusLine label={action.focus.printLabel} />}
            <ActionList items={action.items} helperLabel={action.helperLabel} dated={action.kind === 'countdown'} below={action.helperPlacement === 'below'} />
          </div>
        )}
      </section>

      <section className="club-letter-page" aria-label="Back">
        {head}
        {conversation?.placement !== 'after-example' && conversationBlock}
        <h2 className="club-letter-back-title">
          {kit.mailer.accent === 'evergreen' && <Sprig small />}
          {kit.mailer.accent === 'blush' && <Heart small />}
          {kit.mailer.fieldGuide.title}
        </h2>
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
    <div className="club-print club-sheet club-action-sheet" data-doc={doc} data-preview={preview ? '' : undefined} data-accent={kit.mailer.accent}>
      <div className="club-hand club-sheet-title"><span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{action.title}</span></div>
      <div className="club-sheet-sub">{fill?.firstDay ? `First day of school: ${fill.firstDay}` : kit.subtitle}</div>
      <p className="club-sheet-intro">{action.intro}</p>
      {action.note && <p className="club-sheet-intro club-action-sheet-tip">{action.note}</p>}
      {action.focus && <FocusLine label={action.focus.printLabel} value={fill?.focus?.thing} />}
      <ActionList items={action.items} helperLabel={action.helperLabel} fill={fill} dated={action.kind === 'countdown'} below={action.helperPlacement === 'below'} />
      {action.focus && (
        <div className="club-focus-plan">
          <FocusLine label={action.focus.planLabel} value={fill?.focus?.plan} />
          <div className="club-focus-days">
            <FocusLine label="We start" value={fill?.focus?.start} />
            <FocusLine label="We check in" value={fill?.focus?.checkIn} />
          </div>
        </div>
      )}
      <p className="club-action-sheet-note">
        {action.kind === 'countdown' ? 'Write these dates on your family wall calendar so everyone can see what’s coming.' : kit.mailer.calendarNote}
      </p>
      <div className="club-sheet-foot">Organized Family Club · {monthLabel(kit.month)}</div>
    </div>
  );
}

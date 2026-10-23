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

/** March's touch: one fine-line stem with a few new leaves, in muted sage. */
function Stem({ small }: { small?: boolean }) {
  return (
    <svg className={`club-stem${small ? ' club-stem-small' : ''}`} viewBox="0 0 90 40" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 34 C 26 30, 50 22, 86 8" stroke="#6f8a72" strokeWidth="1.4" />
      {[[22, 30, -1], [38, 25, 1], [54, 19, -1], [70, 13, 1]].map(([x, y, side]) => (
        <path key={x} d={`M${x} ${y} C ${x + 3} ${y - 9 * side}, ${x + 12} ${y - 10 * side}, ${x + 14} ${y - 6 * side} C ${x + 10} ${y - 2 * side}, ${x + 5} ${y - 1 * side}, ${x} ${y}`} stroke="#7d917c" strokeWidth="1.2" />
      ))}
    </svg>
  );
}

/** April's touch: a fine-line place setting (fork, plate, knife) in sage, the plate's rim in pale apricot. */
function PlaceSetting({ small }: { small?: boolean }) {
  return (
    <svg className={`club-place${small ? ' club-place-small' : ''}`} viewBox="0 0 80 40" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="40" cy="20" r="15" stroke="#6f8a72" strokeWidth="1.3" />
      <circle cx="40" cy="20" r="10" stroke="#d2a283" strokeWidth="1.2" />
      <path d="M14 6 v 10 M10.5 6 v 7 c 0 2.5, 7 2.5, 7 0 v -7 M14 16 v 18" stroke="#6f8a72" strokeWidth="1.3" />
      <path d="M66 34 V 6 c 4 3, 5 9, 4 14 h -4" stroke="#6f8a72" strokeWidth="1.3" />
    </svg>
  );
}

/** May's touch: a fine-line open notebook in sage with a soft blue ribbon. No caps, no pencils. */
function Notebook({ small }: { small?: boolean }) {
  return (
    <svg className={`club-notebook${small ? ' club-notebook-small' : ''}`} viewBox="0 0 80 40" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 10 C 32 6, 20 6, 10 8 V 34 C 20 32, 32 32, 40 36 C 48 32, 60 32, 70 34 V 8 C 60 6, 48 6, 40 10 Z" stroke="#6f8a72" strokeWidth="1.3" />
      <path d="M40 10 V 36" stroke="#6f8a72" strokeWidth="1.2" />
      <path d="M16 15 C 23 14, 29 14, 34 15.5 M16 21 C 23 20, 29 20, 34 21.5 M46 15.5 C 51 14, 57 14, 64 15" stroke="#9aab8f" strokeWidth="1" />
      <path d="M56 7 V 20 L 59 17 L 62 20 V 6.5" stroke="#8fa7b8" strokeWidth="1.3" />
    </svg>
  );
}

/** June's touch: a fine-line sun, sage rays around a pale apricot center. No beach, no cartoon. */
function Sun({ small }: { small?: boolean }) {
  return (
    <svg className={`club-sun${small ? ' club-sun-small' : ''}`} viewBox="0 0 40 40" aria-hidden="true" fill="none" strokeLinecap="round">
      <circle cx="20" cy="20" r="7.5" stroke="#d2a283" strokeWidth="1.3" fill="#f8eee5" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <path key={i} d={`M${20 + Math.cos(a) * 11} ${20 + Math.sin(a) * 11} L ${20 + Math.cos(a) * 16} ${20 + Math.sin(a) * 16}`} stroke="#7d917c" strokeWidth="1.3" />;
      })}
    </svg>
  );
}

/** July's touch: a fine-line compass in sage and soft blue, its needle tipped in apricot. No luggage, no cartoons. */
function Compass({ small }: { small?: boolean }) {
  return (
    <svg className={`club-compass${small ? ' club-compass-small' : ''}`} viewBox="0 0 40 40" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="20" cy="20" r="15" stroke="#6f8a72" strokeWidth="1.3" />
      <circle cx="20" cy="20" r="11" stroke="#8fa7b8" strokeWidth="1" />
      <path d="M20 5v3M20 32v3M5 20h3M32 20h3" stroke="#6f8a72" strokeWidth="1.2" />
      <path d="M20 12 23 20 20 28 17 20Z" stroke="#6f8a72" strokeWidth="1.1" />
      <path d="M20 12 23 20H17Z" fill="#e8c6ab" stroke="#d2a283" strokeWidth="1.1" />
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
      data-dense={action?.helperLabel && action.helperPlacement !== 'below' && (action.items.some((t) => t.detail) || action.focus) ? '' : undefined}>
      <section className="club-letter-page" aria-label="Front">
        {head}
        {kit.mailer.accent === 'evergreen' && <Sprig />}
        {kit.mailer.accent === 'blush' && <Heart />}
        {kit.mailer.accent === 'spring' && <Stem />}
        {kit.mailer.accent === 'table' && <PlaceSetting />}
        {kit.mailer.accent === 'school' && <Notebook />}
        {kit.mailer.accent === 'summer' && <Sun />}
        {kit.mailer.accent === 'travel' && <Compass />}
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
            {action.focus?.whenLabel && <FocusLine label={action.focus.whenLabel} />}
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
          {kit.mailer.accent === 'spring' && <Stem small />}
          {kit.mailer.accent === 'table' && <PlaceSetting small />}
          {kit.mailer.accent === 'school' && <Notebook small />}
          {kit.mailer.accent === 'summer' && <Sun small />}
          {kit.mailer.accent === 'travel' && <Compass small />}
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
        {kit.mailer.framework && (
          <ol className="club-letter-framework">
            {kit.mailer.framework.steps.map((f) => <li key={f.word}><strong>{f.word}</strong><span>{f.text}</span></li>)}
          </ol>
        )}
        {kit.mailer.card && (
          <div className="club-letter-pair club-letter-pair-card">
            <div className="club-letter-card">
              <h3>{kit.mailer.card.title}</h3>
              <ul>{kit.mailer.card.ideas.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            {kit.mailer.tip && (
              <div className="club-letter-example club-letter-tip">
                <span className="club-letter-label">{kit.mailer.tip.title}</span>
                <p>{kit.mailer.tip.body}</p>
              </div>
            )}
          </div>
        )}
        {kit.mailer.tip && !kit.mailer.ageGuide && !kit.mailer.card && (
          <div className="club-letter-example club-letter-tip club-letter-tip-wide">
            <span className="club-letter-label">{kit.mailer.tip.title}</span>
            <p>{kit.mailer.tip.body}</p>
          </div>
        )}
        {kit.mailer.reflection && (
          <div className="club-letter-reflection">
            <div className="club-letter-reflection-head">
              <h3>{kit.mailer.reflection.title}</h3>
              <p>{kit.mailer.reflection.note}</p>
            </div>
            <p className="club-letter-reflection-name"><span>Name</span><span className="club-action-helper-line" /></p>
            <ol>
              {kit.mailer.reflection.prompts.map((q) => (
                <li key={q}><span className="club-letter-reflection-q">{q}</span><span className="club-write" /><span className="club-write" /></li>
              ))}
            </ol>
          </div>
        )}
        {kit.mailer.ageGuide && (
          <div className="club-letter-pair">
            <div className="club-letter-example club-letter-ages">
              <span className="club-letter-label">{kit.mailer.ageGuide.title}</span>
              <dl>{kit.mailer.ageGuide.rows.map((r) => <div key={r.ages}><dt>{r.ages}</dt><dd>{r.jobs}</dd></div>)}</dl>
              <p className="club-letter-checklist-note">{kit.mailer.ageGuide.note}</p>
            </div>
            {kit.mailer.tip && (
              <div className="club-letter-example club-letter-tip">
                <span className="club-letter-label">{kit.mailer.tip.title}</span>
                <p>{kit.mailer.tip.body}</p>
              </div>
            )}
          </div>
        )}
        {kit.mailer.checklist && (
          <div className="club-letter-example club-letter-checklist">
            <span className="club-letter-label">{kit.mailer.checklist.title}</span>
            <p className="club-letter-checklist-note">{kit.mailer.checklist.note}</p>
            <ul>{kit.mailer.checklist.items.map((t) => <li key={t}><span className="club-box" />{t}</li>)}</ul>
          </div>
        )}
        {conversation?.placement === 'after-example' && conversationBlock}
        {kit.mailer.invite && (
          <div className="club-letter-invite">
            <QrCode url={qrUrl(kit.mailer.qrPath)} label={`QR code for ${readableUrl(kit.mailer.qrPath)}`} />
            <div>
              <h3>{kit.mailer.invite.title}</h3>
              <p>{kit.mailer.invite.body}</p>
              {kit.mailer.invite.tools && (
                <ul className="club-letter-invite-tools">
                  {kit.mailer.invite.tools.map((t) => <li key={t.title}><strong>{t.title}</strong> {t.body}</li>)}
                </ul>
              )}
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
      {action.focus?.whenLabel && <FocusLine label={action.focus.whenLabel} value={fill?.focus?.start} />}
      <ActionList items={action.items} helperLabel={action.helperLabel} fill={fill} dated={action.kind === 'countdown'} below={action.helperPlacement === 'below'} />
      {action.focus?.planLabel && (
        <div className="club-focus-plan">
          <FocusLine label={action.focus.planLabel} value={fill?.focus?.plan} />
          {action.focus.startAt !== undefined && (
            <div className="club-focus-days">
              <FocusLine label="We start" value={fill?.focus?.start} />
              <FocusLine label="We check in" value={fill?.focus?.checkIn} />
            </div>
          )}
        </div>
      )}
      <p className="club-action-sheet-note">
        {action.kind === 'countdown' ? 'Write these dates on your family wall calendar so everyone can see what’s coming.' : kit.mailer.calendarNote}
      </p>
      <div className="club-sheet-foot">Organized Family Club · {monthLabel(kit.month)}</div>
    </div>
  );
}

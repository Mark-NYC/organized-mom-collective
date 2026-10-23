/**
 * November's one plan, on one US Letter portrait page: Our First Family Meeting Plan, Our Family Restart Plan, Our
 * Family's Next Step (shared leadership) or Our Ownership Handoff Plan, as she edited it in the Family Rhythm &
 * Ownership Guide. A card for beside the calendar, not a chart: no daily boxes, no tracking. Styles: src/styles/club.css.
 */
import { monthLabel } from '../../../data/club/labels';
import type { Plan } from '../../../data/rhythm-guide';
import { toolPalettes, type ToolPaletteId } from '../../../data/tool-palettes';

export default function NextStepSheet({ doc, plan, familyName, month, palette, preview }: {
  doc: string;
  plan: Plan;
  familyName: string;
  month: string;
  palette: ToolPaletteId;
  preview?: boolean;
}) {
  const [swipe, card] = toolPalettes[palette].colors;
  const row = (labelText: string, value: string) => value.trim() && (
    <div className="club-next-row">
      <span className="club-next-label">{labelText}</span>
      <p>{value}</p>
    </div>
  );
  return (
    <div className="club-print club-sheet club-next" data-doc={doc} data-preview={preview ? '' : undefined}>
      <div className="club-hand club-sheet-title"><span className="club-swipe" style={{ ['--swipe' as string]: swipe }}>{plan.title}</span></div>
      <div className="club-sheet-sub">{familyName} · {monthLabel(month)}</div>

      <div className="club-next-goal" style={{ background: card }}>
        <span className="club-next-label">Our goal</span>
        <p>{plan.goal}</p>
      </div>
      {plan.obstacle && row('What got in the way', plan.obstacle)}

      {plan.handoff ? (
        <div className="club-next-own">
          <div className="club-next-row"><span className="club-next-label">I own</span><p className="club-next-statement">{plan.handoff.statement}</p></div>
          {row('When', plan.handoff.when)}
          {row('Done looks like', plan.handoff.done)}
        </div>
      ) : (
        <div className="club-next-row">
          <span className="club-next-label">Our next step</span>
          <p className="club-next-statement">{plan.step}</p>
          {plan.roles.length > 0 && <ul className="club-next-roles">{plan.roles.map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>
      )}

      {plan.handoff && (
        <ol className="club-next-stages">
          {plan.handoff.stages.map((s) => <li key={s.word}><strong>{s.word}</strong><span>{s.text}</span></li>)}
        </ol>
      )}

      <div className="club-next-grid">
        {row('Who’s involved', plan.who)}
        {!plan.handoff && row('When we’ll try it', plan.when)}
        {row('Our reminder', plan.cue)}
      </div>
      {plan.handoff?.coaching && <p className="club-next-coach">{plan.handoff.coaching}</p>}
      {plan.why && <p className="club-next-coach">{plan.why}</p>}

      <div className="club-next-check">
        <span className="club-next-label">Check-in question</span>
        <p>{plan.checkIn}</p>
      </div>
      <div className="club-sheet-foot">Organized Family Club · Our Family, Our Team</div>
    </div>
  );
}

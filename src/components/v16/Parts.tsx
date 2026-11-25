/**
 * V16: one responsibility row (Everyone's Part, the Week Four check-in). Whole-row tap opens it; Keep / Change / Skip;
 * Change edits in place (who, what, done means, when) without leaving the meeting step; "We agree" is the only thing
 * that makes an agreement. Editing an agreement takes it back to "agree again" (src/lib/v16/model.ts → partReducer).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { DAY_NAMES, dayName, occurrenceOf, partContext, partReducer, type Part, type PartAction } from '../../lib/v16/model';
import { addDays } from '../../lib/calendar/recurrence';
import { Down, Person, StatusPill, ownerLine, type Ctx } from './shared';

export function act(ctx: Ctx, a: PartAction) {
  ctx.set((s) => ({ ...s, parts: partReducer(s.parts, a, s.online) }));
}

export function PartRow({ ctx, part, open, onToggle, prominent = false }: { ctx: Ctx; part: Part; open: boolean; onToggle: () => void; prominent?: boolean }) {
  const [editing, setEditing] = useState(false);
  const panel = useId();
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) setEditing(false); }, [open]);
  useEffect(() => { if (editing) editorRef.current?.querySelector<HTMLElement>('select,input')?.focus({ preventScroll: true }); }, [editing]);
  const context = partContext(ctx.s, ctx.monday, part, ctx.names);
  const canAgree = Boolean(part.ownerId && part.title.trim());
  const needsAgreement = part.status === 'kept' || part.changedSinceAgreed;
  return (
    <div data-part={part.id} data-part-state={part.changedSinceAgreed ? 'changed' : part.status}>
      <button type="button" className="v16-row" aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        <Person ctx={ctx} id={part.ownerId} size={prominent ? 'md' : 'sm'} />
        <span className="v16-row-main">
          <span className="v16-eyebrow block">{context}</span>
          <span className={`block ${prominent ? 'v16-h3' : 'v16-row-title'} mt-0.5`}>{part.title || 'Untitled'}</span>
          <span className="v16-meta mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">{ownerLine(ctx, part)} <StatusPill part={part} /></span>
        </span>
        <Down open={open} />
      </button>
      {open && (
        <div id={panel} className="pb-4" data-part-panel>
          {!editing && (
            <>
              <p className="text-[0.9rem]"><span className="font-semibold">Done means: </span>{part.finishLine || <span className="text-[color:var(--of-soft)]">Not decided yet</span>}</p>
              {part.why && (
                <details className="v16-details mt-1">
                  <summary className="!min-h-[40px] !text-[0.82rem] !font-medium text-[color:var(--of-soft)]">Why this?</summary>
                  <p className="v16-meta pb-1">{part.why} {part.eventLink && 'The activity itself stays on the calendar whatever you decide.'}</p>
                </details>
              )}
              {part.status === 'skipped' ? (
                <div className="v16-choices">
                  <p className="v16-meta w-full">Skipped for now. {part.eventLink ? 'The activity is still on the calendar.' : ''}</p>
                  <button type="button" className="v16-choice" onClick={() => act(ctx, { type: 'unskip', id: part.id })}>Bring it back</button>
                </div>
              ) : (
                <>
                  <div className="v16-choices" role="group" aria-label="Decide together">
                    {part.status !== 'agreed' && (
                      <button type="button" className="v16-choice" aria-pressed={part.status === 'kept'} onClick={() => act(ctx, { type: 'keep', id: part.id })} data-keep>Keep</button>
                    )}
                    <button type="button" className="v16-choice" onClick={() => setEditing(true)} data-change>Change</button>
                    {part.status !== 'agreed' && <button type="button" className="v16-choice v16-choice--quiet" onClick={() => act(ctx, { type: 'skip', id: part.id })} data-skip>Skip</button>}
                  </div>
                  {needsAgreement && (
                    <div className="mt-3">
                      <button type="button" className="of-btn of-btn--block" disabled={!canAgree} onClick={() => act(ctx, { type: 'agree', id: part.id, today: ctx.today })} data-we-agree>We agree</button>
                      <p className="v16-meta mt-2">{canAgree ? `Say it together, then tap. It goes on Today for ${ctx.names[part.ownerId!]}.` : 'Choose who will do it first.'}</p>
                    </div>
                  )}
                  {part.status === 'agreed' && (
                    <p className="v16-meta mt-3" role="status">Agreed{part.agreedOn ? ` on ${new Date(`${part.agreedOn}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}` : ''}. {part.pending ? 'Saved on this phone; it will reach the other adult’s phone when you’re back online.' : 'It stays in place week to week until you change it.'}</p>
                  )}
                  {part.status === 'suggested' && !part.changedSinceAgreed && <p className="v16-meta mt-2">Keep it to talk it over. Nothing is agreed until you all say so.</p>}
                </>
              )}
            </>
          )}
          {editing && <Editor ctx={ctx} part={part} onDone={() => setEditing(false)} refEl={editorRef} />}
        </div>
      )}
    </div>
  );
}

function Editor({ ctx, part, onDone, refEl }: { ctx: Ctx; part: Part; onDone: () => void; refEl: React.RefObject<HTMLDivElement | null> }) {
  const edit = (patch: Extract<PartAction, { type: 'edit' }>['patch']) => act(ctx, { type: 'edit', id: part.id, patch });
  const ids = { who: useId(), what: useId(), done: useId(), when: useId() };
  const occ = part.eventLink ? occurrenceOf(ctx.s, ctx.monday, part.eventLink) : null;
  return (
    <div ref={refEl} className="v16-editor" data-editor>
      <label className="v16-field" htmlFor={ids.who}>Who will do it?
        <select id={ids.who} className="v16-input" value={part.ownerId ?? ''} onChange={(e) => edit({ ownerId: e.target.value || null })} data-edit-owner>
          <option value="">Choose someone</option>
          {ctx.people.map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}
        </select>
      </label>
      <label className="v16-field" htmlFor={ids.what}>What will they do?
        <input id={ids.what} className="v16-input" value={part.title} maxLength={80} onChange={(e) => edit({ title: e.target.value })} data-edit-title />
      </label>
      <label className="v16-field" htmlFor={ids.done}>Done means
        <textarea id={ids.done} className="v16-input" rows={2} value={part.finishLine} maxLength={120} onChange={(e) => edit({ finishLine: e.target.value })} data-edit-finish />
      </label>
      {part.eventLink && occ && (
        <label className="v16-field" htmlFor={ids.when}>When
          <select id={ids.when} className="v16-input" value={part.offsetDays ?? 0} onChange={(e) => edit({ offsetDays: Number(e.target.value) })} data-edit-when>
            {[-2, -1, 0].map((n) => <option key={n} value={n}>{n === 0 ? `The same day (${dayName(occ.date)})` : `${n === -1 ? 'The day before' : 'Two days before'} (${dayName(addDays(occ.date, n))})`}</option>)}
          </select>
        </label>
      )}
      {part.weekday !== undefined && (
        <label className="v16-field" htmlFor={ids.when}>Which day
          <select id={ids.when} className="v16-input" value={part.weekday} onChange={(e) => edit({ weekday: Number(e.target.value) })} data-edit-when>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
          </select>
        </label>
      )}
      <button type="button" className="v16-choice w-full" onClick={onDone} data-done-editing>Done editing</button>
      {part.changedSinceAgreed && <p className="v16-meta" role="status">This changes what you agreed. Agree again when everyone’s happy with it.</p>}
    </div>
  );
}

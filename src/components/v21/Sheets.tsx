/**
 * V21 sheets: ask for a hand, make a plan for something that needs an owner, choose what to do about an event, and
 * the family's standing agreements and remembered decisions (Everyone's part). Every write goes through
 * src/lib/v21/model.ts; nothing changes until the adult taps the button that says so.
 */
import { useState } from 'react';
import { DAY_NAMES, dayName, type Part } from '../../lib/v16/model';
import {
  acknowledge, askFor, askHelp, chooseIntent, clearIntent, decisionsOf, editDecision, editStanding, forgetDecision, intelOf, intentOptions, makeUsual, markSeen,
  remember, rhythmOf, takeIt, titleKey, toMeeting, type IntentOption, type Subject,
} from '../../lib/v21/model';
import type { Matter, WeekItem } from '../../lib/v21/today';
import { Badge, badgeFor } from '../v20/Badge';
import { Sheet, type Ctx } from '../v16/shared';
import RoutineCardSheet from './RoutineCard';
import { Chip, adultsOf, othersOf, ownerName, viewerOf } from './ui';

const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const t12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

/** Ask another adult for a hand with one of your own responsibilities. Asking never moves it. */
export function AskSheet({ ctx, part, date, time, onClose }: { ctx: Ctx; part: Part; date: string; time: string | null; onClose: () => void }) {
  const viewer = viewerOf(ctx);
  const others = othersOf(ctx);
  const [to, setTo] = useState(others[0]?.id ?? '');
  const standing = rhythmOf(part) === 'weekly' || rhythmOf(part) === 'event';
  const [scope, setScope] = useState<'once' | 'always'>('once');
  const [ask, setAsk] = useState(askFor(part.title));
  const subject: Subject = standing ? (scope === 'once' ? { kind: 'occurrence', partId: part.id, date } : { kind: 'part', partId: part.id }) : { kind: 'part', partId: part.id };
  const send = () => {
    ctx.set((s) => askHelp(s, { from: viewer, to, subject, title: part.title, ask, date: subject.kind === 'part' && standing ? null : date, time: subject.kind === 'part' && standing ? null : time, today: ctx.today }).state);
    onClose();
  };
  return (
    <Sheet title="Ask for a hand" onClose={onClose}>
      <div data-ask-sheet={part.id}>
        <p className="v21-meta">It stays yours until they say yes.</p>
        {others.length > 1 && (
          <label className="v16-field mt-3">Who?
            <select className="v16-input" value={to} onChange={(e) => setTo(e.target.value)} data-ask-to>{others.map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}</select>
          </label>
        )}
        {standing && (
          <div className="v19-options mt-3" role="radiogroup" aria-label="For how long">
            <button type="button" role="radio" aria-checked={scope === 'once'} className="v19-option" onClick={() => setScope('once')} data-scope-once><span className="v19-radio" aria-hidden="true" />Just {dayName(date)}</button>
            <button type="button" role="radio" aria-checked={scope === 'always'} className="v19-option" onClick={() => setScope('always')} data-scope-always><span className="v19-radio" aria-hidden="true" /><span><span className="block">From now on</span><span className="v21-meta block">{ownerName(ctx, to)} would take it over every week.</span></span></button>
          </div>
        )}
        <label className="v16-field mt-3">What {ownerName(ctx, to)} sees
          <input className="v16-input" value={ask} maxLength={120} onChange={(e) => setAsk(e.target.value)} data-ask-text />
        </label>
        <p className="v21-meta mt-1">{subject.kind === 'occurrence' || !standing ? [dayName(date), time ? t12(time) : null].filter(Boolean).join(' · ') : 'Every week'}</p>
        <button type="button" className="v21-btn v21-btn--dark v21-btn--block mt-5" disabled={!to || !ask.trim()} onClick={send} data-send-ask>Ask {ownerName(ctx, to)}</button>
      </div>
    </Sheet>
  );
}

/** Something needs an owner (a decision made each time, or a declined request): take it, ask, or talk it over. */
export function MakePlanSheet({ ctx, m, meetingDate, onClose }: { ctx: Ctx; m: Matter; meetingDate: string | null; onClose: () => void }) {
  const viewer = viewerOf(ctx);
  const r = m.request;
  const d = m.decision;
  const title = r?.title ?? d?.title ?? m.title;
  const subject: Subject = r?.subject ?? { kind: 'event', link: d!.eventLink!, date: m.date!, need: d?.need };
  const date = r?.date ?? m.date ?? null;
  const time = r?.time ?? m.time ?? null;
  const declinedBy = r?.to;
  const others = othersOf(ctx).filter((o) => o.id !== declinedBy);
  const [took, setTook] = useState(false);
  const mine = () => {
    ctx.set((s) => { let n = takeIt(s, { by: viewer, title, subject, date, time, today: ctx.today }); if (r) n = acknowledge(n, r.id, viewer, ctx.today); return n; });
    if (d && !r) setTook(true); else onClose();
  };
  const askOther = (to: string) => { ctx.set((s) => { let n = askHelp(s, { from: viewer, to, subject, title, date, time, today: ctx.today }).state; if (r) n = acknowledge(n, r.id, viewer, ctx.today); return n; }); onClose(); };
  const meeting = meetingDate && date && meetingDate <= date;
  const bringUp = () => { ctx.set((s) => (r ? toMeeting(s, r.id, viewer, ctx.today) : markSeen(s, viewer, m.key, ctx.today))); onClose(); };
  if (took && d) {
    return (
      <Sheet title="You have it" onClose={onClose}>
        <div data-usual-offer>
          <p className="v21-sheet-lede">{title} · {date ? dayName(date) : ''} is yours.</p>
          <p className="v21-meta mt-1">Should this be the usual, so nobody has to ask each week? You can change it any time in Everyone’s part.</p>
          <div className="v21-stack mt-4">
            <button type="button" className="v21-btn v21-btn--dark v21-btn--block" onClick={() => { ctx.set((s) => makeUsual(s, { decisionId: d.id, ownerId: viewer, time, today: ctx.today, by: viewer })); onClose(); }} data-make-usual>Make it my usual</button>
            <button type="button" className="v21-btn v21-btn--outline v21-btn--block" onClick={onClose} data-just-this-time>Just this time</button>
          </div>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={m.title} onClose={onClose}>
      <div data-make-plan-sheet={m.key}>
        <p className="v21-meta">{[date ? dayName(date) : null, time ? t12(time) : null].filter(Boolean).join(' · ')}{declinedBy ? ` · ${ownerName(ctx, declinedBy)} can’t this time` : ''}</p>
        <div className="v21-stack mt-4">
          <button type="button" className="v21-btn v21-btn--dark v21-btn--block" onClick={mine} data-take>I’ll do it</button>
          {others.map((o) => <button key={o.id} type="button" className="v21-btn v21-btn--outline v21-btn--block" onClick={() => askOther(o.id)} data-ask={o.id}>Ask {o.firstName}</button>)}
          {meeting && <button type="button" className="v21-btn v21-btn--outline v21-btn--block" onClick={bringUp} data-bring-up>Decide at the Family Meeting</button>}
        </div>
        <p className="v21-meta mt-3">Nothing is anyone’s until they say yes.</p>
      </div>
    </Sheet>
  );
}

/** Mark said yes: Meg can make him the usual for a decision the family makes each time. Optional, one tap. */
export function UsualOffer({ ctx, m }: { ctx: Ctx; m: Matter }) {
  const r = m.request!;
  const viewer = viewerOf(ctx);
  if (r.subject.kind !== 'event') return null;
  const link = r.subject.link;
  const d = decisionsOf(ctx.s).find((x) => x.kind === 'each-time' && x.eventLink === link);
  if (!d) return null;
  const use = () => ctx.set((s) => acknowledge(makeUsual(s, { decisionId: d.id, ownerId: r.to, time: r.time, today: ctx.today, by: viewer }), r.id, viewer, ctx.today));
  return <button type="button" className="v21-link" onClick={use} data-make-usual>Make {ownerName(ctx, r.to)} the usual</button>;
}

/** What to do about an event: offered, never required. "Nothing needed" is a first-class answer. */
export function IntentSheet({ ctx, w, onClose }: { ctx: Ctx; w: WeekItem; onClose: () => void }) {
  const viewer = viewerOf(ctx);
  const opts = intentOptions(w.occ.event.title);
  const pref = w.preference;
  const [choice, setChoice] = useState<string | null>(w.intent?.choice ?? pref?.choice ?? null);
  const [owner, setOwner] = useState<string>(w.plannedPart?.ownerId ?? pref?.ownerId ?? viewer);
  const [rememberIt, setRememberIt] = useState(false);
  const opt = opts.find((o) => o.id === choice) ?? null;
  const adults = adultsOf(ctx).map((m) => m.id);
  const isOther = owner !== viewer && adults.includes(owner);
  const save = (option: IntentOption | 'nothing') => {
    ctx.set((s) => {
      let n = w.intent ? clearIntent(s, w.link, w.occ.date) : s;
      n = chooseIntent(n, { link: w.link, date: w.occ.date, eventTitle: w.occ.event.title, option, ownerId: option === 'nothing' ? null : owner, by: viewer, today: ctx.today, time: w.occ.event.start_time ?? null, adults });
      if (rememberIt) {
        const id = `d-pref-${titleKey(w.occ.event.title)}`.replace(/[^a-z0-9-]+/gi, '-');
        const text = option === 'nothing' ? `Usually nothing needed for ${w.occ.event.title}` : `We usually ${lowerFirst(option.title)}`;
        n = remember(n, { id, kind: 'preference', text, titleKey: titleKey(w.occ.event.title), choice: option === 'nothing' ? 'nothing' : option.id, ownerId: option === 'nothing' ? null : owner, by: viewer, on: ctx.today });
      }
      return n;
    });
    onClose();
  };
  return (
    <Sheet title={w.occ.event.title} onClose={onClose}>
      <div data-intent-sheet={w.link}>
        <p className="v21-meta">{dayName(w.occ.date)}. Anything you’d like to do? Nothing is needed unless you choose it.</p>
        {pref && <p className="v21-note mt-3" data-preference>{pref.text}.</p>}
        <div className="v19-options mt-3" role="radiogroup" aria-label="What to do">
          {opts.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} className="v19-option" onClick={() => { setChoice(o.id); if (o.owner === 'child' && !ctx.kids.has(owner)) setOwner([...ctx.kids][0] ?? viewer); }} data-intent-option={o.id}>
              <span className="v19-radio" aria-hidden="true" /><span>{o.label}</span>
            </button>
          ))}
        </div>
        {opt && (
          <>
            <label className="v16-field mt-3">Who?
              <select className="v16-input" value={owner} onChange={(e) => setOwner(e.target.value)} data-intent-owner>
                {ctx.people.map((m) => <option key={m.id} value={m.id}>{m.id === viewer ? `${m.firstName} (me)` : m.firstName}</option>)}
              </select>
            </label>
            <p className="v21-meta mt-1">{opt.title}{opt.lead ? ` · by ${dayName(new Date(Date.parse(`${w.occ.date}T12:00:00Z`) - opt.lead * 864e5).toISOString().slice(0, 10))}` : ''}</p>
          </>
        )}
        <label className="v21-check-line mt-4"><input type="checkbox" checked={rememberIt} onChange={(e) => setRememberIt(e.target.checked)} data-remember /> Remember this for next time</label>
        <div className="v21-stack mt-4">
          <button type="button" className="v21-btn v21-btn--dark v21-btn--block" disabled={!opt} onClick={() => opt && save(opt)} data-intent-save>{isOther ? `Ask ${ownerName(ctx, owner)}` : 'Add to our plan'}</button>
          <button type="button" className="v21-btn v21-btn--outline v21-btn--block" onClick={() => save('nothing')} data-intent-nothing>Nothing needed</button>
          {w.intent && <button type="button" className="v21-link" onClick={() => { ctx.set((s) => clearIntent(s, w.link, w.occ.date)); onClose(); }} data-intent-clear>Undo our choice</button>}
        </div>
      </div>
    </Sheet>
  );
}

/** Everyone's part, opened: standing agreements by kind, their routine cards, and what the family decided. */
export function AgreementsPanel({ ctx, routines, weekly }: { ctx: Ctx; routines: Part[]; weekly: Part[] }) {
  const [card, setCard] = useState<Part | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const decisions = decisionsOf(ctx.s);
  return (
    <div className="v21-agreements" data-agreements>
      {routines.length > 0 && <h3 className="v21-h3">Daily routines</h3>}
      {routines.map((p) => <AgreementRow key={p.id} ctx={ctx} p={p} editing={edit === p.id} onEdit={() => setEdit(edit === p.id ? null : p.id)} onCard={() => setCard(p)} />)}
      {weekly.length > 0 && <h3 className="v21-h3">Weekly responsibilities</h3>}
      {weekly.map((p) => <AgreementRow key={p.id} ctx={ctx} p={p} editing={edit === p.id} onEdit={() => setEdit(edit === p.id ? null : p.id)} onCard={() => setCard(p)} />)}
      {!routines.length && !weekly.length && <p className="v21-meta py-2">What the family agrees at the meeting lives here.</p>}
      <h3 className="v21-h3">What we’ve decided</h3>
      {!decisions.length && <p className="v21-meta py-1" data-no-decisions>Nothing remembered yet. When you choose something you’d like to keep, it shows here.</p>}
      {decisions.map((d) => <DecisionRow key={d.id} ctx={ctx} id={d.id} />)}
      <p className="v21-meta mt-2">Change an agreement together at the Family Meeting, or edit the words here.</p>
      {card && <RoutineCardSheet ctx={ctx} part={card} onClose={() => setCard(null)} />}
    </div>
  );
}

function AgreementRow({ ctx, p, editing, onEdit, onCard }: { ctx: Ctx; p: Part; editing: boolean; onEdit: () => void; onCard: () => void }) {
  const viewer = viewerOf(ctx);
  const [cue, setCue] = useState(p.cue ?? '');
  const [title, setTitle] = useState(p.title);
  const [finish, setFinish] = useState(p.finishLine);
  const when = p.weekday !== undefined ? `Every ${DAY_NAMES[p.weekday]}` : p.eventLink ? 'Every time it’s on the calendar' : null;
  const printable = rhythmOf(p) === 'routine' || /clean|reset|tidy|floor|room|bathroom|kitchen/i.test(p.title);
  return (
    <div className="v21-agreement" data-agreement={p.id}>
      <div className="v21-row !border-0 !py-2">
        <Badge name={badgeFor(p.title)} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="v21-row-title">{ownerName(ctx, p.ownerId)} · {p.title}</p>
          <p className="v21-meta">{[when, p.cue].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="v21-agreement-actions">
        {printable && <button type="button" className="v21-link v21-link--small" onClick={onCard} data-create-card>Create routine card</button>}
        <button type="button" className="v21-link v21-link--small" onClick={onEdit} aria-expanded={editing} data-edit-agreement>{editing ? 'Close' : 'Edit'}</button>
      </div>
      {editing && (
        <form className="v21-edit" onSubmit={(e) => { e.preventDefault(); ctx.set((s) => editStanding(s, p.id, { title: title.trim() || p.title, cue: cue.trim() || undefined, finishLine: finish.trim() }, viewer, ctx.today)); onEdit(); }}>
          <label className="v16-field">What<input className="v16-input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} data-edit-title /></label>
          <label className="v16-field mt-2">When<input className="v16-input" value={cue} maxLength={60} onChange={(e) => setCue(e.target.value)} data-edit-cue /></label>
          <label className="v16-field mt-2">Done when<input className="v16-input" value={finish} maxLength={140} onChange={(e) => setFinish(e.target.value)} data-edit-finish /></label>
          <p className="v21-meta mt-2">{p.ownerId === viewer || p.ownerId === 'together' ? 'Saved for everyone.' : `${ownerName(ctx, p.ownerId)} will see what changed.`}</p>
          <button type="submit" className="v21-btn v21-btn--dark v21-btn--block mt-3" data-save-agreement>Save</button>
        </form>
      )}
      <span className="sr-only"><Chip ctx={ctx} id={p.ownerId} /></span>
    </div>
  );
}

function DecisionRow({ ctx, id }: { ctx: Ctx; id: string }) {
  const d = intelOf(ctx.s).decisions![id];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.text);
  return (
    <div className="v21-agreement" data-decision={d.id} data-decision-kind={d.kind}>
      <div className="v21-row !border-0 !py-2">
        <Badge name={d.kind === 'each-time' ? 'helping-hands' : 'star'} size="sm" />
        <div className="min-w-0 flex-1"><p className="v21-row-title">{d.text}</p><p className="v21-meta">{d.kind === 'each-time' ? 'Decided each time' : 'Remembered preference'}{d.ownerId ? ` · ${ownerName(ctx, d.ownerId)}` : ''}</p></div>
      </div>
      <div className="v21-agreement-actions">
        <button type="button" className="v21-link v21-link--small" onClick={() => setEditing(!editing)} data-edit-decision>{editing ? 'Close' : 'Edit'}</button>
        <button type="button" className="v21-link v21-link--small" onClick={() => ctx.set((s) => forgetDecision(s, d.id))} data-forget-decision>Forget</button>
      </div>
      {editing && (
        <form className="v21-edit" onSubmit={(e) => { e.preventDefault(); ctx.set((s) => editDecision(s, d.id, { text })); setEditing(false); }}>
          <label className="v16-field">In our words<input className="v16-input" value={text} maxLength={140} onChange={(e) => setText(e.target.value)} data-decision-text /></label>
          <button type="submit" className="v21-btn v21-btn--dark v21-btn--block mt-3" data-save-decision>Save</button>
        </form>
      )}
    </div>
  );
}

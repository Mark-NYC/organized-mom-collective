/**
 * V21 routine card (docs/ios/V21_PREVIEW.md → Printables): an agreement moved onto paper, so a child can own it
 * without another app or a parent's reminder. Prefilled from the agreement; who, when, what and "I'm done when" are
 * editable; the draft is saved with the agreement (intel.cards), not in a separate printable store.
 *
 * Built from the existing printable system: the tool palettes (src/data/tool-palettes.ts), the responsibility
 * illustrations (src/data/responsibilities.ts, on their fixed category circles), Kalam headings, white paper and warm
 * charcoal text (docs/brand/TOOL-OUTPUT-DESIGN.md). Prints one full US Letter page from the browser's print dialog.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { responsibilities, responsibilityColor, responsibilityImage, type Responsibility } from '../../data/responsibilities';
import { resolveToolPalette, toolPalettes, type ToolPaletteId } from '../../data/tool-palettes';
import type { Part } from '../../lib/v16/model';
import { cardOf, rhythmOf, saveCard, type CardDraft } from '../../lib/v21/model';
import { Sheet, type Ctx } from '../v16/shared';
import { ownerName } from './ui';

const WORDS: [RegExp, string][] = [[/floor|tidy my room|pick up/i, 'clean-my-floor'], [/toy/i, 'put-toys-away'], [/clothes|laundry/i, 'put-clothes-away'], [/bed\b|make my bed/i, 'make-my-bed'],
  [/trash|bins/i, 'take-out-the-trash'], [/counter|kitchen|reset/i, 'wipe-the-counters'], [/table/i, 'clear-the-table'], [/backpack/i, 'pack-my-backpack'], [/teeth/i, 'brush-my-teeth'], [/desk/i, 'tidy-my-desk']];
export const artFor = (title: string) => WORDS.find(([re]) => re.test(title))?.[1] ?? '';

/** A first draft from the agreement: "Andrew’s floor routine", When: the cue, What: the agreement, Done: its finish line. */
export function draftFor(ctx: Pick<Ctx, 'names'>, p: Part): CardDraft {
  const routine = rhythmOf(p) === 'routine';
  const together = p.ownerId === 'together' || !p.ownerId || !ctx.names[p.ownerId];
  const noun = p.title.split(/\s+/).pop()!.toLowerCase().replace(/[^a-z]/g, '');
  return {
    ownerId: p.ownerId,
    heading: together ? 'OUR CLEANING ZONE' : routine ? 'MY DAILY ROUTINE' : 'MY RESPONSIBILITY',
    title: together ? p.title : `${ownerName(ctx, p.ownerId)}’s ${noun} routine`,
    when: p.cue ? p.cue.replace(/^After I\b/, 'After I').replace(/\.$/, '') + '.' : p.weekday !== undefined ? `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.weekday]}.` : '',
    what: p.title.replace(/\.$/, '') + '.',
    done: p.finishLine,
    badge: artFor(p.title),
    palette: 'warm-neutrals',
    zone: together,
  };
}

export default function RoutineCardSheet({ ctx, part, onClose }: { ctx: Ctx; part: Part; onClose: () => void }) {
  const [d, setD] = useState<CardDraft>(() => cardOf(ctx.s, part.id) ?? draftFor(ctx, part));
  const [printing, setPrinting] = useState(false);
  const set = (patch: Partial<CardDraft>) => setD((x) => ({ ...x, ...patch }));
  // Saved with the agreement as she edits (and kept for next time).
  useEffect(() => { ctx.set((s) => saveCard(s, part.id, d)); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!printing) return;
    document.documentElement.classList.add('v21-printing');
    const done = () => { document.documentElement.classList.remove('v21-printing'); setPrinting(false); };
    addEventListener('afterprint', done, { once: true });
    const id = setTimeout(() => { try { print(); } catch { /* blocked */ } }, 60);
    return () => { clearTimeout(id); removeEventListener('afterprint', done); document.documentElement.classList.remove('v21-printing'); };
  }, [printing]);
  const palette = resolveToolPalette(d.palette) as ToolPaletteId;
  const owners = [...ctx.people.map((m) => ({ id: m.id, label: m.firstName })), { id: 'together', label: 'Together' }];
  return (
    <Sheet title="Routine card" onClose={onClose}>
      <div data-routine-card-sheet={part.id}>
        <p className="v21-meta">For the fridge or the bedroom door, so {d.zone ? 'everyone knows the plan' : `${ownerName(ctx, d.ownerId)} knows the plan`} without being reminded.</p>
        <RoutineCardView d={d} />
        <div className="v21-card-form">
          <label className="v16-field">Who<select className="v16-input" value={d.ownerId ?? ''} onChange={(e) => { const id = e.target.value; set({ ownerId: id, zone: id === 'together', heading: id === 'together' ? 'OUR CLEANING ZONE' : d.heading === 'OUR CLEANING ZONE' ? 'MY DAILY ROUTINE' : d.heading }); }} data-card-owner>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="v16-field">Card title<input className="v16-input" value={d.title} maxLength={42} onChange={(e) => set({ title: e.target.value })} data-card-title /></label>
          <label className="v16-field">When<input className="v16-input" value={d.when} maxLength={85} onChange={(e) => set({ when: e.target.value })} data-card-when /></label>
          <label className="v16-field">What<input className="v16-input" value={d.what} maxLength={105} onChange={(e) => set({ what: e.target.value })} data-card-what /></label>
          <label className="v16-field">I’m done when<input className="v16-input" value={d.done} maxLength={140} onChange={(e) => set({ done: e.target.value })} data-card-done /></label>
          <fieldset className="mt-1"><legend className="v16-field">Picture</legend>
            <div className="v21-art-pick" role="group">
              {responsibilities.filter((r) => r.image).map((r) => (
                <button key={r.id} type="button" aria-pressed={d.badge === r.id} title={r.title} onClick={() => set({ badge: r.id })} data-card-art={r.id}><Art r={r} size={44} /></button>
              ))}
              <button type="button" aria-pressed={!d.badge} onClick={() => set({ badge: '' })} data-card-art="none" className="v21-art-none">None</button>
            </div>
          </fieldset>
          <fieldset className="mt-1"><legend className="v16-field">Choose your colors</legend>
            <div className="v21-swatches">{(Object.keys(toolPalettes) as ToolPaletteId[]).map((id) => (
              <button key={id} type="button" aria-pressed={palette === id} onClick={() => set({ palette: id })} data-card-palette={id}>
                <span aria-hidden="true">{toolPalettes[id].colors.map((c) => <i key={c} style={{ background: c }} />)}</span>{toolPalettes[id].label}
              </button>
            ))}</div>
          </fieldset>
        </div>
        <button type="button" className="v21-btn v21-btn--dark v21-btn--block mt-5" onClick={() => setPrinting(true)} data-print-card>Print card</button>
        <button type="button" className="v21-link mt-1" onClick={() => setD(draftFor(ctx, part))} data-card-reset>Start over from our agreement</button>
      </div>
      {printing && createPortal(<div className="v21-print-root" data-print-root><RoutineCardView d={d} print /></div>, document.body)}
    </Sheet>
  );
}

function Art({ r, size }: { r: Responsibility; size: number }) {
  return <span className="v21-art" style={{ background: responsibilityColor(r), width: size, height: size }}><img src={responsibilityImage(r, size > 100 ? 256 : 128)!} alt="" /></span>;
}

export function RoutineCardView({ d, print = false }: { d: CardDraft; print?: boolean }) {
  const p = toolPalettes[resolveToolPalette(d.palette)].colors;
  const r = responsibilities.find((x) => x.id === d.badge && x.image);
  return (
    <article className={`v21-routine-card${print ? ' is-print' : ''}`} style={{ '--c1': p[0], '--c2': p[1], '--c3': p[2] } as CSSProperties} data-routine-card aria-label={d.title}>
      <p className="v21-rc-eyebrow">{d.heading}</p>
      <h3 className="v21-rc-title"><span>{d.title}</span></h3>
      {r && <div className="v21-rc-art"><Art r={r} size={print ? 220 : 112} /></div>}
      <dl className="v21-rc-lines">
        {d.when && <div><dt>When:</dt> <dd>{d.when}</dd></div>}
        {d.what && <div><dt>What:</dt> <dd>{d.what}</dd></div>}
        {d.done && <div><dt>I’m done when:</dt> <dd>{d.done}</dd></div>}
      </dl>
    </article>
  );
}

/** V16 experiment: what every screen receives, and the few small pieces they share (docs/ios/V16_EXPERIMENT.md). */
import * as React from 'react';
import type { MarkerColor } from '../../data/club/family-colors';
import type { FamilyMeeting } from '../../lib/club/family-meeting';
import type { FamilyMember, Household } from '../../lib/club/profile';
import { dayName, partDate, statusLabel, type Part, type V16State } from '../../lib/v16/model';
import { Avatar } from '../app/ui';

export type Route = 'today' | 'plans' | 'cleaning' | 'resources' | 'account' | 'meeting' | 'check-in' | 'plan';
export const TAB_OF: Record<Route, 'today' | 'meeting'> = {
  today: 'today', plans: 'today', cleaning: 'today', resources: 'today', account: 'today', meeting: 'meeting', 'check-in': 'meeting', plan: 'meeting',
};

/** v16: the approved V16 layout on the current design system. v17: the same product with the V17 visual system. */
export type Look = 'v16' | 'v17';

export interface Ctx {
  look: Look;
  s: V16State;
  set: (f: (s: V16State) => V16State) => void;
  today: string;
  monday: string;
  household: Household;
  colors: Record<string, MarkerColor>;
  names: Record<string, string>;
  people: FamilyMember[];
  kids: Set<string>;
  /** The Club month's prepared meeting for this family (null for a free household). */
  club: FamilyMeeting | null;
  go: (r: Route) => void;
}

export function Person({ ctx, id, size = 'sm' }: { ctx: Ctx; id: string | null; size?: 'sm' | 'md' }) {
  if (!id || !ctx.names[id]) return <span aria-hidden="true" className={`of-avatar${size === 'sm' ? ' of-avatar--sm' : ''}`} style={{ background: '#efe9e1', color: '#6e6461' }}>?</span>;
  return <Avatar name={ctx.names[id]} color={ctx.colors[id]} size={size} />;
}

export function StatusPill({ part }: { part: Part }) {
  const label = statusLabel(part);
  const cls = part.status === 'agreed' ? (part.pending ? 'v16-pill v16-pill--pending' : 'v16-pill v16-pill--agreed') : 'v16-pill';
  return <span className={cls} data-part-status={part.changedSinceAgreed ? 'changed' : part.status}>{label}</span>;
}

/** "Sofia · Wednesday", "Mateo · When I come in", "Needs an owner · Thursday". */
export function ownerLine(ctx: Ctx, p: Part): string {
  const who = p.ownerId ? ctx.names[p.ownerId] ?? 'Needs a new owner' : 'Needs an owner';
  const date = partDate(ctx.s, ctx.monday, p);
  const when = date ? dayName(date) : p.cue ?? (p.eventLink ? 'No date this week' : '');
  return when ? `${who} · ${when}` : who;
}

export function Down({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease', flexShrink: 0, color: 'var(--of-soft)' }}><path d="m6 9 6 6 6-6" /></svg>
  );
}

export function Arrow() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export function CheckMark() {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
}

/** One real checkbox (role=checkbox), 44px target. `tone`: the owner's color (V17 fills a done check with it). */
export function Check({ checked, label, onChange, tone }: { checked: boolean; label: string; onChange: () => void; tone?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className="v16-check" onClick={onChange} style={tone ? ({ '--tone': tone } as React.CSSProperties) : undefined}>
      <span>{checked && <CheckMark />}</span>
    </button>
  );
}

/** A cleaning task's check outside the Cleaning screen: the cleaning companion's own box and pen tick (TaskList.tsx). */
export function CleaningBox({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className="group inline-flex size-11 shrink-0 items-center justify-center" onClick={onChange} data-cleaning-box>
      <span aria-hidden="true" className={`relative size-8 rounded-[7px] border-[1.5px] transition-colors ${checked ? 'border-rule-strong/60' : 'border-ink'} group-hover:bg-band`}>
        <svg viewBox="0 0 28 28" className={`absolute -top-[0.7rem] -right-[0.55rem] size-[2.3rem] overflow-visible text-ink transition-opacity ${checked ? 'opacity-100 duration-0' : 'opacity-0 duration-200'}`}
          fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15.5c2 1.6 3.7 3.6 5.3 6.2C13 13.6 18 7.4 25 2.5" pathLength={1} className={`tick-path ${checked ? 'tick-on' : ''}`} />
        </svg>
      </span>
    </button>
  );
}

export const fmtDate = (d: string, o: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });

// ------------------------------------------------------------------ V17: interface icons, sheets

/**
 * V17's icons for things in the app (activities, jobs, shortcuts): one small line set drawn like the app's existing
 * interface icons (src/components/app/ui.tsx: 24px grid, round caps), each on a soft tile from the printed calendar's
 * palette. The soft-color hand-drawn illustrations stay where they belong: the kid-friendly printables for the fridge.
 */
type Glyph = 'ball' | 'bus' | 'lunch' | 'chat' | 'car' | 'hanger' | 'trash' | 'music' | 'backpack' | 'people' | 'calendar' | 'sparkle' | 'book' | 'heart' | 'paw' | 'plate';
const GLYPH: Record<Glyph, React.ReactNode> = {
  ball: <><circle cx="12" cy="12" r="8.5" /><path d="m12 8.3 3 2.2-1.1 3.6h-3.8L9 10.5z" /><path d="M12 3.5v4.8M15 10.5l4.6-1.4M13.9 14.1l2.8 4M10.1 14.1l-2.8 4M9 10.5 4.4 9.1" /></>,
  bus: <><rect x="4.5" y="4" width="15" height="13.5" rx="3" /><path d="M4.5 11h15M8 20v-2.5M16 20v-2.5" /><circle cx="8.3" cy="14.3" r=".6" /><circle cx="15.7" cy="14.3" r=".6" /></>,
  lunch: <><rect x="3.5" y="8.5" width="17" height="11" rx="2.5" /><path d="M9 8.5V6.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6.5v2M3.5 13h17" /></>,
  chat: <><path d="M4 15.5V6.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V12a2 2 0 0 1-2 2H7.5z" /><path d="M17 8.5h1.5a1.5 1.5 0 0 1 1.5 1.5v9l-2.8-2.5H11a1.5 1.5 0 0 1-1.5-1.5V14" /></>,
  car: <><path d="M4.5 16.5V12l1.8-4.6A2 2 0 0 1 8.2 6h7.6a2 2 0 0 1 1.9 1.4l1.8 4.6v4.5" /><path d="M3.5 16.5h17M4.5 12h15" /><circle cx="7.8" cy="18.3" r="1.7" /><circle cx="16.2" cy="18.3" r="1.7" /></>,
  hanger: <><path d="M12 9.5V8.6a2 2 0 1 0-2-2" /><path d="M12 9.5 3.8 15.6a1.3 1.3 0 0 0 .8 2.4h14.8a1.3 1.3 0 0 0 .8-2.4z" /></>,
  trash: <><path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" /><path d="M10 11v5.5M14 11v5.5" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.8" cy="18" r="2.2" /><circle cx="16.8" cy="16" r="2.2" /></>,
  backpack: <><path d="M6 10a6 6 0 0 1 12 0v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19z" /><path d="M9.5 4.6V3.5h5v1.1M9 14h6v3.5H9z" /></>,
  people: <><circle cx="9" cy="8.5" r="3" /><circle cx="17" cy="9.5" r="2.3" /><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5" /><path d="M14.8 14.6c.7-.4 1.4-.6 2.2-.6 2 0 3.5 1.4 4 4" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /><circle cx="12" cy="15" r=".7" /></>,
  sparkle: <><path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.8l-1.6-5.6L5 10.6 10.4 9z" /><path d="M18.5 16.5v3M17 18h3" /></>,
  book: <><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5z" /><path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19M9 8h6" /></>,
  heart: <><path d="M12 19s-7-4.3-7-9.5A3.8 3.8 0 0 1 12 7.3a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19z" /></>,
  paw: <><circle cx="7" cy="10" r="1.6" /><circle cx="10.5" cy="6.8" r="1.6" /><circle cx="14.5" cy="6.8" r="1.6" /><circle cx="18" cy="10" r="1.6" /><path d="M12.5 11.5c2.6 0 5 3.4 5 5.6 0 1.6-1.4 2.4-2.8 2-1.3-.4-1.6-.7-2.2-.7s-.9.3-2.2.7c-1.4.4-2.8-.4-2.8-2 0-2.2 2.4-5.6 5-5.6z" /></>,
  plate: <><circle cx="12" cy="12.5" r="6.5" /><circle cx="12" cy="12.5" r="3.5" /><path d="M3.5 5v6M3.5 8h0M20.5 5v14" /></>,
};
/** Each icon's tile: a tint from the printed calendar's month palette, with a darker ink of the same hue. */
const TILE: Record<Glyph, 'sky' | 'butter' | 'sage' | 'blush' | 'lilac'> = {
  ball: 'sky', bus: 'butter', lunch: 'blush', chat: 'lilac', car: 'sky', hanger: 'sage', trash: 'sage', music: 'lilac', backpack: 'butter',
  people: 'sage', calendar: 'sky', sparkle: 'sage', book: 'blush', heart: 'blush', paw: 'butter', plate: 'blush',
};
const MATCH: [RegExp, Glyph][] = [
  [/soccer|practice|sport|game/i, 'ball'], [/field trip/i, 'bus'], [/lunch/i, 'lunch'], [/conference|teacher/i, 'chat'],
  [/pick ?up|drive|ride/i, 'car'], [/shoes|coat|entry/i, 'hanger'], [/trash|recycl/i, 'trash'], [/piano|music|guitar|violin/i, 'music'],
  [/school/i, 'backpack'], [/family meeting/i, 'people'], [/dog|pet/i, 'paw'], [/table|dinner/i, 'plate'],
];
export const artFor = (text: string): Glyph => MATCH.find(([re]) => re.test(text))?.[1] ?? 'calendar';

export function Art({ name, size = 'md' }: { name: Glyph; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;
  return (
    <span aria-hidden="true" className={`v17-art v17-art--${size} v17-tone--${TILE[name]}`} data-glyph={name}>
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{GLYPH[name]}</svg>
    </span>
  );
}

/** A native-feeling bottom sheet (dialog): grabber, title, Done. Esc, the backdrop and Done close it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,button:not([data-sheet-close])')?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', key);
    document.documentElement.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', key); document.documentElement.style.overflow = ''; prev?.focus?.({ preventScroll: true }); };
  }, [onClose]);
  return (
    <div className="v17-sheet-wrap" data-sheet>
      <button type="button" className="v17-sheet-backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div ref={ref} className="v17-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="v17-grabber" aria-hidden="true" />
        <div className="v17-sheet-head"><h2>{title}</h2><button type="button" className="v17-sheet-done" onClick={onClose} data-sheet-close>Done</button></div>
        <div className="v17-sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Inline in V16 (as approved), a bottom sheet in V17. */
export function Panel({ ctx, title, onClose, children }: { ctx: Ctx; title: string; onClose: () => void; children: React.ReactNode }) {
  return ctx.look === 'v17' ? <Sheet title={title} onClose={onClose}>{children}</Sheet> : <>{children}</>;
}

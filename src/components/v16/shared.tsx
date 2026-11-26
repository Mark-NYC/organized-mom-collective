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

// ------------------------------------------------------------------ V17: one bold icon family, sheets

/**
 * V17's icon family: filled silhouettes and heavy rounded strokes on a 24px grid (SF Symbols in spirit), in near-black
 * by default. One family everywhere: tabs, header, rows, shortcuts. No pastel tiles around them. The soft-color
 * hand-drawn illustrations belong to editorial content, monthly kits, printables and celebrations, not the interface.
 */
export type Glyph = 'house' | 'people' | 'person' | 'ball' | 'bus' | 'lunch' | 'chat' | 'car' | 'hanger' | 'trash' | 'music' | 'backpack'
  | 'calendar' | 'sparkle' | 'book' | 'heart' | 'paw' | 'plate' | 'check' | 'sync';
const F = { fill: 'currentColor', stroke: 'none' } as const;
// Thunks: built when drawn, never at module load (module-level JSX can run before the JSX runtime binding is ready).
const GLYPH: Record<Glyph, () => React.ReactNode> = {
  house: () => <path {...F} d="M3.2 10.4 11 4.1a1.6 1.6 0 0 1 2 0l7.8 6.3c.3.3.5.6.5 1V19a2 2 0 0 1-2 2h-3.8v-5.2a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V21H4.7a2 2 0 0 1-2-2v-7.6c0-.4.2-.7.5-1z" />,
  people: () => <><circle {...F} cx="8.8" cy="7.8" r="3.4" /><circle {...F} cx="17" cy="8.8" r="2.7" /><path {...F} d="M2.4 19.3c.5-3.8 3.1-6.1 6.4-6.1s5.9 2.3 6.4 6.1a1.3 1.3 0 0 1-1.3 1.5H3.7a1.3 1.3 0 0 1-1.3-1.5z" /><path {...F} d="M16.6 20.8h3.9a1.2 1.2 0 0 0 1.2-1.4c-.4-3-2.2-4.9-4.6-4.9-.9 0-1.7.2-2.4.7 1.1 1.2 1.8 2.8 2 4.6.1.4 0 .7-.1 1z" /></>,
  person: () => <><circle {...F} cx="12" cy="7.6" r="4.1" /><path {...F} d="M4 19.6c.8-4 4-6.4 8-6.4s7.2 2.4 8 6.4a1.3 1.3 0 0 1-1.3 1.6H5.3A1.3 1.3 0 0 1 4 19.6z" /></>,
  ball: () => <><clipPath id="of-ball"><circle cx="12" cy="12" r="9.3" /></clipPath><circle cx="12" cy="12" r="9.3" strokeWidth="2" /><polygon {...F} points="12.00,8.30 15.52,10.86 14.17,14.99 9.83,14.99 8.48,10.86" /><g clipPath="url(#of-ball)"><polygon {...F} points="12.00,5.70 8.86,3.42 10.06,-0.27 13.94,-0.27 15.14,3.42" /><polygon {...F} points="17.99,10.05 19.19,6.36 23.07,6.36 24.27,10.05 21.13,12.33" /><polygon {...F} points="15.70,17.10 19.58,17.10 20.78,20.79 17.64,23.07 14.50,20.79" /><polygon {...F} points="8.30,17.10 9.50,20.79 6.36,23.07 3.22,20.79 4.42,17.10" /><polygon {...F} points="6.01,10.05 2.87,12.33 -0.27,10.05 0.93,6.36 4.81,6.36" /></g><path d="M12.00 8.30L12.00 5.40 M15.52 10.86L18.28 9.96 M14.17 14.99L15.88 17.34 M9.83 14.99L8.12 17.34 M8.48 10.86L5.72 9.96" strokeWidth="1.6" /></>,
  bus: () => <><path {...F} fillRule="evenodd" d="M7 2.8h10A3 3 0 0 1 20 5.8V17a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 17V5.8a3 3 0 0 1 3-3zM6.4 6.3v4.6h11.2V6.3zM7.6 13.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm8.8 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" /><rect {...F} x="6" y="17.5" width="3" height="3.6" rx="1.2" /><rect {...F} x="15" y="17.5" width="3" height="3.6" rx="1.2" /></>,
  lunch: () => <><path {...F} d="M12 7.4c1.2-.9 2.6-1.3 4-1.1 3 .4 4.6 3.4 4.2 6.8-.5 4.1-3.4 8.3-6 8.3-.9 0-1.4-.4-2.2-.4s-1.3.4-2.2.4c-2.6 0-5.5-4.2-6-8.3-.4-3.4 1.2-6.4 4.2-6.8 1.4-.2 2.8.2 4 1.1z" /><path d="M12 7.2c0-2 .9-3.6 2.6-4.4" strokeWidth="2.1" /><path {...F} d="M12.4 5.6c.3-1.8 1.9-3 3.9-2.9-.2 1.9-1.8 3.1-3.9 2.9z" /></>,
  chat: () => <><path {...F} d="M5.2 3.6h9.6A2.8 2.8 0 0 1 17.6 6.4v6a2.8 2.8 0 0 1-2.8 2.8H9.4l-3.9 3.2c-.5.4-1.2 0-1.2-.6v-2.6a2.8 2.8 0 0 1-1.9-2.8v-6a2.8 2.8 0 0 1 2.8-2.8z" /><path d="M20 8.6a2 2 0 0 1 1.2 1.8v5.4a2.3 2.3 0 0 1-1.5 2.2v2.2l-3.3-2.6h-3.6" strokeWidth="2.1" /></>,
  car: () => <path {...F} fillRule="evenodd" d="M7.7 5.2h8.6a2.6 2.6 0 0 1 2.4 1.7l1.5 4c.6.4 1 1 1 1.8v4.6a1.3 1.3 0 0 1-1.3 1.3h-.8v1.2a1.6 1.6 0 0 1-3.2 0v-1.2H8.1v1.2a1.6 1.6 0 0 1-3.2 0v-1.2h-.8a1.3 1.3 0 0 1-1.3-1.3v-4.6c0-.8.4-1.4 1-1.8l1.5-4a2.6 2.6 0 0 1 2.4-1.7zM6.6 10.4h10.8l-1-2.7a.8.8 0 0 0-.7-.5H8.3a.8.8 0 0 0-.7.5zM6.8 13.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm10.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" />,
  hanger: () => <><path d="M12 9.6V8.4a2.1 2.1 0 1 0-2.1-2.1" strokeWidth="2.3" /><path {...F} d="M12 8.6c.3 0 .6.1.8.3l7.8 6c1.2.9.6 2.8-.9 2.8H4.3c-1.5 0-2.1-1.9-.9-2.8l7.8-6c.2-.2.5-.3.8-.3z" /></>,
  trash: () => <><path {...F} d="M5.5 8h13l-1 11.4a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8z" /><path d="M3.8 5.8h16.4M9.4 5.6V4.2a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v1.4" strokeWidth="2.2" /></>,
  music: () => <><path d="M9.2 17.6V6.3l10-2.3v11.3" strokeWidth="2.3" /><circle {...F} cx="6.6" cy="17.6" r="2.9" /><circle {...F} cx="16.6" cy="15.4" r="2.9" /></>,
  backpack: () => <><path {...F} fillRule="evenodd" d="M5.6 10.4A6.4 6.4 0 0 1 12 4a6.4 6.4 0 0 1 6.4 6.4v9.1a1.9 1.9 0 0 1-1.9 1.9h-9a1.9 1.9 0 0 1-1.9-1.9zM9 13.6a1 1 0 0 0-1 1v3.3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3.3a1 1 0 0 0-1-1z" /><path d="M9.4 4.4V3.3a.9.9 0 0 1 .9-.9h3.4a.9.9 0 0 1 .9.9v1.1M9.2 10.6h5.6" strokeWidth="2" /><path d="M9.2 10.6h5.6" stroke="#fff" strokeWidth="1.8" /></>,
  calendar: () => <><rect x="3.6" y="5" width="16.8" height="15.6" rx="3" strokeWidth="2.2" /><path {...F} d="M3.6 8A3 3 0 0 1 6.6 5h10.8a3 3 0 0 1 3 3v2.2H3.6z" /><path d="M8 2.8v3.4M16 2.8v3.4" strokeWidth="2.3" /><rect {...F} x="7" y="13.2" width="3.2" height="3.2" rx=".9" /></>,
  sparkle: () => <><path {...F} d="M10.5 3.4c.2-.6 1-.6 1.2 0l1.4 4.3a2 2 0 0 0 1.3 1.3l4.3 1.4c.6.2.6 1 0 1.2l-4.3 1.4a2 2 0 0 0-1.3 1.3l-1.4 4.3c-.2.6-1 .6-1.2 0l-1.4-4.3a2 2 0 0 0-1.3-1.3l-4.3-1.4c-.6-.2-.6-1 0-1.2l4.3-1.4a2 2 0 0 0 1.3-1.3z" /><path {...F} d="M18.3 15.6c.1-.4.7-.4.8 0l.4 1.2c.1.3.3.5.6.6l1.2.4c.4.1.4.7 0 .8l-1.2.4a1 1 0 0 0-.6.6l-.4 1.2c-.1.4-.7.4-.8 0l-.4-1.2a1 1 0 0 0-.6-.6l-1.2-.4c-.4-.1-.4-.7 0-.8l1.2-.4a1 1 0 0 0 .6-.6z" /></>,
  book: () => <><path {...F} d="M4.8 5a2.4 2.4 0 0 1 2.4-2.4h11a1 1 0 0 1 1 1v13.6H7.2a2.4 2.4 0 0 0-2.4 2.3z" /><path d="M4.8 19.4a2 2 0 0 0 2 2h12.4" strokeWidth="2.2" /></>,
  heart: () => <path {...F} d="M12 20.6c-.3 0-.6-.1-.8-.3C8 17.9 3 14.2 3 9.4A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 9 2.2c0 4.8-5 8.5-8.2 10.9-.2.2-.5.3-.8.3z" />,
  paw: () => <><ellipse {...F} cx="6.4" cy="10.4" rx="1.9" ry="2.3" /><ellipse {...F} cx="10.2" cy="6.6" rx="1.9" ry="2.4" /><ellipse {...F} cx="14.6" cy="6.6" rx="1.9" ry="2.4" /><ellipse {...F} cx="18.2" cy="10.4" rx="1.9" ry="2.3" /><path {...F} d="M12.4 11.4c2.7 0 5.3 3.6 5.3 6 0 1.7-1.5 2.6-3 2.1-1.2-.4-1.6-.7-2.3-.7s-1.1.3-2.3.7c-1.5.5-3-.4-3-2.1 0-2.4 2.6-6 5.3-6z" /></>,
  plate: () => <><circle cx="12.5" cy="12.5" r="6.6" strokeWidth="2.2" /><circle {...F} cx="12.5" cy="12.5" r="3.2" /><path d="M3.4 4.4v5.4a1.4 1.4 0 0 0 1.4 1.4M3.4 11.2v8.6M21 4.4v15.4" strokeWidth="2.1" /></>,
  sync: () => <><path d="M19.6 10.6A7.8 7.8 0 0 0 5.4 7.5" strokeWidth="2.4" /><path {...F} d="M3.6 4.2v5.2h5.2z" /><path d="M4.4 13.4a7.8 7.8 0 0 0 14.2 3.1" strokeWidth="2.4" /><path {...F} d="M20.4 19.8v-5.2h-5.2z" /></>,
  check: () => <><circle {...F} cx="12" cy="12" r="9.4" /><path d="m7.8 12.3 2.8 2.8 5.6-5.8" stroke="#fff" strokeWidth="2.4" /></>,
};
const MATCH: [RegExp, Glyph][] = [
  [/soccer|practice|sport|game/i, 'ball'], [/field trip/i, 'bus'], [/lunch/i, 'lunch'], [/conference|teacher/i, 'chat'],
  [/pick ?up|drive|ride/i, 'car'], [/shoes|coat|entry/i, 'hanger'], [/trash|recycl/i, 'trash'], [/piano|music|guitar|violin/i, 'music'],
  [/school/i, 'backpack'], [/family meeting/i, 'people'], [/dog|pet/i, 'paw'], [/table|dinner/i, 'plate'],
];
export const artFor = (text: string): Glyph => MATCH.find(([re]) => re.test(text))?.[1] ?? 'calendar';

/** A bold icon. Bare by default (near-black, no container). `tile`: a solid calendar-color square with a white glyph. */
export function Art({ name, size = 'md', tile }: { name: Glyph; size?: 'sm' | 'md' | 'lg'; tile?: 'blue' | 'sage' | 'rose' | 'butter' | 'plum' }) {
  const px = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;
  const svg = <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">{GLYPH[name]()}</svg>;
  return tile
    ? <span aria-hidden="true" className={`v17-tile v17-tile--${tile}`} data-glyph={name}>{svg}</span>
    : <span aria-hidden="true" className={`v17-icon v17-icon--${size}`} data-glyph={name}>{svg}</span>;
}

/**
 * V17 "meaningful moments" only (invitations, Club, encouragement, empty states, celebrations): the brand's own
 * hand-drawn soft-color illustrations (public/assets/icons/ofc/v2/routines, the printables' library). Everyday controls
 * keep the black icon family (Art).
 */
export function Illo({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' | 'xl' }) {
  return <span aria-hidden="true" className={`v17-illo v17-illo--${size}`}><img src={`/assets/icons/ofc/v2/routines/${name}.webp`} alt="" decoding="async" /></span>;
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

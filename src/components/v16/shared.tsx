/** V16 experiment: what every screen receives, and the few small pieces they share (docs/ios/V16_EXPERIMENT.md). */
import type { MarkerColor } from '../../data/club/family-colors';
import type { FamilyMeeting } from '../../lib/club/family-meeting';
import type { FamilyMember, Household } from '../../lib/club/profile';
import { dayName, partDate, statusLabel, type Part, type V16State } from '../../lib/v16/model';
import { Avatar } from '../app/ui';

export type Route = 'today' | 'plans' | 'cleaning' | 'resources' | 'account' | 'meeting' | 'check-in' | 'plan';
export const TAB_OF: Record<Route, 'today' | 'meeting'> = {
  today: 'today', plans: 'today', cleaning: 'today', resources: 'today', account: 'today', meeting: 'meeting', 'check-in': 'meeting', plan: 'meeting',
};

export interface Ctx {
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

/** One real checkbox (role=checkbox), 44px target. */
export function Check({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className="v16-check" onClick={onChange}>
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

/**
 * The Organized Mom visual signatures. Used everywhere so the system is
 * recognizable on its own:
 *
 *   DayMark   – a calendar cell in the day's color: label top-left, zone icon
 *               (or a month numeral) bottom-right
 *   TimeMark  – the boxed "15 MIN" stamp
 *   CalendarEdge – the four-color band from the printed calendar
 *   Wordmark  – the OMC badge (public/brand/) + spaced-caps name
 *
 * These render to plain HTML, so .astro pages can use them without hydration.
 */
import type { Accent } from '../data/cleaning';
import { accentClasses } from './accent';

const pad = (n: number) => String(n).padStart(2, '0');

interface DayMarkProps {
  label: string;
  /** Zone icon (cleaning days). Months show a numeral instead. */
  icon?: string;
  number?: number;
  /** Weekday color. Omit both accent and color for an outlined cell. */
  accent?: Accent;
  /** Month color hex from src/theme.ts */
  color?: string;
  size?: 'sm' | 'md';
}

export function DayMark({ label, icon, number, accent, color, size = 'md' }: DayMarkProps) {
  const md = size === 'md';
  const dims = icon
    ? md ? 'size-[4.5rem] p-1.5' : 'size-[3.25rem] p-1'
    : md ? 'h-[4.25rem] w-[3.75rem] p-1.5' : 'h-12 w-12 p-1';
  const tracking = label.length > 3 ? 'tracking-[0.04em]' : 'tracking-[0.14em]';
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 flex-col justify-between ${dims} ${
        accent ? accentClasses[accent].fill : color ? '' : 'border-[1.5px] border-ink'
      }`}
      style={color ? { backgroundColor: color } : undefined}
    >
      <span className={`text-[0.56rem] leading-none font-semibold ${tracking} whitespace-nowrap uppercase`}>{label}</span>
      {icon ? (
        <img
          src={icon}
          alt=""
          width={192}
          height={192}
          className={`absolute ${md ? 'right-0.5 bottom-0.5 size-[3.3rem]' : 'right-0 bottom-0 size-[2.45rem]'}`}
        />
      ) : (
        number !== undefined && (
          <span className={`self-end ${md ? 'text-[1.9rem]' : 'text-[1.4rem]'} leading-[0.75] font-medium tracking-[-0.03em] tabular-nums`}>
            {pad(number)}
          </span>
        )
      )}
    </span>
  );
}

/** "15 minutes" → "15 MIN", "10–15 minutes" → "10–15 MIN" */
export function shortTime(minutes: string): string {
  return minutes.replace(/\s*minutes?/i, ' min').trim();
}

export function TimeMark({ children }: { children: string }) {
  return (
    <span className="inline-flex shrink-0 items-center border border-ink px-1.5 py-[3px] text-[0.64rem] leading-none font-semibold tracking-[0.16em] whitespace-nowrap uppercase tabular-nums">
      {children}
    </span>
  );
}

export function CalendarEdge({ className = 'h-1' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`grid grid-cols-4 ${className}`}>
      <span className="bg-blue" />
      <span className="bg-blush" />
      <span className="bg-green" />
      <span className="bg-apricot" />
    </div>
  );
}

/** The Organized Mom Collective badge with the spaced-caps wordmark beside it. */
export function Wordmark({ badge = 'size-10' }: { badge?: string | false }) {
  return (
    <span className="flex items-center gap-3">
      {badge && <img src="/brand/omc-badge-160.png" alt="" width={160} height={160} className={`${badge} shrink-0`} />}
      <span className="text-[0.78rem] font-semibold tracking-[0.28em] whitespace-nowrap uppercase">Organized Mom</span>
    </span>
  );
}

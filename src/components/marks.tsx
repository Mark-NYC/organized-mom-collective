import type React from 'react';

/**
 * Organized Mom visual signatures, taken from the printed calendar:
 *
 *   ZoneTag   – the cleaning tag (icon + spaced-caps zone label) in the month color
 *   MonthBand – the month header band: month name and year in Georgia Pro Black Italic
 *   TimeMark  – the boxed "15 MIN" stamp
 *   Wordmark  – the OMC badge + spaced-caps name
 *
 * These render to plain HTML, so .astro pages can use them without hydration.
 * Colors: the current month's color is the CSS token `month` (bg-month etc.);
 * pass `color` to show a specific month instead.
 */

/** "15 minutes" → "15 min" (rendered uppercase) */
export function shortTime(minutes: string): string {
  return minutes.replace(/\s*minutes?/i, ' min').trim();
}

export function TimeMark({ children }: { children: string }) {
  return (
    <span className="inline-flex shrink-0 items-center border border-ink px-1.5 py-[3px] text-[0.62rem] leading-none font-semibold tracking-[0.16em] whitespace-nowrap uppercase tabular-nums">
      {children}
    </span>
  );
}

interface ZoneTagProps {
  icon: string;
  label: string;
  size?: 'sm' | 'md';
  /** Fill with the current month's color (default) or leave outlined. */
  filled?: boolean;
}

export function ZoneTag({ icon, label, size = 'md', filled = true }: ZoneTagProps) {
  const md = size === 'md';
  return (
    <span
      className={`zone-tag inline-flex max-w-full items-center rounded-full ${
        filled ? 'bg-month' : 'border border-rule'
      } ${md ? 'gap-2 py-1 pr-5 pl-2' : 'gap-1.5 py-0.5 pr-3.5 pl-1.5'}`}
    >
      <img src={icon} alt="" width={192} height={192} className={`shrink-0 ${md ? 'size-9' : 'size-7'}`} />
      <span className={`font-semibold whitespace-nowrap uppercase ${md ? 'text-[0.78rem] tracking-[0.2em]' : 'text-[0.66rem] tracking-[0.18em]'}`}>
        {label}
      </span>
    </span>
  );
}

interface MonthBandProps {
  month: string;
  year?: number;
  /** Specific month color; defaults to the current month token */
  color?: string;
  size?: 'sm' | 'md';
  className?: string;
  children?: React.ReactNode;
}

/** The printed calendar's month header. */
export function MonthBand({ month, year, color, size = 'md', className = '', children }: MonthBandProps) {
  const md = size === 'md';
  return (
    <div
      className={`flex items-end justify-between ${color ? '' : 'bg-month'} ${className}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      <span className={`month-title leading-none ${md ? 'text-[2.6rem] sm:text-[3.4rem]' : 'text-[2rem]'}`}>{month}</span>
      {year !== undefined && (
        <span className={`month-title leading-none ${md ? 'text-[1.9rem] sm:text-[2.4rem]' : 'text-[1.5rem]'}`}>{year}</span>
      )}
      {children}
    </div>
  );
}

/** The Organized Mom Collective badge with the spaced-caps wordmark beside it. */
export function Wordmark({ badge = 'size-10' }: { badge?: string | false }) {
  return (
    <span className="flex items-center gap-3">
      {badge && <img src="/brand/omc-badge-160.png" alt="" width={160} height={160} className={`${badge} shrink-0`} />}
      <span className="text-[0.74rem] font-semibold tracking-[0.26em] whitespace-nowrap uppercase">Organized Mom</span>
    </span>
  );
}

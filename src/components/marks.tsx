import type React from 'react';

/**
 * Organized Mom visual signatures, taken from the printed calendar:
 *
 *   ZoneTag      – the cleaning tag: zone icon + spaced-caps label, outlined
 *   MonthHeading – month name (and year) in Georgia Pro Black Italic under a thin month-color rule
 *   TimeMark     – the boxed "15 MIN" stamp
 *   Wordmark     – the OMC badge + spaced-caps name
 *
 * These render to plain HTML, so .astro pages can use them without hydration.
 * The current month's color is the CSS token `month` (border-month etc.) and is
 * only ever used as an accent; pass `color` to show a specific month instead.
 */

/** "15 minutes" → "15 min" (rendered uppercase) */
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

interface ZoneTagProps {
  icon: string;
  label: string;
  size?: 'sm' | 'md';
}

/** The printed calendar's cleaning tag: light outline, charcoal icon and label, a soft month tint behind the icon. */
export function ZoneTag({ icon, label, size = 'md' }: ZoneTagProps) {
  const md = size === 'md';
  return (
    <span
      className={`zone-tag inline-flex max-w-full items-center rounded-full border border-rule bg-paper ${
        md ? 'gap-2 py-[3px] pr-4 pl-[3px]' : 'gap-1.5 py-[2px] pr-3 pl-[2px]'
      }`}
    >
      <span className={`grid shrink-0 place-items-center rounded-full bg-month/35 ${md ? 'size-8' : 'size-7'}`}>
        <img src={icon} alt="" width={192} height={192} className={md ? 'size-7' : 'size-6'} />
      </span>
      <span
        className={`font-semibold whitespace-nowrap uppercase ${md ? 'text-[0.74rem] tracking-[0.18em]' : 'text-[0.66rem] tracking-[0.16em]'}`}
      >
        {label}
      </span>
    </span>
  );
}

interface MonthHeadingProps {
  month: string;
  year?: number;
  /** Specific month color for the rule; defaults to the current month token */
  color?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Month name in the calendar's display face, under a thin month-color rule. */
export function MonthHeading({ month, year, color, className = '', children }: MonthHeadingProps) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-t-[3px] pt-2.5 ${color ? '' : 'border-month'} ${className}`}
      style={color ? { borderTopColor: color } : undefined}
    >
      <span className="month-title text-[1.6rem] leading-none">
        {month}
        {year !== undefined && ` ${year}`}
      </span>
      {children}
    </div>
  );
}

/** The Organized Mom Collective badge with the spaced-caps wordmark beside it. */
export function Wordmark({ badge = 'size-9' }: { badge?: string | false }) {
  return (
    <span className="flex items-center gap-2.5">
      {badge && <img src="/brand/omc-badge-160.png" alt="" width={160} height={160} className={`${badge} shrink-0`} />}
      <span className="text-[0.7rem] font-semibold tracking-[0.24em] whitespace-nowrap uppercase">Organized Mom</span>
    </span>
  );
}

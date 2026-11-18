/**
 * Organized Family's shared UI pieces (docs/ios/APP_DESIGN_SYSTEM.md; styles in src/styles/family-app-brand.css).
 * Used by every primary screen on the website's /app and in the iPhone app, so the two can't drift apart. They render
 * plain HTML, so .astro pages can use them without hydration.
 */
import type { ReactNode } from 'react';
import type { MarkerColor } from '../../data/club/family-colors';

type Tone = 'plain' | 'sage' | 'month' | 'quiet';
const toneClass = (tone: Tone) => (tone === 'plain' ? '' : ` of-tile--${tone}`);

/** A card. `href` makes the whole tile a link (one tap target); otherwise a section. */
export function Tile({ tone = 'plain', href, className = '', children, label, ...data }: {
  tone?: Tone; href?: string; className?: string; children: ReactNode; label?: string; [data: `data-${string}`]: string | boolean | undefined;
}) {
  const cls = `of-tile${toneClass(tone)} ${className}`.trim();
  if (href) return <a href={href} className={cls} aria-label={label} {...data}>{children}</a>;
  return <section className={cls} aria-label={label} {...data}>{children}</section>;
}

/** Eyebrow, serif title, optional subtitle, and an action or a chevron on the right. */
export function TileHead({ eyebrow, title, sub, action, chevron = false, large = false, id }: {
  eyebrow?: ReactNode; title?: ReactNode; sub?: ReactNode; action?: ReactNode; chevron?: boolean; large?: boolean; id?: string;
}) {
  return (
    <div className="of-tile-head">
      <div className="min-w-0">
        {eyebrow && <p className="of-eyebrow" id={id && !title ? id : undefined}>{eyebrow}</p>}
        {title && <h2 className={`of-tile-title${large ? ' of-tile-title--lg' : ''}`} id={id}>{title}</h2>}
        {sub && <p className="of-tile-sub">{sub}</p>}
      </div>
      {action}
      {chevron && <Chevron />}
    </div>
  );
}

export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`of-chevron ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
  );
}

/** A soft wash of a family member's own color (never the month's) behind their initial, in their color. */
export const tint = (hex: string, amount = 0.18) => {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const mix = (c: number, base: number) => Math.round(c * amount + base * (1 - amount));
  return `rgb(${mix(n(1), 251)}, ${mix(n(3), 247)}, ${mix(n(5), 241)})`;
};

export function Avatar({ name, color, size = 'md' }: { name: string; color?: MarkerColor; size?: 'md' | 'sm' }) {
  const hex = color?.hex ?? '#8fa686';
  return (
    <span aria-hidden="true" className={`of-avatar${size === 'sm' ? ' of-avatar--sm' : ''}`} style={{ background: tint(hex), color: hex }}>
      {name.trim().charAt(0).toUpperCase() || '·'}
    </span>
  );
}

/** Segments: one per task (up to 12), else a continuous bar. Accessible as a progressbar either way. */
export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const segments = total > 0 && total <= 12 ? total : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="of-progress">
      {segments
        ? Array.from({ length: segments }, (_, i) => <span key={i} data-on={i < done ? '' : undefined} />)
        : <span style={{ background: `linear-gradient(90deg, var(--of-sage-bar) ${total ? (done / total) * 100 : 0}%, rgba(255,255,255,.75) 0)` }} />}
    </div>
  );
}

/** Line icons for navigation and settings rows (not the cleaning zone artwork, which stays in public/icons/zones/). */
export function Icon({ name, size = 20 }: { name: 'home' | 'calendar' | 'check' | 'family' | 'person' | 'mail' | 'help' | 'sparkle' | 'people-plus' | 'list' | 'meeting'; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
    calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
    check: <><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="m8.5 12.2 2.4 2.4 4.8-5" /></>,
    family: <><circle cx="9" cy="8.5" r="3" /><circle cx="17" cy="9.5" r="2.3" /><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5" /><path d="M14.8 14.6c.7-.4 1.4-.6 2.2-.6 2 0 3.5 1.4 4 4" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
    mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" /><path d="M12 16.8v.2" /></>,
    sparkle: <><path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.8l-1.6-5.6L5 10.6 10.4 9z" /></>,
    'people-plus': <><circle cx="9.5" cy="8.5" r="3.2" /><path d="M3.5 19.5c.9-3.4 3.2-5.3 6-5.3s5.1 1.9 6 5.3" /><path d="M18.5 8v6M15.5 11h6" /></>,
    list: <><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" /></>,
    meeting: <><path d="M5 18.5V7.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9z" /><path d="M9 10h6M9 13h4" /></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
  );
}

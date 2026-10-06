import { useState } from 'react';
import { monthlyDeepClean } from '../data/cleaning';
import { monthColor } from '../theme';
import { DayMark } from './marks';

export default function MonthBrowser() {
  const current = new Date().getMonth();
  const [index, setIndex] = useState(current);
  const month = monthlyDeepClean[index];
  const count = monthlyDeepClean.length;
  const prev = monthlyDeepClean[(index - 1 + count) % count];
  const next = monthlyDeepClean[(index + 1) % count];
  const color = monthColor(month.month);

  return (
    <div className="border-t-[3px] pt-4" style={{ borderTopColor: color }}>
      <div className="flex items-start gap-4" aria-live="polite">
        <DayMark label={month.name.slice(0, 3)} number={month.month + 1} color={color} />
        <div className="min-w-0 flex-1">
          <p className="label">
            {month.name}
            {index === current && <span className="text-muted"> · This month</span>}
          </p>
          <h3 className="mt-2 font-serif text-[1.85rem] leading-[1.05] font-semibold">{month.title}</h3>
        </div>
      </div>
      <p className="mt-3 font-serif text-[1.08rem] leading-snug text-muted italic">{month.description}</p>
      <ol className="mt-4 border-t border-rule">
        {month.tasks.map((t, i) => (
          <li key={t.id} className="flex min-h-12 items-center gap-4 border-b border-rule py-3 leading-snug">
            <span className="w-5 shrink-0 text-[0.7rem] font-semibold tracking-[0.1em] text-faint tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            {t.label}
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIndex((index - 1 + count) % count)}
          aria-label={`Previous month: ${prev.name}`}
          className="min-h-11 text-[0.7rem] font-semibold tracking-[0.18em] text-muted uppercase hover:text-ink"
        >
          ← {prev.name.slice(0, 3)}
        </button>
        {index !== current && (
          <button
            type="button"
            onClick={() => setIndex(current)}
            className="min-h-11 text-[0.7rem] font-semibold tracking-[0.18em] text-ink uppercase underline decoration-rule underline-offset-[6px]"
          >
            This month
          </button>
        )}
        <button
          type="button"
          onClick={() => setIndex((index + 1) % count)}
          aria-label={`Next month: ${next.name}`}
          className="min-h-11 text-[0.7rem] font-semibold tracking-[0.18em] text-muted uppercase hover:text-ink"
        >
          {next.name.slice(0, 3)} →
        </button>
      </div>
    </div>
  );
}

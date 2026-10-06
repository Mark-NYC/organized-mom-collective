import { useState } from 'react';
import { monthlyDeepClean } from '../data/cleaning';
import { monthColor } from '../theme';
import { MonthHeading } from './marks';

export default function MonthBrowser() {
  const current = new Date().getMonth();
  const [index, setIndex] = useState(current);
  const month = monthlyDeepClean[index];
  const count = monthlyDeepClean.length;
  const prev = monthlyDeepClean[(index - 1 + count) % count];
  const next = monthlyDeepClean[(index + 1) % count];

  return (
    <div aria-live="polite">
      <MonthHeading month={month.name} color={monthColor(month.month)}>
        {index === current && <span className="label text-muted">This month</span>}
      </MonthHeading>
      <h3 className="project-title mt-3">{month.title}</h3>
      <p className="mt-1 text-[1rem] leading-snug text-muted">{month.description}</p>
      <ol className="mt-3 border-t border-rule-strong">
        {month.tasks.map((t, i) => (
          <li key={t.id} className="flex min-h-12 items-center gap-4 border-b border-rule py-2.5 text-[1.0625rem] leading-snug sm:text-[1rem]">
            <span className="w-5 shrink-0 text-[0.68rem] font-semibold tracking-[0.1em] text-muted tabular-nums">
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
          className="min-h-11 text-[0.68rem] font-semibold tracking-[0.18em] text-muted uppercase hover:text-ink"
        >
          ← {prev.name.slice(0, 3)}
        </button>
        {index !== current && (
          <button type="button" onClick={() => setIndex(current)} className="text-link min-h-11">
            This month
          </button>
        )}
        <button
          type="button"
          onClick={() => setIndex((index + 1) % count)}
          aria-label={`Next month: ${next.name}`}
          className="min-h-11 text-[0.68rem] font-semibold tracking-[0.18em] text-muted uppercase hover:text-ink"
        >
          {next.name.slice(0, 3)} →
        </button>
      </div>
    </div>
  );
}

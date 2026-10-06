import { useState } from 'react';
import { monthlyDeepClean } from '../data/cleaning';
import { accentClasses } from './accent';

export default function MonthBrowser() {
  const current = new Date().getMonth();
  const [index, setIndex] = useState(current);
  const month = monthlyDeepClean[index];
  const a = accentClasses[month.accent];
  const count = monthlyDeepClean.length;
  const prev = monthlyDeepClean[(index - 1 + count) % count];
  const next = monthlyDeepClean[(index + 1) % count];

  return (
    <div className="card overflow-hidden">
      <div className={`${a.tint} flex items-center justify-between gap-2 border-b ${a.border} px-2 py-2`}>
        <button
          type="button"
          onClick={() => setIndex((index - 1 + count) % count)}
          aria-label={`Previous month: ${prev.name}`}
          className="grid size-11 place-items-center rounded-full text-muted hover:text-ink"
        >
          <Chevron dir="left" />
        </button>
        <p className="text-center" aria-live="polite">
          <span className="eyebrow">{month.name}</span>
          {index === current && (
            <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-[0.68rem] font-medium tracking-wide text-ink uppercase">
              This month
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setIndex((index + 1) % count)}
          aria-label={`Next month: ${next.name}`}
          className="grid size-11 place-items-center rounded-full text-muted hover:text-ink"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="px-5 pt-5 pb-6 sm:px-7">
        <h3 className="font-serif text-[1.7rem] leading-tight font-semibold">{month.title}</h3>
        <p className="mt-1 text-[0.95rem] text-muted">{month.description}</p>
        <ul className="mt-4 space-y-2.5">
          {month.tasks.map((t) => (
            <li key={t.id} className="flex gap-3 text-[0.98rem] leading-snug">
              <span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 rounded-full ${a.dot} ring-1 ring-black/10`} />
              {t.label}
            </li>
          ))}
        </ul>
        {index !== current && (
          <button
            type="button"
            onClick={() => setIndex(current)}
            className="mt-5 min-h-11 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            Back to this month
          </button>
        )}
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

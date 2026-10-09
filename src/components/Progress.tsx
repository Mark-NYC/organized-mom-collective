import { useEffect, useState } from 'react';
import type { WeekDay } from '../lib/progress';

const SIZE = 52;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

interface RingProps {
  done: number;
  total: number;
  /** Changes when the routine was just finished in this visit, to play the bloom once. */
  bloom: number;
}

/**
 * Today's routine as a ring in the month's color. It counts what's done — the
 * empty part is a quiet track, not a deficit.
 */
export function ProgressRing({ done, total, bloom }: RingProps) {
  const complete = total > 0 && done === total;
  const offset = total > 0 ? C * (1 - done / total) : C;
  // Play the swell once per finish; the ring itself stays mounted so its fill keeps animating.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (bloom > 0) setPlaying(true);
  }, [bloom]);

  return (
    <span
      role="img"
      aria-label={complete ? 'Today’s routine is done' : `${done} of ${total} tasks done today`}
      className="relative grid shrink-0 place-items-center"
      style={{ width: SIZE, height: SIZE }}
    >
      {bloom > 0 && (
        <span key={`halo-${bloom}`} aria-hidden="true" className="ring-halo absolute inset-0 rounded-full bg-month" />
      )}
      <span
        aria-hidden="true"
        onAnimationEnd={(e) => e.target === e.currentTarget && setPlaying(false)}
        className={`relative grid place-items-center ${playing ? 'ring-bloom' : ''}`}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill={complete ? 'var(--color-month)' : 'none'} className="ring-center" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--color-rule)"
            strokeOpacity={0.45}
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--color-month)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            className="ring-fill"
            // A zero-length round cap still draws a dot; hide the fill until there's progress.
            opacity={done > 0 ? 1 : 0}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          {complete ? (
            <svg
              viewBox="0 0 28 28"
              className="size-6 text-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M6 14.5c1.6 1.3 3 2.9 4.3 5C13 13.4 16.8 8.7 22 5"
                pathLength={1}
                className={bloom > 0 ? 'tick-path tick-draw' : 'tick-path tick-on'}
              />
            </svg>
          ) : (
            <span className="text-[0.95rem] font-bold tabular-nums">{done}</span>
          )}
        </span>
      </span>
    </span>
  );
}

/**
 * Monday–Sunday. A filled dot is a day she did something. Days she didn't are
 * just an outline — no red, no gaps called out, nothing to "lose".
 */
export function WeekDots({ days }: { days: WeekDay[] }) {
  const doneDays = days.filter((d) => d.state === 'done');
  const label =
    doneDays.length === 0
      ? 'This week: a fresh start.'
      : `This week you made progress on ${doneDays.map((d) => d.name).join(', ')}.`;

  return (
    <span role="img" aria-label={label} className="flex items-center gap-[3px]">
      {days.map((d) => (
        <span
          key={d.name}
          aria-hidden="true"
          className={`size-[7px] rounded-full ${
            d.state === 'done'
              ? 'bg-month ring-1 ring-rule-strong/50'
              : d.state === 'today'
                ? 'ring-1 ring-ink'
                : d.state === 'past'
                  ? 'ring-1 ring-rule'
                  : 'ring-1 ring-rule/60'
          }`}
        />
      ))}
    </span>
  );
}

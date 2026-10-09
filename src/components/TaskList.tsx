import { useState } from 'react';
import type { Task } from '../data/cleaning';

interface TaskCheckboxProps {
  task: Task;
  checked: boolean;
  onToggle: (id: string) => void;
  /** Namespaces the input id so the same task can appear twice on a page. */
  scope: string;
  /** Marks the one task to do next. */
  next?: boolean;
}

/**
 * One ruled line with the printed calendar's rounded-square box, plus a pen
 * tick that overshoots it when checked. Checking draws the tick, gives the box
 * a tiny press and, on phones that support it, a light tap of haptic feedback.
 */
export function TaskCheckbox({ task, checked, onToggle, scope, next }: TaskCheckboxProps) {
  const inputId = `${scope}-${task.id}`;
  const [pop, setPop] = useState(false);

  const change = () => {
    if (!checked) {
      setPop(true);
      try {
        navigator.vibrate?.(10);
      } catch {
        /* not supported */
      }
    }
    onToggle(task.id);
  };

  return (
    <li className="border-b border-rule">
      <label htmlFor={inputId} className="group flex min-h-14 cursor-pointer items-center gap-3.5 py-2.5 select-none">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={change}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          onAnimationEnd={() => setPop(false)}
          className={`relative size-8 shrink-0 ${pop ? 'box-pop' : ''} rounded-[7px] border-[1.5px] transition-colors ${checked ? 'border-rule-strong/60' : 'border-ink'} group-hover:bg-band group-active:bg-band peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-ink`}
        >
          <svg
            viewBox="0 0 28 28"
            className={`absolute -top-[0.7rem] -right-[0.55rem] size-[2.3rem] overflow-visible text-ink transition-opacity ${
              checked ? 'opacity-100 duration-0' : 'opacity-0 duration-200'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 15.5c2 1.6 3.7 3.6 5.3 6.2C13 13.6 18 7.4 25 2.5" pathLength={1} className={`tick-path ${checked ? 'tick-on' : ''}`} />
          </svg>
        </span>
        <span
          className={`min-w-0 flex-1 text-[1.0625rem] leading-snug transition-colors sm:text-[1rem] ${
            checked ? 'text-muted line-through decoration-muted/70 decoration-1' : 'text-ink'
          }`}
        >
          {task.label}
        </span>
        {next && (
          <span className="shrink-0 border-b-[3px] border-month text-[0.62rem] font-semibold tracking-[0.18em] text-muted uppercase">
            Next
          </span>
        )}
      </label>
    </li>
  );
}

interface TaskListProps {
  tasks: Task[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  scope: string;
  label: string;
  next?: string;
}

export function TaskList({ tasks, checked, onToggle, scope, label, next }: TaskListProps) {
  return (
    <ul aria-label={label}>
      {tasks.map((task) => (
        <TaskCheckbox key={task.id} task={task} checked={checked.has(task.id)} onToggle={onToggle} scope={scope} next={task.id === next} />
      ))}
    </ul>
  );
}

/** Quiet tally, "2 / 5" — not a score. */
export function Tally({ done, total }: { done: number; total: number }) {
  return (
    <span className="shrink-0 text-[0.66rem] font-semibold tracking-[0.16em] whitespace-nowrap text-muted uppercase tabular-nums" aria-live="polite">
      {done === total && total > 0 ? 'Done' : `${done} / ${total}`}
    </span>
  );
}

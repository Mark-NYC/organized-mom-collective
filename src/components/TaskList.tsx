import type { Task } from '../data/cleaning';

interface TaskCheckboxProps {
  task: Task;
  checked: boolean;
  onToggle: (id: string) => void;
  /** Namespaces the input id so the same task can appear twice on a page. */
  scope: string;
}

/**
 * One ruled line with the printed calendar's rounded-square box, plus a pen
 * tick that overshoots it when checked.
 */
export function TaskCheckbox({ task, checked, onToggle, scope }: TaskCheckboxProps) {
  const inputId = `${scope}-${task.id}`;
  return (
    <li className="border-b border-rule">
      <label htmlFor={inputId} className="group flex min-h-14 cursor-pointer items-center gap-3.5 py-2.5 select-none">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(task.id)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative size-7 shrink-0 rounded-[6px] border-[1.5px] border-ink transition-colors group-hover:bg-band group-active:bg-band peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-ink"
        >
          <svg
            viewBox="0 0 28 28"
            className={`absolute -top-[0.7rem] -right-[0.55rem] size-[2.1rem] overflow-visible text-ink transition-opacity ${
              checked ? 'opacity-100' : 'opacity-0'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 15.5c2 1.6 3.7 3.6 5.3 6.2C13 13.6 18 7.4 25 2.5" />
          </svg>
        </span>
        <span
          className={`text-[1.0625rem] leading-snug transition-colors sm:text-[1rem] ${
            checked ? 'text-muted line-through decoration-muted/70 decoration-1' : 'text-ink'
          }`}
        >
          {task.label}
        </span>
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
}

export function TaskList({ tasks, checked, onToggle, scope, label }: TaskListProps) {
  return (
    <ul aria-label={label}>
      {tasks.map((task) => (
        <TaskCheckbox key={task.id} task={task} checked={checked.has(task.id)} onToggle={onToggle} scope={scope} />
      ))}
    </ul>
  );
}

/** Quiet tally, "2 / 5" — not a score. */
export function Tally({ done, total }: { done: number; total: number }) {
  return (
    <span className="text-[0.66rem] font-semibold tracking-[0.16em] text-muted uppercase tabular-nums" aria-live="polite">
      {done === total && total > 0 ? 'Done' : `${done} / ${total}`}
    </span>
  );
}

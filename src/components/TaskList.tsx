import type { Task } from '../data/cleaning';

interface TaskCheckboxProps {
  task: Task;
  checked: boolean;
  onToggle: (id: string) => void;
  /** Namespaces the input id so the same task can appear twice on a page. */
  scope: string;
}

export function TaskCheckbox({ task, checked, onToggle, scope }: TaskCheckboxProps) {
  const inputId = `${scope}-${task.id}`;
  return (
    <li>
      <label
        htmlFor={inputId}
        className="group flex min-h-12 cursor-pointer items-center gap-3.5 rounded-xl py-2.5 pr-2 select-none"
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(task.id)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-md border-[1.5px] border-faint bg-card transition-colors group-hover:border-sage peer-checked:border-sage peer-checked:bg-sage peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage"
        >
          <svg
            viewBox="0 0 16 16"
            className={`size-3.5 text-white transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </span>
        <span
          className={`text-[0.98rem] leading-snug transition-colors ${
            checked ? 'text-faint line-through decoration-faint/60' : 'text-ink'
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
    <ul aria-label={label} className="divide-y divide-line/70">
      {tasks.map((task) => (
        <TaskCheckbox key={task.id} task={task} checked={checked.has(task.id)} onToggle={onToggle} scope={scope} />
      ))}
    </ul>
  );
}

/** "2 of 5" — quiet progress, not a score. */
export function Progress({ done, total }: { done: number; total: number }) {
  return (
    <p className="text-sm text-muted tabular-nums" aria-live="polite">
      {done === total && total > 0 ? 'All done' : `${done} of ${total}`}
    </p>
  );
}

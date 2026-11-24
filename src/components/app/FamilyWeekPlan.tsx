/**
 * The same short family plan on Today and at the end of the Family Meeting.
 * Priorities are chosen by the family. Preparation tasks come from actual event
 * responsibilities. Standing agreements are a separate, explicitly labeled
 * "At home this week" row; they are never invented as calendar priorities.
 */
import type { CalendarEvent } from '../../lib/calendar/recurrence';
import type { Resolved } from '../../lib/app/priorities';
import type { EventTasks, EventTask } from '../../lib/calendar/event-tasks';
import { tasksFor } from '../../lib/calendar/event-tasks';
import type { PersonAgreements } from '../../lib/family-meeting-support';
import type { Household } from '../../lib/club/profile';
import type { MarkerColor } from '../../data/club/family-colors';
import { Avatar } from './ui';

export interface PlanRow {
  priority: Resolved;
  parts: EventTask[];
  owner: string | null;
}

/** A single source for which parts belong under which visible priority. */
export function planRows(current: Resolved[], external: CalendarEvent[], own: CalendarEvent[], tasks: EventTask[], available: boolean): PlanRow[] {
  return current.map((priority) => {
    const ref = priority.priority;
    const imported = !priority.gone && ref.source === 'imported'
      ? external.find((e) => e.external?.uid === ref.event_uid && e.external?.instance_key === ref.instance_key)
      : undefined;
    const familyEvent = !priority.gone && ref.source === 'family' ? own.find((e) => e.id === ref.event_uid) : undefined;
    return {
      priority,
      parts: imported && available ? tasksFor(tasks, imported) : [],
      owner: familyEvent?.owner_member_id ?? null,
    };
  });
}

/** The newest agreed responsibility per person, children before adults. Nothing is inferred from intake-only roles. */
export function homeParts(agreed: PersonAgreements[], household: Household | null, limit = 3) {
  const childrenFirst = [...agreed].sort((a, b) => {
    const child = (id: string) => household?.members.find((m) => m.id === id)?.kind === 'child';
    return Number(child(b.memberId)) - Number(child(a.memberId));
  });
  return childrenFirst.flatMap((p) => p.parts.length
    ? [{ id: p.parts[p.parts.length - 1].id, name: p.name, memberId: p.memberId, text: p.parts[p.parts.length - 1].text }]
    : []).slice(0, limit);
}

const time = (r: Resolved) => {
  if (!r.date) return null;
  const d = new Date(`${r.date}T12:00:00Z`);
  const when = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${when}${r.time ? ` · ${r.time}` : ''}`;
};

export default function FamilyWeekPlan({ current, external, own = [], tasks, household, colors, agreed = [], interactive = false, onError, max = 3, showHome = true }: {
  current: Resolved[];
  external: CalendarEvent[];
  own?: CalendarEvent[];
  tasks: EventTasks;
  household: Household | null;
  colors: Record<string, MarkerColor>;
  agreed?: PersonAgreements[];
  interactive?: boolean;
  onError?: (message: string | null) => void;
  max?: number;
  showHome?: boolean;
}) {
  const rows = planRows(current.slice(0, max), external, own, tasks.tasks, tasks.available);
  const home = showHome ? homeParts(agreed, household) : [];
  const person = (id: string | null) => household?.members.find((m) => m.id === id && !m.archived)?.firstName ?? 'Anyone';
  if (!rows.length && !home.length) return null;
  return (
    <ol className="mt-1" data-family-plan-list>
      {rows.map(({ priority: r, parts, owner }, index) => (
        <li key={r.priority.id} className="border-b border-[var(--of-rule)] py-3 last:border-0" data-today-priority={r.title} data-plan-priority={r.title}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--of-month-wash)] font-serif text-[1rem] text-warm-ink">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.98rem] font-semibold leading-snug text-warm-ink">{r.title}</p>
              {r.gone
                ? <p className="mt-0.5 text-[0.82rem] text-[#a33]">No longer on the calendar</p>
                : time(r) && <p className="mt-0.5 text-[0.82rem] text-warm-soft">{time(r)}</p>}
              {parts.length > 0 && (
                <ul className="mt-2 space-y-1.5" data-plan-prep>
                  {parts.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[0.87rem] leading-snug" data-family-plan-part={t.id}>
                      {interactive ? (
                        <button type="button" role="checkbox" aria-checked={t.done} aria-label={`${t.title}, ${person(t.member_id)}`}
                          onClick={async () => onError?.(await tasks.toggle(t.id))}
                          className="grid size-10 shrink-0 place-items-center rounded-full text-[0.85rem]"
                          data-priority-part-toggle={t.id}>
                          <span className={`grid size-6 place-items-center rounded-full border-2 ${t.done ? 'border-[var(--of-sage-bar)] bg-[var(--of-sage-bar)] text-white' : 'border-[var(--of-rule-strong)]'}`}>{t.done ? '✓' : ''}</span>
                        </button>
                      ) : <Avatar name={person(t.member_id)} color={t.member_id ? colors[t.member_id] : undefined} size="sm" />}
                      <span className={`min-w-0 ${t.done ? 'text-warm-soft line-through' : 'text-warm-ink'}`}>
                        <strong className="font-semibold">{person(t.member_id)}</strong> · {t.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {owner && parts.length === 0 && (
                <p className="mt-2 text-[0.87rem] text-warm-ink" data-plan-event-owner>
                  <strong>{person(owner)}</strong> · Handling this event
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
      {home.length > 0 && (
        <li className="py-3" data-plan-home>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--of-sage)] text-warm-ink">⌂</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.98rem] font-semibold text-warm-ink">At home this week</p>
              <ul className="mt-1.5 space-y-1.5">
                {home.map((p) => (
                  <li key={`${p.memberId}:${p.id}`} className="flex items-center gap-2 text-[0.87rem] leading-snug" data-plan-home-part={p.name}>
                    <Avatar name={p.name} color={colors[p.memberId]} size="sm" />
                    <span><strong className="font-semibold">{p.name}</strong> · {p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </li>
      )}
    </ol>
  );
}

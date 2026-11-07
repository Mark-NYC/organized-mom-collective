/**
 * The owner editor every migrated month shares (desktop dialogs and phone edit sheets alike): for each prepared task,
 * who does it (tap names; more than one is fine), her own wording, and "Leave it off" (January's Skip it). It only
 * reports choices through callbacks; the month's controller (`clubPlan.update`) applies them, so the printed sheet,
 * the rail and the phone screen stay one plan. Styles: src/styles/club-personalize.css (`.po-*`).
 */
import { el } from '../plan/dom';
import { canDo, type PlanTask } from './assign';
import { TASK_TITLE_LIMIT, type PlannedTask } from './edits';
import type { FamilyContext, Person } from './family';

export interface TaskEditorOptions {
  ctx: FamilyContext;
  tasks: readonly PlannedTask[];
  /** The rules for each task (who can do it), by id. */
  rules: Readonly<Record<string, Pick<PlanTask, 'who' | 'minAge' | 'maxAge'>>>;
  locked: boolean;
  onOwners(id: string, person: string, current: readonly string[]): void;
  onTitle(id: string, title: string): void;
  onSkip(id: string, skip: boolean): void;
  onReset(id: string): void;
}

const chip = (p: Person, on: boolean, disabled: boolean, pick: () => void) => {
  const b = el('button', { type: 'button', class: 'po-chip', disabled }, p.name);
  b.setAttribute('aria-pressed', String(on));
  b.addEventListener('click', pick);
  return b;
};

export function taskEditor(o: TaskEditorOptions): HTMLElement {
  return el('div', { class: 'po-list' }, ...o.tasks.map((t) => {
    const rule = o.rules[t.id] ?? { who: 'any' };
    const able = o.ctx.people.filter((p) => canDo(rule, p));
    const chips = el('div', { class: 'po-chips', role: 'group' }, ...able.map((p) =>
      chip(p, t.ownerIds.includes(p.id), o.locked || t.skipped, () => o.onOwners(t.id, p.id, t.ownerIds))));
    chips.setAttribute('aria-label', `Who does “${t.label}”`);
    const words = el('input', { type: 'text', class: 'po-input', value: t.label, maxLength: TASK_TITLE_LIMIT, disabled: o.locked || t.skipped });
    words.setAttribute('aria-label', `Wording for “${t.label}”`);
    words.addEventListener('change', () => o.onTitle(t.id, words.value));
    words.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); words.blur(); } });
    const skip = el('button', { type: 'button', class: 'po-text-btn', disabled: o.locked }, t.skipped ? 'Put it back on the page' : 'Leave it off');
    skip.addEventListener('click', () => o.onSkip(t.id, !t.skipped));
    const actions = el('div', { class: 'po-actions' }, skip);
    if (t.changed && !o.locked) {
      const reset = el('button', { type: 'button', class: 'po-text-btn' }, 'Use the prepared version');
      reset.addEventListener('click', () => o.onReset(t.id));
      actions.append(reset);
    }
    return el('div', { class: `po-task${t.skipped ? ' is-off' : ''}` },
      el('p', { class: 'po-task-head' }, el('strong', {}, t.label), el('span', {}, t.skipped ? 'Not on the page' : t.who || 'Nobody yet: pick someone')),
      able.length ? chips : el('p', { class: 'po-note' }, 'Nobody in the family is old enough for this one yet.'),
      words, actions);
  }));
}

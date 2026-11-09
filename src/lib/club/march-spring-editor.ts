/**
 * March's Spring Clean as a Team editor: one implementation for the desktop dialog (MarchSpringClean.astro) and the
 * phone edit sheets (MarchSpringCleanMobile.astro). Editing is optional; the prepared project stays the default.
 *
 *   The room   ·  choose another room or space (it prepares that room's project).
 *   Who does what · each job with the people who can safely do it as chips (grown-ups-only jobs offer only grown-ups);
 *                   several people can share a job, "together" only when she says so.
 *   The jobs   ·  swap a job for another of the room's, remove one, or add one (eight at most).
 *
 * Every change is tried on a copy first: a change the plan refuses (a grown-ups-only job for a child, a ninth job)
 * says why and changes nothing; an accepted one goes through the plan's controller (`clubPlan.update`), so the sheet,
 * the rail, the phone and saving stay one plan. Styles: `.sce-*` in MarchSpringClean.astro.
 */
import { el } from './plan/dom';
import { jobById } from '../../data/spring-cleaning';
import { guideIconSrc } from '../../data/club/spring-clean-guides';
import {
  MAX_JOBS, ROOM_CHOICES, addJob, helpersOf, jobChoices, ownerProblem, removeJob, replaceJob, restoreProject, roomLabel, setOwners, setRoom,
  suggestedRoom, youngFor, type EditResult, type JobView, type SpringPlanResource, type SpringState,
} from './engines/march-spring-clean';

export type SpringSection = 'room' | 'people' | 'jobs';
interface Options {
  plan: () => SpringPlanResource;
  locked: () => boolean;
  /** Draw the current section again after a change. */
  redraw: () => void;
}

const btn = (label: string, cls: string, onClick: () => void, extra: Record<string, unknown> = {}) => {
  const b = el('button', { type: 'button', class: cls, ...extra }, label);
  b.addEventListener('click', onClick);
  return b;
};
const icon = (j: Pick<JobView, 'guide'>) => {
  const slot = el('span', { class: 'sce-icon', 'aria-hidden': 'true' });
  slot.append(el('img', { src: guideIconSrc(j.guide.icon), alt: '', decoding: 'async' }));
  return slot;
};

export function springEditor(o: Options) {
  let message: { text: string; error?: boolean; undo?: SpringState } | null = null;
  const p = () => o.plan();

  /** Try a change on a copy; apply it only if the plan accepts it. */
  const change = (fn: (s: SpringState) => EditResult, done?: string, undoable = false) => {
    if (o.locked()) return;
    const before = structuredClone(p().state());
    const trial = structuredClone(before);
    const res = fn(trial);
    if (!res.ok) {
      message = { text: res.text, error: true };
      o.redraw();
      return;
    }
    p().update((s) => { fn(s); });
    message = done ? { text: done, ...(undoable ? { undo: before } : {}) } : null;
    o.redraw();
  };

  const status = () => {
    if (!message) return el('p', { class: 'sce-status', role: 'status' });
    const box = el('p', { class: `sce-status${message.error ? ' is-error' : ''}`, role: message.error ? 'alert' : 'status' }, message.text);
    if (message.undo) {
      const before = message.undo;
      box.append(' ', btn('Undo', 'sce-link', () => { p().replace(before); message = null; o.redraw(); }));
    }
    return box;
  };

  function roomSection() {
    const v = p().view();
    const sug = suggestedRoom(v.ctx);
    const chips = el('div', { class: 'cp-chips sce-rooms', role: 'group', 'aria-label': 'Room or space' }, ...ROOM_CHOICES.map((r) => btn(r.label, 'cp-chip', () => {
      if (r.id === v.room.id) return;
      change((s) => setRoom(s, r.id, p().members(), p().prefs()), `${r.label}: a new plan for this room is ready.`, true);
    }, { 'aria-pressed': String(r.id === v.room.id), disabled: o.locked() })));
    return el('div', { class: 'sce-section' },
      el('p', { class: 'sce-intro' }, `Suggested: ${roomLabel(sug.room)}. ${sug.why} Choosing another room prepares a new plan for it.`),
      chips, status());
  }

  function peopleSection() {
    const v = p().view();
    const helpers = helpersOf(v.ctx);
    const rows = v.jobs.map((j) => {
      const job = jobById(j.jobId)!;
      const current = j.owners.map((x) => x.id);
      // Everyone allowed to own it: grown-ups-only jobs offer only grown-ups; a younger child is allowed (ages are
      // suggestions) with a note to stay close.
      const able = helpers.filter((h) => ownerProblem(j.jobId, h.id, v.ctx) === null);
      const chips = el('div', { class: 'cp-chips cp-people-chips', role: 'group', 'aria-label': `Who does: ${j.title}` }, ...able.map((h) => {
        const on = current.includes(h.id);
        const person = v.ctx.people.find((x) => x.id === h.id)!;
        const chip = btn(person.name, 'cp-chip sce-person', () => {
          const next = on ? current.filter((x) => x !== h.id) : [...current, h.id];
          change((s) => setOwners(s, j.key, next, p().members(), p().prefs(), j.joint ? 'joint' : undefined),
            next.length ? undefined : `${j.title}: nobody is on it now.`);
        }, { 'aria-pressed': String(on), disabled: o.locked() });
        const young = youngFor(j.jobId, h.id, v.ctx);
        if (young) chip.title = young;
        return chip;
      }));
      const parts: Node[] = [el('div', { class: 'sce-job-head' }, icon(j), el('strong', {}, j.title), el('span', { class: 'sce-min' }, `about ${j.minutes} min`))];
      if (job.adultOnly) parts.push(el('p', { class: 'sce-note' }, 'Grown-ups only.'));
      parts.push(chips);
      if (current.length > 1) {
        const box = el('input', { type: 'checkbox', ...(j.joint ? { checked: true } : {}), disabled: o.locked() }) as HTMLInputElement;
        box.addEventListener('change', () => change((s) => setOwners(s, j.key, current, p().members(), p().prefs(), box.checked ? 'joint' : undefined)));
        parts.push(el('label', { class: 'sce-joint' }, box, ' Together, on one shared job (otherwise each does their own part)'));
      }
      if (!current.length) parts.push(el('p', { class: 'sce-needs' }, j.needs ?? 'Nobody is on this job yet.'));
      return el('li', { class: 'sce-job' }, ...parts);
    });
    return el('div', { class: 'sce-section' },
      el('p', { class: 'sce-intro' }, 'Tap a name to add or take someone off a job. Only people who can safely do a job are offered.'),
      el('ul', { class: 'sce-jobs' }, ...rows), status());
  }

  function jobsSection() {
    const v = p().view();
    const choices = jobChoices(p().state(), p().members(), p().prefs());
    const select = (label: string, onPick: (id: string) => void) => {
      const s = el('select', { class: 'sce-select', 'aria-label': label, disabled: o.locked() || !choices.length }) as HTMLSelectElement;
      s.append(el('option', { value: '' }, label), ...choices.map((c) => el('option', { value: c.id }, `${c.title}${c.adultOnly ? ' (grown-ups)' : ''}`)));
      s.addEventListener('change', () => { if (s.value) onPick(s.value); });
      return s;
    };
    const rows = v.jobs.map((j) => el('li', { class: 'sce-job' },
      el('div', { class: 'sce-job-head' }, icon(j), el('strong', {}, j.title)),
      el('div', { class: 'sce-actions' },
        select('Swap for…', (id) => change((s) => replaceJob(s, j.key, id, p().members(), p().prefs()), `Swapped in: ${jobById(id)?.title}.`, true)),
        btn('Remove', 'sce-link', () => change((s) => removeJob(s, j.key, p().members(), p().prefs()), `Removed: ${j.title}.`, true), { disabled: o.locked() }))));
    const add = v.jobs.length < MAX_JOBS
      ? el('div', { class: 'sce-add' }, select('Add a job…', (id) => change((s) => addJob(s, id, p().members(), p().prefs()), `Added: ${jobById(id)?.title}.`, true)))
      : el('p', { class: 'sce-note' }, `${MAX_JOBS} jobs is the most the instructions print clearly. Remove one to add another.`);
    return el('div', { class: 'sce-section' },
      el('p', { class: 'sce-intro' }, 'A focused room the family can finish is better than a long list. Swap, remove or add a job here.'),
      el('ul', { class: 'sce-jobs' }, ...rows), add, status());
  }

  return {
    section(which: SpringSection) {
      return which === 'room' ? roomSection() : which === 'people' ? peopleSection() : jobsSection();
    },
    /** "Start over with the prepared plan", with Undo. */
    restore() {
      const v = p().view();
      return btn('Start over with the prepared plan', 'sce-link', () => change((s) => { restoreProject(s); return { ok: true }; }, 'The prepared plan is back.', true),
        { hidden: !v.changed || o.locked() });
    },
    clear() { message = null; },
  };
}

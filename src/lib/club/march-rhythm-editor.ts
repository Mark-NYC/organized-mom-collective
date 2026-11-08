/**
 * The March Family Rhythm editor, one implementation for the desktop dialog (MarchFamilyRhythm.astro) and the phone
 * edit sheets (MarchPlanMobile.astro), in the order Mom thinks about it:
 *   1. Our family moments: two suggested moments, each a choice from common shared moments (plus her own wording),
 *      and an optional third.
 *   2. Who owns what: each moment's jobs, with the owner's colored name chips, the job's words, which moment it
 *      belongs to, remove; add a job from the moment's list or her own words.
 *   3. Our new habits: tick the one or two jobs the family is practicing (preselected).
 * Everything here is optional: the prepared plan is already useful. It only changes the plan through the printable's
 * controller (`clubPlan.update`); after each change it calls `redraw`. Styles: `.mre-*` in MarchFamilyRhythm.astro.
 */
import { el } from './plan/dom';
import {
  ANCHORS, JOBS, LABEL_LIMIT, MAX_HABITS, MAX_ROWS, TITLE_LIMIT, addRow, anchorById, moveRow, removeRow, restorePlan, setAnchor, setHabit,
  setMomentLabel, setMomentOn, setRowOwners, setRowTitle, type AnchorId, type RhythmPlanResource,
} from './engines/march-family-rhythm';

export type RhythmSection = 'moments' | 'owners' | 'habits';
interface Opts { locked: boolean; redraw: () => void }

const field = (label: string, control: HTMLElement, hint?: string) =>
  el('label', { class: 'mre-field' }, el('span', { class: 'mre-label' }, label), control, ...(hint ? [el('span', { class: 'mre-hint' }, hint)] : []));

/** 1. Our family moments. */
export function momentsEditor(p: RhythmPlanResource, o: Opts): HTMLElement {
  const v = p.view();
  const change = (fn: () => void) => { fn(); o.redraw(); };
  const m = () => p.members(), pr = () => p.prefs();
  const cards = v.moments.map((mo, i) => {
    const taken = new Set(v.moments.filter((x) => x.id !== mo.id && x.enabled).map((x) => x.anchor));
    const pick = el('select', { class: 'mre-select', disabled: o.locked || !mo.enabled }) as HTMLSelectElement;
    for (const a of ANCHORS) pick.append(el('option', { value: a.id, disabled: taken.has(a.id) }, `${a.title} · ${a.cue}`));
    pick.value = mo.anchor;
    pick.addEventListener('change', () => change(() => p.update((s) => setAnchor(s, mo.id, pick.value as AnchorId, m(), pr()))));
    const label = el('input', { type: 'text', class: 'mre-input', value: mo.title === anchorById(mo.anchor).title ? '' : mo.title, placeholder: anchorById(mo.anchor).title, maxLength: LABEL_LIMIT, disabled: o.locked || !mo.enabled });
    label.setAttribute('aria-label', `Our words for moment ${i + 1}`);
    label.addEventListener('change', () => change(() => p.update((s) => setMomentLabel(s, mo.id, label.value, m(), pr()))));
    const head = i < 2
      ? el('p', { class: 'mre-card-title' }, `Moment ${i + 1}`)
      : (() => {
        const on = el('input', { type: 'checkbox', checked: mo.enabled, disabled: o.locked });
        on.addEventListener('change', () => change(() => p.update((s) => setMomentOn(s, mo.id, on.checked, m(), pr()))));
        return el('label', { class: 'mre-check' }, on, el('span', {}, 'Add a third moment (optional)'));
      })();
    return el('div', { class: `mre-card${mo.enabled ? '' : ' is-off'}` }, head,
      field('Shared moment', pick, 'Changing it prepares jobs that fit the new moment.'), field('In our words (optional)', label));
  });
  return el('div', { class: 'mre-section' },
    el('p', { class: 'mre-intro' }, 'Two moments your family already shares each day. Most families need only two.'), ...cards);
}

/** 2. Who owns what. */
export function ownersEditor(p: RhythmPlanResource, o: Opts): HTMLElement {
  const v = p.view();
  const change = (fn: () => void) => { fn(); o.redraw(); };
  const m = () => p.members(), pr = () => p.prefs();
  const on = v.moments.filter((x) => x.enabled);
  const blocks = on.map((mo) => {
    const rows = mo.rows.map((r) => {
      const chips = el('div', { class: 'mre-chips', role: 'group' }, ...v.people.map((person) => {
        const pressed = r.owners.some((x) => x.id === person.id);
        const b = el('button', { type: 'button', class: 'mre-chip', disabled: o.locked });
        const dot = el('span', { class: 'mre-dot', 'aria-hidden': 'true' });
        dot.style.background = person.color.hex;
        b.append(dot, person.name);
        b.setAttribute('aria-pressed', String(pressed));
        b.addEventListener('click', () => {
          const next = pressed ? r.owners.map((x) => x.id).filter((x) => x !== person.id) : [...r.owners.map((x) => x.id), person.id];
          change(() => p.update((s) => setRowOwners(s, r.id, next, m(), pr())));
        });
        return b;
      }));
      chips.setAttribute('aria-label', `Who owns “${r.title}”`);
      const title = el('input', { type: 'text', class: 'mre-input', value: r.title, maxLength: TITLE_LIMIT, disabled: o.locked });
      title.setAttribute('aria-label', `Job: ${r.title}`);
      title.addEventListener('change', () => change(() => p.update((s) => setRowTitle(s, r.id, title.value, m(), pr()))));
      const where = el('select', { class: 'mre-select mre-select--small', disabled: o.locked }) as HTMLSelectElement;
      for (const x of on) where.append(el('option', { value: x.id }, x.title));
      where.value = mo.id;
      where.setAttribute('aria-label', `Moment for “${r.title}”`);
      where.addEventListener('change', () => change(() => p.update((s) => moveRow(s, r.id, where.value, m(), pr()))));
      const remove = el('button', { type: 'button', class: 'mre-text-btn', disabled: o.locked }, 'Remove');
      remove.setAttribute('aria-label', `Remove ${r.title}`);
      remove.addEventListener('click', () => change(() => p.update((s) => removeRow(s, r.id, m(), pr()))));
      return el('li', { class: `mre-row${r.habit ? ' is-habit' : ''}` }, title, chips,
        el('div', { class: 'mre-row-foot' }, on.length > 1 ? where : el('span'), remove),
        ...(r.misfit ? [el('p', { class: 'mre-warn' }, `This has to happen before “${mo.cue.toLowerCase()}”, so it can’t follow this moment. Move it, or choose a job that comes after.`)] : []));
    });
    // Add a job: one from this moment's list, or her own words, for one person.
    const full = mo.rows.length >= MAX_ROWS;
    const job = el('select', { class: 'mre-select', disabled: o.locked || full }) as HTMLSelectElement;
    job.append(el('option', { value: '' }, 'Choose a job…'));
    for (const j of JOBS.filter((x) => x.anchor === mo.anchor && !mo.rows.some((r) => r.title === x.title) && (!x.pets || v.ctx.pets))) job.append(el('option', { value: j.id }, j.title));
    job.append(el('option', { value: 'own' }, 'Our own job…'));
    const words = el('input', { type: 'text', class: 'mre-input', placeholder: 'Describe the job', maxLength: TITLE_LIMIT, hidden: true, disabled: o.locked || full });
    const who = el('select', { class: 'mre-select', disabled: o.locked || full }) as HTMLSelectElement;
    for (const person of v.people) who.append(el('option', { value: person.id }, person.name));
    const add = el('button', { type: 'button', class: 'mre-btn', disabled: o.locked || full }, 'Add');
    job.addEventListener('change', () => { words.hidden = job.value !== 'own'; if (!words.hidden) words.focus(); });
    add.addEventListener('click', () => {
      if (!job.value || (job.value === 'own' && !words.value.trim())) return;
      change(() => p.update((s) => addRow(s, mo.id, who.value, m(), pr(), job.value === 'own' ? undefined : job.value, words.value)));
    });
    return el('section', { class: 'mre-moment' },
      el('h4', { class: 'mre-moment-title' }, mo.title, el('span', {}, ` · ${mo.cue}`)),
      mo.rows.length ? el('ul', { class: 'mre-rows' }, ...rows) : el('p', { class: 'mre-hint' }, 'No jobs yet: this moment won’t print until it has one.'),
      el('div', { class: 'mre-add' }, el('span', { class: 'mre-label' }, full ? `${MAX_ROWS} jobs is the most a moment holds` : 'Add a job'), job, words, who, add));
  });
  return el('div', { class: 'mre-section' },
    el('p', { class: 'mre-intro' }, 'Tap names to change who owns a job (siblings can share one). Not everyone needs a part in every moment.'), ...blocks);
}

/** 3. Our new habits. */
export function habitsEditor(p: RhythmPlanResource, o: Opts): HTMLElement {
  const v = p.view();
  const change = (fn: () => void) => { fn(); o.redraw(); };
  const items = v.printed.flatMap((mo) => mo.rows.map((r) => {
    const box = el('input', { type: 'checkbox', checked: r.habit, disabled: o.locked || (!r.habit && v.habits.length >= MAX_HABITS) });
    box.addEventListener('change', () => change(() => p.update((s) => setHabit(s, r.id, box.checked, p.members(), p.prefs()))));
    return el('label', { class: 'mre-check mre-habit' }, box, el('span', {}, el('strong', {}, r.owners.map((x) => x.name).join(' & ')), ` · ${r.title} · ${mo.title}`));
  }));
  return el('div', { class: 'mre-section' },
    el('p', { class: 'mre-intro' }, `Choose one or two jobs the family is learning now. They’re highlighted on the chart; everything else is already part of your routine.`), ...items);
}

/** "Start over with the prepared plan": back to the recommendation from her newest family-page answers. */
export function restoreButton(p: RhythmPlanResource, o: Opts): HTMLElement {
  const b = el('button', { type: 'button', class: 'mre-text-btn', disabled: o.locked || !p.view().changed }, 'Start over with the prepared plan');
  b.addEventListener('click', () => { p.update((s) => restorePlan(s)); o.redraw(); });
  return b;
}

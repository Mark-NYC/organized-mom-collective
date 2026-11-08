/**
 * The March Family Rhythm editor: one implementation for the desktop dialog (MarchFamilyRhythm.astro) and the phone
 * edit sheets (MarchPlanMobile.astro). Small, focused steps, never a long form:
 *
 *   Our moments  ·  the shared moments: choose another, her own words, turn one on or off (with a confirmation when
 *                   it holds jobs).
 *   Who owns what · level 1: each moment as a card (count, who does what, "Edit responsibilities");
 *                   level 2: one moment's jobs as compact rows (icon, job, owners in their colors, Edit, Remove);
 *                   level 3: one job: the job (suggestions from the moment's list, or her words), who owns it, when,
 *                   and whether it's a new habit. Done saves it; Cancel leaves it as it was; Remove asks first.
 *   New habits  ·  choose one or two.
 *
 * Every change goes through the plan's controller (`clubPlan.update`), so the preview and saving work as everywhere
 * else in the Club. A job being edited is a draft until Done; `dirty()` lets the dialog or sheet refuse to close over
 * it. Styles: `.mre-*` in MarchFamilyRhythm.astro.
 */
import { el } from './plan/dom';
import { marchIconArt } from '../../data/club/march-chore-icons';
import {
  ANCHORS, JOBS, LABEL_LIMIT, MAX_HABITS, MAX_ROWS, TITLE_LIMIT, anchorById, isIndividual, removeRow, restorePlan, saveRow, setAnchor, setHabit,
  setMomentLabel, setMomentOn, type AnchorId, type MomentView, type RhythmPlanResource, type RhythmState, type RowDraft, type RowView,
} from './engines/march-family-rhythm';

export type RhythmSection = 'moments' | 'owners' | 'habits';
interface Options {
  plan: () => RhythmPlanResource;
  locked: () => boolean;
  /** Draw the current section again (after any change, or a step in or out). */
  redraw: () => void;
}
interface Editing { rowId?: string; draft: RowDraft; start: string; error?: string; confirmRemove?: boolean }

const btn = (label: string, cls: string, onClick: () => void, extra: Record<string, unknown> = {}) => {
  const b = el('button', { type: 'button', class: cls, ...extra }, label);
  b.addEventListener('click', onClick);
  return b;
};
const dot = (hex: string) => { const d = el('span', { class: 'mre-dot', 'aria-hidden': 'true' }); d.style.background = hex; return d; };
const owners = (r: RowView) => el('span', { class: 'mre-owners' }, ...r.owners.flatMap((o, i) => {
  const n = el('span', { class: 'mre-owner' }, dot(o.color.hex), o.name);
  return i ? [el('span', { class: 'mre-amp', 'aria-hidden': 'true' }, r.mode === 'together' ? '+' : '·'), n] : [n];
}), ...(r.mode === 'each' ? [el('span', { class: 'mre-mode' }, 'each their own')] : r.mode === 'together' ? [el('span', { class: 'mre-mode' }, 'together')] : []));
const iconOf = (r: Pick<RowView, 'icon'>) => {
  const art = r.icon ? marchIconArt(r.icon) : null;
  const slot = el('span', { class: 'mre-icon', 'aria-hidden': 'true' });
  if (art) slot.append(el('img', { src: art.src, alt: '', decoding: 'async' }));
  return slot;
};

export function rhythmEditor(o: Options) {
  let momentId: string | null = null;
  let editing: Editing | null = null;
  let confirmRow: string | null = null;
  let confirmOff: string | null = null;
  let status: { text: string; undo?: RhythmState } | null = null;
  let warning = '';
  const p = () => o.plan();
  const m = () => p().members();
  const pr = () => p().prefs();
  /** A change through the controller, with an Undo for anything that takes something away. */
  const change = (fn: (s: RhythmState) => void, said?: string) => {
    const before = structuredClone(p().state());
    p().update(fn);
    status = said ? { text: said, undo: before } : null;
    warning = '';
    o.redraw();
  };
  const statusLine = () => {
    if (warning) return el('p', { class: 'mre-warn', role: 'alert' }, warning);
    if (!status) return el('p', { class: 'mre-status', role: 'status' });
    const s = status;
    const undo = s.undo ? [btn('Undo', 'mre-text-btn', () => { p().replace(s.undo!); status = null; o.redraw(); })] : [];
    return el('p', { class: 'mre-status', role: 'status' }, s.text, ...undo);
  };

  // ---------------------------------------------------------------- 1. Our moments
  const moments = () => {
    const v = p().view();
    const locked = o.locked();
    const on = v.moments.filter((x) => x.enabled);
    const cards = v.moments.map((mo, i) => {
      const taken = new Set(v.moments.filter((x) => x.id !== mo.id && x.enabled).map((x) => x.anchor));
      const pick = el('select', { class: 'mre-select', disabled: locked || !mo.enabled }) as HTMLSelectElement;
      for (const a of ANCHORS) pick.append(el('option', { value: a.id, disabled: taken.has(a.id) }, `${a.title} · ${a.cue}`));
      pick.value = mo.anchor;
      pick.setAttribute('aria-label', `Moment ${i + 1}`);
      pick.addEventListener('change', () => change((s) => setAnchor(s, mo.id, pick.value as AnchorId, m(), pr()), `Now ${anchorById(pick.value as AnchorId).title.toLowerCase()}, with jobs that fit it.`));
      const label = el('input', { type: 'text', class: 'mre-input', value: mo.title === anchorById(mo.anchor).title ? '' : mo.title, placeholder: anchorById(mo.anchor).title, maxLength: LABEL_LIMIT, disabled: locked || !mo.enabled });
      label.setAttribute('aria-label', `Our words for moment ${i + 1}`);
      label.addEventListener('change', () => change((s) => setMomentLabel(s, mo.id, label.value, m(), pr())));
      const count = mo.rows.length;
      const head = el('div', { class: 'mre-card-head' },
        el('p', { class: 'mre-card-title' }, mo.enabled ? mo.title : `${mo.title} (off)`),
        ...(mo.enabled
          ? [on.length > 1 ? btn('Turn off', 'mre-text-btn', () => { if (count) { confirmOff = mo.id; o.redraw(); } else change((s) => setMomentOn(s, mo.id, false, m(), pr())); }, { disabled: locked, 'aria-label': `Turn off ${mo.title}` }) : el('span')]
          : [btn(i === 2 ? 'Add this moment' : 'Turn on', 'mre-btn', () => change((s) => setMomentOn(s, mo.id, true, m(), pr())), { disabled: locked || taken.has(mo.anchor) })]));
      const confirm = confirmOff === mo.id
        ? [el('div', { class: 'mre-confirm', role: 'alertdialog', 'aria-label': `Turn off ${mo.title}` },
          el('p', {}, `${mo.title} has ${count} ${count === 1 ? 'job' : 'jobs'}. They come off the chart; turn it back on to bring them back.`),
          el('div', { class: 'mre-actions' },
            btn('Turn it off', 'mre-btn mre-btn--dark', () => { confirmOff = null; change((s) => setMomentOn(s, mo.id, false, m(), pr()), `${mo.title} is off.`); }),
            btn('Keep it', 'mre-btn', () => { confirmOff = null; o.redraw(); })))]
        : [];
      return el('div', { class: `mre-card${mo.enabled ? '' : ' is-off'}` }, head, ...confirm,
        ...(mo.enabled ? [el('label', { class: 'mre-field' }, el('span', { class: 'mre-label' }, 'Shared moment'), pick, el('span', { class: 'mre-hint' }, 'Choosing another prepares jobs that fit it.')),
          el('label', { class: 'mre-field' }, el('span', { class: 'mre-label' }, 'In our words (optional)'), label)] : []));
    });
    return el('div', { class: 'mre-section' },
      el('p', { class: 'mre-intro' }, 'Moments your family already shares each day. Two is plenty for most families.'), statusLine(), ...cards);
  };

  // ---------------------------------------------------------------- 2. Who owns what
  const overview = (v: ReturnType<RhythmPlanResource['view']>) => el('div', { class: 'mre-section' },
    el('p', { class: 'mre-intro' }, 'Open a moment to change one job. Not everyone needs a part in every moment.'), statusLine(),
    ...v.moments.filter((x) => x.enabled).map((mo) => el('section', { class: 'mre-card' },
      el('div', { class: 'mre-card-head' }, el('h4', { class: 'mre-card-title' }, mo.title), el('span', { class: 'mre-count' }, `${mo.rows.length} ${mo.rows.length === 1 ? 'job' : 'jobs'}`)),
      mo.rows.length ? el('ul', { class: 'mre-summary' }, ...mo.rows.map((r) => el('li', {}, el('span', { class: 'mre-summary-who' }, ...r.owners.map((x) => dot(x.color.hex)), r.owners.map((x) => x.name).join(r.mode === 'together' ? ' + ' : ' · ')), el('span', {}, r.title))))
        : el('p', { class: 'mre-hint' }, 'No jobs yet: it won’t print until it has one.'),
      btn('Edit responsibilities', 'mre-btn', () => { momentId = mo.id; status = null; o.redraw(); }, { disabled: o.locked(), 'aria-label': `Edit responsibilities for ${mo.title}` }))));

  const momentRows = (mo: MomentView) => {
    const locked = o.locked();
    // Every assignment on its own line here (each person's own job separately), so a change touches one person.
    const rows = mo.parts.map((r) => {
      if (confirmRow === r.id) {
        return el('li', { class: 'mre-row mre-confirm', role: 'alertdialog', 'aria-label': `Remove ${r.title}` },
          el('p', {}, `Remove “${r.title}”?`),
          el('div', { class: 'mre-actions' },
            btn('Remove', 'mre-btn mre-btn--dark', () => { confirmRow = null; change((s) => removeRow(s, r.id, m(), pr()), `Removed “${r.title}”.`); }),
            btn('Keep', 'mre-btn', () => { confirmRow = null; o.redraw(); })));
      }
      return el('li', { class: `mre-row${r.habit ? ' is-habit' : ''}` }, iconOf(r),
        el('span', { class: 'mre-row-text' }, el('span', { class: 'mre-row-title' }, r.title, ...(r.habit ? [el('span', { class: 'mre-tag' }, 'New habit')] : [])), owners(r),
          ...(r.misfit ? [el('span', { class: 'mre-warn-inline' }, `Has to happen before ${anchorById(mo.anchor).when}.`)] : [])),
        el('span', { class: 'mre-row-actions' },
          btn('Edit', 'mre-text-btn', () => openRow(mo, r), { disabled: locked, 'aria-label': `Edit ${r.title}` }),
          btn('Remove', 'mre-text-btn', () => { confirmRow = r.id; o.redraw(); }, { disabled: locked, 'aria-label': `Remove ${r.title}` })));
    });
    const full = mo.rows.length >= MAX_ROWS;
    return el('div', { class: 'mre-section' },
      btn('‹ All moments', 'mre-back', () => { momentId = null; confirmRow = null; status = null; o.redraw(); }),
      el('div', { class: 'mre-card-head' }, el('h4', { class: 'mre-card-title' }, mo.title), el('span', { class: 'mre-count' }, `Cue: ${mo.cue}`)),
      statusLine(),
      mo.rows.length ? el('ul', { class: 'mre-rows' }, ...rows) : el('p', { class: 'mre-hint' }, 'No jobs yet: this moment won’t print until it has one.'),
      mo.finish ? el('p', { class: 'mre-finish' }, el('b', {}, 'Finished when '), mo.finish) : el('span'),
      btn(full ? `${MAX_ROWS} jobs is the most a moment holds` : '+ Add a responsibility', 'mre-btn mre-add', () => openRow(mo), { disabled: locked || full }));
  };

  const openRow = (mo: MomentView, r?: RowView) => {
    const v = p().view();
    const draft: RowDraft = r
      ? { title: r.title, ...(r.job ? { job: r.job } : {}), owners: r.owners.map((x) => x.id), moment: mo.id, habit: r.habit }
      : { title: '', owners: v.people.filter((x) => !x.adult).slice(0, 1).map((x) => x.id), moment: mo.id, habit: false };
    // The prepared plan isn't written down until her first change; its rows have the same ids, so editing works on it.
    editing = { rowId: r?.id, draft, start: JSON.stringify(draft) };
    status = null;
    o.redraw();
  };
  const closeRow = () => { editing = null; warning = ''; o.redraw(); };

  /** Level 3: one responsibility. Nothing changes until Done. */
  const rowEditor = (e: Editing) => {
    const v = p().view();
    const d = e.draft;
    const mo = v.moments.find((x) => x.id === d.moment) ?? v.moments[0];
    const redraw = () => o.redraw();
    const inMoment = new Set(mo.rows.filter((x) => x.id !== e.rowId).map((x) => x.title));
    // Jobs that fit this moment and aren't on it yet (no "Clear my own plate" when someone clears the whole table).
    const ideas = JOBS.filter((j) => j.anchor === mo.anchor && (!j.pets || v.ctx.pets) && !inMoment.has(j.title) && !(j.id === 'd-plate' && inMoment.has('Clear the dinner table')));
    const chips = el('div', { class: 'mre-chips', role: 'group', 'aria-label': 'Jobs that fit this moment' }, ...ideas.map((j) => {
      const b = btn(j.title, 'mre-chip mre-chip--job', () => { d.job = j.id; d.title = j.title; e.error = undefined; redraw(); });
      b.setAttribute('aria-pressed', String(d.job === j.id));
      return b;
    }));
    const words = el('input', { type: 'text', class: 'mre-input', value: d.job ? '' : d.title, maxLength: TITLE_LIMIT, placeholder: 'Or in your words, e.g. Water the plants' });
    words.setAttribute('aria-label', 'The job, in your words');
    words.addEventListener('input', () => { d.title = words.value; delete d.job; chips.querySelectorAll('[aria-pressed="true"]').forEach((c) => c.setAttribute('aria-pressed', 'false')); });
    const who = el('div', { class: 'mre-chips', role: 'group', 'aria-label': 'Who owns it' }, ...v.people.map((x) => {
      const on = d.owners.includes(x.id);
      const b = btn('', 'mre-chip', () => { d.owners = on ? d.owners.filter((i) => i !== x.id) : [...d.owners, x.id]; e.error = undefined; redraw(); });
      b.append(dot(x.color.hex), x.name);
      b.setAttribute('aria-pressed', String(on));
      return b;
    }));
    const individual = isIndividual({ job: d.job, title: d.title });
    const shareNote = d.owners.length > 1 ? el('p', { class: 'mre-hint' }, individual ? 'Each does their own.' : 'They’ll do it together. For separate jobs, add each one on its own.') : el('span');
    const when = el('select', { class: 'mre-select' }) as HTMLSelectElement;
    for (const x of v.moments.filter((y) => y.enabled)) when.append(el('option', { value: x.id }, x.title));
    when.value = d.moment;
    when.setAttribute('aria-label', 'When');
    when.addEventListener('change', () => {
      d.moment = when.value;
      // A job from one moment's list doesn't carry to another moment: keep her words, drop the suggestion link.
      if (d.job && JOBS.find((j) => j.id === d.job)?.anchor !== v.moments.find((x) => x.id === d.moment)?.anchor) delete d.job;
      e.error = undefined;
      redraw();
    });
    const row = e.rowId ? p().state().plan?.rows.find((x) => x.id === e.rowId) : undefined;
    const established = Boolean(row?.established ?? v.moments.flatMap((x) => x.rows).find((x) => x.id === e.rowId)?.established);
    const habitCount = v.habits.filter((h) => h.id !== e.rowId).length;
    const habit = el('input', { type: 'checkbox', checked: d.habit, disabled: established });
    habit.addEventListener('change', () => { d.habit = habit.checked; });
    const habitHint = established ? 'Already theirs, so it isn’t a new habit.' : !d.habit && habitCount >= MAX_HABITS ? `Choosing this replaces “${v.habits[0]?.title}”.` : 'One or two for the family to practice.';
    const save = () => {
      if (!d.job) d.title = words.value;
      let result: ReturnType<typeof saveRow> = { ok: false, text: '' };
      p().update((s) => { result = saveRow(s, e.rowId, d, m(), pr()); });
      if (!result.ok) { e.error = result.text; redraw(); return; }
      const said = e.rowId ? 'Saved.' : `Added “${d.title || JOBS.find((j) => j.id === d.job)?.title}”.`;
      editing = null;
      momentId = d.moment;
      status = { text: said };
      o.redraw();
    };
    const body = el('div', { class: 'mre-section mre-one' },
      el('p', { class: 'mre-kicker' }, `${e.rowId ? 'Edit' : 'Add'} a responsibility · ${mo.title}`),
      ...(warning ? [el('p', { class: 'mre-warn', role: 'alert' }, warning)] : []),
      el('fieldset', { class: 'mre-fieldset' }, el('legend', { class: 'mre-label' }, 'The job'), ideas.length ? chips : el('span'), words),
      el('fieldset', { class: 'mre-fieldset' }, el('legend', { class: 'mre-label' }, 'Who owns it'), who, shareNote),
      el('label', { class: 'mre-field' }, el('span', { class: 'mre-label' }, 'When'), when),
      el('label', { class: 'mre-check' }, habit, el('span', {}, el('strong', {}, 'A new habit'), el('span', { class: 'mre-hint' }, ` · ${habitHint}`))),
      ...(e.error ? [el('p', { class: 'mre-warn', role: 'alert' }, e.error)] : []),
      e.confirmRemove
        ? el('div', { class: 'mre-confirm', role: 'alertdialog', 'aria-label': 'Remove this job' }, el('p', {}, `Remove “${d.title}”?`),
          el('div', { class: 'mre-actions' },
            btn('Remove', 'mre-btn mre-btn--dark', () => { const id = e.rowId!; editing = null; momentId = d.moment; change((s) => removeRow(s, id, m(), pr()), `Removed “${d.title}”.`); }),
            btn('Keep', 'mre-btn', () => { e.confirmRemove = false; redraw(); })))
        : el('div', { class: 'mre-actions mre-actions--end' },
          btn('Done', 'mre-btn mre-btn--dark', save),
          btn('Cancel', 'mre-btn', closeRow),
          ...(e.rowId ? [btn('Remove', 'mre-text-btn mre-remove', () => { e.confirmRemove = true; redraw(); })] : [])));
    return body;
  };

  const ownersSection = () => {
    if (editing) return rowEditor(editing);
    const v = p().view();
    const mo = momentId ? v.moments.find((x) => x.id === momentId && x.enabled) : undefined;
    return mo ? momentRows(mo) : overview(v);
  };

  // ---------------------------------------------------------------- 3. New habits
  const habits = () => {
    const v = p().view();
    const locked = o.locked();
    const items = v.printed.flatMap((mo) => mo.parts.map((r) => {
      const box = el('input', { type: 'checkbox', checked: r.habit, disabled: locked || r.established });
      box.addEventListener('change', () => change((s) => setHabit(s, r.id, box.checked, m(), pr())));
      return el('label', { class: 'mre-check mre-habit' }, box,
        el('span', {}, el('strong', {}, r.owners.map((x) => x.name).join(' & ')), ` · ${r.title} · ${mo.title}`, ...(r.established ? [el('span', { class: 'mre-hint' }, ' (already theirs)')] : [])));
    }));
    return el('div', { class: 'mre-section' },
      el('p', { class: 'mre-intro' }, `Choose one or two jobs someone is learning now. They’re marked on the chart and named under “This week, we’re practicing”. A third replaces the oldest.`), ...items);
  };

  return {
    section(name: RhythmSection) { return name === 'moments' ? moments() : name === 'owners' ? ownersSection() : habits(); },
    /** Open "Who owns what" at one moment's jobs. */
    focus(id?: string) { momentId = id ?? null; editing = null; confirmRow = null; status = null; warning = ''; },
    /** A single job is open (it has its own Done and Cancel). */
    editingRow() { return Boolean(editing); },
    /** A job is being edited and has changes not yet saved with Done. */
    dirty() { return Boolean(editing && JSON.stringify(editing.draft) !== editing.start); },
    /** Say why it can't close yet (Done or Cancel first). */
    warn() { warning = 'You have a change that isn’t saved yet. Choose Done to keep it, or Cancel.'; o.redraw(); },
    reset() { momentId = null; editing = null; confirmRow = null; confirmOff = null; status = null; warning = ''; },
  };
}
export type RhythmEditor = ReturnType<typeof rhythmEditor>;

/** "Start over with the prepared plan": back to the recommendation from her newest family-page answers. */
export function restoreButton(p: RhythmPlanResource, o: { locked: boolean; redraw: () => void }): HTMLElement {
  const b = el('button', { type: 'button', class: 'mre-text-btn', disabled: o.locked || !p.view().changed }, 'Start over with the prepared plan');
  b.addEventListener('click', () => { p.update((s) => restorePlan(s)); o.redraw(); });
  return b;
}

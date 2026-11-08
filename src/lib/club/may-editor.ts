/**
 * The May editor, Our Summer Day: one implementation for the desktop dialog (MaySummerRhythm.astro) and the phone edit
 * sheets (MayPlanMobile.astro), in three small areas instead of one long form:
 *   Our day          · the kind of day and how much structure (the suggestions the blocks are prepared from), then
 *                      each block: its name, earlier/later, on or off; "Restore the prepared rhythm".
 *   When it happens  · each block: Time or Trigger. Time shows a time field; Trigger shows familiar events and her own
 *                      words. Only the chosen one shows. Anything that doesn't add up is said beside the block.
 *   Activities & responsibilities · one block at a time: its activities, and the family's jobs on it with the shared
 *                      owner editor (stable member ids and January colors).
 * Every change goes through the plan (`update`) so the preview updates live and saves the usual Club way. The dialog
 * or sheet brings Done and Cancel (Cancel puts back the plan as it was when the editor opened).
 * Styles: `.mye-*` in MaySummerRhythm.astro; the owner editor's `.po-*` in src/styles/club-personalize.css.
 */
import { el } from './plan/dom';
import {
  DESC_LIMIT, LABELS, MAY_KEYS, TITLE_LIMIT, TRIGGER_CHOICES, TRIGGER_LIMIT, EVENING_TIME, defaultTrigger, mayIssues, mayParts, moveBlock, partRules,
  setTime, setTrigger, setWhen, visibleKeys, type MayKey, type MayOptions, type MayState,
} from './engines/may-summer-rhythm';
import { taskEditor } from './personalize/editor';
import { resetTask, setTaskSkip, setTaskTitle, toggleTaskOwner } from './personalize/edits';
import type { FamilyContext } from './personalize/family';

export type MaySection = 'day' | 'when' | 'jobs';
export const MAY_SECTIONS: readonly [MaySection, string][] = [['day', 'Our day'], ['when', 'When it happens'], ['jobs', 'Activities & responsibilities']];

interface Options {
  state: () => MayState;
  update: (fn: (s: MayState) => void) => void;
  ctx: () => FamilyContext | null;
  locked: () => boolean;
  /** Draw the current section again (after a change, or a step in or out). */
  redraw: () => void;
  /** Lines a trigger takes in its printed box (more than two needs shortening). */
  lines: (text: string) => number;
  /** Back to the prepared rhythm (her newest family-page answers). */
  restore: () => void;
}

const field = (label: string, control: HTMLElement, hint?: string) =>
  el('label', { class: 'mye-field' }, el('span', { class: 'mye-label' }, label), control, ...(hint ? [el('span', { class: 'mye-hint' }, hint)] : []));
const select = <T extends string | number>(value: T, choices: readonly [T, string][], onChange: (v: string) => void, disabled: boolean) => {
  const s = el('select', { class: 'mye-select', disabled }) as HTMLSelectElement;
  for (const [v, t] of choices) s.append(el('option', { value: String(v) }, t));
  s.value = String(value);
  s.addEventListener('change', () => onChange(s.value));
  return s;
};
const btn = (label: string, cls: string, onClick: () => void, extra: Record<string, unknown> = {}) => {
  const b = el('button', { type: 'button', class: cls, ...extra }, label);
  b.addEventListener('click', onClick);
  return b;
};

export function mayEditor(o: Options) {
  let focusKey: MayKey | null = null;
  let confirmRestore = false;
  const change = (fn: (s: MayState) => void) => { o.update(fn); o.redraw(); };
  const opt = <K extends keyof MayOptions>(k: K, v: MayOptions[K]) => change((s) => { s.options[k] = v; });

  // ---------------------------------------------------------------- Our day
  const day = () => {
    const s = o.state();
    const locked = o.locked();
    const settings = el('div', { class: 'mye-card' },
      el('p', { class: 'mye-card-title' }, 'The kind of day'),
      field('Our summer days', select(s.options.days, [['home', 'Mostly at home'], ['mixed', 'Home days and outings'], ['camp', 'Camp or scheduled programs']], (v) => opt('days', v as MayOptions['days']), locked)),
      field('How much structure', select(s.options.structure, [['relaxed', 'Relaxed: no clock, just what comes next'], ['balanced', 'Balanced: a few times, the rest by what comes before'], ['structured', 'More structured: suggested times']], (v) => opt('structure', v as MayOptions['structure']), locked),
        'Sets each block’s prepared time or trigger. Anything you’ve chosen yourself stays.'),
      field('Morning starts', select(s.options.start, [[7, '7:00 AM'], [7.5, '7:30 AM'], [8, '8:00 AM'], [8.5, '8:30 AM'], [9, '9:00 AM'], [9.5, '9:30 AM']], (v) => opt('start', Number(v)), locked)),
      field('Quiet time', select(s.options.quiet, [['independent', 'Independent play and reading'], ['rest', 'Rest or nap'], ['older', 'Independent recharge']], (v) => opt('quiet', v as MayOptions['quiet']), locked)),
      field('Favorite kind of play', select(s.options.play, [['outdoors', 'Outdoor play'], ['active', 'Sports and movement'], ['creative', 'Making and creativity'], ['mixed', 'A mix of everything']], (v) => opt('play', v as MayOptions['play']), locked)));
    // The blocks this kind of day uses, in order: name, earlier/later, on or off.
    const usable = (k: MayKey) => visibleKeys([k], { ...s.options, snack: true }).length > 0;
    const shown = s.order.filter(usable);
    const blocks = shown.map((k, i) => {
      const r = s.rows.find((x) => x.key === k);
      const on = k === 'snack' ? s.options.snack : true;
      const name = el('input', { type: 'text', class: 'mye-input', value: r?.title ?? LABELS[k], maxLength: TITLE_LIMIT, disabled: locked || !on });
      name.setAttribute('aria-label', `Name of ${LABELS[k]}`);
      name.addEventListener('change', () => change((st) => { st.edits[k] = { ...(st.edits[k] ?? {}), title: name.value.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT) }; }));
      const move = (d: -1 | 1) => change((st) => moveBlock(st, k, d, o.ctx() ?? undefined));
      const toggle = k === 'snack'
        ? btn(on ? 'Leave out' : 'Include', 'mye-text-btn', () => opt('snack', !on), { disabled: locked, 'aria-label': `${on ? 'Leave out' : 'Include'} ${LABELS[k]}` })
        : btn('Remove', 'mye-text-btn', () => change((st) => { st.order = st.order.filter((x) => x !== k); st.removed = [...st.removed, k]; }), { disabled: locked || shown.length <= 2, 'aria-label': `Remove ${LABELS[k]}` });
      return el('li', { class: `mye-block${on ? '' : ' is-off'}` }, name,
        el('span', { class: 'mye-block-actions' },
          btn('↑', 'mye-icon-btn', () => move(-1), { disabled: locked || i === 0, 'aria-label': `Move ${LABELS[k]} earlier` }),
          btn('↓', 'mye-icon-btn', () => move(1), { disabled: locked || i === shown.length - 1, 'aria-label': `Move ${LABELS[k]} later` }),
          toggle));
    });
    const removed = s.removed.filter(usable);
    const restore = confirmRestore
      ? el('div', { class: 'mye-confirm', role: 'alertdialog', 'aria-label': 'Restore the prepared rhythm' },
        el('p', {}, 'Go back to the rhythm prepared for your family? Your names, activities, times, triggers and who helps go back to the prepared ones.'),
        el('div', { class: 'mye-actions' },
          btn('Restore', 'mye-btn mye-btn--dark', () => { confirmRestore = false; o.restore(); o.redraw(); }),
          btn('Keep my changes', 'mye-btn', () => { confirmRestore = false; o.redraw(); })))
      : btn('Restore the prepared rhythm', 'mye-text-btn', () => { confirmRestore = true; o.redraw(); }, { disabled: locked });
    return el('div', { class: 'mye-section' },
      el('p', { class: 'mye-intro' }, 'A little structure, plenty of freedom. Change only what doesn’t fit your summer.'),
      settings,
      el('div', { class: 'mye-card' }, el('p', { class: 'mye-card-title' }, 'Our blocks, in order'),
        el('ul', { class: 'mye-blocks' }, ...blocks),
        ...(removed.length ? [el('p', { class: 'mye-hint' }, 'Add back:'), el('div', { class: 'mye-chips' }, ...removed.map((k) => btn(`+ ${LABELS[k]}`, 'mye-chip', () => change((st) => { st.removed = st.removed.filter((x) => x !== k); st.order = [...st.order, k]; }), { disabled: locked })))] : [])),
      restore);
  };

  // ---------------------------------------------------------------- When it happens
  const when = () => {
    const s = o.state();
    const locked = o.locked();
    const issues = mayIssues(s.rows);
    const cards = s.rows.map((r) => {
      const seg = el('div', { class: 'mye-seg', role: 'radiogroup', 'aria-label': `When ${r.title} happens` }, ...(['time', 'trigger'] as const).map((k) => {
        const b = btn(k === 'time' ? 'Time' : 'Trigger', 'mye-seg-btn', () => { if (k === 'trigger' && r.when !== 'trigger') focusKey = r.key; change((st) => setWhen(st, r.key, k)); }, { disabled: locked, role: 'radio' });
        b.setAttribute('aria-checked', String(r.when === k));
        return b;
      }));
      let control: HTMLElement;
      if (r.when === 'time') {
        const input = el('input', { type: 'time', step: '300', class: 'mye-input mye-time', value: r.time || (r.key === 'evening' ? EVENING_TIME : ''), disabled: locked });
        input.setAttribute('aria-label', `${r.title} time`);
        input.addEventListener('change', () => { if (input.value) change((st) => setTime(st, r.key, input.value)); });
        control = el('div', { class: 'mye-when-control' }, input,
          btn('No set time', 'mye-text-btn', () => change((st) => setTime(st, r.key, '')), { disabled: locked || !r.time }));
      } else if (focusKey !== r.key) {
        // Compact until she changes it: the trigger as it prints, and one button.
        control = el('div', { class: 'mye-when-control' }, el('span', { class: 'mye-current' }, `→ ${r.trigger}`),
          btn('Change', 'mye-text-btn', () => { focusKey = r.key; o.redraw(); }, { disabled: locked, 'aria-label': `Change the trigger for ${r.title}` }));
      } else {
        const custom = !TRIGGER_CHOICES.includes(r.trigger as (typeof TRIGGER_CHOICES)[number]);
        // Most likely first: the prepared one, then the block just before this one on her day, then familiar events.
        const prev = s.rows[s.rows.indexOf(r) - 1];
        const afterPrev = prev ? `After ${prev.title.replace(/\s*&.*$/, '').toLowerCase()}` : '';
        const choices = [...new Set([defaultTrigger(r.key, s.options), ...(afterPrev && afterPrev.length <= TRIGGER_LIMIT ? [afterPrev] : []), ...TRIGGER_CHOICES])].filter((t) => t !== 'When we wake up' || r.key === 'morning');
        const chips = el('div', { class: 'mye-chips', role: 'group', 'aria-label': 'Familiar events' }, ...choices.map((t) => {
          const b = btn(t, 'mye-chip', () => { focusKey = null; change((st) => setTrigger(st, r.key, t)); }, { disabled: locked });
          b.setAttribute('aria-pressed', String(r.trigger === t));
          return b;
        }));
        const words = el('input', { type: 'text', class: 'mye-input', maxLength: TRIGGER_LIMIT, value: custom ? r.trigger : '', placeholder: 'Or in your words, e.g. When the pool closes', disabled: locked });
        words.setAttribute('aria-label', `${r.title} trigger, in your words`);
        words.addEventListener('change', () => { if (words.value.trim()) change((st) => setTrigger(st, r.key, words.value)); });
        words.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); words.blur(); } });
        control = el('div', { class: 'mye-when-control mye-when-control--trigger' }, chips, words);
      }
      const notes = [
        ...issues.filter((x) => x.key === r.key).map((x) => el('p', { class: 'mye-issue' }, x.text)),
        ...(r.slot?.kind === 'trigger' && o.lines(r.slot.text) > 2 ? [el('p', { class: 'mye-issue' }, `“${r.slot.text}” needs more than two lines on the sheet. Shorten it a little.`)] : []),
        ...(r.key === 'evening' ? [el('p', { class: 'mye-hint' }, 'One flexible block: when the evening begins, not a deadline for each job in it.')] : []),
      ];
      const card = el('section', { class: `mye-card mye-when${focusKey === r.key ? ' is-focus' : ''}` },
        el('div', { class: 'mye-card-head' }, el('p', { class: 'mye-card-title' }, r.title), seg), control, ...notes);
      card.dataset.key = r.key;
      return card;
    });
    return el('div', { class: 'mye-section' },
      el('p', { class: 'mye-intro' }, 'Each block shows one thing on the sheet: a time, or the familiar event that starts it. Mix them however your days really go.'),
      ...cards);
  };

  // ---------------------------------------------------------------- Activities & responsibilities
  const jobs = () => {
    const s = o.state();
    const locked = o.locked();
    const ctx = o.ctx();
    const key = s.rows.some((r) => r.key === focusKey) ? focusKey! : s.rows[0]?.key;
    const r = s.rows.find((x) => x.key === key);
    const picker = el('div', { class: 'mye-chips', role: 'tablist', 'aria-label': 'Block' }, ...s.rows.map((x) => {
      const b = btn(x.title, 'mye-chip', () => { focusKey = x.key; o.redraw(); }, { role: 'tab' });
      b.setAttribute('aria-selected', String(x.key === key));
      b.setAttribute('aria-pressed', String(x.key === key));
      return b;
    }));
    if (!r) return el('div', { class: 'mye-section' }, picker);
    const desc = el('input', { type: 'text', class: 'mye-input', value: r.desc, maxLength: DESC_LIMIT, disabled: locked });
    desc.setAttribute('aria-label', `${r.title} activities`);
    desc.addEventListener('change', () => change((st) => { st.edits[r.key] = { ...(st.edits[r.key] ?? {}), desc: desc.value.replace(/\s+/g, ' ').trim().slice(0, DESC_LIMIT) }; }));
    const all = ctx ? mayParts(ctx, s.parts).filter((p) => p.block === r.key) : [];
    const edit = (fn: (st: MayState) => void) => change((st) => { st.parts ??= {}; fn(st); });
    const owners = ctx && all.length
      ? taskEditor({ ctx, tasks: all, rules: partRules, locked,
        onOwners: (id, person, cur) => edit((st) => toggleTaskOwner(st.parts!, id, cur, person)),
        onTitle: (id, title) => edit((st) => setTaskTitle(st.parts!, id, title, all.find((t) => t.id === id)?.title ?? title)),
        onSkip: (id, skip) => edit((st) => setTaskSkip(st.parts!, id, skip)),
        onReset: (id) => edit((st) => resetTask(st.parts!, id)) })
      : el('p', { class: 'mye-hint' }, 'No family jobs here. That’s fine: it’s time to play, rest or explore.');
    return el('div', { class: 'mye-section' },
      el('p', { class: 'mye-intro' }, 'Choose a block. Its activities are ideas kids can pick from; the family’s jobs are the few things that keep the day running.'),
      picker,
      el('div', { class: 'mye-card' }, el('p', { class: 'mye-card-title' }, r.title),
        field('Activities', desc, 'A few ideas, separated by “·”.'),
        el('p', { class: 'mye-label' }, 'Who helps'), owners));
  };

  return {
    section(name: MaySection) { return name === 'day' ? day() : name === 'when' ? when() : jobs(); },
    /** Open at one block (the "When it happens" card, or its activities). */
    focus(key?: MayKey) { focusKey = key ?? null; confirmRestore = false; },
    keys: MAY_KEYS,
  };
}
export type MayEditor = ReturnType<typeof mayEditor>;

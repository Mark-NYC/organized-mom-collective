/**
 * The routine chart's behavior, for every page that shows it (src/components/site/RoutineChart.astro): the free chart
 * at /routine-chart, the buyers' chart (ROUTINE_PLUS_PATH) and the Organized Family Club's (/club/tools/routine-chart).
 * One implementation: improve it here and every entry point gets it.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the chart for someone, e.g. a Club child. It gets its own
 * saved chart (the storage key plus `handoff.key`); a first chart starts from `handoff.variant` with `handoff.name`
 * in the title, and the picker puts jobs suited to `handoff.age` first. Without one, nothing changes.
 */
import { toolPalettes, resolveToolPalette } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { autosave, downloadPng } from '../../lib/printable';
import { matchResponsibility, responsibilityById, responsibilityColor, responsibilityImage } from '../../data/responsibilities';
import { routineTypes, type RoutineType } from '../../data/routines';
import type { ToolHandoff } from '../../lib/tool-handoff';
import { hasSaved, orderPickerForAge } from './tool-handoff-ui';

export function initRoutineChart(host: HTMLElement, handoff?: ToolHandoff | null) {
  const types: Record<string, RoutineType> = routineTypes;
  const sheet = host.querySelector<HTMLElement>('.mr-sheet')!;
  const notes = host.hasAttribute('data-mr-notes');
  const advanced=host.querySelector<HTMLElement>('[data-mr-advanced]')!;
  const ideas=host.querySelector<HTMLElement>('.mr-ideas')!;
  host.querySelector<HTMLButtonElement>('[data-mr-customize]')?.addEventListener('click',e=>{
    const button=e.currentTarget as HTMLButtonElement;
    const open=advanced.classList.toggle('mr-advanced-open');
    ideas.classList.toggle('mr-ideas-open',open);
    button.setAttribute('aria-expanded',String(open));
  });
  const toolId = notes ? 'routine-chart-plus' : 'routine-chart';
  let firstAction = false;
  const action = () => { if (!firstAction) { firstAction = true; toolEvent('tool_first_action', toolId); } };
  const typeField = sheet.querySelector<HTMLInputElement>('[data-mr-type-field]')!;
  const chips = host.querySelector<HTMLElement>('[data-mr-chips]')!;
  const field = (name: string) => sheet.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
  const rows = sheet.querySelectorAll('[data-mr-step]').length;
  const stepFields = Array.from(sheet.querySelectorAll<HTMLInputElement>('[data-mr-step]'));
  const iconFields = Array.from(sheet.querySelectorAll<HTMLInputElement>('[data-mr-icon-field]'));
  const iconSlots = Array.from(sheet.querySelectorAll<HTMLElement>('[data-mr-icon]'));
  const picker = host.querySelector<HTMLElement>('[data-rp]')!;
  const pickerStatus = picker.querySelector<HTMLElement>('[data-rp-status]')!;

  function renderIcons() {
    let any = false;
    iconSlots.forEach((slot, i) => {
      const r = responsibilityById(iconFields[i].value);
      const src = r ? responsibilityImage(r, 256) : null;
      const img = slot.querySelector('img')!;
      slot.toggleAttribute('data-on', !!src);
      if (r && src) {
        any = true;
        if (img.getAttribute('src') !== src) img.src = src;
        slot.style.setProperty('--mr-cat', responsibilityColor(r));
      } else img.removeAttribute('src');
    });
    sheet.classList.toggle('mr-has-icons', any);
  }
  /** A step line that means a library job gets its illustration; an emptied line loses it. */
  function syncIcon(i: number) {
    const text = stepFields[i].value.trim();
    if (!text) iconFields[i].value = '';
    else iconFields[i].value = matchResponsibility(text) ?? iconFields[i].value;
  }

  const paletteField = field('palette');
  const paletteButtons = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-mr-palette]'));
  function renderPalette() {
    const id = resolveToolPalette(paletteField.value);
    paletteField.value = id;
    toolPalettes[id].colors.forEach((color, i) => sheet.style.setProperty(`--mr-accent-${i + 1}`, color));
    paletteButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mrPalette === id)));
  }
  function renderType() {
    renderPalette();
    renderIcons();
    const id = types[typeField.value] ? typeField.value : 'morning';
    picker.dataset.rpRoutine = id;
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-mr-type]')) b.setAttribute('aria-pressed', String(b.dataset.mrType === id));
    chips.replaceChildren(
      ...types[id].ideas.map((idea) => {
        const chip = Object.assign(document.createElement('button'), { type: 'button', className: 'mr-chip', textContent: `+ ${idea}` });
        chip.dataset.idea = idea;
        return chip;
      }),
    );
  }

  // Charts saved before illustrations existed pick them up for lines that match a library job.
  // A handoff (another page on the site opening this chart for someone, e.g. a Club child) gets its own saved chart.
  const storageKey = handoff ? `${host.dataset.mrKey!}:${handoff.key}` : host.dataset.mrKey!;
  const fresh = !hasSaved(storageKey);
  const save = autosave(sheet, storageKey, () => {
    stepFields.forEach((_, i) => { if (!iconFields[i].value) syncIcon(i); });
    renderType();
  });

  for (const button of paletteButtons) button.addEventListener('click', () => {
    paletteField.value = button.dataset.mrPalette!;
    renderPalette();
    save();
  });

  function load(id: string, quiet = false) {
    const t = types[id];
    typeField.value = id;
    if (!quiet) {
      action();
      toolEvent('tool_start', toolId);
    }
    field('title').value = t.title;
    field('subtitle').value = t.subtitle;
    for (let i = 0; i < rows; i++) {
      field(`time-${i}`).value = t.steps[i]?.[0] ?? '';
      field(`step-${i}`).value = t.steps[i]?.[1] ?? '';
      if (notes) field(`note-${i}`).value = t.steps[i]?.[2] ?? '';
      iconFields[i].value = '';
      syncIcon(i);
    }
    field('end-label').value = t.endLabel;
    field('end-time').value = t.endTime;
    renderType();
    save();
  }

  // Opened for someone: their first chart starts from the chosen routine with their name on it, and the picker
  // puts the jobs suited to their age first. Their saved chart is never replaced.
  if (handoff) {
    if (fresh) {
      const id = handoff.variant && types[handoff.variant] ? handoff.variant : typeField.value || 'morning';
      load(id, true);
      if (handoff.name) field('title').value = `${handoff.name}’s ${types[id].title}`;
      save();
    }
    if (handoff.age !== undefined) orderPickerForAge(picker, handoff.age, handoff.name);
  }

  /** True once the sheet differs from the current type's starter routine. */
  const edited = () => {
    const t = types[typeField.value] ?? types.morning;
    if (field('title').value !== t.title || field('subtitle').value !== t.subtitle) return true;
    if (field('end-label').value !== t.endLabel || field('end-time').value !== t.endTime) return true;
    return Array.from({ length: rows }, (_, i) => i).some(
      (i) =>
        field(`time-${i}`).value !== (t.steps[i]?.[0] ?? '') ||
        field(`step-${i}`).value !== (t.steps[i]?.[1] ?? '') ||
        (notes && field(`note-${i}`).value !== (t.steps[i]?.[2] ?? '')),
    );
  };

  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-mr-type]')) {
    b.addEventListener('click', () => {
      if (b.dataset.mrType === typeField.value) return;
      if (edited() && !confirm('Switch routines? Your changes to this chart will be replaced.')) return;
      load(b.dataset.mrType!);
    });
  }

  // Suggestion chips fill the next empty step.
  chips.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-idea]');
    if (!chip) return;
    const empty = Array.from(sheet.querySelectorAll<HTMLInputElement>('[data-mr-step]')).find((el) => !el.value.trim());
    if (!empty) {
      alert('The chart is full. Clear a step first.');
      return;
    }
    empty.value = chip.dataset.idea!;
    syncIcon(stepFields.indexOf(empty));
    renderIcons();
    action();
    save();
  });

  // Library tiles fill the next empty step with the job's title and illustration.
  picker.addEventListener('rp:pick', (e) => {
    const r = responsibilityById((e as CustomEvent<{ id: string }>).detail.id);
    if (!r) return;
    const i = stepFields.findIndex((el) => !el.value.trim());
    if (i < 0) {
      pickerStatus.textContent = 'The chart is full. Clear a step first, then tap again.';
      return;
    }
    stepFields[i].value = r.title;
    iconFields[i].value = r.id;
    renderIcons();
    action();
    save();
    pickerStatus.textContent = `Added “${r.title}” as step ${i + 1}.`;
  });

  // Typing a line that matches a library job adds its illustration; clearing a line removes it.
  sheet.addEventListener('input', (e) => {
    const i = stepFields.indexOf(e.target as HTMLInputElement);
    if (i < 0) return;
    const before = iconFields[i].value;
    syncIcon(i);
    if (iconFields[i].value !== before) { renderIcons(); save(); }
  });

  // Arrows swap a step (with its note and illustration) with its neighbor; the times stay in order.
  sheet.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mr-move]');
    if (!b) return;
    const i = stepFields.indexOf(b.closest('.mr-step')!.querySelector<HTMLInputElement>('[data-mr-step]')!);
    const j = i + Number(b.dataset.mrMove);
    if (j < 0 || j >= rows) return;
    const keys = ['step', 'icon', ...(notes ? ['note'] : [])];
    for (const k of keys) {
      const a = field(`${k}-${i}`), c = field(`${k}-${j}`);
      [a.value, c.value] = [c.value, a.value];
    }
    renderIcons();
    action();
    save();
    sheet.querySelectorAll<HTMLButtonElement>(`[data-mr-move="${b.dataset.mrMove}"]`)[j]?.focus();
  });

  host.querySelector('[data-mr-reset]')!.addEventListener('click', () => {
    if (!confirm('Reset this chart to the starter routine?')) return;
    load(types[typeField.value] ? typeField.value : 'morning');
  });

  /** 07:45 → 7:45 AM */
  const twelveHour = (v: string) => {
    if (!v) return '';
    const [h, m] = v.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };

  const button = host.querySelector<HTMLButtonElement>('[data-mr-download]')!;
  button.addEventListener('click', async () => {
    toolEvent('tool_download_click', toolId);
    // Time pickers would print their --:-- hint and clock icon: show plain 12-hour text while capturing.
    const times = Array.from(sheet.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    const values = times.map((el) => el.value);
    times.forEach((el) => {
      el.type = 'text';
      el.value = twelveHour(el.value);
    });
    // Empty notes would print their "Add a reminder" hint: drop hints while capturing.
    const hinted = Array.from(sheet.querySelectorAll<HTMLInputElement>('[placeholder]'));
    hinted.forEach((el) => el.removeAttribute('placeholder'));
    const name = field('title').value.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
    try {
      await downloadPng(sheet, {
        filename: `${name || 'routine'}.png`,
        width: 816,
        height: 1056,
        layoutHost: host,
        exportClass: 'mr-exporting',
        button,
      });
    } finally {
      hinted.forEach((el) => (el.placeholder = 'Add a reminder'));
      times.forEach((el, i) => {
        el.type = 'time';
        el.value = values[i];
      });
    }
  });
}

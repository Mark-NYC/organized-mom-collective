/**
 * The chore chart's behavior, for every page that shows it (src/components/site/ChoreChart.astro): the free chart at
 * /chore-chart and the Organized Family Club's (/club/tools/chore-chart). One implementation: improve it here and
 * every entry point gets it.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the chart for someone, e.g. a Club child. It gets its own
 * saved chart (the storage key plus `handoff.key`); a first chart starts with `handoff.name` and the chores for
 * `handoff.age`'s group (`variant: 'one-job'`: one job for that age, or a grown-up's), and the picker puts jobs
 * suited to that age first. Without one, nothing changes.
 */
import { toolPalettes, resolveToolPalette } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { autosave, clearFields, downloadPng } from '../../lib/printable';
import { adultOneJob, choreSets, ageGroupFor, oneJobs, type AgeGroup, type ChoreSet } from '../../data/chore-chart';
import { matchResponsibility, responsibilityById, responsibilityColor, responsibilityImage } from '../../data/responsibilities';
import type { ToolHandoff } from '../../lib/tool-handoff';
import { hasSaved, orderPickerForAge } from './tool-handoff-ui';

export function initChoreChart(host: HTMLElement, handoff?: ToolHandoff | null) {
  const sets: Record<AgeGroup, ChoreSet> = choreSets;
  const sheet = host.querySelector<HTMLElement>('.cc-sheet')!;
  const form = host.querySelector<HTMLFormElement>('[data-cc-form]')!;
  const nameInput = host.querySelector<HTMLInputElement>('[data-cc-name]')!;
  const ageSelect = host.querySelector<HTMLSelectElement>('[data-cc-age]')!;
  const ageField = sheet.querySelector<HTMLInputElement>('[data-cc-age-field]')!;
  const ageBadge = sheet.querySelector<HTMLElement>('[data-cc-age-badge]')!;
  const forLine = sheet.querySelector<HTMLElement>('[data-cc-for]')!;
  const status = host.querySelector<HTMLElement>('[data-cc-hint]')!;
  const advanced = host.querySelector<HTMLElement>('[data-cc-advanced]')!;
  host.querySelector<HTMLButtonElement>('[data-cc-customize]')?.addEventListener('click', e => {
    const button=e.currentTarget as HTMLButtonElement;
    const open=advanced.classList.toggle('cc-advanced-open');
    button.setAttribute('aria-expanded',String(open));
  });
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'chore-chart'); }
  };
  const field = (name: string) => sheet.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;

  // Illustrations: each chore row (8 daily, then 7 weekly) has a hidden id field and an icon.
  const rowFields = Array.from(sheet.querySelectorAll<HTMLInputElement>('[data-cc-row]'));
  const iconFields = Array.from(sheet.querySelectorAll<HTMLInputElement>('[data-cc-icon-field]'));
  const iconImgs = Array.from(sheet.querySelectorAll<HTMLImageElement>('[data-cc-icon]'));
  const picker = host.querySelector<HTMLElement>('[data-rp]')!;
  const pickerStatus = picker.querySelector<HTMLElement>('[data-rp-status]')!;
  const target = host.querySelector<HTMLSelectElement>('[data-cc-target]')!;
  function renderIcons() {
    iconImgs.forEach((img, i) => {
      const r = responsibilityById(iconFields[i].value);
      const src = r ? responsibilityImage(r, 256) : null;
      img.hidden = !src;
      if (r && src) {
        if (img.getAttribute('src') !== src) img.src = src;
        img.style.setProperty('--cc-cat', responsibilityColor(r));
      } else img.removeAttribute('src');
    });
  }
  /** A row that means a library job gets its illustration; an emptied row loses it. */
  function syncIcon(i: number) {
    const text = rowFields[i].value.trim();
    if (!text) iconFields[i].value = '';
    else iconFields[i].value = matchResponsibility(text) ?? iconFields[i].value;
  }
  const syncAllIcons = (reset = false) => rowFields.forEach((_, i) => { if (reset || !iconFields[i].value) { if (reset) iconFields[i].value = ''; syncIcon(i); } });

  // The name is typed in the form but saved with the sheet (autosave reads [data-field] inside one root).
  const savedName = sheet.querySelector<HTMLInputElement>('[data-cc-name-field]')!;

  const paletteField = field('palette');
  const paletteButtons = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-cc-palette]'));
  function renderPalette() {
    const id = resolveToolPalette(paletteField.value);
    paletteField.value = id;
    toolPalettes[id].colors.forEach((color, i) => sheet.style.setProperty(`--cc-accent-${i + 1}`, color));
    paletteButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ccPalette === id)));
  }
  function render() {
    renderPalette();
    renderIcons();
    const name = nameInput.value.trim();
    forLine.textContent = name ? `${name}’s` : '';
    const set = sets[ageField.value as AgeGroup];
    ageSelect.value = set ? ageField.value : '';
    ageBadge.hidden = !set;
    ageBadge.textContent = set ? set.label.replace(/\s*\(.*\)/, '') : '';
    const hasChores = Array.from(sheet.querySelectorAll<HTMLInputElement>('.cc-chore')).some(el => el.value.trim());
    status.textContent = hasChores
      ? `${name ? name + '’s' : 'Your'} chart is taking shape. Edit any job or reward, then download when ready.`
      : set
        ? `Great choice. Use the suggested jobs for ${set.label}, or adjust the chart to fit your family.`
        : 'Start with a name and age. Your chart will fill in with suggested jobs.';
  }

  // A handoff (another page opening this chart for someone, e.g. a Club child) gets its own saved chart.
  const storageKey = handoff ? `${host.dataset.ccKey!}:${handoff.key}` : host.dataset.ccKey!;
  const fresh = !hasSaved(storageKey);
  const save = autosave(sheet, storageKey, () => {
    nameInput.value = savedName.value;
    syncAllIcons();
    render();
  });

  for (const button of paletteButtons) {
    button.addEventListener('click', () => {
      paletteField.value = button.dataset.ccPalette!;
      renderPalette();
      save();
    });
  }

  nameInput.addEventListener('input', () => {
    started();
    savedName.value = nameInput.value;
    render();
    save();
  });

  const choreFields = () => Array.from(sheet.querySelectorAll<HTMLInputElement>('.cc-chore, .cc-reward-text'));
  function fillSuggestedChores(askBeforeReplacing: boolean, quiet = false) {
    const set = sets[ageSelect.value as AgeGroup];
    if (!set) return false;
    if (askBeforeReplacing && choreFields().some(el => el.value.trim()) &&
        !confirm('Replace the chores on the chart with the ones for this age?')) return false;
    sheet.querySelectorAll<HTMLInputElement>('[data-field^="daily-"][data-cc-row]').forEach((el, i) => (el.value = set.daily[i] ?? ''));
    WEEKLY_FIELD_KEYS.forEach((key,i) => (field(key).value = set.weekly[i] ?? ''));
    set.rewards.forEach((reward, i) => (field(`reward-${i}`).value = reward));
    syncAllIcons(true);
    ageField.value = ageSelect.value;
    if (!quiet) {
      started();
      toolEvent('tool_start', 'chore-chart');
    }
    render();
    save();
    return true;
  }
  // "Start with one job": one job they can own start to finish, everything else left blank to add later (no rewards
  // either: the family decides). `job` is a grown-up's, who has no age group.
  function fillOneJob(askBeforeReplacing: boolean, quiet = false, job?: string) {
    const text = job ?? oneJobs[ageSelect.value as AgeGroup];
    if (!text) return false;
    if (askBeforeReplacing && choreFields().some(el => el.value.trim()) &&
        !confirm('Start over with one job? The chores on the chart will be cleared.')) return false;
    choreFields().forEach((el) => (el.value = ''));
    field('daily-0').value = text;
    syncAllIcons(true);
    ageField.value = job ? '' : ageSelect.value;
    if (!quiet) {
      started();
      toolEvent('tool_start', 'chore-chart');
    }
    render();
    save();
    status.textContent = `One job to start: ${text}. Add more when this one sticks.`;
    return true;
  }
  host.querySelector<HTMLButtonElement>('[data-cc-one-job]')?.addEventListener('click', () => {
    if (!sets[ageSelect.value as AgeGroup]) {
      status.textContent = 'Choose an age group first, and we’ll suggest one job that fits.';
      ageSelect.focus();
      return;
    }
    if (fillOneJob(true)) sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const DAILY = sheet.querySelectorAll('[data-field^="daily-"][data-cc-row]').length;
  const WEEKLY_FIELD_KEYS = ['weekly-0','weekly-1','weekly-2','weekly-3','weekly-4','weekly-5','weekly-6'];
  ageSelect.addEventListener('change', () => {
    if (!sets[ageSelect.value as AgeGroup]) return;
    // First selection gives an immediate useful chart. Never silently replace custom work.
    if (!choreFields().some(el => el.value.trim())) fillSuggestedChores(false);
    else {
      const set = sets[ageSelect.value as AgeGroup];
      status.textContent = `Suggested jobs for ${set.label} are ready. Select “Use suggested chores” to replace your existing jobs.`;
    }
  });
  sheet.addEventListener('input', (e) => {
    const i = rowFields.indexOf(e.target as HTMLInputElement);
    if (i >= 0) {
      const before = iconFields[i].value;
      syncIcon(i);
      if (iconFields[i].value !== before) save();
    }
    render();
  });

  // Library tiles: "Daily chores" fills the next empty daily row; a weekday fills that day's row.
  picker.addEventListener('rp:pick', (e) => {
    const r = responsibilityById((e as CustomEvent<{ id: string }>).detail.id);
    if (!r) return;
    let i: number;
    if (target.value === 'daily') {
      i = rowFields.slice(0, DAILY).findIndex((el) => !el.value.trim());
      if (i < 0) { pickerStatus.textContent = 'Daily chores are full. Clear a row first, or add it to a weekday.'; return; }
    } else {
      i = DAILY + Number(target.value);
      const current = rowFields[i].value.trim();
      if (current && current !== r.title && !confirm(`Replace “${current}” with “${r.title}”?`)) return;
    }
    rowFields[i].value = r.title;
    iconFields[i].value = r.id;
    started();
    render();
    save();
    pickerStatus.textContent = `Added “${r.title}” to ${target.value === 'daily' ? 'daily chores' : target.selectedOptions[0].text}.`;
  });

  // Opened for someone: their first chart starts with their name and the chores for their age group (or, with
  // `variant: 'one-job'`, one job for their age, or a grown-up's job when there's no age), and the picker puts the
  // jobs suited to their age first. Their saved chart is never replaced.
  if (handoff) {
    if (fresh) {
      if (handoff.name) nameInput.value = savedName.value = handoff.name;
      const group = handoff.age !== undefined ? ageGroupFor(handoff.age) : null;
      if (group) ageSelect.value = group;
      // No name and no age ("someone else"): the chart opens blank, as for any visitor.
      if (handoff.variant === 'one-job' && (group || handoff.name)) {
        fillOneJob(false, true, group ? undefined : adultOneJob);
      } else if (group) {
        fillSuggestedChores(false, true);
      } else {
        render();
        save();
      }
    }
    if (handoff.age !== undefined) orderPickerForAge(picker, handoff.age, handoff.name);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!sets[ageSelect.value as AgeGroup]) { ageSelect.focus(); return; }
    if (!fillSuggestedChores(true)) return;
    sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  host.querySelector('[data-cc-clear]')!.addEventListener('click', () => {
    if (!confirm('Clear everything on this chart?')) return;
    const selectedPalette = paletteField.value;
    clearFields(sheet);
    paletteField.value = selectedPalette;
    nameInput.value = '';
    render();
    save();
  });

  const button = host.querySelector<HTMLButtonElement>('[data-cc-download]')!;
  button.addEventListener('click', async () => {
    toolEvent('tool_download_click', 'chore-chart');
    // The PNG would print an empty reward's "Reward" hint as if it were filled in: drop hints while capturing.
    const hinted = Array.from(sheet.querySelectorAll<HTMLInputElement>('[placeholder]'));
    hinted.forEach((el) => el.removeAttribute('placeholder'));
    const name = nameInput.value.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
    await downloadPng(sheet, {
      filename: `${name ? `${name}-` : ''}chore-chart.png`,
      width: 1056,
      height: 816,
      layoutHost: sheet.closest<HTMLElement>('.chore-chart-container')!,
      exportClass: 'cc-exporting',
      button,
    });
    hinted.forEach((el) => (el.placeholder = 'Reward'));
  });
}

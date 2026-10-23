/**
 * The screen time tool's behavior, for every page that shows it (src/components/site/ScreenTimeContract.astro): the
 * free /screen-time-contract and the Club's /club/tools/screen-time. One implementation: improve it here and both get it.
 *
 * Two formats on one sheet (the earn-it contract and the family agreement), switched above it; the sheet remembers
 * which. The agreement's starter wording follows an age band; choosing another band rewrites the agreement only if
 * she hasn't changed it (otherwise it asks). Reset puts the current format's starter text back.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening it for someone, e.g. a Club child. Their own saved sheet
 * (the storage key plus `handoff.key`); a first visit opens in `handoff.variant`'s format with their name and the
 * wording for `handoff.age`.
 */
import { autosave, downloadPng, fieldsIn } from '../../lib/printable';
import { toolEvent } from '../../lib/tool-engagement';
import { screenAgeFor, screenStarters, type ScreenAge } from '../../data/screen-time';
import type { ToolHandoff } from '../../lib/tool-handoff';
import { hasSaved } from './tool-handoff-ui';

type Format = 'earn' | 'agreement';

export function initScreenTime(host: HTMLElement, handoff?: ToolHandoff | null) {
  const sheet = host.querySelector<HTMLElement>('[data-st-sheet]')!;
  const field = (name: string) => sheet.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
  const formatField = sheet.querySelector<HTMLInputElement>('[data-st-format-field]')!;
  const ageField = sheet.querySelector<HTMLInputElement>('[data-st-age-field]')!;
  const minutes = sheet.querySelector<HTMLInputElement>('[data-st-minutes]')!;
  const toolId = handoff ? 'screen-time-club' : 'screen-time';
  const storageKey = handoff ? `${host.dataset.stKey!}:${handoff.key}` : host.dataset.stKey!;
  const fresh = !hasSaved(storageKey);
  const start = (host.dataset.stStart === 'agreement' ? 'agreement' : 'earn') as Format;

  const format = (): Format => (formatField.value === 'agreement' ? 'agreement' : formatField.value === 'earn' ? 'earn' : start);
  const age = (): ScreenAge => (['young', 'school', 'teen'].includes(ageField.value) ? (ageField.value as ScreenAge) : 'school');
  const agreementFields = () => fieldsIn(sheet).filter((el) => el.dataset.field!.startsWith('a-'));

  const syncMinutes = () => {
    const n = minutes.value.trim() || '30';
    sheet.querySelectorAll('[data-st-slot-min]').forEach((el) => (el.textContent = n));
  };
  function render() {
    const f = format();
    sheet.dataset.stFormat = f;
    for (const el of host.querySelectorAll<HTMLElement>('[data-st-only]')) el.hidden = el.dataset.stOnly !== f;
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-st-format-btn]')) b.setAttribute('aria-pressed', String(b.dataset.stFormatBtn === f));
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-st-age]')) b.setAttribute('aria-pressed', String(b.dataset.stAge === age()));
    const amount = sheet.querySelector<HTMLInputElement>('[data-st-amount]')!;
    amount.placeholder = screenStarters[age()].amountHint;
    syncMinutes();
  }

  /** The agreement's starter wording for an age (the "How much" blank and the check-in date stay hers). */
  const starterValues = (a: ScreenAge): Record<string, string> => {
    const s = screenStarters[a];
    const out: Record<string, string> = { 'a-weekday': s.weekday, 'a-weekend': s.weekend };
    s.before.forEach((t, i) => (out[`a-before-${i}`] = t));
    s.where.forEach((t, i) => (out[`a-where-${i}`] = t));
    s.end.forEach((t, i) => (out[`a-end-${i}`] = t));
    s.adults.forEach((t, i) => (out[`a-adult-${i}`] = t));
    return out;
  };
  const agreementEdited = () => {
    const want = starterValues(age());
    return agreementFields().some((el) => el.dataset.field! in want && el.value !== want[el.dataset.field!]);
  };
  const applyAge = (a: ScreenAge) => {
    ageField.value = a;
    const want = starterValues(a);
    for (const el of agreementFields()) if (el.dataset.field! in want) el.value = want[el.dataset.field!];
  };

  const save = autosave(sheet, storageKey, render);
  if (fresh) {
    formatField.value = handoff?.variant === 'agreement' || handoff?.variant === 'earn' ? handoff.variant : start;
    if (handoff?.age !== undefined) applyAge(screenAgeFor(handoff.age));
    if (handoff?.name) field('name').value = handoff.name;
    render();
    save();
  }
  minutes.addEventListener('input', syncMinutes);

  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-st-format-btn]')) {
    b.addEventListener('click', () => {
      formatField.value = b.dataset.stFormatBtn!;
      render();
      save();
    });
  }
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-st-age]')) {
    b.addEventListener('click', () => {
      const a = b.dataset.stAge as ScreenAge;
      if (a === age()) return;
      if (agreementEdited() && !confirm('Use the starter wording for this age? Your changes to the agreement will be replaced.')) return;
      applyAge(a);
      toolEvent('tool_first_action', toolId);
      render();
      save();
    });
  }

  // Suggestion chips fill the next empty line of their list.
  for (const chip of host.querySelectorAll<HTMLButtonElement>('[data-st-add]')) {
    chip.addEventListener('click', () => {
      const slots = Array.from(sheet.querySelectorAll<HTMLInputElement>(`[data-st-slot="${chip.dataset.stAdd}"]`));
      const empty = slots.find((el) => !el.value.trim());
      if (!empty) {
        alert('That list is full. Clear a line on the sheet first.');
        return;
      }
      empty.value = chip.dataset.idea!;
      save();
    });
  }

  // Reset puts the current format's starter text back (each field's value attribute, or the age's wording).
  host.querySelector('[data-st-reset]')!.addEventListener('click', () => {
    if (format() === 'agreement') {
      if (!confirm('Reset the agreement to the starter wording?')) return;
      applyAge(age());
      for (const el of agreementFields()) if (el.dataset.field === 'a-amount' || el.dataset.field === 'a-review') el.value = '';
    } else {
      if (!confirm('Reset the contract to the starter jobs and activities?')) return;
      for (const el of fieldsIn(sheet)) if (!el.dataset.field!.startsWith('a-') && el.type !== 'hidden') el.value = el.defaultValue;
    }
    render();
    save();
  });

  const button = host.querySelector<HTMLButtonElement>('[data-st-download]')!;
  button.addEventListener('click', async () => {
    toolEvent('tool_download_click', toolId);
    // The PNG would print placeholder hints as if they'd been filled in: drop them while capturing.
    const hinted = Array.from(sheet.querySelectorAll<HTMLInputElement>('[placeholder]'));
    const hints = hinted.map((el) => el.placeholder);
    hinted.forEach((el) => el.removeAttribute('placeholder'));
    const name = field('name').value.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
    try {
      await downloadPng(sheet, {
        filename: `${name ? `${name}-` : ''}screen-time-${format() === 'agreement' ? 'agreement' : 'contract'}.png`,
        width: 816,
        height: 1056,
        layoutHost: host,
        exportClass: 'st-exporting',
        button,
      });
    } finally {
      hinted.forEach((el, i) => (el.placeholder = hints[i]));
    }
  });
}

/**
 * What every site tool does the same way when another page opens it for someone (src/lib/tool-handoff.ts): know
 * whether that person already has a saved copy, and put the picture jobs suited to their age first in the
 * responsibility picker (ResponsibilityPicker.astro). Used by routine-chart.ts and chore-chart.ts.
 */

/** True when this browser already holds a saved copy under `key` (blocked storage: false). */
export const hasSaved = (key: string) => {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};

/** Jobs for older children move to the end of the picker (dimmed), and its hint says why. */
export function orderPickerForAge(picker: HTMLElement, age: number, name?: string) {
  for (const li of picker.querySelectorAll<HTMLElement>('[data-rp-min]')) li.toggleAttribute('data-rp-later', Number(li.dataset.rpMin) > age);
  const hint = picker.querySelector<HTMLElement>('.rp-hint');
  if (hint) hint.textContent = `Jobs suited to ${name ?? 'your child'} (age ${age}) come first. ${hint.textContent ?? ''}`.trim();
}

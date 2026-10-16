import { requireToolEmail } from './tool-email';

/**
 * Shared browser code for the fill-in printables (/planner, /pantry): every `[data-field]` input inside
 * a root element autosaves to one localStorage key, can be cleared, and the root exports as a PNG.
 */
type Field = HTMLInputElement | HTMLTextAreaElement;
type Values = Record<string, string | boolean>;

const isCheckbox = (el: Field): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'checkbox';

export const fieldsIn = (root: HTMLElement) => Array.from(root.querySelectorAll<Field>('[data-field]'));

/** Restores saved values, then saves on every edit. Storage blocked (private browsing): works, isn't remembered. */
export function autosave(root: HTMLElement, key: string, onRestore?: () => void) {
  let saved: Values = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? '{}');
  } catch {
    saved = {};
  }
  for (const el of fieldsIn(root)) {
    const v = saved[el.dataset.field!];
    if (v === undefined) continue;
    if (isCheckbox(el)) el.checked = v === true;
    else el.value = String(v);
  }
  onRestore?.();

  const save = () => {
    const data: Values = {};
    for (const el of fieldsIn(root)) data[el.dataset.field!] = isCheckbox(el) ? el.checked : el.value;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Not saved; the page still works for this visit.
    }
  };
  root.addEventListener('input', save);
  root.addEventListener('change', save);
  return save;
}

export function clearFields(root: HTMLElement) {
  for (const el of fieldsIn(root)) {
    if (isCheckbox(el)) el.checked = false;
    else el.value = '';
  }
}

/**
 * Downloads `root` as a PNG at a fixed layout width, whatever the screen size. `exportClass` goes on
 * `layoutHost` during the capture so its CSS can switch off the mobile layout. html-to-image (loaded on
 * demand) draws a copy of the page in the browser itself, so fonts, gradients and line breaks match the screen.
 */
export async function downloadPng(
  root: HTMLElement,
  opts: { filename: string; width: number; height?: number; layoutHost: HTMLElement; exportClass: string; button: HTMLButtonElement },
) {
  if (!await requireToolEmail()) return;
  const { button, layoutHost, exportClass, width } = opts;
  const label = button.textContent;
  const dates = fieldsIn(root).filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'date');
  const dateValues = dates.map((el) => el.value);
  button.disabled = true;
  button.textContent = 'Preparing…';
  layoutHost.classList.add(exportClass);
  root.style.width = root.style.minWidth = root.style.maxWidth = `${width}px`;
  // The copy keeps computed margins: a centered root (margin: auto) would be shifted right and cut off.
  root.style.margin = '0';
  try {
    // The copy keeps typed text but not ticks: mirror them as attributes.
    for (const el of fieldsIn(root)) if (isCheckbox(el)) el.toggleAttribute('checked', el.checked);
    // Date pickers would print their mm/dd/yyyy hint and calendar icon: show plain text while capturing.
    for (const el of dates) {
      const [y, m, d] = el.value.split('-');
      el.type = 'text';
      el.value = y ? `${Number(m)}/${Number(d)}/${y}` : '';
    }
    // Illustrations added just now may still be loading: wait so the PNG never has a blank icon.
    await Promise.all(Array.from(root.querySelectorAll('img')).map((img) => (img.complete ? null : img.decode().catch(() => null))));
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(root, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width,
      height: opts.height ?? root.offsetHeight,
      // An empty icon slot (<img> without src) would fail the whole capture: leave it out of the copy.
      filter: (node) => !(node instanceof HTMLImageElement && !node.getAttribute('src')),
    });
    const link = document.createElement('a');
    link.download = opts.filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('PNG export failed', error);
    alert('Sorry, the download didn’t work. Please try again.');
  } finally {
    dates.forEach((el, i) => {
      el.type = 'date';
      el.value = dateValues[i];
    });
    layoutHost.classList.remove(exportClass);
    root.style.width = root.style.minWidth = root.style.maxWidth = '';
    root.style.margin = '';
    button.disabled = false;
    button.textContent = label;
  }
}

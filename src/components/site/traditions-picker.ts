/**
 * The Family Christmas Traditions Picker's behavior, for every page that shows it (src/components/site/
 * TraditionsPicker.astro). One implementation: improve it here and every entry point gets it.
 *
 * Three suggestions show straight away (src/data/christmas-traditions.ts picks them from her answers, defaults for
 * any she skips). She ticks the ones she'll keep, swaps the others, and downloads or copies her picks. Everything
 * saves in this browser.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the picker for a family, e.g. a Club kit. It gets its own
 * saved picks (the storage key plus `handoff.key`); the first visit starts with `handoff.ages` (the children's real
 * ages) and `handoff.name` (the family's name) on the printout. Without one, nothing is prefilled.
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import {
  ageOptions, costLabel, defaultPrefs, kidBand, pickTraditions, swapTradition, traditionById, traditionsText,
  type Tradition, type TraditionPrefs,
} from '../../data/christmas-traditions';
import type { ToolHandoff } from '../../lib/tool-handoff';

interface Saved {
  v: 1;
  prefs: TraditionPrefs;
  /** Which age chips are on; null while the ages are the family profile's own. */
  chips: string[] | null;
  shown: string[];
  kept: string[];
  skipped: string[];
  family: string;
  palette: ToolPaletteId;
}

const MAX_SKIPPED = 40;
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && Boolean(traditionById(x))) : []);

function read(key: string): Saved | null {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!o || o.v !== 1 || typeof o.prefs !== 'object') return null;
    const p = o.prefs as Partial<TraditionPrefs>;
    return {
      v: 1,
      prefs: {
        ages: Array.isArray(p.ages) ? p.ages.filter((a) => Number.isInteger(a) && a >= 0 && a < 30).slice(0, 12) : [],
        time: p.time === 'short' || p.time === 'half-day' ? p.time : 'hour',
        cost: p.cost === 'free' || p.cost === 'flexible' ? p.cost : 'under-25',
        setting: p.setting === 'home' || p.setting === 'out' ? p.setting : 'either',
      },
      chips: Array.isArray(o.chips) ? o.chips.filter((c: unknown) => ageOptions.some((a) => a.id === c)) : null,
      shown: ids(o.shown).slice(0, 3),
      kept: ids(o.kept).slice(0, 3),
      skipped: ids(o.skipped).slice(-MAX_SKIPPED),
      family: typeof o.family === 'string' ? o.family.slice(0, 40) : '',
      palette: resolveToolPalette(String(o.palette ?? '')),
    };
  } catch {
    return null;
  }
}

/** The age chips a set of real ages falls into. */
const chipsFor = (ages: readonly number[]) =>
  ageOptions.filter((o) => ages.some((a) => (o.id === 'under-5' ? a < 5 : o.id === '5-8' ? a >= 5 && a <= 8 : o.id === '9-12' ? a >= 9 && a <= 12 : a >= 13))).map((o) => o.id);

const listOf = (xs: number[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function initTraditionsPicker(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.tpKey!}:${handoff.key}` : host.dataset.tpKey!;
  const $ = <T extends Element>(sel: string) => host.querySelector<T>(sel)!;
  const list = $<HTMLOListElement>('[data-tp-list]');
  const card = $<HTMLTemplateElement>('[data-tp-card]');
  const status = $<HTMLElement>('[data-tp-status]');
  const agesNote = $<HTMLElement>('[data-tp-ages-note]');
  const familyInput = $<HTMLInputElement>('[data-tp-family]');
  const sheet = $<HTMLElement>('[data-tp-sheet]');
  const sheetWrap = sheet.parentElement!;
  const sheetList = $<HTMLOListElement>('[data-tp-sheet-list]');
  const sheetHint = $<HTMLElement>('[data-tp-sheet-hint]');
  const sheetFamily = $<HTMLElement>('[data-tp-sheet-family]');
  const downloadBtn = $<HTMLButtonElement>('[data-tp-download]');
  const copyBtn = $<HTMLButtonElement>('[data-tp-copy]');
  const copyFallback = $<HTMLTextAreaElement>('[data-tp-copy-fallback]');

  const fresh = !read(key);
  const s: Saved = read(key) ?? {
    v: 1,
    prefs: { ...defaultPrefs, ages: handoff?.ages ?? [] },
    chips: handoff?.ages?.length ? null : [],
    shown: [],
    kept: [],
    skipped: [],
    family: handoff?.name ?? '',
    palette: resolveToolPalette(''),
  };
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'traditions-picker'); }
  };
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* This visit only. */
    }
  };
  const picks = () => s.kept.map(traditionById).filter((t): t is Tradition => Boolean(t));
  const band = () => kidBand(s.prefs.ages);

  /** Suggestions for the current answers: kept ones stay, the rest are chosen again. */
  const repick = () => {
    s.shown = pickTraditions(s.prefs, s.kept, s.skipped).map((t) => t.id);
  };

  function renderQuestions() {
    const chips = s.chips ?? chipsFor(s.prefs.ages);
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-age]')) b.setAttribute('aria-pressed', String(chips.includes(b.dataset.tpAge!)));
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-time]')) b.setAttribute('aria-pressed', String(b.dataset.tpTime === s.prefs.time));
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-cost]')) b.setAttribute('aria-pressed', String(b.dataset.tpCost === s.prefs.cost));
    for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-setting]')) b.setAttribute('aria-pressed', String(b.dataset.tpSetting === s.prefs.setting));
    agesNote.textContent = s.chips === null && s.prefs.ages.length
      ? `From your family profile: ${listOf(s.prefs.ages)}. Tap to change.`
      : 'Tap any that apply, or skip it.';
  }

  function renderCards() {
    list.replaceChildren();
    const b = band();
    s.shown.forEach((id, i) => {
      const t = traditionById(id)!;
      const li = (card.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
      const kept = s.kept.includes(id);
      li.classList.toggle('is-kept', kept);
      li.dataset.tpId = id;
      li.querySelector('[data-tp-name]')!.textContent = t.name;
      li.querySelector('[data-tp-meta]')!.textContent = `${t.takes} · ${costLabel[t.cost]}`;
      li.querySelector('[data-tp-about]')!.textContent = t.about;
      li.querySelector('[data-tp-kids]')!.textContent = t.kids[b];
      const box = li.querySelector<HTMLInputElement>('[data-tp-keep]')!;
      box.checked = kept;
      box.setAttribute('aria-label', `We’ll do this: ${t.name}`);
      box.addEventListener('change', () => {
        started();
        s.kept = box.checked ? [...s.kept.filter((k) => k !== id), id].sort((x, y) => s.shown.indexOf(x) - s.shown.indexOf(y)) : s.kept.filter((k) => k !== id);
        say(box.checked ? `${t.name} is on your list.` : `${t.name} is off your list.`);
        update();
      });
      const swap = li.querySelector<HTMLButtonElement>('[data-tp-swap]')!;
      swap.hidden = kept;
      swap.setAttribute('aria-label', `Swap ${t.name} for another idea`);
      swap.addEventListener('click', () => {
        started();
        const next = swapTradition(s.prefs, s.shown, i, s.skipped);
        if (!next) return say('That’s every idea that fits. Try more time, a bigger budget, or “Either.”');
        s.skipped = [...s.skipped.filter((k) => k !== id), id].slice(-MAX_SKIPPED);
        s.shown = s.shown.map((x, n) => (n === i ? next.id : x));
        say(`Swapped for ${next.name}.`);
        update();
        list.querySelectorAll<HTMLButtonElement>('[data-tp-swap]')[i]?.focus();
      });
      list.append(li);
    });
  }

  function renderSheet() {
    const p = picks();
    const b = band();
    sheetFamily.textContent = s.family.trim();
    // Nothing kept yet: a one-line hint instead of an empty page.
    sheetHint.hidden = p.length > 0;
    sheetWrap.hidden = p.length === 0;
    sheetList.replaceChildren(
      ...p.map((t, i) => {
        const li = document.createElement('li');
        li.className = 'tp-sheet-item';
        li.append(Object.assign(document.createElement('span'), { className: 'tp-sheet-num', textContent: String(i + 1) }));
        const body = document.createElement('div');
        const line = (cls: string, text: string) => Object.assign(document.createElement('p'), { className: cls, textContent: text });
        const kids = line('tp-sheet-kids', ` ${t.kids[b]}`);
        kids.prepend(Object.assign(document.createElement('b'), { textContent: 'Kids can' }));
        const lines = document.createElement('div');
        lines.className = 'tp-sheet-lines';
        lines.innerHTML = '<span>When</span><span>Who’s leading?</span>';
        body.append(line('tp-sheet-name', t.name), line('tp-sheet-meta', `${t.takes} · ${costLabel[t.cost]}`), line('tp-sheet-about', t.about), kids, lines);
        li.append(body);
        return li;
      }),
    );
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--tp-a1', a1);
    host.style.setProperty('--tp-a2', a2);
    host.style.setProperty('--tp-a3', a3);
    for (const btn of host.querySelectorAll<HTMLButtonElement>('[data-tp-palette]')) btn.setAttribute('aria-pressed', String(btn.dataset.tpPalette === s.palette));
    copyFallback.hidden = true;
    fit();
  }

  /** The printout keeps its US Letter layout and scales down to the screen. */
  function fit() {
    const scale = Math.min(1, sheetWrap.clientWidth / 816 || 1);
    sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
    sheetWrap.style.height = `${Math.ceil(1056 * scale)}px`;
  }

  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  function say(text: string) {
    status.textContent = text;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { status.textContent = ''; }, 6000);
  }

  function update() {
    save();
    renderQuestions();
    renderCards();
    renderSheet();
  }

  const answer = (patch: Partial<TraditionPrefs>) => {
    started();
    s.prefs = { ...s.prefs, ...patch };
    repick();
    update();
  };
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-age]')) {
    b.addEventListener('click', () => {
      const chips = s.chips ?? chipsFor(s.prefs.ages);
      const id = b.dataset.tpAge!;
      s.chips = chips.includes(id) ? chips.filter((c) => c !== id) : [...chips, id];
      answer({ ages: ageOptions.filter((o) => s.chips!.includes(o.id)).map((o) => o.age) });
    });
  }
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-time]')) b.addEventListener('click', () => answer({ time: b.dataset.tpTime as TraditionPrefs['time'] }));
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-cost]')) b.addEventListener('click', () => answer({ cost: b.dataset.tpCost as TraditionPrefs['cost'] }));
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-setting]')) b.addEventListener('click', () => answer({ setting: b.dataset.tpSetting as TraditionPrefs['setting'] }));
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-tp-palette]')) {
    b.addEventListener('click', () => {
      s.palette = resolveToolPalette(b.dataset.tpPalette!);
      save();
      renderSheet();
    });
  }
  familyInput.value = s.family;
  familyInput.addEventListener('input', () => {
    s.family = familyInput.value.slice(0, 40);
    save();
    renderSheet();
  });

  const needPicks = () => {
    if (picks().length) return false;
    say('Tick “We’ll do this” on one to three ideas first.');
    list.querySelector<HTMLInputElement>('[data-tp-keep]')?.focus();
    return true;
  };
  downloadBtn.addEventListener('click', () => {
    if (needPicks()) return;
    toolEvent('tool_download_click', 'traditions-picker');
    downloadPng(sheet, { filename: 'our-christmas-traditions.png', width: 816, height: 1056, layoutHost: host, exportClass: 'tp-exporting', button: downloadBtn });
  });
  copyBtn.addEventListener('click', () => {
    if (needPicks()) return;
    const text = traditionsText(picks(), band(), s.family.trim() ? `${s.family.trim()}: Our Christmas Traditions` : undefined);
    const manual = () => {
      copyFallback.value = text;
      copyFallback.hidden = false;
      copyFallback.focus();
      copyFallback.select();
      say('Select the text and copy it.');
    };
    if (!navigator.clipboard) return manual();
    navigator.clipboard.writeText(text).then(() => say('Copied. Paste it into a note or a message.'), manual);
  });

  addEventListener('resize', fit);
  // A first visit, or saved ideas that went missing: suggest afresh (kept ones stay).
  if (fresh || s.shown.length !== 3) repick();
  update();
}

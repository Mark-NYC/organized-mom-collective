/**
 * The Family Habit Builder's behavior, for every page that shows it (src/components/site/HabitBuilder.astro). One
 * implementation: improve it here and every entry point gets it.
 *
 * It opens with a whole example habit (the kitchen, after dinner, everyone) so nothing has to be answered first. Each
 * answer rewrites the suggested sentence until she edits it herself; then her words stay ("Use the suggested wording"
 * brings ours back). Everything saves in this browser.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the builder for a family, e.g. a Club kit. Its own saved
 * habit (the storage key plus `handoff.key`); a first visit starts from `handoff.variant` (an area id) or
 * `handoff.text` (her one thing, in her words), `handoff.people` (first names for "who"), `handoff.date` (the start
 * day) and `handoff.name` (the family's name on the card).
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import { responsibilityById, responsibilityImage } from '../../data/responsibilities';
import {
  checkInDay, dayLabel, habitAreaById, habitMomentById, habitStatement, habitText, MAX_HABIT_TEXT, OTHER_AREA, practiceDays, whoLabel,
  type HabitWho,
} from '../../data/family-habits';
import type { ToolHandoff } from '../../lib/tool-handoff';

interface Saved {
  v: 1;
  area: string;
  otherLabel: string;
  otherAction: string;
  moment: string;
  /** She picked the moment herself (otherwise it follows the area's usual one). */
  momentChosen: boolean;
  otherMoment: string;
  who: HabitWho;
  /** Chosen first names (profile people), or typed names. */
  names: string[];
  typedNames: string;
  /** Her own words, or null for the suggested sentence. */
  statement: string | null;
  doneMeans: string | null;
  start: string;
  family: string;
  palette: ToolPaletteId;
}

const WHO: HabitWho[] = ['everyone', 'adults', 'children', 'some'];
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');

function read(key: string): Saved | null {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!o || o.v !== 1) return null;
    return {
      v: 1,
      area: habitAreaById(o.area) || o.area === OTHER_AREA ? o.area : 'kitchen',
      otherLabel: clean(o.otherLabel, 80),
      otherAction: clean(o.otherAction, 100),
      moment: habitMomentById(o.moment) || o.moment === OTHER_AREA ? o.moment : 'after-dinner',
      momentChosen: o.momentChosen === true,
      otherMoment: clean(o.otherMoment, 60),
      who: WHO.includes(o.who) ? o.who : 'everyone',
      names: Array.isArray(o.names) ? o.names.map((n: unknown) => clean(n, 30)).filter(Boolean).slice(0, 12) : [],
      typedNames: clean(o.typedNames, 80),
      statement: typeof o.statement === 'string' && o.statement.trim() ? clean(o.statement, MAX_HABIT_TEXT) : null,
      doneMeans: typeof o.doneMeans === 'string' ? clean(o.doneMeans, MAX_HABIT_TEXT) : null,
      start: typeof o.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.start) ? o.start : '',
      family: clean(o.family, 40),
      palette: resolveToolPalette(String(o.palette ?? '')),
    };
  } catch {
    return null;
  }
}

export function initHabitBuilder(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.hbKey!}:${handoff.key}` : host.dataset.hbKey!;
  const $ = <T extends Element>(sel: string) => host.querySelector<T>(sel)!;
  const all = <T extends Element>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
  const people = handoff?.people ?? [];

  const fromKit = habitAreaById(handoff?.variant) ? handoff!.variant! : handoff?.text ? OTHER_AREA : 'kitchen';
  const s: Saved = read(key) ?? {
    v: 1,
    area: fromKit,
    otherLabel: fromKit === OTHER_AREA ? handoff?.text ?? '' : '',
    otherAction: '',
    moment: habitAreaById(fromKit)?.when ?? 'after-dinner',
    momentChosen: false,
    otherMoment: '',
    who: 'everyone',
    names: [],
    typedNames: '',
    statement: null,
    doneMeans: null,
    start: handoff?.date ?? '',
    family: handoff?.name ?? '',
    palette: resolveToolPalette(''),
  };

  const statementBox = $<HTMLTextAreaElement>('[data-hb-statement]');
  const doneBox = $<HTMLTextAreaElement>('[data-hb-done]');
  const startInput = $<HTMLInputElement>('[data-hb-start]');
  const familyInput = $<HTMLInputElement>('[data-hb-family]');
  const otherLabel = $<HTMLInputElement>('[data-hb-other-label]');
  const otherAction = $<HTMLInputElement>('[data-hb-other-action]');
  const momentText = $<HTMLInputElement>('[data-hb-moment-text]');
  const namesText = $<HTMLInputElement>('[data-hb-names-text]');
  const peopleBox = $<HTMLElement>('[data-hb-people]');
  const status = $<HTMLElement>('[data-hb-status]');
  const sheet = $<HTMLElement>('[data-hb-sheet]');
  const sheetWrap = sheet.parentElement!;
  const downloadBtn = $<HTMLButtonElement>('[data-hb-download]');
  const copyFallback = $<HTMLTextAreaElement>('[data-hb-copy-fallback]');

  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'habit-builder'); }
  };
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* This visit only. */
    }
  };

  // "Specific people": her family's first names when the page handed them over, else typed names.
  if (people.length) {
    peopleBox.replaceChildren(...people.map((p) => {
      const label = document.createElement('label');
      label.className = 'hb-person';
      const box = Object.assign(document.createElement('input'), { type: 'checkbox', value: p.name });
      box.dataset.hbPerson = p.name;
      box.addEventListener('change', () => {
        started();
        const picked = all<HTMLInputElement>('[data-hb-person]').filter((b) => b.checked).map((b) => b.value);
        s.names = picked;
        update();
      });
      label.append(box, document.createTextNode(p.name));
      return label;
    }));
    $<HTMLElement>('[data-hb-who-note]').textContent = 'Optional. Choose the whole family, or tap Specific people to pick names.';
  }
  const names = () => (s.who !== 'some' ? [] : people.length ? s.names : s.typedNames.split(/\s*(?:,|\band\b|&)\s*/).map((n) => n.trim()).filter(Boolean));

  const area = () => habitAreaById(s.area);
  const action = () => (area()?.action ?? s.otherAction.trim());
  const momentWords = () => (s.moment === OTHER_AREA ? s.otherMoment.trim() : habitMomentById(s.moment)?.phrase ?? '');
  const suggested = () => habitStatement(s.moment === OTHER_AREA ? s.otherMoment : s.moment, s.who, action(), names());
  const statement = () => s.statement ?? suggested();
  const done = () => s.doneMeans ?? area()?.doneMeans ?? '';
  const whenText = () => momentWords() || 'Each day';
  const whoText = () => whoLabel(s.who, names());

  let fitted = false;
  function fit() {
    const scale = Math.min(1, sheetWrap.clientWidth / 816 || 1);
    sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
    sheetWrap.style.height = `${Math.ceil(1056 * scale)}px`;
    fitted = true;
  }

  function update() {
    save();
    for (const b of all<HTMLButtonElement>('[data-hb-area]')) b.setAttribute('aria-pressed', String(b.dataset.hbArea === s.area));
    for (const b of all<HTMLButtonElement>('[data-hb-moment]')) b.setAttribute('aria-pressed', String(b.dataset.hbMoment === s.moment));
    for (const b of all<HTMLButtonElement>('[data-hb-who]')) b.setAttribute('aria-pressed', String(b.dataset.hbWho === s.who));
    $<HTMLElement>('[data-hb-other]').hidden = s.area !== OTHER_AREA;
    $<HTMLElement>('[data-hb-moment-other]').hidden = s.moment !== OTHER_AREA;
    peopleBox.hidden = s.who !== 'some' || !people.length;
    $<HTMLElement>('[data-hb-names-typed]').hidden = s.who !== 'some' || people.length > 0;
    for (const b of all<HTMLInputElement>('[data-hb-person]')) b.checked = s.names.includes(b.value);

    const words = statement();
    if (document.activeElement !== statementBox) statementBox.value = words;
    statementBox.placeholder = s.area === OTHER_AREA ? 'Fill in what everyone will do, above, or write your habit here.' : '';
    if (document.activeElement !== doneBox) doneBox.value = done();
    doneBox.placeholder = 'What finished looks like, so nobody has to check.';
    $<HTMLElement>('[data-hb-edit-note]').textContent = s.statement === null ? 'Change any words. It’s yours.' : 'Your words. They stay when you change the answers above.';
    $<HTMLButtonElement>('[data-hb-reset-words]').hidden = s.statement === null;
    $<HTMLElement>('[data-hb-when]').textContent = whenText();
    $<HTMLElement>('[data-hb-who-label]').textContent = whoText();
    startInput.value = s.start;
    const check = s.start ? checkInDay(s.start) : '';
    $<HTMLElement>('[data-hb-checkin]').textContent = s.start ? `Check in together on ${dayLabel(check)}.` : 'No date needed: start whenever suits your family.';

    // The card.
    $<HTMLElement>('[data-hb-sheet-family]').textContent = s.family.trim();
    $<HTMLElement>('[data-hb-sheet-statement]').textContent = words || 'Our one small habit';
    $<HTMLElement>('[data-hb-sheet-when]').textContent = whenText();
    $<HTMLElement>('[data-hb-sheet-who]').textContent = whoText();
    $<HTMLElement>('[data-hb-sheet-done]').textContent = done() || ' ';
    const labels = practiceDays(s.start);
    all<HTMLElement>('[data-hb-day]').forEach((el, i) => (el.textContent = labels[i]));
    $<HTMLElement>('[data-hb-sheet-dates]').textContent = s.start ? `We start ${dayLabel(s.start)} · We check in ${dayLabel(check)}` : 'We start ________________   We check in ________________';
    const art = $<HTMLImageElement>('[data-hb-art]');
    const r = area()?.illustration ? responsibilityById(area()!.illustration!) : undefined;
    const src = r ? responsibilityImage(r, 256) : null;
    art.hidden = !src;
    if (src) { if (art.getAttribute('src') !== src) art.src = src; } else art.removeAttribute('src');
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--hb-a1', a1);
    host.style.setProperty('--hb-a2', a2);
    host.style.setProperty('--hb-a3', a3);
    for (const b of all<HTMLButtonElement>('[data-hb-palette]')) b.setAttribute('aria-pressed', String(b.dataset.hbPalette === s.palette));
    copyFallback.hidden = true;
    if (!fitted) fit();
  }

  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (text: string) => {
    status.textContent = text;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { status.textContent = ''; }, 6000);
  };

  for (const b of all<HTMLButtonElement>('[data-hb-area]')) {
    b.addEventListener('click', () => {
      started();
      s.area = b.dataset.hbArea!;
      if (!s.momentChosen) s.moment = area()?.when ?? s.moment;
      s.doneMeans = null;
      update();
      if (s.area === OTHER_AREA) otherLabel.focus();
    });
  }
  for (const b of all<HTMLButtonElement>('[data-hb-moment]')) {
    b.addEventListener('click', () => {
      started();
      s.moment = b.dataset.hbMoment!;
      s.momentChosen = true;
      update();
      if (s.moment === OTHER_AREA) momentText.focus();
    });
  }
  for (const b of all<HTMLButtonElement>('[data-hb-who]')) {
    b.addEventListener('click', () => {
      started();
      s.who = b.dataset.hbWho as HabitWho;
      update();
    });
  }
  const typed = (input: HTMLInputElement, set: (v: string) => void) => input.addEventListener('input', () => { started(); set(input.value); update(); });
  otherLabel.value = s.otherLabel;
  otherAction.value = s.otherAction;
  momentText.value = s.otherMoment;
  namesText.value = s.typedNames;
  familyInput.value = s.family;
  typed(otherLabel, (v) => (s.otherLabel = v.slice(0, 80)));
  typed(otherAction, (v) => (s.otherAction = v.slice(0, 100)));
  typed(momentText, (v) => (s.otherMoment = v.slice(0, 60)));
  typed(namesText, (v) => (s.typedNames = v.slice(0, 80)));
  typed(familyInput, (v) => (s.family = v.slice(0, 40)));
  statementBox.addEventListener('input', () => {
    started();
    const v = statementBox.value.slice(0, MAX_HABIT_TEXT);
    s.statement = v.trim() && v.trim() !== suggested() ? v : null;
    update();
  });
  doneBox.addEventListener('input', () => {
    started();
    s.doneMeans = doneBox.value.slice(0, MAX_HABIT_TEXT);
    update();
  });
  $<HTMLButtonElement>('[data-hb-reset-words]').addEventListener('click', () => {
    s.statement = null;
    statementBox.value = suggested();
    update();
  });
  startInput.addEventListener('change', () => {
    started();
    s.start = /^\d{4}-\d{2}-\d{2}$/.test(startInput.value) ? startInput.value : '';
    update();
  });
  for (const b of all<HTMLButtonElement>('[data-hb-palette]')) {
    b.addEventListener('click', () => {
      s.palette = resolveToolPalette(b.dataset.hbPalette!);
      update();
    });
  }

  downloadBtn.addEventListener('click', () => {
    if (!statement().trim()) return say('Write your habit first: what will everyone do?');
    toolEvent('tool_download_click', 'habit-builder');
    downloadPng(sheet, { filename: 'our-family-habit.png', width: 816, height: 1056, layoutHost: host, exportClass: 'hb-exporting', button: downloadBtn });
  });
  $<HTMLButtonElement>('[data-hb-copy]').addEventListener('click', () => {
    if (!statement().trim()) return say('Write your habit first: what will everyone do?');
    const text = habitText({
      statement: statement(), when: whenText(), who: whoText(), doneMeans: done(),
      ...(s.start ? { start: dayLabel(s.start), checkIn: dayLabel(checkInDay(s.start)) } : {}),
    });
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
  update();
}

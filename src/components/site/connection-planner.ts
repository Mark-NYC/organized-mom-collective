/**
 * The Family Connection Planner's behavior, for every page that shows it (src/components/site/ConnectionPlanner.astro).
 * One implementation: improve it here and every entry point gets it.
 *
 * Three ideas show straight away (src/data/connection-ideas.ts picks them from her answers, defaults for any she
 * skips). She can swap or edit any, and choose one; the chosen one stays put when she changes answers, and becomes a
 * one-page plan (who, when, prep, a question) to download or copy. Everything saves in this browser.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the planner for a family, e.g. a Club kit. Its own saved
 * plan (the storage key plus `handoff.key`); a first visit starts with `handoff.ages` (the children's real ages),
 * `handoff.people` (first names for "who's joining") and `handoff.name` (the family's name on the plan).
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import {
  ageOptions, connectionById, connectionText, costLabel, defaultConnectionPrefs, pickConnections, slotLabel, swapConnection,
  type ConnectionIdea, type ConnectionPrefs,
} from '../../data/connection-ideas';
import type { ToolHandoff } from '../../lib/tool-handoff';

interface Plan {
  who: string;
  when: string;
  prep: string | null;
  question: string | null;
}
interface Saved {
  v: 1;
  prefs: ConnectionPrefs;
  /** Which age chips are on; null while the ages are the family profile's own. */
  chips: string[] | null;
  shown: string[];
  chosen: string | null;
  skipped: string[];
  /** Her own title and description for an idea, by id. */
  edits: Record<string, { title: string; about: string }>;
  plan: Plan;
  family: string;
  palette: ToolPaletteId;
}

const MAX_SKIPPED = 40;
const KINDS = ['family', 'one-on-one', 'both'];
const TIMES = ['15', '30', 'hour', 'more'];
const COSTS = ['free', 'under-25', 'flexible'];
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && Boolean(connectionById(x))) : []);
const listOf = (xs: (string | number)[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const chipsFor = (ages: readonly number[]) =>
  ageOptions.filter((o) => ages.some((a) => (o.id === 'under-5' ? a < 5 : o.id === '5-8' ? a >= 5 && a <= 8 : o.id === '9-12' ? a >= 9 && a <= 12 : a >= 13))).map((o) => o.id);

function read(key: string): Saved | null {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!o || o.v !== 1 || typeof o.prefs !== 'object') return null;
    const p = o.prefs as Partial<ConnectionPrefs>;
    const edits: Saved['edits'] = {};
    for (const [id, e] of Object.entries((o.edits ?? {}) as Record<string, { title?: unknown; about?: unknown }>)) {
      if (connectionById(id) && e) edits[id] = { title: clean(e.title, 60), about: clean(e.about, 200) };
    }
    return {
      v: 1,
      prefs: {
        ages: Array.isArray(p.ages) ? p.ages.filter((a) => Number.isInteger(a) && a >= 0 && a < 30).slice(0, 12) : [],
        kind: KINDS.includes(p.kind as string) ? p.kind! : 'both',
        time: TIMES.includes(p.time as string) ? p.time! : '30',
        cost: COSTS.includes(p.cost as string) ? p.cost! : 'free',
        setting: p.setting === 'home' || p.setting === 'out' ? p.setting : 'either',
      },
      chips: Array.isArray(o.chips) ? o.chips.filter((c: unknown) => ageOptions.some((a) => a.id === c)) : null,
      shown: ids(o.shown).slice(0, 3),
      chosen: typeof o.chosen === 'string' && connectionById(o.chosen) ? o.chosen : null,
      skipped: ids(o.skipped).slice(-MAX_SKIPPED),
      edits,
      plan: {
        who: clean(o.plan?.who, 80),
        when: clean(o.plan?.when, 60),
        prep: typeof o.plan?.prep === 'string' ? clean(o.plan.prep, 100) : null,
        question: typeof o.plan?.question === 'string' ? clean(o.plan.question, 120) : null,
      },
      family: clean(o.family, 40),
      palette: resolveToolPalette(String(o.palette ?? '')),
    };
  } catch {
    return null;
  }
}

export function initConnectionPlanner(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.cnKey!}:${handoff.key}` : host.dataset.cnKey!;
  const $ = <T extends Element>(sel: string) => host.querySelector<T>(sel)!;
  const all = <T extends Element>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
  const people = handoff?.people ?? [];
  const list = $<HTMLOListElement>('[data-cn-list]');
  const card = $<HTMLTemplateElement>('[data-cn-card]');
  const status = $<HTMLElement>('[data-cn-status]');
  const sheet = $<HTMLElement>('[data-cn-sheet]');
  const sheetWrap = sheet.parentElement!;
  const planBox = $<HTMLElement>('[data-cn-plan]');
  const whoInput = $<HTMLInputElement>('[data-cn-who]');
  const whenInput = $<HTMLInputElement>('[data-cn-when]');
  const prepInput = $<HTMLInputElement>('[data-cn-prep-input]');
  const questionInput = $<HTMLInputElement>('[data-cn-question]');
  const familyInput = $<HTMLInputElement>('[data-cn-family]');
  const peopleBox = $<HTMLElement>('[data-cn-people]');
  const downloadBtn = $<HTMLButtonElement>('[data-cn-download]');
  const copyFallback = $<HTMLTextAreaElement>('[data-cn-copy-fallback]');

  const saved = read(key);
  const s: Saved = saved ?? {
    v: 1,
    prefs: { ...defaultConnectionPrefs, ages: handoff?.ages ?? [] },
    chips: handoff?.ages?.length ? null : [],
    shown: [],
    chosen: null,
    skipped: [],
    edits: {},
    plan: { who: '', when: '', prep: null, question: null },
    family: handoff?.name ?? '',
    palette: resolveToolPalette(''),
  };
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'connection-planner'); }
  };
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* This visit only. */
    }
  };
  const title = (t: ConnectionIdea) => s.edits[t.id]?.title.trim() || t.title;
  const about = (t: ConnectionIdea) => s.edits[t.id]?.about.trim() || t.about;
  const chosen = () => (s.chosen ? connectionById(s.chosen) : undefined);
  /** Who, before she says: the whole family for a family moment or a rhythm; nobody named for one-on-one. */
  const defaultWho = (t: ConnectionIdea) => (t.slot === 'one-on-one' ? '' : 'The whole family');
  const who = () => s.plan.who || (chosen() ? defaultWho(chosen()!) : '');
  const prep = () => s.plan.prep ?? chosen()?.prep ?? '';
  const question = () => s.plan.question ?? chosen()?.question ?? '';

  /** Suggestions for the current answers: the chosen one stays where it is, the rest are chosen again. */
  const repick = () => {
    const keep = s.chosen ? s.shown.map((id) => (id === s.chosen ? id : null)) : [];
    s.shown = pickConnections(s.prefs, keep, s.skipped).map((t) => t.id);
    if (s.chosen && !s.shown.includes(s.chosen)) s.chosen = null;
  };

  // "Who's joining": her family's first names, when the page handed them over.
  if (people.length) {
    peopleBox.replaceChildren(...people.map((p) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'cn-person', textContent: p.name });
      b.dataset.cnPerson = p.name;
      b.addEventListener('click', () => {
        started();
        const names = who().split(/\s*(?:,|\band\b)\s*/).map((n) => n.trim()).filter((n) => people.some((x) => x.name === n));
        const next = names.includes(p.name) ? names.filter((n) => n !== p.name) : [...names, p.name];
        s.plan.who = listOf(people.map((x) => x.name).filter((n) => next.includes(n)));
        update();
      });
      return b;
    }));
  }

  function renderQuestions() {
    const chips = s.chips ?? chipsFor(s.prefs.ages);
    for (const b of all<HTMLButtonElement>('[data-cn-age]')) b.setAttribute('aria-pressed', String(chips.includes(b.dataset.cnAge!)));
    for (const [attr, val] of [['cnKind', s.prefs.kind], ['cnTime', s.prefs.time], ['cnCost', s.prefs.cost], ['cnSetting', s.prefs.setting]] as const) {
      const sel = `[data-${attr.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
      for (const b of all<HTMLButtonElement>(sel)) b.setAttribute('aria-pressed', String(b.dataset[attr] === val));
    }
    $<HTMLElement>('[data-cn-ages-note]').textContent = s.chips === null && s.prefs.ages.length
      ? `From your family profile: ${listOf(s.prefs.ages)}. Tap to change.`
      : 'Tap any that apply, or skip it.';
  }

  function renderCards() {
    list.replaceChildren();
    s.shown.forEach((id, i) => {
      const t = connectionById(id)!;
      const li = (card.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
      const isChosen = s.chosen === id;
      li.classList.toggle('is-chosen', isChosen);
      li.dataset.cnId = id;
      li.querySelector('[data-cn-slot]')!.textContent = slotLabel[t.slot];
      li.querySelector('[data-cn-name]')!.textContent = title(t);
      li.querySelector('[data-cn-meta]')!.textContent = `${t.takes} · ${costLabel[t.cost]}`;
      li.querySelector('[data-cn-about]')!.textContent = about(t);
      li.querySelector<HTMLElement>('[data-cn-prep-line]')!.hidden = !t.prep;
      li.querySelector('[data-cn-prep]')!.textContent = t.prep;
      li.querySelector('[data-cn-share]')!.textContent = t.share;

      const choose = li.querySelector<HTMLButtonElement>('[data-cn-choose]')!;
      choose.setAttribute('aria-pressed', String(isChosen));
      choose.textContent = isChosen ? 'Our pick' : 'Choose this one';
      choose.setAttribute('aria-label', isChosen ? `${title(t)} is your pick` : `Choose ${title(t)}`);
      choose.addEventListener('click', () => {
        started();
        if (s.chosen !== id) s.plan = { who: '', when: s.plan.when, prep: null, question: null };
        s.chosen = s.chosen === id ? null : id;
        say(s.chosen ? `${title(t)} is your pick. Your plan is below.` : 'No pick yet.');
        update();
      });

      const editBox = li.querySelector<HTMLElement>('[data-cn-edit]')!;
      const toggle = li.querySelector<HTMLButtonElement>('[data-cn-edit-toggle]')!;
      const titleInput = li.querySelector<HTMLInputElement>('[data-cn-edit-title]')!;
      const aboutInput = li.querySelector<HTMLTextAreaElement>('[data-cn-edit-about]')!;
      toggle.setAttribute('aria-label', `Edit ${title(t)}`);
      toggle.addEventListener('click', () => {
        const open = editBox.hidden;
        editBox.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Done' : 'Edit';
        toggle.setAttribute('aria-label', open ? `Done editing ${title(t)}` : `Edit ${title(t)}`);
        if (open) { titleInput.value = title(t); aboutInput.value = about(t); titleInput.focus(); }
        else update();
      });
      const edit = () => {
        started();
        s.edits[id] = { title: titleInput.value.slice(0, 60), about: aboutInput.value.slice(0, 200) };
        if (s.edits[id].title.trim() === t.title && s.edits[id].about.trim() === t.about) delete s.edits[id];
        li.querySelector('[data-cn-name]')!.textContent = title(t);
        li.querySelector('[data-cn-about]')!.textContent = about(t);
        save();
        renderPlan();
      };
      titleInput.addEventListener('input', edit);
      aboutInput.addEventListener('input', edit);
      li.querySelector<HTMLButtonElement>('[data-cn-edit-reset]')!.addEventListener('click', () => {
        delete s.edits[id];
        titleInput.value = t.title;
        aboutInput.value = t.about;
        edit();
      });

      const swap = li.querySelector<HTMLButtonElement>('[data-cn-swap]')!;
      swap.hidden = isChosen;
      swap.setAttribute('aria-label', `Swap ${title(t)} for another idea`);
      swap.addEventListener('click', () => {
        started();
        const next = swapConnection(s.prefs, s.shown, i, s.skipped);
        if (!next) return say('That’s every idea of this kind that fits. Try more time, a bigger budget, or “Either.”');
        s.skipped = [...s.skipped.filter((k) => k !== id), id].slice(-MAX_SKIPPED);
        s.shown = s.shown.map((x, n) => (n === i ? next.id : x));
        say(`Swapped for ${next.title}.`);
        update();
        list.querySelectorAll<HTMLButtonElement>('[data-cn-swap]')[i]?.focus();
      });
      list.append(li);
    });
  }

  function renderPlan() {
    const t = chosen();
    $<HTMLElement>('[data-cn-hint]').hidden = Boolean(t);
    planBox.hidden = !t;
    if (!t) return;
    if (document.activeElement !== whoInput) whoInput.value = who();
    whoInput.placeholder = t.slot === 'one-on-one' ? 'e.g. Grandma and the youngest' : 'The whole family';
    if (document.activeElement !== prepInput) prepInput.value = prep();
    if (document.activeElement !== questionInput) questionInput.value = question();
    whenInput.value = s.plan.when;
    peopleBox.hidden = !people.length;
    const named = who().split(/\s*(?:,|\band\b)\s*/).map((n) => n.trim());
    for (const b of all<HTMLButtonElement>('[data-cn-person]')) b.setAttribute('aria-pressed', String(named.includes(b.dataset.cnPerson!)));

    $<HTMLElement>('[data-cn-sheet-family]').textContent = s.family.trim();
    $<HTMLElement>('[data-cn-sheet-slot]').textContent = slotLabel[t.slot];
    $<HTMLElement>('[data-cn-sheet-name]').textContent = title(t);
    $<HTMLElement>('[data-cn-sheet-about]').textContent = about(t);
    $<HTMLElement>('[data-cn-sheet-who]').textContent = who();
    $<HTMLElement>('[data-cn-sheet-when]').textContent = s.plan.when;
    $<HTMLElement>('[data-cn-sheet-prep-row]').hidden = !prep().trim();
    $<HTMLElement>('[data-cn-sheet-prep]').textContent = prep();
    $<HTMLElement>('[data-cn-sheet-share]').textContent = t.share;
    $<HTMLElement>('[data-cn-sheet-question-box]').hidden = !question().trim();
    $<HTMLElement>('[data-cn-sheet-question]').textContent = question();
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--cn-a1', a1);
    host.style.setProperty('--cn-a2', a2);
    host.style.setProperty('--cn-a3', a3);
    for (const b of all<HTMLButtonElement>('[data-cn-palette]')) b.setAttribute('aria-pressed', String(b.dataset.cnPalette === s.palette));
    copyFallback.hidden = true;
    fit();
  }

  /** The plan keeps its US Letter layout and scales down to the screen. */
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
    renderPlan();
  }

  const answer = (patch: Partial<ConnectionPrefs>) => {
    started();
    s.prefs = { ...s.prefs, ...patch };
    repick();
    update();
  };
  for (const b of all<HTMLButtonElement>('[data-cn-age]')) {
    b.addEventListener('click', () => {
      const chips = s.chips ?? chipsFor(s.prefs.ages);
      const id = b.dataset.cnAge!;
      s.chips = chips.includes(id) ? chips.filter((c) => c !== id) : [...chips, id];
      answer({ ages: ageOptions.filter((o) => s.chips!.includes(o.id)).map((o) => o.age) });
    });
  }
  for (const b of all<HTMLButtonElement>('[data-cn-kind]')) b.addEventListener('click', () => answer({ kind: b.dataset.cnKind as ConnectionPrefs['kind'] }));
  for (const b of all<HTMLButtonElement>('[data-cn-time]')) b.addEventListener('click', () => answer({ time: b.dataset.cnTime as ConnectionPrefs['time'] }));
  for (const b of all<HTMLButtonElement>('[data-cn-cost]')) b.addEventListener('click', () => answer({ cost: b.dataset.cnCost as ConnectionPrefs['cost'] }));
  for (const b of all<HTMLButtonElement>('[data-cn-setting]')) b.addEventListener('click', () => answer({ setting: b.dataset.cnSetting as ConnectionPrefs['setting'] }));
  for (const b of all<HTMLButtonElement>('[data-cn-palette]')) {
    b.addEventListener('click', () => {
      s.palette = resolveToolPalette(b.dataset.cnPalette!);
      save();
      renderPlan();
    });
  }
  const typed = (input: HTMLInputElement, set: (v: string) => void) => input.addEventListener('input', () => { started(); set(input.value); save(); renderPlan(); });
  familyInput.value = s.family;
  typed(whoInput, (v) => (s.plan.who = v.slice(0, 80)));
  typed(whenInput, (v) => (s.plan.when = v.slice(0, 60)));
  typed(prepInput, (v) => (s.plan.prep = v.slice(0, 100)));
  typed(questionInput, (v) => (s.plan.question = v.slice(0, 120)));
  typed(familyInput, (v) => (s.family = v.slice(0, 40)));

  const plan = () => {
    const t = chosen()!;
    return { title: title(t), about: about(t), who: who(), when: s.plan.when, prep: prep(), question: question(), share: t.share };
  };
  downloadBtn.addEventListener('click', () => {
    if (!chosen()) return say('Choose one idea first.');
    toolEvent('tool_download_click', 'connection-planner');
    downloadPng(sheet, { filename: 'our-family-connection-plan.png', width: 816, height: 1056, layoutHost: host, exportClass: 'cn-exporting', button: downloadBtn });
  });
  $<HTMLButtonElement>('[data-cn-copy]').addEventListener('click', () => {
    if (!chosen()) return say('Choose one idea first.');
    const text = connectionText(plan(), s.family);
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
  if (!saved || s.shown.length !== 3) repick();
  update();
}

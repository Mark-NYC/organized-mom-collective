/**
 * The Family Weekly Reset Builder's behavior, for every page that shows it (src/components/site/
 * FamilyResetBuilder.astro). One implementation: improve it here and every entry point gets it.
 *
 * It opens with a guide straight away (whoever's known, Sunday, taking turns to lead). Any change re-plans the five
 * steps from the rules (src/data/family-reset.ts) while keeping what she changed: a step's words, minutes or
 * participation lines, its order, steps she removed, the question, her own question. "New suggestions" does the same
 * on request. Everything saves in this browser.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the builder for a family, e.g. a Club kit. Its own saved
 * guide (the storage key plus `handoff.key`); a first visit starts with `handoff.people`, `handoff.name` on the guide
 * and the meeting day and time she wrote in `handoff.text` when there is one.
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import {
  bandOf, CONCERNS, leaderNote, meetLabel, resetAgenda, resetMinutes, resetQuestion,
  type Concern, type Leadership, type MeetDay, type ResetStep,
} from '../../data/family-reset';
import { helpersFromHandoff, readHelpers, type Helper } from '../../lib/household-helpers';
import type { ToolHandoff } from '../../lib/tool-handoff';
import { initHelpersEditor } from './helpers-editor';

interface Step extends ResetStep { edited?: true }
interface Saved {
  v: 1;
  helpers: Helper[];
  concerns: Concern[];
  other: string;
  day: MeetDay;
  otherDay: string;
  /** 'HH:MM' or ''. */
  time: string;
  lead: Leadership;
  leader: string | null;
  next: string | null;
  steps: Step[];
  removed: string[];
  question: string;
  questionEdited: boolean;
  own: string;
  family: string;
  palette: ToolPaletteId;
  seq: number;
}

const DAYS: MeetDay[] = ['sunday', 'friday', 'saturday', 'other'];
const LEADS: Leadership[] = ['one', 'rotate', 'together'];
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
const twelve = (v: string) => {
  if (!/^\d{2}:\d{2}$/.test(v)) return '';
  const [h, m] = v.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

function read(key: string): Saved | null {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!o || o.v !== 1) return null;
    const helpers = readHelpers(o.helpers, []);
    if (!helpers.length) return null;
    const ids = new Set(helpers.map((h) => h.id));
    const who = (x: unknown) => (typeof x === 'string' && ids.has(x) ? x : null);
    return {
      v: 1, helpers,
      concerns: Array.isArray(o.concerns) ? CONCERNS.filter((c) => o.concerns.includes(c)) : [],
      other: clean(o.other, 40), day: DAYS.includes(o.day) ? o.day : 'sunday', otherDay: clean(o.otherDay, 20),
      time: typeof o.time === 'string' && /^\d{2}:\d{2}$/.test(o.time) ? o.time : '',
      lead: LEADS.includes(o.lead) ? o.lead : 'rotate', leader: who(o.leader), next: who(o.next),
      steps: Array.isArray(o.steps) ? o.steps.slice(0, 8).flatMap((x: Partial<Step>) => (typeof x?.key === 'string' && typeof x.title === 'string' ? [{
        key: x.key.slice(0, 20), title: clean(x.title, 60), minutes: Number.isInteger(x.minutes) ? Math.min(30, Math.max(1, x.minutes!)) : 3,
        body: clean(x.body, 240), parts: Array.isArray(x.parts) ? x.parts.filter((p): p is string => typeof p === 'string').map((p) => clean(p, 140)).slice(0, 4) : [],
        ...(x.edited ? { edited: true as const } : {}),
      }] : [])) : [],
      removed: Array.isArray(o.removed) ? o.removed.filter((k: unknown): k is string => typeof k === 'string').slice(0, 8) : [],
      question: clean(o.question, 100), questionEdited: o.questionEdited === true, own: clean(o.own, 100),
      family: clean(o.family, 40), palette: resolveToolPalette(String(o.palette ?? '')), seq: Number.isInteger(o.seq) ? o.seq : 100,
    };
  } catch {
    return null;
  }
}

/** A first leader who isn't automatically the account holder: an older child, else another grown-up, else whoever's there. */
function firstLeader(helpers: readonly Helper[]): string | null {
  const older = helpers.filter((h) => bandOf(h) === 'teen' || (bandOf(h) === 'school' && (h.age ?? 8) >= 8));
  const other = helpers.filter((h) => h.group === 'adult' && !h.holder);
  return (older[0] ?? other[0] ?? helpers[0])?.id ?? null;
}
const nextAfter = (helpers: readonly Helper[], id: string | null) => {
  const i = helpers.findIndex((h) => h.id === id);
  return helpers.length > 1 ? helpers[(i + 1) % helpers.length].id : null;
};

export function initFamilyResetBuilder(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.frKey!}:${handoff.key}` : host.dataset.frKey!;
  const brand = host.dataset.frBrand ?? '';
  const $ = <T extends Element>(sel: string, root: ParentNode = host) => root.querySelector<T>(sel)!;
  const all = <T extends Element>(sel: string, root: ParentNode = host) => Array.from(root.querySelectorAll<T>(sel));
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
    const { dataset, ...rest } = props as { dataset?: Record<string, string> };
    const node = document.createElement(tag);
    Object.assign(node, rest);
    if (dataset) Object.assign(node.dataset, dataset);
    node.append(...kids);
    return node;
  };
  const status = $<HTMLElement>('[data-fr-status]');
  const stepsBox = $<HTMLOListElement>('[data-fr-steps]');
  const sheets = $<HTMLElement>('[data-fr-sheets]');
  const copyFallback = $<HTMLTextAreaElement>('[data-fr-copy-fallback]');
  const downloadBtn = $<HTMLButtonElement>('[data-fr-download]');

  const saved = read(key);
  const fromProfile = helpersFromHandoff(handoff);
  const helpers0: Helper[] = fromProfile.length ? fromProfile : [
    { id: 'h0', name: 'Adult 1', group: 'adult', age: null, limits: [] },
    { id: 'h1', name: 'Child 1', group: 'school', age: null, limits: [] },
  ];
  const lead0 = firstLeader(helpers0);
  const s: Saved = saved ?? {
    v: 1, helpers: helpers0, concerns: [], other: '', day: 'sunday', otherDay: '', time: '',
    lead: 'rotate', leader: lead0, next: nextAfter(helpers0, lead0), steps: [], removed: [], question: '', questionEdited: false, own: '',
    family: handoff?.name ?? '', palette: resolveToolPalette(''), seq: 100,
  };
  // A meeting day she wrote on the kit ("Sunday at 6:30") becomes the day she chose, when it names one.
  if (!saved && (handoff?.variant === 'sunday' || handoff?.variant === 'friday' || handoff?.variant === 'saturday')) s.day = handoff.variant;
  if (!saved && handoff?.text) {
    const t = handoff.text.toLowerCase();
    const d = (['sunday', 'friday', 'saturday'] as MeetDay[]).find((x) => t.includes(x));
    if (d) s.day = d; else { s.day = 'other'; s.otherDay = clean(handoff.text, 20); }
    const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(handoff.text);
    if (m) {
      let h = Number(m[1]);
      if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
      if (h < 24) s.time = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
    }
  }
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'family-reset'); }
  };
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* This visit only. */
    }
  };
  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (text: string) => {
    status.textContent = text;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { status.textContent = ''; }, 6000);
  };
  const helperById = (id: string | null) => s.helpers.find((h) => h.id === id);

  /** Re-plan the steps for these people and concerns; her changed steps, order and removals stay. */
  const build = () => {
    const fresh = resetAgenda({ people: s.helpers, concerns: s.concerns, other: s.other }).filter((x) => !s.removed.includes(x.key));
    const freshBy = new Map(fresh.map((x) => [x.key, x]));
    const kept = s.steps.flatMap((x) => (x.edited ? [x] : freshBy.has(x.key) ? [freshBy.get(x.key)!] : []));
    for (const f of fresh) if (!kept.some((x) => x.key === f.key)) kept.splice(fresh.indexOf(f), 0, f);
    s.steps = kept;
    if (!s.questionEdited) s.question = resetQuestion(s.helpers);
    if (!helperById(s.leader)) s.leader = firstLeader(s.helpers);
    if (s.next && !helperById(s.next)) s.next = nextAfter(s.helpers, s.leader);
  };
  if (!saved) build();

  const people = initHelpersEditor($<HTMLElement>('[data-hp]'), {
    helpers: () => s.helpers,
    setHelpers: (next) => { s.helpers = next; },
    limits: [],
    newId: () => `h${s.seq++}`,
    say,
    onChange: (change) => {
      started();
      if (change !== 'name') build();
      update();
    },
  });

  // ---------------------------------------------------------------- the questions
  function renderQuestions() {
    for (const c of all<HTMLInputElement>('[data-fr-concern]')) c.checked = s.concerns.includes(c.dataset.frConcern as Concern);
    $<HTMLElement>('[data-fr-other-box]').hidden = !s.concerns.includes('other');
    $<HTMLInputElement>('[data-fr-other]').value = s.other;
    for (const b of all<HTMLButtonElement>('[data-fr-day]')) b.setAttribute('aria-pressed', String(b.dataset.frDay === s.day));
    $<HTMLElement>('[data-fr-other-day-box]').hidden = s.day !== 'other';
    $<HTMLInputElement>('[data-fr-other-day]').value = s.otherDay;
    $<HTMLInputElement>('[data-fr-time]').value = s.time;
    for (const b of all<HTMLButtonElement>('[data-fr-lead]')) b.setAttribute('aria-pressed', String(b.dataset.frLead === s.lead));
    const opts = (sel: HTMLSelectElement, value: string | null) => sel.replaceChildren(el('option', { value: '', textContent: 'Choose later' }),
      ...s.helpers.map((h) => el('option', { value: h.id, textContent: h.name, selected: h.id === value })));
    $<HTMLElement>('[data-fr-leader-box]').hidden = s.lead === 'together';
    $<HTMLElement>('[data-fr-leader-label]').textContent = s.lead === 'rotate' ? 'This week' : 'Who leads';
    opts($<HTMLSelectElement>('[data-fr-leader]'), s.leader);
    $<HTMLElement>('[data-fr-next-box]').hidden = s.lead !== 'rotate';
    opts($<HTMLSelectElement>('[data-fr-next]'), s.next);
    $<HTMLElement>('[data-fr-leader-note]').textContent = s.lead === 'together' ? 'Choose a leader at the start of each meeting.' : leaderNote(helperById(s.leader));
    $<HTMLElement>('[data-fr-people-note]').textContent = fromProfile.length
      ? 'From your family profile. Not everyone has to be there every week; remove anyone who won’t usually join.'
      : 'Everyone who usually joins. Not everyone has to be there every week.';
    $<HTMLInputElement>('[data-fr-question]').value = s.question;
    $<HTMLInputElement>('[data-fr-own]').value = s.own;
  }

  // ---------------------------------------------------------------- the steps
  function renderSteps() {
    const m = resetMinutes(s.helpers);
    const total = s.steps.reduce((n, x) => n + x.minutes, 0);
    $<HTMLElement>('[data-fr-timing]').textContent = `About ${total} minutes. ${m.note}`;
    stepsBox.replaceChildren(...s.steps.map((x, i) => {
      const li = el('li', { className: 'fr-step', dataset: { frStep: x.key } });
      const touch = () => { x.edited = true; started(); save(); renderSheets(); };
      const title = el('input', { type: 'text', className: 'fr-step-title', value: x.title, maxLength: 60 });
      title.setAttribute('aria-label', `Step ${i + 1}`);
      title.addEventListener('change', () => { if (title.value.trim()) x.title = title.value.trim(); touch(); });
      const minutes = el('input', { type: 'number', min: 1, max: 30, value: String(x.minutes) });
      minutes.setAttribute('aria-label', `Minutes for step ${i + 1}`);
      minutes.addEventListener('change', () => {
        const n = Number(minutes.value);
        x.minutes = Number.isInteger(n) ? Math.min(30, Math.max(1, n)) : x.minutes;
        touch();
        renderSteps();
      });
      const move = (d: number) => {
        [s.steps[i], s.steps[i + d]] = [s.steps[i + d], s.steps[i]];
        s.steps[i].edited = true;
        s.steps[i + d].edited = true;
        started();
        save();
        renderPlan();
        stepsBox.querySelector<HTMLButtonElement>(`[data-fr-step="${x.key}"] [data-fr-move="${d}"]`)?.focus();
      };
      const up = el('button', { type: 'button', className: 'fr-mv', textContent: '↑', disabled: i === 0, dataset: { frMove: '-1' } });
      up.setAttribute('aria-label', `Move up: ${x.title}`);
      up.addEventListener('click', () => move(-1));
      const down = el('button', { type: 'button', className: 'fr-mv', textContent: '↓', disabled: i === s.steps.length - 1, dataset: { frMove: '1' } });
      down.setAttribute('aria-label', `Move down: ${x.title}`);
      down.addEventListener('click', () => move(1));
      const remove = el('button', { type: 'button', className: 'fr-x', textContent: '×' });
      remove.setAttribute('aria-label', `Remove: ${x.title}`);
      remove.addEventListener('click', () => {
        if (s.steps.length <= 2) return say('Keep at least two steps.');
        started();
        s.removed = [...s.removed, x.key];
        s.steps = s.steps.filter((y) => y !== x);
        say(`Removed: ${x.title}`);
        update();
      });
      const body = el('textarea', { value: x.body, rows: 2, maxLength: 240 });
      body.setAttribute('aria-label', `What happens in step ${i + 1}`);
      body.addEventListener('change', () => { x.body = body.value.trim(); touch(); });
      const parts = el('textarea', { className: 'fr-parts', value: x.parts.join('\n'), rows: Math.max(1, x.parts.length), maxLength: 560, placeholder: 'How each person takes part (one per line, optional)' });
      parts.setAttribute('aria-label', `How everyone takes part in step ${i + 1}`);
      parts.addEventListener('change', () => { x.parts = parts.value.split('\n').map((p) => p.trim()).filter(Boolean).slice(0, 4); touch(); });
      li.append(title, minutes, up, down, remove, body, parts);
      return li;
    }));
  }

  // ---------------------------------------------------------------- the printout
  function renderSheets() {
    sheets.replaceChildren();
    const lead = helperById(s.leader);
    const when = meetLabel(s.day, s.otherDay, twelve(s.time));
    const total = s.steps.reduce((n, x) => n + x.minutes, 0);
    const sheet = el('div', { className: 'fr-sheet', dataset: { frSheet: 'guide' } },
      el('div', { className: 'fr-sheet-family', textContent: s.family.trim() }),
      el('div', { className: 'fr-sheet-title' }, el('span', { className: 'fr-swipe', textContent: 'Our Family Weekly Reset' })),
      el('div', { className: 'fr-sheet-meta' },
        el('span', {}, 'We meet ', el('b', { textContent: when || '__________' })),
        el('span', {}, el('b', { textContent: `${total} minutes` }), ' together')),
      el('ol', { className: 'fr-sheet-steps' }, ...s.steps.map((x, i) => el('li', { className: 'fr-sheet-step' },
        el('span', { className: 'fr-sheet-num', textContent: String(i + 1) }),
        el('div', {}, el('h3', { textContent: x.title }), ...(x.body ? [el('p', { textContent: x.body })] : []),
          ...(x.parts.length ? [el('ul', {}, ...x.parts.map((p) => el('li', { textContent: p })))] : [])),
        el('span', { className: 'fr-sheet-min', textContent: `${x.minutes} min` })))),
      el('div', { className: 'fr-sheet-q' }, el('span', { textContent: 'This week’s question' }), el('p', { textContent: s.question }),
        ...(s.own.trim() ? [el('span', { textContent: 'Our own question' }), el('p', { textContent: s.own.trim() })] : [])),
      el('div', { className: 'fr-sheet-lead' },
        el('span', {}, 'This week’s meeting leader ', el('em', { textContent: s.lead === 'together' ? '' : lead?.name ?? '' })),
        ...(s.lead === 'rotate' ? [el('span', {}, 'Next week ', el('em', { textContent: helperById(s.next)?.name ?? '' }))] : [])),
      el('p', { className: 'fr-sheet-lead-note', textContent: s.lead === 'together' ? 'Choose a leader each week. Grown-ups make the calls that need a grown-up.' : leaderNote(lead) }),
      el('div', { className: 'fr-sheet-foot' },
        el('p', { className: 'fr-sheet-cal', textContent: 'The plan lives on the wall calendar: update its schedule, meal plan, grocery list and to-dos before you finish.' }),
        el('p', { className: 'fr-sheet-brand', textContent: brand })));
    sheets.append(el('div', { className: 'fr-sheet-wrap' }, sheet));
    sheets.classList.remove('is-compact');
    if (sheet.clientHeight && sheet.scrollHeight > sheet.clientHeight + 1) sheets.classList.add('is-compact');
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--fr-a1', a1);
    host.style.setProperty('--fr-a2', a2);
    host.style.setProperty('--fr-a3', a3);
    for (const b of all<HTMLButtonElement>('[data-fr-palette]')) b.setAttribute('aria-pressed', String(b.dataset.frPalette === s.palette));
    copyFallback.hidden = true;
    fit();
  }
  function fit() {
    for (const wrap of all<HTMLElement>('.fr-sheet-wrap')) {
      const sheet = wrap.firstElementChild as HTMLElement;
      const scale = Math.min(1, wrap.clientWidth / 816 || 1);
      sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
      wrap.style.height = `${Math.ceil(1056 * scale)}px`;
    }
  }

  function renderPlan() {
    renderSteps();
    renderSheets();
  }
  function update() {
    save();
    renderQuestions();
    people.render();
    renderPlan();
  }

  // ---------------------------------------------------------------- wiring
  for (const c of all<HTMLInputElement>('[data-fr-concern]')) {
    c.addEventListener('change', () => {
      started();
      const x = c.dataset.frConcern as Concern;
      s.concerns = c.checked ? CONCERNS.filter((y) => y === x || s.concerns.includes(y)) : s.concerns.filter((y) => y !== x);
      build();
      update();
    });
  }
  $<HTMLInputElement>('[data-fr-other]').addEventListener('change', (e) => { s.other = clean((e.target as HTMLInputElement).value, 40); build(); update(); });
  for (const b of all<HTMLButtonElement>('[data-fr-day]')) b.addEventListener('click', () => { started(); s.day = b.dataset.frDay as MeetDay; update(); });
  $<HTMLInputElement>('[data-fr-other-day]').addEventListener('change', (e) => { s.otherDay = clean((e.target as HTMLInputElement).value, 20); update(); });
  $<HTMLInputElement>('[data-fr-time]').addEventListener('change', (e) => { s.time = (e.target as HTMLInputElement).value; update(); });
  for (const b of all<HTMLButtonElement>('[data-fr-lead]')) {
    b.addEventListener('click', () => {
      started();
      s.lead = b.dataset.frLead as Leadership;
      if (s.lead === 'rotate' && !s.next) s.next = nextAfter(s.helpers, s.leader);
      update();
    });
  }
  $<HTMLSelectElement>('[data-fr-leader]').addEventListener('change', (e) => { started(); s.leader = (e.target as HTMLSelectElement).value || null; update(); });
  $<HTMLSelectElement>('[data-fr-next]').addEventListener('change', (e) => { started(); s.next = (e.target as HTMLSelectElement).value || null; update(); });
  $<HTMLInputElement>('[data-fr-question]').addEventListener('change', (e) => {
    const v = clean((e.target as HTMLInputElement).value, 100).trim();
    s.question = v || resetQuestion(s.helpers);
    s.questionEdited = Boolean(v);
    started();
    update();
  });
  $<HTMLInputElement>('[data-fr-own]').addEventListener('change', (e) => { s.own = clean((e.target as HTMLInputElement).value, 100); started(); update(); });
  $<HTMLButtonElement>('[data-fr-fresh]').addEventListener('click', () => {
    started();
    build();
    say('Fresh suggestions. Your changes stayed.');
    update();
  });
  const familyInput = $<HTMLInputElement>('[data-fr-family]');
  familyInput.value = s.family;
  familyInput.addEventListener('input', () => { s.family = familyInput.value.slice(0, 40); save(); renderSheets(); });
  for (const b of all<HTMLButtonElement>('[data-fr-palette]')) b.addEventListener('click', () => { s.palette = resolveToolPalette(b.dataset.frPalette!); save(); renderSheets(); });
  downloadBtn.addEventListener('click', async () => {
    toolEvent('tool_download_click', 'family-reset');
    const sheet = $<HTMLElement>('.fr-sheet', sheets);
    await downloadPng(sheet, { filename: 'family-weekly-reset.png', width: 816, height: 1056, layoutHost: host, exportClass: 'fr-exporting', button: downloadBtn });
  });
  $<HTMLButtonElement>('[data-fr-copy]').addEventListener('click', () => {
    const when = meetLabel(s.day, s.otherDay, twelve(s.time));
    const lines = ['Our Family Weekly Reset', ...(s.family.trim() ? [s.family.trim()] : []), `${when ? `${when} · ` : ''}${s.steps.reduce((n, x) => n + x.minutes, 0)} minutes together`, ''];
    s.steps.forEach((x, i) => lines.push(`${i + 1}. ${x.title} (${x.minutes} min)`, ...(x.body ? [`   ${x.body}`] : []), ...x.parts.map((p) => `   - ${p}`)));
    lines.push('', `This week’s question: ${s.question}`, ...(s.own.trim() ? [`Our own question: ${s.own.trim()}`] : []));
    lines.push(`This week’s meeting leader: ${s.lead === 'together' ? '__________' : helperById(s.leader)?.name ?? '__________'}`);
    lines.push('', 'Update the wall calendar before you finish.');
    const text = lines.join('\n');
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
  document.fonts?.ready.then(() => renderSheets());
  update();
}

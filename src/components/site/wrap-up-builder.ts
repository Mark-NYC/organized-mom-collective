/**
 * The School Year Wrap-Up Builder's behavior, for every page that shows it (src/components/site/WrapUpBuilder.astro).
 * One implementation: improve it here and every entry point gets it.
 *
 * It opens with a plan straight away once there's a last day (every kind of closeout work on, the family as helpers).
 * Any change re-plans from the rules (src/data/school-wrapup.ts) while keeping what she chose: dates she entered,
 * owners she picked, wording she changed, tasks she removed, added or checked off. "New suggestions" does the same on
 * request; only "Use the suggested dates" clears her dates. Everything saves in this browser.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the builder for a family, e.g. a Club kit. Its own saved
 * plan (the storage key plus `handoff.key`); a first visit starts with `handoff.people` as helpers, `handoff.date` as
 * the last day and `handoff.name` on the plan.
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import { isDay, localToday, longLabel, shortLabel, type Day } from '../../lib/club/countdown';
import {
  assignWrapTasks, cannotOwn, isStudentAge, PICKS, resolveLastDay, shownDate, sortWrap, templateById, timingFor, wrapTasksFor,
  type LastDay, type Phase, type Pick, type Student, type WrapTask,
} from '../../data/school-wrapup';
import { helpersFromHandoff, readHelpers, type Helper } from '../../lib/household-helpers';
import type { ToolHandoff } from '../../lib/tool-handoff';
import { initHelpersEditor } from './helpers-editor';

interface Saved {
  v: 1;
  helpers: Helper[];
  /** The family's last day of school. */
  lastDay: Day | '';
  /** A child's own last day, or not in school (by helper id). */
  own: Record<string, LastDay>;
  picks: Pick[];
  tasks: (WrapTask & { ownTitle?: true })[];
  /** Suggested tasks she removed (their keys), so suggestions don't bring them back. */
  removed: string[];
  /** 'family', or a child's id. */
  printFor: string;
  family: string;
  palette: ToolPaletteId;
  next: number;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const PHASES: Phase[] = ['before', 'after'];
const phaseLabel: Record<Phase, string> = { before: 'Before school ends', after: 'After the last day' };

function readOwn(json: unknown, ids: Set<string>): Record<string, LastDay> {
  const out: Record<string, LastDay> = {};
  if (!json || typeof json !== 'object') return out;
  for (const [id, v] of Object.entries(json as Record<string, Partial<{ kind: string; date: string }>>)) {
    if (!ids.has(id) || !v) continue;
    if (v.kind === 'none') out[id] = { kind: 'none' };
    else if (v.kind === 'own') out[id] = { kind: 'own', date: isDay(v.date) ? v.date : '' };
  }
  return out;
}

function read(key: string): Saved | null {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!o || o.v !== 1) return null;
    const helpers = readHelpers(o.helpers, []);
    if (!helpers.length) return null;
    const ids = new Set(helpers.map((h) => h.id));
    const owner = (x: unknown) => (x === 'everyone' || x === 'each' || (typeof x === 'string' && ids.has(x)) ? (x as string) : null);
    return {
      v: 1, helpers, lastDay: isDay(o.lastDay) ? o.lastDay : '', own: readOwn(o.own, ids),
      picks: Array.isArray(o.picks) ? PICKS.filter((p) => o.picks.includes(p)) : [...PICKS],
      tasks: Array.isArray(o.tasks) ? o.tasks.slice(0, 80).flatMap((x: Partial<WrapTask & { ownTitle: boolean }>) => (typeof x?.key === 'string' && typeof x.title === 'string' && PHASES.includes(x.phase as Phase) ? [{
        key: x.key.slice(0, 120), template: typeof x.template === 'string' ? x.template.slice(0, 30) : null, title: clean(x.title, 100), phase: x.phase as Phase,
        children: Array.isArray(x.children) ? x.children.filter((c): c is string => typeof c === 'string' && ids.has(c)) : [],
        owner: owner(x.owner), suggested: isDay(x.suggested) ? x.suggested : null,
        ...(isDay(x.date) ? { date: x.date } : {}), ...(x.withGrownUp ? { withGrownUp: true } : {}), ...(x.moved ? { moved: true } : {}),
        ...(x.done ? { done: true } : {}), ...(x.pinned ? { pinned: true } : {}), ...(x.ownTitle ? { ownTitle: true as const } : {}),
      }] : [])) : [],
      removed: Array.isArray(o.removed) ? o.removed.filter((k: unknown): k is string => typeof k === 'string').slice(0, 80) : [],
      printFor: typeof o.printFor === 'string' && (o.printFor === 'family' || ids.has(o.printFor)) ? o.printFor : 'family',
      family: clean(o.family, 40), palette: resolveToolPalette(String(o.palette ?? '')), next: Number.isInteger(o.next) ? o.next : 100,
    };
  } catch {
    return null;
  }
}

export function initWrapUpBuilder(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.wuKey!}:${handoff.key}` : host.dataset.wuKey!;
  const brand = host.dataset.wuBrand ?? '';
  const today = localToday();
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
  const status = $<HTMLElement>('[data-wu-status]');
  const groups = $<HTMLElement>('[data-wu-groups]');
  const sheets = $<HTMLElement>('[data-wu-sheets]');
  const copyFallback = $<HTMLTextAreaElement>('[data-wu-copy-fallback]');
  const downloadBtn = $<HTMLButtonElement>('[data-wu-download]');

  const saved = read(key);
  const fromProfile = helpersFromHandoff(handoff);
  const s: Saved = saved ?? {
    v: 1,
    helpers: fromProfile.length ? fromProfile : [
      { id: 'h0', name: 'Adult 1', group: 'adult', age: null, limits: [] },
      { id: 'h1', name: 'Child 1', group: 'school', age: null, limits: [] },
    ],
    lastDay: handoff?.date && isDay(handoff.date) ? handoff.date : '', own: {}, picks: [...PICKS], tasks: [], removed: [],
    printFor: 'family', family: handoff?.name ?? '', palette: resolveToolPalette(''), next: 100,
  };
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'school-wrap-up'); }
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
  const kidsOf = (x: WrapTask) => x.children.map((c) => helperById(c)?.name).filter((n): n is string => Boolean(n));
  const ownerName = (x: WrapTask) => (x.owner === 'everyone' ? 'Everyone' : x.owner === 'each' ? list(kidsOf(x)) : helperById(x.owner)?.name ?? 'Needs someone');

  /** Children in school this year, with the last day that applies to each. */
  const students = (): Student[] => s.helpers.filter(isStudentAge).flatMap((h) => {
    const d = resolveLastDay(s.lastDay, s.own[h.id]);
    return d === null ? [] : [{ helper: h, lastDay: d }];
  });

  /**
   * Re-plan: the suggested tasks for these children, days and picks, minus the ones she removed, with her checks,
   * dates, wording and chosen owners kept; her own tasks stay; then owners for the rest.
   */
  const build = () => {
    const before = new Map(s.tasks.map((x) => [x.key, x]));
    const suggested = wrapTasksFor(students(), s.picks, today).filter((x) => !s.removed.includes(x.key));
    const merged = suggested.map((x) => {
      const was = before.get(x.key);
      if (!was) return x;
      return {
        ...x,
        ...(was.ownTitle ? { title: was.title, ownTitle: true as const } : {}),
        ...(was.date ? { date: was.date } : {}),
        ...(was.done ? { done: true } : {}),
        ...(was.pinned ? { owner: was.owner, pinned: true } : {}),
      };
    });
    const custom = s.tasks.filter((x) => !x.template);
    s.tasks = assignWrapTasks([...merged, ...custom], s.helpers);
  };
  if (!saved) build();

  const people = initHelpersEditor($<HTMLElement>('[data-hp]'), {
    helpers: () => s.helpers,
    setHelpers: (next) => { s.helpers = next; },
    limits: [],
    newId: () => `h${s.next++}`,
    say,
    onChange: (change, h) => {
      started();
      if (change === 'remove') delete s.own[h.id];
      build();
      update();
    },
  });

  // ---------------------------------------------------------------- the questions
  const familyDay = $<HTMLInputElement>('[data-wu-family-day]');
  function renderQuestions() {
    familyDay.value = s.lastDay;
    for (const c of all<HTMLInputElement>('[data-wu-pick]')) c.checked = s.picks.includes(c.dataset.wuPick as Pick);
    $<HTMLElement>('[data-wu-people-note]').textContent = fromProfile.length
      ? 'From your family profile. Each child closes out their own year; grown-ups take what needs a signature or a decision.'
      : 'Add your children and the grown-ups at home. Each child closes out their own year; grown-ups take what needs a signature or a decision.';
    const kids = s.helpers.filter(isStudentAge);
    $<HTMLElement>('[data-wu-kids]').replaceChildren(...kids.map((h) => {
      const own = s.own[h.id] ?? { kind: 'family' };
      const choice = el('select', {});
      choice.setAttribute('aria-label', `${h.name}’s last day`);
      choice.append(
        el('option', { value: 'family', textContent: 'Same day', selected: own.kind === 'family' }),
        el('option', { value: 'own', textContent: 'A different day', selected: own.kind === 'own' }),
        el('option', { value: 'none', textContent: 'Not in school this year', selected: own.kind === 'none' }),
      );
      const date = el('input', { type: 'date', value: own.kind === 'own' ? own.date : '', hidden: own.kind !== 'own' });
      date.setAttribute('aria-label', `${h.name}’s last day of school`);
      choice.addEventListener('change', () => {
        started();
        const v = choice.value;
        if (v === 'family') delete s.own[h.id];
        else s.own[h.id] = v === 'none' ? { kind: 'none' } : { kind: 'own', date: s.lastDay };
        build();
        update();
      });
      date.addEventListener('change', () => {
        started();
        s.own[h.id] = { kind: 'own', date: isDay(date.value) ? date.value : '' };
        build();
        update();
      });
      return el('li', { className: 'wu-kid', dataset: { wuKid: h.id } }, el('span', { textContent: h.name }), choice, date);
    }));
  }

  // ---------------------------------------------------------------- the plan
  /** A line about timing when the last day is close or past: never a list of what's overdue. */
  function renderTiming() {
    const box = $<HTMLElement>('[data-wu-timing]');
    const st = students();
    const dated = st.filter((x) => x.lastDay);
    const lines: string[] = [];
    if (!st.length) lines.push('Add a child to make a plan.');
    else if (!dated.length) lines.push('Enter the last day of school and we’ll suggest a day for each task.');
    for (const day of [...new Set(dated.map((x) => x.lastDay as Day))].sort()) {
      const who = list(dated.filter((x) => x.lastDay === day).map((x) => x.helper.name));
      const t = timingFor(day, today);
      const ofWho = dated.length === st.length && new Set(dated.map((x) => x.lastDay)).size === 1 ? '' : ` for ${who}`;
      if (t === 'tight') lines.push(`School ends ${longLabel(day)}${ofWho}: a few things moved to the days left.`);
      else if (t === 'last-minute') lines.push(`School ends ${longLabel(day)}${ofWho}: just what matters before then, and the rest after.`);
      else if (t === 'today') lines.push(`Today’s the last day${ofWho}: bring everything home, then enjoy the after-school closeout.`);
      else if (t === 'over') lines.push(`School’s out${ofWho}: here’s the after-school closeout, starting today.`);
    }
    box.textContent = lines.join(' ');
    box.hidden = !lines.length;
  }

  function ownerSelect(x: WrapTask) {
    const select = el('select', {});
    select.setAttribute('aria-label', `Who does: ${x.title}`);
    select.append(el('option', { value: '', textContent: 'Needs someone' }));
    if (x.template === 'celebrate' || !x.template) select.append(el('option', { value: 'everyone', textContent: 'Everyone', selected: x.owner === 'everyone' }));
    if (x.children.length > 1 && x.template !== 'celebrate') select.append(el('option', { value: 'each', textContent: `Each their own (${list(kidsOf(x))})`, selected: x.owner === 'each' }));
    for (const h of s.helpers) {
      const why = x.template ? cannotOwn(x, h) : null;
      select.append(el('option', { value: h.id, textContent: `${h.name}${why ? ` (${why})` : ''}`, disabled: Boolean(why), selected: x.owner === h.id }));
    }
    select.addEventListener('change', () => {
      started();
      x.owner = select.value || null;
      x.pinned = true;
      save();
      renderPlan();
    });
    return select;
  }

  function renderGroups() {
    const tasks = sortWrap(s.tasks);
    groups.replaceChildren(...PHASES.map((phase) => {
      const mine = tasks.filter((x) => x.phase === phase);
      const box = el('section', { className: 'wu-group', dataset: { wuGroup: phase } }, el('h3', { textContent: phaseLabel[phase] }));
      if (phase === 'after') box.append(el('p', { className: 'wu-group-note', textContent: 'The Five Favorites Rule: when the papers come home, each child chooses five favorites worth keeping. Five is a suggestion, not a limit.' }));
      if (!mine.length) box.append(el('p', { className: 'wu-group-note', textContent: phase === 'before' ? 'Nothing left before the last day.' : 'Nothing here yet.' }));
      const rows = el('ul', { className: 'wu-rows' });
      for (const x of mine) {
        const li = el('li', { className: `wu-row${x.owner ? '' : ' is-open'}${x.done ? ' is-done' : ''}`, dataset: { wuTask: x.key } });
        const check = el('input', { type: 'checkbox', checked: Boolean(x.done) });
        check.setAttribute('aria-label', `Done: ${x.title}`);
        check.addEventListener('change', () => { started(); x.done = check.checked || undefined; save(); renderPlan(); });
        const text = el('textarea', { value: x.title, maxLength: 100, rows: 1 });
        text.setAttribute('aria-label', 'Task');
        const grow = () => { text.style.height = 'auto'; text.style.height = `${text.scrollHeight + 2}px`; };
        requestAnimationFrame(grow);
        text.addEventListener('input', grow);
        text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); text.blur(); } });
        text.addEventListener('change', () => {
          started();
          const words = text.value.trim();
          if (words) { x.title = words.slice(0, 100); (x as Saved['tasks'][number]).ownTitle = true; }
          save();
          renderPlan();
        });
        const date = el('input', { type: 'date', value: shownDate(x) ?? '' });
        date.setAttribute('aria-label', `Day for: ${x.title}`);
        date.addEventListener('change', () => {
          started();
          if (isDay(date.value)) x.date = date.value; else delete x.date;
          save();
          renderPlan();
        });
        const remove = el('button', { type: 'button', className: 'wu-x', textContent: '×' });
        remove.setAttribute('aria-label', `Remove: ${x.title}`);
        remove.addEventListener('click', () => {
          started();
          if (x.template) s.removed = [...s.removed, x.key];
          s.tasks = s.tasks.filter((y) => y !== x);
          say(`Removed: ${x.title}`);
          update();
        });
        li.append(check, text, date, ownerSelect(x), remove);
        const notes = [
          ...(x.children.length && x.template && x.template !== 'celebrate' && x.owner !== 'each' && !x.children.includes(x.owner ?? '') && x.children.length < s.helpers.filter(isStudentAge).length ? [`For ${list(kidsOf(x))}`] : []),
          ...(x.withGrownUp ? ['With a grown-up helping'] : []),
          ...(x.date ? ['Your date'] : x.moved ? ['Moved to a day that’s still ahead'] : []),
          ...(!x.owner ? ['Needs someone'] : []),
        ];
        if (notes.length) li.append(el('p', { className: 'wu-row-note', textContent: notes.join(' · ') }));
        rows.append(li);
      }
      box.append(rows);
      return box;
    }));
    const who = $<HTMLSelectElement>('[data-wu-add-who]');
    who.replaceChildren(el('option', { value: '', textContent: 'Who?' }), el('option', { value: 'everyone', textContent: 'Everyone' }), ...s.helpers.map((h) => el('option', { value: h.id, textContent: h.name })));
  }

  // ---------------------------------------------------------------- the printout
  /** One child's plan: their own tasks and the celebration; the family's: everything. */
  const familyTask = (x: WrapTask) => !x.template || (templateById(x.template)?.scope === 'family' && x.template !== 'celebrate');
  const forPrint = () => sortWrap(s.tasks).filter((x) => s.printFor === 'family' || (!familyTask(x) && x.children.includes(s.printFor)));
  const FOOT_ROOM = 72;
  function renderSheets(compact = false) {
    sheets.replaceChildren();
    sheets.classList.toggle('is-compact', compact);
    const child = s.printFor === 'family' ? null : helperById(s.printFor);
    const st = students().filter((x) => !child || x.helper.id === child.id);
    const days = [...new Set(st.map((x) => x.lastDay))];
    const sub = !st.length ? '' : days.length === 1
      ? (days[0] ? `Last day of school: ${longLabel(days[0])}` : 'Last day of school: ____________')
      : `Last day of school: ${st.map((x) => `${x.helper.name}, ${x.lastDay ? shortLabel(x.lastDay) : '______'}`).join(' · ')}`;
    const title = child ? `${child.name}’s School Year Wrap-Up` : 'Our School Year Wrap-Up';
    const newSheet = (cont: boolean) => {
      const sheet = el('div', { className: 'wu-sheet', dataset: { wuSheet: title } },
        el('div', { className: 'wu-sheet-family', textContent: s.family.trim() }),
        el('div', { className: 'wu-sheet-title' }, el('span', { className: 'wu-swipe', textContent: title })),
        el('p', { className: 'wu-sheet-sub', textContent: `${sub}${cont ? ' (continued)' : ''}` }));
      sheets.append(el('div', { className: 'wu-sheet-wrap' }, sheet));
      return sheet;
    };
    const foot = (sheet: HTMLElement) => sheet.append(el('div', { className: 'wu-sheet-foot' },
      el('p', { className: 'wu-sheet-cal', textContent: 'Dates are suggestions, not school deadlines. Put the last school events and these days on the family calendar.' }),
      el('p', { className: 'wu-sheet-brand', textContent: brand })));
    let sheet = newSheet(false);
    let rows = 0;
    const full = () => {
      if (!sheet.clientHeight) return rows > 20;
      const top = sheet.getBoundingClientRect().top;
      return (sheet.lastElementChild as HTMLElement).getBoundingClientRect().bottom - top > 1056 - 36 - FOOT_ROOM;
    };
    const tasks = forPrint();
    for (const phase of PHASES) {
      const mine = tasks.filter((x) => x.phase === phase);
      if (!mine.length) continue;
      const head = () => el('div', { className: 'wu-sheet-group' }, el('div', { className: 'wu-sheet-group-head', textContent: phase === 'before' ? 'Before school ends' : 'After school ends' }));
      let block = head();
      sheet.append(block);
      rows += 1;
      for (const [i, x] of mine.entries()) {
        const d = shownDate(x);
        const owner = el('div', { className: 'wu-sheet-owner', textContent: child && (x.owner === 'each' || x.owner === child.id) ? child.name : ownerName(x) });
        if (x.withGrownUp) owner.append(el('small', { textContent: 'with a grown-up' }));
        const row = el('div', { className: 'wu-sheet-row' }, el('span', { className: `wu-sheet-box${x.done ? ' is-done' : ''}` }), el('span', { className: 'wu-sheet-date', textContent: d ? shortLabel(d) : '' }), el('span', { textContent: x.title }), owner);
        block.append(row);
        rows += 1;
        if (full()) {
          row.remove();
          if (i === 0) block.remove();
          foot(sheet);
          sheet = newSheet(true);
          rows = 1;
          block = head();
          sheet.append(block);
          block.append(row);
          rows += 1;
        }
      }
    }
    if (tasks.some((x) => x.template === 'papers')) {
      sheet.append(el('p', { className: 'wu-sheet-five' }, el('strong', { textContent: 'The Five Favorites Rule  ' }), 'When the papers come home, choose five favorites worth keeping. Five is a suggestion, not a limit.'));
      if (full()) sheet.lastElementChild!.remove();
    }
    if (!compact && sheet.clientHeight && sheets.querySelectorAll('.wu-sheet').length === 2 && sheet.querySelectorAll('.wu-sheet-row').length <= 3) return renderSheets(true);
    foot(sheet);
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--wu-a1', a1);
    host.style.setProperty('--wu-a2', a2);
    host.style.setProperty('--wu-a3', a3);
    for (const b of all<HTMLButtonElement>('[data-wu-palette]')) b.setAttribute('aria-pressed', String(b.dataset.wuPalette === s.palette));
    const pf = $<HTMLSelectElement>('[data-wu-print-for]');
    pf.replaceChildren(el('option', { value: 'family', textContent: 'The whole family', selected: s.printFor === 'family' }),
      ...students().map((x) => el('option', { value: x.helper.id, textContent: `${x.helper.name} only`, selected: s.printFor === x.helper.id })));
    copyFallback.hidden = true;
    fit();
  }
  function fit() {
    for (const wrap of all<HTMLElement>('.wu-sheet-wrap')) {
      const sheet = wrap.firstElementChild as HTMLElement;
      const scale = Math.min(1, wrap.clientWidth / 816 || 1);
      sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
      wrap.style.height = `${Math.ceil(1056 * scale)}px`;
    }
  }

  function renderPlan() {
    renderTiming();
    renderGroups();
    renderSheets();
  }
  function update() {
    if (!students().some((x) => x.helper.id === s.printFor)) s.printFor = 'family';
    save();
    renderQuestions();
    people.render();
    renderPlan();
  }

  // ---------------------------------------------------------------- wiring
  familyDay.addEventListener('change', () => {
    started();
    s.lastDay = isDay(familyDay.value) ? familyDay.value : '';
    build();
    update();
  });
  for (const c of all<HTMLInputElement>('[data-wu-pick]')) {
    c.addEventListener('change', () => {
      started();
      const p = c.dataset.wuPick as Pick;
      s.picks = c.checked ? PICKS.filter((x) => x === p || s.picks.includes(x)) : s.picks.filter((x) => x !== p);
      build();
      update();
    });
  }
  $<HTMLButtonElement>('[data-wu-add]').addEventListener('click', () => {
    const input = $<HTMLInputElement>('[data-wu-add-title]');
    const words = input.value.trim();
    if (!words) return say('Type the task first.');
    started();
    const who = $<HTMLSelectElement>('[data-wu-add-who]').value || null;
    s.tasks.push({ key: `own-${s.next++}`, template: null, title: words.slice(0, 100), phase: $<HTMLSelectElement>('[data-wu-add-phase]').value as Phase, children: [], owner: who, suggested: null, ...(who ? { pinned: true } : {}) });
    input.value = '';
    say(`Added: ${words}. Give it a day if it needs one.`);
    update();
  });
  $<HTMLButtonElement>('[data-wu-fresh]').addEventListener('click', () => {
    started();
    build();
    say('Fresh suggestions. Your dates, owners, wording and checks stayed.');
    update();
  });
  $<HTMLButtonElement>('[data-wu-reset-dates]').addEventListener('click', () => {
    const mine = s.tasks.filter((x) => x.date);
    if (!mine.length) return say('Every task already uses the suggested day.');
    if (!confirm(`Use the suggested days for ${mine.length} task${mine.length > 1 ? 's' : ''} you dated yourself? Dates your school gave you will need entering again.`)) return;
    for (const x of mine) delete x.date;
    say('Suggested days restored.');
    update();
  });
  $<HTMLSelectElement>('[data-wu-print-for]').addEventListener('change', (e) => { s.printFor = (e.target as HTMLSelectElement).value; save(); renderSheets(); });
  const familyInput = $<HTMLInputElement>('[data-wu-family]');
  familyInput.value = s.family;
  familyInput.addEventListener('input', () => { s.family = familyInput.value.slice(0, 40); save(); renderSheets(); });
  for (const b of all<HTMLButtonElement>('[data-wu-palette]')) b.addEventListener('click', () => { s.palette = resolveToolPalette(b.dataset.wuPalette!); save(); renderSheets(); });
  downloadBtn.addEventListener('click', async () => {
    toolEvent('tool_download_click', 'school-wrap-up');
    const pages = all<HTMLElement>('.wu-sheet', sheets);
    const who = s.printFor === 'family' ? 'family' : (helperById(s.printFor)?.name ?? 'child').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    for (const [i, sheet] of pages.entries()) {
      await downloadPng(sheet, { filename: `school-wrap-up-${who}${pages.length > 1 ? `-${i + 1}` : ''}.png`, width: 816, height: 1056, layoutHost: host, exportClass: 'wu-exporting', button: downloadBtn });
    }
  });
  $<HTMLButtonElement>('[data-wu-copy]').addEventListener('click', () => {
    const lines = ['Our School Year Wrap-Up', ''];
    for (const st of students()) lines.push(`${st.helper.name}: last day ${st.lastDay ? longLabel(st.lastDay) : 'not set'}`);
    lines.push('');
    for (const phase of PHASES) {
      const mine = sortWrap(s.tasks).filter((x) => x.phase === phase);
      if (!mine.length) continue;
      lines.push(phaseLabel[phase].toUpperCase(), ...mine.map((x) => `${x.done ? '[x]' : '[ ]'} ${shownDate(x) ? `${shortLabel(shownDate(x)!)}: ` : ''}${x.title} (${ownerName(x)})`), '');
    }
    lines.push('Dates are suggestions, not school deadlines. Put them on the family calendar.');
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
  // Pages are filled by measuring: once the plan's fonts arrive, measure again.
  document.fonts?.ready.then(() => renderSheets());
  update();
}

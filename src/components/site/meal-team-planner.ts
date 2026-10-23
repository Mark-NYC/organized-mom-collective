/**
 * The Family Meal Responsibility Planner's behavior, for every page that shows it (src/components/site/
 * MealTeamPlanner.astro). One implementation: improve it here and every entry point gets it.
 *
 * It opens with a plan straight away (dinner, whoever's known, the same jobs all week). Any change re-plans from the
 * job rules (src/data/mealtime-jobs.ts) while keeping what she chose: owners she picked (pinned), jobs she reworded,
 * removed or added. "New suggestions" does the same on request. Everything saves in this browser.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the planner for a family, e.g. a Club kit. Its own saved
 * plan (the storage key plus `handoff.key`); a first visit starts with `handoff.people` as helpers and `handoff.name`
 * on the chart.
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import { responsibilityById, responsibilityImage } from '../../data/responsibilities';
import {
  assignMealJobs, cannotDoMeal, DAYS, jobLabel, mealJobById, mealJobsFor, mealLimitOptions, mealOptions, partLabel, planJobAsMealJob, rotateMealJobs,
  type Meal, type Mode, type Part, type PlanJob,
} from '../../data/mealtime-jobs';
import { helpersFromHandoff, readHelpers, type Helper } from '../../lib/household-helpers';
import type { ToolHandoff } from '../../lib/tool-handoff';
import { initHelpersEditor } from './helpers-editor';

interface Saved {
  v: 1;
  helpers: Helper[];
  meals: Meal[];
  mode: Mode;
  /** Days the family eats at home: 0 Monday … 6 Sunday. */
  days: number[];
  allergy: boolean;
  jobs: PlanJob[];
  /** Jobs she removed (their keys), so suggestions don't bring them back. */
  removed: string[];
  view: 'team' | 'week';
  family: string;
  palette: ToolPaletteId;
  next: number;
}

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];
const PARTS: Part[] = ['week', 'before', 'during', 'after'];
const LIMITS = mealLimitOptions.map((l) => l.id as string);
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function read(key: string): Saved | null {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!o || o.v !== 1) return null;
    const helpers = readHelpers(o.helpers, LIMITS);
    if (!helpers.length) return null;
    const ids = new Set(helpers.map((h) => h.id));
    const meals = Array.isArray(o.meals) ? MEALS.filter((m) => o.meals.includes(m)) : ['dinner' as Meal];
    return {
      v: 1, helpers, meals: meals.length ? meals : ['dinner'], mode: o.mode === 'rotate' ? 'rotate' : 'same',
      days: Array.isArray(o.days) ? [...new Set(o.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) < 7))].sort() as number[] : [0, 1, 2, 3, 4, 5, 6],
      allergy: o.allergy === true,
      jobs: Array.isArray(o.jobs) ? o.jobs.slice(0, 60).flatMap((x: Partial<PlanJob>) => (typeof x?.key === 'string' && typeof x.title === 'string' && PARTS.includes(x.part as Part) ? [{
        key: x.key.slice(0, 40), jobId: typeof x.jobId === 'string' && mealJobById(x.jobId) ? x.jobId : null, title: clean(x.title, 100), part: x.part as Part,
        meal: x.meal === 'week' || MEALS.includes(x.meal as Meal) ? (x.meal as Meal | 'week') : 'week',
        owner: x.owner === 'everyone' || (typeof x.owner === 'string' && ids.has(x.owner)) ? x.owner : null, ...(x.pinned ? { pinned: true } : {}),
      }] : [])) : [],
      removed: Array.isArray(o.removed) ? o.removed.filter((k: unknown): k is string => typeof k === 'string').slice(0, 60) : [],
      view: o.view === 'week' ? 'week' : 'team', family: clean(o.family, 40), palette: resolveToolPalette(String(o.palette ?? '')), next: Number.isInteger(o.next) ? o.next : 100,
    };
  } catch {
    return null;
  }
}

export function initMealTeamPlanner(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.mltKey!}:${handoff.key}` : host.dataset.mltKey!;
  const brand = host.dataset.mltBrand ?? '';
  const $ = <T extends Element>(sel: string, root: ParentNode = host) => root.querySelector<T>(sel)!;
  const all = <T extends Element>(sel: string, root: ParentNode = host) => Array.from(root.querySelectorAll<T>(sel));
  /** A small element builder: properties (and `dataset`) set on the new element, children appended. */
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
    const { dataset, ...rest } = props as { dataset?: Record<string, string> };
    const node = document.createElement(tag);
    Object.assign(node, rest);
    if (dataset) Object.assign(node.dataset, dataset);
    node.append(...kids);
    return node;
  };
  const status = $<HTMLElement>('[data-mlt-status]');
  const team = $<HTMLElement>('[data-mlt-team]');
  const week = $<HTMLElement>('[data-mlt-week]');
  const sheets = $<HTMLElement>('[data-mlt-sheets]');
  const copyFallback = $<HTMLTextAreaElement>('[data-mlt-copy-fallback]');
  const downloadBtn = $<HTMLButtonElement>('[data-mlt-download]');

  const saved = read(key);
  const fromProfile = helpersFromHandoff(handoff);
  const s: Saved = saved ?? {
    v: 1,
    helpers: fromProfile.length ? fromProfile : [{ id: 'h0', name: 'Adult 1', group: 'adult', age: null, limits: [] }],
    meals: ['dinner'], mode: 'same', days: [0, 1, 2, 3, 4, 5, 6], allergy: false, jobs: [], removed: [], view: 'team',
    family: handoff?.name ?? '', palette: resolveToolPalette(''), next: 100,
  };
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'meal-team'); }
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
  const ownerName = (id: string | null) => (id === 'everyone' ? 'Everyone' : helperById(id)?.name ?? 'Needs someone');

  /**
   * Re-plan: the suggested jobs for these meals and this family, minus the ones she removed, with her wording, her
   * pinned owners and her own jobs kept; then owners for the rest.
   */
  const build = () => {
    const before = new Map(s.jobs.map((x) => [x.key, x]));
    const suggested = mealJobsFor(s.meals, s.helpers, s.allergy).filter((x) => !s.removed.includes(x.key));
    const merged = suggested.map((x) => {
      const was = before.get(x.key);
      return was ? { ...x, title: was.title, ...(was.pinned ? { owner: was.owner, pinned: true } : {}) } : x;
    });
    const custom = s.jobs.filter((x) => !x.jobId && (x.meal === 'week' || s.meals.includes(x.meal)));
    // A pinned owner a new limit or the allergy setting now rules out goes back to suggestions.
    for (const x of [...merged, ...custom]) {
      const h = x.pinned ? helperById(x.owner) : undefined;
      const why = h ? cannotDoMeal(planJobAsMealJob(x), h, s.allergy) : null;
      if (why && !why.startsWith('suggested')) x.pinned = false;
    }
    s.jobs = assignMealJobs([...merged, ...custom], s.helpers, s.allergy);
  };
  if (!saved) build();

  const people = initHelpersEditor($<HTMLElement>('[data-hp]'), {
    helpers: () => s.helpers,
    setHelpers: (next) => { s.helpers = next; },
    limits: mealLimitOptions,
    newId: () => `h${s.next++}`,
    say,
    onChange: (change) => {
      started();
      if (change !== 'name') build();
      update();
    },
  });

  // ---------------------------------------------------------------- the questions
  function renderQuestions() {
    for (const b of all<HTMLButtonElement>('[data-mlt-meal]')) b.setAttribute('aria-pressed', String(s.meals.includes(b.dataset.mltMeal as Meal)));
    for (const b of all<HTMLButtonElement>('[data-mlt-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mltMode === s.mode));
    for (const b of all<HTMLButtonElement>('[data-mlt-day]')) b.setAttribute('aria-pressed', String(s.days.includes(Number(b.dataset.mltDay))));
    for (const b of all<HTMLButtonElement>('[data-mlt-view]')) b.setAttribute('aria-pressed', String(b.dataset.mltView === s.view));
    $<HTMLInputElement>('[data-mlt-allergy]').checked = s.allergy;
    $<HTMLElement>('[data-mlt-mode-note]').textContent = s.mode === 'same'
      ? 'Each person owns the same job every day. Easiest for younger children to remember.'
      : 'Jobs move to the next person each day you eat at home. The weekly thinking stays put.';
    $<HTMLElement>('[data-mlt-people-note]').textContent = fromProfile.length
      ? 'From your family profile. Remove anyone who isn’t helping, add anyone who is, and note any limits.'
      : 'Add everyone who eats at home. Limits are optional: we’ll only suggest jobs that fit.';
  }

  /** Who carries the thinking: named, so it's visible, and a nudge when one grown-up holds all of it. */
  function renderBalance() {
    const thinking = s.jobs.filter((x) => x.meal === 'week' && x.owner && x.owner !== 'everyone');
    const by = new Map<string, string[]>();
    for (const x of thinking) by.set(x.owner!, [...(by.get(x.owner!) ?? []), (mealJobById(x.jobId ?? '')?.short ?? x.title).toLowerCase()]);
    const parts = [...by].map(([id, jobs]) => `${ownerName(id)}: ${list(jobs)}`);
    const adults = s.helpers.filter((h) => h.group === 'adult');
    const heavy = adults.find((a) => thinking.length > 1 && thinking.every((x) => x.owner === a.id));
    $<HTMLElement>('[data-mlt-balance]').textContent = `The thinking behind meals is shared too. ${parts.join('; ')}.${heavy && adults.length > 1 ? ` ${heavy.name} has all of it: give some to ${list(adults.filter((a) => a !== heavy).map((a) => a.name))}?` : ''}`;
  }

  function ownerSelect(x: PlanJob) {
    const job = planJobAsMealJob(x);
    const select = el('select', {});
    select.setAttribute('aria-label', `Who does: ${x.title}`);
    select.append(el('option', { value: '', textContent: 'Needs someone' }));
    if (x.meal !== 'week') select.append(el('option', { value: 'everyone', textContent: 'Everyone', selected: x.owner === 'everyone' }));
    for (const h of s.helpers) {
      const why = cannotDoMeal(job, h, s.allergy);
      const hard = why && !why.startsWith('suggested');
      select.append(el('option', { value: h.id, textContent: `${h.name}${hard ? ` (${why})` : ''}`, disabled: Boolean(hard), selected: x.owner === h.id }));
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

  function renderTeam() {
    team.replaceChildren(...PARTS.map((part) => {
      const jobs = s.jobs.filter((x) => x.part === part);
      const box = el('section', { className: 'mlt-part', dataset: { mltPart: part } }, el('h3', { textContent: partLabel[part] }));
      if (part === 'week') box.append(el('p', { className: 'mlt-part-note', textContent: 'Meals go in the calendar’s meal plan; groceries in its grocery list. These jobs keep them filled.' }));
      const rows = el('ul', { className: 'mlt-rows' });
      for (const x of jobs) {
        const li = el('li', { className: `mlt-row${x.owner ? '' : ' is-open'}`, dataset: { mltJob: x.key } });
        const text = el('textarea', { value: jobLabel(x, s.meals), maxLength: 100, rows: 1 });
        text.setAttribute('aria-label', 'Job');
        const grow = () => { text.style.height = 'auto'; text.style.height = `${text.scrollHeight + 2}px`; };
        requestAnimationFrame(grow);
        text.addEventListener('input', grow);
        text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); text.blur(); } });
        text.addEventListener('change', () => {
          started();
          const words = text.value.replace(/^(Breakfast|Lunch|Dinner): /, '').trim();
          if (words) x.title = words.slice(0, 100);
          save();
          renderPlan();
        });
        const remove = el('button', { type: 'button', className: 'mlt-x', textContent: '×' });
        remove.setAttribute('aria-label', `Remove: ${x.title}`);
        remove.addEventListener('click', () => {
          started();
          if (x.jobId) s.removed = [...s.removed, x.key];
          s.jobs = s.jobs.filter((y) => y !== x);
          say(`Removed: ${x.title}`);
          update();
        });
        li.append(text, ownerSelect(x), remove);
        const h = helperById(x.owner);
        const job = planJobAsMealJob(x);
        const why = h ? cannotDoMeal(job, h, s.allergy) : null;
        if (!x.owner) li.append(el('p', { className: 'mlt-row-note', textContent: 'Needs someone: nobody listed can do this one yet.' }));
        else if (why) li.append(el('p', { className: 'mlt-row-note', textContent: `${why.replace(/^s/, 'S')}: your call.` }));
        else if (h && h.group !== 'adult' && job.supervised) li.append(el('p', { className: 'mlt-row-note', textContent: 'With a grown-up nearby until they’ve got it.' }));
        rows.append(li);
      }
      box.append(rows);
      return box;
    }));

    // Add a job of her own.
    const part = el('select', {});
    part.setAttribute('aria-label', 'Part of mealtime');
    part.append(...($<HTMLTemplateElement>('[data-mlt-parts]').content.cloneNode(true) as DocumentFragment).children);
    const title = el('input', { type: 'text', placeholder: 'A job of your own', maxLength: 100 });
    title.setAttribute('aria-label', 'Your own job');
    const who = el('select', {});
    who.setAttribute('aria-label', 'Who does it');
    who.append(el('option', { value: '', textContent: 'Who?' }), el('option', { value: 'everyone', textContent: 'Everyone' }), ...s.helpers.map((h) => el('option', { value: h.id, textContent: h.name })));
    const add = el('button', { type: 'button', className: 'mlt-link', textContent: 'Add' });
    add.addEventListener('click', () => {
      const words = title.value.trim();
      if (!words) return say('Type the job first.');
      started();
      const p = part.value as Part;
      s.jobs.push({ key: `own-${s.next++}`, jobId: null, title: words.slice(0, 100), part: p, meal: p === 'week' ? 'week' : s.meals[s.meals.length - 1], owner: who.value || null, pinned: Boolean(who.value) });
      if (!who.value) s.jobs = assignMealJobs(s.jobs, s.helpers, s.allergy);
      say(`Added: ${words}`);
      update();
    });
    team.append(el('div', { className: 'mlt-add' }, part, title, who, add));
  }

  const homeDays = () => (s.days.length ? s.days : [0, 1, 2, 3, 4, 5, 6]);
  const daysLabel = () => (homeDays().length === 7 ? 'every day' : list(homeDays().map((d) => DAYS[d])));
  const rotation = () => rotateMealJobs(s.jobs, s.helpers, homeDays(), s.allergy);
  const shortOf = (x: PlanJob) => {
    const sh = mealJobById(x.jobId ?? '')?.short ?? x.title;
    return s.meals.length > 1 && x.meal !== 'week' ? `${mealOptions.find((m) => m.id === x.meal)!.label[0]}: ${sh}` : sh;
  };
  /** Who does what on one day: person id → short job labels. */
  const dayJobs = (day: number) => {
    const rot = s.mode === 'rotate' ? rotation().get(day) : null;
    const out = new Map<string, string[]>();
    for (const x of s.jobs.filter((y) => y.meal !== 'week' && y.owner !== 'everyone')) {
      const owner = rot?.get(x.key) ?? x.owner;
      if (owner) out.set(owner, [...(out.get(owner) ?? []), shortOf(x)]);
    }
    return out;
  };

  function renderWeek() {
    if (s.mode === 'same') {
      const today = dayJobs(homeDays()[0]);
      const everyone = s.jobs.filter((x) => x.owner === 'everyone').map((x) => shortOf(x).toLowerCase());
      week.replaceChildren(el('div', { className: 'mlt-week-same' },
        el('p', { textContent: `The same jobs ${daysLabel()} you eat at home:` }),
        ...s.helpers.filter((h) => today.has(h.id)).map((h) => el('p', {}, el('strong', { textContent: `${h.name}: ` }), list(today.get(h.id)!))),
        ...(everyone.length ? [el('p', {}, el('strong', { textContent: 'Everyone: ' }), list(everyone))] : []),
        el('p', {}, el('strong', { textContent: 'Once a week: ' }), list(s.jobs.filter((x) => x.meal === 'week').map((x) => `${shortOf(x).toLowerCase()} (${ownerName(x.owner)})`)))));
      return;
    }
    const rowsFor = homeDays();
    const ppl = s.helpers.filter((h) => rowsFor.some((d) => dayJobs(d).has(h.id)));
    const table = el('table', { className: 'mlt-grid' },
      el('thead', {}, el('tr', {}, el('th', { textContent: 'Day' }), ...ppl.map((h) => el('th', { textContent: h.name })))),
      el('tbody', {}, ...rowsFor.map((d) => {
        const jobs = dayJobs(d);
        return el('tr', {}, el('th', { textContent: DAYS[d] }), ...ppl.map((h) => el('td', { textContent: (jobs.get(h.id) ?? ['—']).join(', ') })));
      })));
    week.replaceChildren(el('p', { className: 'mlt-part-note', textContent: 'Jobs move along each day. The weekly thinking and “everyone” jobs stay the same.' }), el('div', { className: 'mlt-grid-wrap' }, table));
  }

  // ---------------------------------------------------------------- printouts
  /** A fine-line mark for each part of mealtime, for jobs the illustration library doesn't cover. */
  const PART_ICON: Record<Part, string> = {
    week: '<rect x="9" y="7" width="14" height="18" rx="2"/><path d="M12.5 12h7M12.5 16h7M12.5 20h4"/>',
    before: '<path d="M8 15h16a8 8 0 0 1-16 0z"/><path d="M14 11c0-2 2-2 2-4M18 11c0-2 2-2 2-4"/>',
    during: '<circle cx="16" cy="16" r="8"/><circle cx="16" cy="16" r="4.5"/>',
    after: '<path d="M10 22l9-9M17 11l4 4M9 23h4"/><path d="M22 8v3M20.5 9.5h3"/>',
  };
  const partIcon = (part: Part) => {
    const span = el('span', { className: 'mlt-sheet-art mlt-sheet-icon' });
    span.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${PART_ICON[part]}</svg>`;
    return span;
  };
  /** Room left for the footer on each page. */
  const FOOT_ROOM = 72;
  function renderSheets(compact = false) {
    sheets.replaceChildren();
    sheets.classList.toggle('is-compact', compact);
    const sub = `${list(s.meals.map((m) => mealOptions.find((o) => o.id === m)!.label))} · ${s.mode === 'same' ? 'the same jobs all week' : 'jobs rotate: see the week'}`;
    const newSheet = (title: string, subtitle: string) => {
      const sheet = el('div', { className: 'mlt-sheet', dataset: { mltSheet: title } },
        el('div', { className: 'mlt-sheet-family', textContent: s.family.trim() }),
        el('div', { className: 'mlt-sheet-title' }, el('span', { className: 'mlt-swipe', textContent: title })),
        el('p', { className: 'mlt-sheet-sub', textContent: subtitle }));
      sheets.append(el('div', { className: 'mlt-sheet-wrap' }, sheet));
      return sheet;
    };
    const foot = (sheet: HTMLElement) => sheet.append(el('div', { className: 'mlt-sheet-foot' },
      el('p', { className: 'mlt-sheet-cal', textContent: 'Meals go in the wall calendar’s meal plan, groceries in its grocery list. This chart shows who makes each part happen.' }),
      el('p', { className: 'mlt-sheet-brand', textContent: brand })));
    // Pages fill by measuring (laid out at full size, before scaling), so long names and extra jobs move to a new page
    // instead of running off this one. Hidden (no layout), it falls back to a row count.
    let sheet = newSheet('Our Mealtime Team', sub);
    let rows = 0;
    const full = () => {
      if (!sheet.clientHeight) return rows > 18;
      const top = sheet.getBoundingClientRect().top;
      return (sheet.lastElementChild as HTMLElement).getBoundingClientRect().bottom - top > 1056 - 36 - FOOT_ROOM;
    };
    const nextPage = (part: Part) => {
      foot(sheet);
      sheet = newSheet('Our Mealtime Team', `${sub} (continued)`);
      rows = 0;
      const block = el('div', { className: 'mlt-sheet-part' }, el('div', { className: 'mlt-sheet-part-head', textContent: `${partLabel[part]} (continued)` }));
      sheet.append(block);
      return block;
    };
    for (const part of PARTS) {
      const jobs = s.jobs.filter((x) => x.part === part);
      if (!jobs.length) continue;
      let block = el('div', { className: 'mlt-sheet-part' }, el('div', { className: 'mlt-sheet-part-head', textContent: partLabel[part] }));
      sheet.append(block);
      rows += 1;
      for (const [i, x] of jobs.entries()) {
        const job = planJobAsMealJob(x);
        const r = job.illustration ? responsibilityById(job.illustration) : undefined;
        const src = r ? responsibilityImage(r, 128) : null;
        const art = src ? el('img', { className: 'mlt-sheet-art', src, alt: '', width: 30, height: 30 }) : partIcon(part);
        const h = helperById(x.owner);
        const owner = el('div', { className: 'mlt-sheet-owner', textContent: ownerName(x.owner) });
        if (h && h.group !== 'adult' && job.supervised) owner.append(el('small', { textContent: 'with a grown-up nearby' }));
        const row = el('div', { className: 'mlt-sheet-row' }, art, el('span', { textContent: jobLabel(x, s.meals) }), owner);
        block.append(row);
        rows += 1;
        if (full()) {
          row.remove();
          // A heading never sits alone at the bottom of a page.
          if (i === 0) block.remove();
          block = i === 0 ? (() => { foot(sheet); sheet = newSheet('Our Mealtime Team', `${sub} (continued)`); rows = 1; const b = el('div', { className: 'mlt-sheet-part' }, el('div', { className: 'mlt-sheet-part-head', textContent: partLabel[part] })); sheet.append(b); return b; })() : nextPage(part);
          block.append(row);
          rows += 1;
        }
      }
    }
    // Only a few jobs spilled onto a second page: set the chart a little tighter so it stays on one.
    if (!compact && sheet.clientHeight && sheets.querySelectorAll('.mlt-sheet').length === 2 && sheet.querySelectorAll('.mlt-sheet-row').length <= 3) return renderSheets(true);
    foot(sheet);
    if (s.mode === 'rotate') {
      const w = newSheet('Our Weekly Meal Responsibilities', 'Jobs move along each day. The weekly thinking stays the same.');
      const ppl = s.helpers.filter((h) => homeDays().some((d) => dayJobs(d).has(h.id)));
      w.append(el('table', { className: 'mlt-sheet-grid' },
        el('thead', {}, el('tr', {}, el('th', { textContent: '' }), ...ppl.map((h) => el('th', { textContent: h.name })))),
        el('tbody', {}, ...homeDays().map((d) => {
          const jobs = dayJobs(d);
          return el('tr', {}, el('td', { textContent: DAYS[d] }), ...ppl.map((h) => el('td', { textContent: (jobs.get(h.id) ?? ['—']).join(', ') })));
        }))));
      const thinking = s.jobs.filter((x) => x.meal === 'week').map((x) => `${shortOf(x)}: ${ownerName(x.owner)}`);
      if (thinking.length) w.append(el('p', { className: 'mlt-sheet-week', textContent: `Every week: ${thinking.join(' · ')}` }));
      foot(w);
    }
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--mlt-a1', a1);
    host.style.setProperty('--mlt-a2', a2);
    host.style.setProperty('--mlt-a3', a3);
    for (const b of all<HTMLButtonElement>('[data-mlt-palette]')) b.setAttribute('aria-pressed', String(b.dataset.mltPalette === s.palette));
    copyFallback.hidden = true;
    fit();
  }
  function fit() {
    for (const wrap of all<HTMLElement>('.mlt-sheet-wrap')) {
      const sheet = wrap.firstElementChild as HTMLElement;
      const scale = Math.min(1, wrap.clientWidth / 816 || 1);
      sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
      wrap.style.height = `${Math.ceil(1056 * scale)}px`;
    }
  }

  function renderPlan() {
    team.hidden = s.view !== 'team';
    week.hidden = s.view !== 'week';
    renderBalance();
    renderTeam();
    renderWeek();
    renderSheets();
  }
  function update() {
    save();
    renderQuestions();
    people.render();
    renderPlan();
  }

  // ---------------------------------------------------------------- wiring
  for (const b of all<HTMLButtonElement>('[data-mlt-meal]')) {
    b.addEventListener('click', () => {
      started();
      const m = b.dataset.mltMeal as Meal;
      if (s.meals.includes(m) && s.meals.length === 1) return say('Keep at least one meal.');
      s.meals = s.meals.includes(m) ? s.meals.filter((x) => x !== m) : MEALS.filter((x) => x === m || s.meals.includes(x));
      build();
      update();
    });
  }
  for (const b of all<HTMLButtonElement>('[data-mlt-mode]')) b.addEventListener('click', () => { started(); s.mode = b.dataset.mltMode as Mode; update(); });
  for (const b of all<HTMLButtonElement>('[data-mlt-day]')) {
    b.addEventListener('click', () => {
      started();
      const d = Number(b.dataset.mltDay);
      s.days = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort();
      update();
    });
  }
  for (const b of all<HTMLButtonElement>('[data-mlt-view]')) b.addEventListener('click', () => { s.view = b.dataset.mltView as Saved['view']; save(); renderQuestions(); renderPlan(); });
  $<HTMLInputElement>('[data-mlt-allergy]').addEventListener('change', (e) => {
    started();
    s.allergy = (e.target as HTMLInputElement).checked;
    build();
    say(s.allergy ? 'Choosing meals, cooking and leftovers are now grown-ups’ jobs.' : 'Allergy setting off.');
    update();
  });
  $<HTMLButtonElement>('[data-mlt-fresh]').addEventListener('click', () => {
    started();
    build();
    say('Fresh suggestions. Owners you chose, your wording and your own jobs stayed.');
    update();
  });
  const familyInput = $<HTMLInputElement>('[data-mlt-family]');
  familyInput.value = s.family;
  familyInput.addEventListener('input', () => { s.family = familyInput.value.slice(0, 40); save(); renderSheets(); });
  for (const b of all<HTMLButtonElement>('[data-mlt-palette]')) b.addEventListener('click', () => { s.palette = resolveToolPalette(b.dataset.mltPalette!); save(); renderSheets(); });
  downloadBtn.addEventListener('click', async () => {
    toolEvent('tool_download_click', 'meal-team');
    const pages = all<HTMLElement>('.mlt-sheet', sheets);
    for (const [i, sheet] of pages.entries()) {
      await downloadPng(sheet, { filename: `mealtime-team${pages.length > 1 ? `-${i + 1}` : ''}.png`, width: 816, height: 1056, layoutHost: host, exportClass: 'mlt-exporting', button: downloadBtn });
    }
  });
  $<HTMLButtonElement>('[data-mlt-copy]').addEventListener('click', () => {
    const lines = ['Our Mealtime Team', ''];
    for (const part of PARTS) {
      const jobs = s.jobs.filter((x) => x.part === part);
      if (!jobs.length) continue;
      lines.push(partLabel[part].toUpperCase(), ...jobs.map((x) => `${ownerName(x.owner)}: ${jobLabel(x, s.meals)}`), '');
    }
    if (s.mode === 'rotate') for (const d of homeDays()) lines.push(`${DAYS[d]}: ${[...dayJobs(d)].map(([id, jobs]) => `${ownerName(id)} ${jobs.join(', ')}`).join('; ')}`);
    lines.push('', 'Meals go in the wall calendar’s meal plan, groceries in its grocery list.');
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
  // Pages are filled by measuring: once the chart's fonts arrive, measure again.
  document.fonts?.ready.then(() => renderSheets());
  update();
}

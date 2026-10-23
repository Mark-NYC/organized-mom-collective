/**
 * The Family Packing & Independence Builder's behavior, for every page that shows it (src/components/site/
 * PackingBuilder.astro). One implementation: improve it here and every entry point gets it.
 *
 * It opens with lists straight away (a pool trip for a few hours, whoever's known). Any change re-plans from the rules
 * (src/data/packing.ts) while keeping what she chose: wording she changed, items she moved between sections, reordered,
 * removed, added or checked, and owners she picked on the shared list. "New suggestions" does the same on request.
 * Lists can be saved under a name in this browser and opened again ("Leo’s Pool Bag").
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the builder for a family, e.g. a Club kit. Its own saved
 * lists (the storage key plus `handoff.key`); a first visit starts with `handoff.people`, the outing in `handoff.variant`
 * and `handoff.name` on the printouts.
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import { responsibilityById, responsibilityImage } from '../../data/responsibilities';
import {
  assignShared, cannotOwnShared, defaultPrefs, lengthOptions, OUTINGS, outingOptions, packCheckUnpack, personList, prefsFor, sharedList, stageOf, templateName,
  type Length, type Outing, type PackItem, type PackingInput, type Pref, type SharedPackItem,
} from '../../data/packing';
import { helpersFromHandoff, readHelpers, type Helper } from '../../lib/household-helpers';
import type { ToolHandoff } from '../../lib/tool-handoff';
import { initHelpersEditor } from './helpers-editor';

interface Saved {
  v: 1;
  helpers: Helper[];
  outing: Outing;
  length: Length;
  nights: number;
  prefs: Pref[];
  /** Each person's list, by helper id, in her order. */
  lists: Record<string, PackItem[]>;
  /** Suggested items she removed, by helper id. */
  removed: Record<string, string[]>;
  shared: SharedPackItem[];
  sharedRemoved: string[];
  /** 'all', 'shared' or a helper id. */
  printFor: string;
  family: string;
  palette: ToolPaletteId;
  next: number;
}
interface Template { name: string; at: string; plan: Saved }

const LENGTHS: Length[] = ['hours', 'day', 'overnight', 'multi'];
const PREFS: Pref[] = ['swim', 'outdoors', 'cool', 'camp-list', 'laundry'];
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
const MAX_TEMPLATES = 12;

function readItems(json: unknown): PackItem[] {
  if (!Array.isArray(json)) return [];
  return json.slice(0, 40).flatMap((x: Partial<PackItem>) => (typeof x?.key === 'string' && typeof x.title === 'string' ? [{
    key: x.key.slice(0, 40), itemId: typeof x.itemId === 'string' ? x.itemId.slice(0, 30) : null, title: clean(x.title, 80),
    section: x.section === 'help' ? 'help' : 'self', ...(typeof x.icon === 'string' && responsibilityById(x.icon) ? { icon: x.icon } : {}),
    ...(x.critical ? { critical: true as const } : {}), ...(x.done ? { done: true } : {}), ...(x.edited ? { edited: true as const } : {}),
  } satisfies PackItem] : []));
}
function readPlan(o: Record<string, unknown> | null): Saved | null {
  if (!o || o.v !== 1) return null;
  const helpers = readHelpers(o.helpers, []);
  if (!helpers.length) return null;
  const ids = new Set(helpers.map((h) => h.id));
  const lists: Record<string, PackItem[]> = {};
  const removed: Record<string, string[]> = {};
  for (const id of ids) {
    lists[id] = readItems((o.lists as Record<string, unknown> | undefined)?.[id]);
    const r = (o.removed as Record<string, unknown> | undefined)?.[id];
    removed[id] = Array.isArray(r) ? r.filter((k): k is string => typeof k === 'string').slice(0, 40) : [];
  }
  return {
    v: 1, helpers, outing: OUTINGS.includes(o.outing as Outing) ? (o.outing as Outing) : 'pool', length: LENGTHS.includes(o.length as Length) ? (o.length as Length) : 'hours',
    nights: Number.isInteger(o.nights) ? Math.min(21, Math.max(1, o.nights as number)) : 3,
    prefs: Array.isArray(o.prefs) ? PREFS.filter((p) => (o.prefs as unknown[]).includes(p)) : [],
    lists, removed,
    shared: Array.isArray(o.shared) ? (o.shared as Partial<SharedPackItem>[]).slice(0, 30).flatMap((x) => (typeof x?.key === 'string' && typeof x.title === 'string' ? [{
      key: x.key.slice(0, 40), itemId: typeof x.itemId === 'string' ? x.itemId : null, title: clean(x.title, 80), owner: typeof x.owner === 'string' && ids.has(x.owner) ? x.owner : null,
      ...(x.critical ? { critical: true as const } : {}), ...(x.done ? { done: true } : {}), ...(x.pinned ? { pinned: true as const } : {}),
    }] : [])) : [],
    sharedRemoved: Array.isArray(o.sharedRemoved) ? (o.sharedRemoved as unknown[]).filter((k): k is string => typeof k === 'string').slice(0, 30) : [],
    printFor: typeof o.printFor === 'string' && (o.printFor === 'all' || o.printFor === 'shared' || ids.has(o.printFor)) ? o.printFor : 'all',
    family: clean(o.family, 40), palette: resolveToolPalette(String(o.palette ?? '')), next: Number.isInteger(o.next) ? (o.next as number) : 100,
  };
}
const parse = (raw: string | null) => {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
};

export function initPackingBuilder(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.pkKey!}:${handoff.key}` : host.dataset.pkKey!;
  const templatesKey = `${key}:saved-lists`;
  const brand = host.dataset.pkBrand ?? '';
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
  const status = $<HTMLElement>('[data-pk-status]');
  const listsBox = $<HTMLElement>('[data-pk-lists]');
  const sheets = $<HTMLElement>('[data-pk-sheets]');
  const copyFallback = $<HTMLTextAreaElement>('[data-pk-copy-fallback]');
  const downloadBtn = $<HTMLButtonElement>('[data-pk-download]');

  let saved: Saved | null = null;
  try {
    saved = readPlan(parse(localStorage.getItem(key)));
  } catch {
    saved = null;
  }
  const fromProfile = helpersFromHandoff(handoff);
  const startOuting: Outing = handoff?.variant && OUTINGS.includes(handoff.variant as Outing) ? (handoff.variant as Outing) : 'pool';
  let s: Saved = saved ?? {
    v: 1,
    helpers: fromProfile.length ? fromProfile : [
      { id: 'h0', name: 'Adult 1', group: 'adult', age: null, limits: [] },
      { id: 'h1', name: 'Child 1', group: 'school', age: null, limits: [] },
    ],
    outing: startOuting, length: outingOptions.find((o) => o.id === startOuting)!.length, nights: 3, prefs: defaultPrefs(startOuting),
    lists: {}, removed: {}, shared: [], sharedRemoved: [], printFor: 'all', family: handoff?.name ?? '', palette: resolveToolPalette(''), next: 100,
  };
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'packing'); }
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
  const input = (): PackingInput => ({ outing: s.outing, length: s.length, nights: s.nights, prefs: s.prefs.filter((p) => prefsFor(s.outing, s.length).includes(p)) });
  const helperById = (id: string | null) => s.helpers.find((h) => h.id === id);
  const outingLabel = () => outingOptions.find((o) => o.id === s.outing)!.label;
  const lengthLabel = () => (s.length === 'multi' ? `${s.nights} night${s.nights === 1 ? '' : 's'}` : lengthOptions.find((l) => l.id === s.length)!.label);

  /**
   * Re-plan: each person's suggested items for this outing, minus the ones she removed; her items keep her wording,
   * section, check and order, new suggestions slot in, her own items stay. The shared list the same way, with owners.
   */
  const build = (rebalance = false) => {
    const o = input();
    const lists: Record<string, PackItem[]> = {};
    for (const h of s.helpers) {
      const before = s.lists[h.id] ?? [];
      const removed = s.removed[h.id] ?? [];
      const fresh = personList(h, o).filter((x) => !removed.includes(x.key));
      const freshByKey = new Map(fresh.map((x) => [x.key, x]));
      const kept = before.flatMap((x) => {
        if (!x.itemId) return [x];
        const f = freshByKey.get(x.key);
        if (!f) return [];
        return [{ ...f, ...(x.edited ? { title: x.title, section: x.section, edited: true as const } : {}), ...(x.done ? { done: true } : {}) }];
      });
      const keys = new Set(kept.map((x) => x.key));
      const out = [...kept];
      for (const f of fresh) {
        if (keys.has(f.key)) continue;
        // A new suggestion goes at the end of its section.
        const last = out.map((x) => x.section).lastIndexOf(f.section);
        out.splice(last < 0 ? (f.section === 'self' ? 0 : out.length) : last + 1, 0, f);
      }
      lists[h.id] = out;
    }
    s.lists = lists;
    const before = new Map(s.shared.map((x) => [x.key, x]));
    const sharedFresh = sharedList(o).filter((x) => !s.sharedRemoved.includes(x.key)).map((x) => {
      const was = before.get(x.key);
      return was ? { ...x, title: was.title, ...(was.done ? { done: true } : {}), ...(was.pinned ? { owner: was.owner, pinned: true as const } : {}), ...(!rebalance && was.owner ? { owner: was.owner, keep: true } : {}) } : x;
    });
    // Owners already on the list stay put (only who's going changing re-balances them); she can always reassign.
    const kept = [...sharedFresh, ...s.shared.filter((x) => !x.itemId)].map((x) => ('keep' in x && x.keep ? { ...x, pinned: true as const } : x));
    s.shared = assignShared(kept, s.helpers).map((x) => {
      const { keep, pinned, ...rest } = x as SharedPackItem & { keep?: boolean };
      // Her own choices stay pinned; owners kept only for stability don't.
      return pinned && !(keep && !before.get(x.key)?.pinned) ? { ...rest, pinned } : rest;
    });
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
      if (change === 'remove') { delete s.lists[h.id]; delete s.removed[h.id]; }
      // A new age or group means new words: suggestions for that person start again (her own items stay).
      if (change === 'age' || change === 'group') s.lists[h.id] = (s.lists[h.id] ?? []).filter((x) => !x.itemId);
      if (change !== 'name') build(true);
      update();
    },
  });

  // ---------------------------------------------------------------- the questions
  function renderQuestions() {
    for (const b of all<HTMLButtonElement>('[data-pk-outing]')) b.setAttribute('aria-pressed', String(b.dataset.pkOuting === s.outing));
    for (const b of all<HTMLButtonElement>('[data-pk-length]')) b.setAttribute('aria-pressed', String(b.dataset.pkLength === s.length));
    $<HTMLElement>('[data-pk-nights-box]').hidden = s.length !== 'multi';
    $<HTMLInputElement>('[data-pk-nights]').value = String(s.nights);
    const relevant = prefsFor(s.outing, s.length);
    for (const box of all<HTMLElement>('[data-pk-pref-box]')) box.hidden = !relevant.includes(box.dataset.pkPrefBox as Pref);
    for (const c of all<HTMLInputElement>('[data-pk-pref]')) c.checked = s.prefs.includes(c.dataset.pkPref as Pref);
    $<HTMLElement>('[data-pk-prefs-box]').hidden = !relevant.length;
    $<HTMLElement>('[data-pk-people-note]').textContent = fromProfile.length
      ? 'From your family profile. Remove anyone who isn’t going on this one; add anyone who is.'
      : 'Add everyone going on this outing. Remove anyone who’s staying home.';
    renderSaved();
    const nameBox = $<HTMLInputElement>('[data-pk-save-name]');
    if (!nameBox.value || nameBox.dataset.auto) { nameBox.value = templateName(input(), s.helpers); nameBox.dataset.auto = '1'; }
  }

  // ---------------------------------------------------------------- the lists
  function itemRow(h: Helper, x: PackItem, list: PackItem[]) {
    const child = h.group !== 'adult';
    const li = el('li', { className: `pk-row${x.done ? ' is-done' : ''}`, dataset: { pkItem: x.key } });
    const check = el('input', { type: 'checkbox', checked: Boolean(x.done) });
    check.setAttribute('aria-label', `Packed: ${x.title}`);
    check.addEventListener('change', () => { started(); x.done = check.checked || undefined; save(); renderAll(); });
    const text = el('input', { type: 'text', value: x.title, maxLength: 80 });
    text.setAttribute('aria-label', `Item on ${h.name}’s list`);
    text.addEventListener('change', () => {
      started();
      const words = text.value.trim();
      if (words) { x.title = words.slice(0, 80); x.edited = true; }
      save();
      renderAll();
    });
    li.append(check, text);
    if (child) {
      const swap = el('button', { type: 'button', className: 'pk-swap', textContent: x.section === 'self' ? 'A grown-up helps' : 'I can pack it' });
      swap.setAttribute('aria-label', `${x.section === 'self' ? 'Move to “A grown-up helps with”' : 'Move to “I can pack myself”'}: ${x.title}`);
      if (x.critical && x.section === 'help') swap.title = 'Usually a grown-up’s: medicine, documents, forms, safety';
      swap.addEventListener('click', () => {
        started();
        x.section = x.section === 'self' ? 'help' : 'self';
        x.edited = true;
        // It moves to the end of its new section.
        list.splice(list.indexOf(x), 1);
        const last = list.map((y) => y.section).lastIndexOf(x.section);
        list.splice(last < 0 ? (x.section === 'self' ? 0 : list.length) : last + 1, 0, x);
        save();
        renderAll();
      });
      li.append(swap);
    } else li.append(el('span'));
    const peers = list.filter((y) => y.section === x.section);
    const i = peers.indexOf(x);
    const move = (d: number) => {
      const other = peers[i + d];
      const a = list.indexOf(x), b = list.indexOf(other);
      [list[a], list[b]] = [list[b], list[a]];
      started();
      save();
      renderAll();
      listsBox.querySelector<HTMLButtonElement>(`[data-pk-person="${h.id}"] [data-pk-item="${x.key}"] [data-pk-move="${d}"]`)?.focus();
    };
    const up = el('button', { type: 'button', className: 'pk-mv', textContent: '↑', disabled: i === 0, dataset: { pkMove: '-1' } });
    up.setAttribute('aria-label', `Move up: ${x.title}`);
    up.addEventListener('click', () => move(-1));
    const down = el('button', { type: 'button', className: 'pk-mv', textContent: '↓', disabled: i === peers.length - 1, dataset: { pkMove: '1' } });
    down.setAttribute('aria-label', `Move down: ${x.title}`);
    down.addEventListener('click', () => move(1));
    const remove = el('button', { type: 'button', className: 'pk-x', textContent: '×' });
    remove.setAttribute('aria-label', `Remove: ${x.title}`);
    remove.addEventListener('click', () => {
      started();
      if (x.itemId) s.removed[h.id] = [...(s.removed[h.id] ?? []), x.key];
      list.splice(list.indexOf(x), 1);
      say(`Removed from ${h.name}’s list: ${x.title}`);
      save();
      renderAll();
    });
    li.append(up, down, remove);
    if (child && x.critical && x.section === 'self') li.append(el('p', { className: 'pk-row-note', textContent: 'Usually a grown-up checks this one.' }));
    return li;
  }

  function renderLists() {
    const cards = s.helpers.map((h) => {
      const list = s.lists[h.id] ?? (s.lists[h.id] = []);
      const child = h.group !== 'adult';
      const pcu = packCheckUnpack(h);
      const card = el('section', { className: 'pk-person', dataset: { pkPerson: h.id } },
        el('h3', { textContent: `${h.name}’s list` }),
        el('p', { className: 'pk-person-note', textContent: child ? `Pack: ${pcu.pack} Check: ${pcu.check}` : 'Your own things. Shared items are below.' }));
      const sections: PackItem['section'][] = child ? ['self', 'help'] : ['self'];
      for (const sec of sections) {
        if (child) card.append(el('h4', { textContent: sec === 'self' ? 'I can pack myself' : 'A grown-up helps with' }));
        card.append(el('ul', { className: 'pk-rows' }, ...list.filter((x) => x.section === sec).map((x) => itemRow(h, x, list))));
      }
      const add = el('input', { type: 'text', placeholder: `Add to ${h.name}’s list`, maxLength: 80 });
      add.setAttribute('aria-label', `Add an item to ${h.name}’s list`);
      const addBtn = el('button', { type: 'button', className: 'pk-link', textContent: 'Add' });
      const doAdd = () => {
        const words = add.value.trim();
        if (!words) return say('Type the item first.');
        started();
        list.push({ key: `own-${s.next++}`, itemId: null, title: words.slice(0, 80), section: 'self' });
        say(`Added to ${h.name}’s list: ${words}`);
        save();
        renderAll();
      };
      addBtn.addEventListener('click', doAdd);
      add.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
      card.append(el('div', { className: 'pk-add' }, add, addBtn));
      return card;
    });

    // The shared list, with owners.
    const shared = el('section', { className: 'pk-shared', dataset: { pkShared: '' } },
      el('h3', { textContent: 'Shared supplies' }),
      el('p', { className: 'pk-person-note', textContent: 'One person brings each. Medicine, documents and safety stay with grown-ups.' }));
    shared.append(el('ul', { className: 'pk-rows' }, ...s.shared.map((x) => {
      const li = el('li', { className: `pk-row${x.done ? ' is-done' : ''}`, dataset: { pkSharedItem: x.key } });
      const check = el('input', { type: 'checkbox', checked: Boolean(x.done) });
      check.setAttribute('aria-label', `Packed: ${x.title}`);
      check.addEventListener('change', () => { started(); x.done = check.checked || undefined; save(); renderAll(); });
      const text = el('input', { type: 'text', value: x.title, maxLength: 80 });
      text.setAttribute('aria-label', 'Shared item');
      text.addEventListener('change', () => { const w = text.value.trim(); if (w) x.title = w.slice(0, 80); started(); save(); renderAll(); });
      const owner = el('select', {});
      owner.setAttribute('aria-label', `Who brings: ${x.title}`);
      owner.append(el('option', { value: '', textContent: 'Who?' }));
      for (const h of s.helpers) {
        const why = cannotOwnShared(x, h);
        owner.append(el('option', { value: h.id, textContent: `${h.name}${why ? ` (${why})` : ''}`, disabled: Boolean(why), selected: x.owner === h.id }));
      }
      owner.addEventListener('change', () => { started(); x.owner = owner.value || null; x.pinned = true; save(); renderAll(); });
      const remove = el('button', { type: 'button', className: 'pk-x', textContent: '×' });
      remove.setAttribute('aria-label', `Remove: ${x.title}`);
      remove.addEventListener('click', () => {
        started();
        if (x.itemId) s.sharedRemoved = [...s.sharedRemoved, x.key];
        s.shared = s.shared.filter((y) => y !== x);
        save();
        renderAll();
      });
      li.append(check, text, owner, remove);
      return li;
    })));
    const add = el('input', { type: 'text', placeholder: 'Add a shared item', maxLength: 80 });
    add.setAttribute('aria-label', 'Add a shared item');
    const who = el('select', {});
    who.setAttribute('aria-label', 'Who brings it');
    who.append(el('option', { value: '', textContent: 'Who?' }), ...s.helpers.map((h) => el('option', { value: h.id, textContent: h.name })));
    const addBtn = el('button', { type: 'button', className: 'pk-link', textContent: 'Add' });
    addBtn.addEventListener('click', () => {
      const words = add.value.trim();
      if (!words) return say('Type the item first.');
      started();
      s.shared.push({ key: `own-${s.next++}`, itemId: null, title: words.slice(0, 80), owner: who.value || null, ...(who.value ? { pinned: true as const } : {}) });
      save();
      renderAll();
    });
    shared.append(el('div', { className: 'pk-add' }, add, who, addBtn));
    listsBox.replaceChildren(...cards, shared);
  }

  // ---------------------------------------------------------------- printouts
  const FOOT_ROOM = 70;
  const art = (x: PackItem, young: boolean) => {
    const r = x.icon ? responsibilityById(x.icon) : undefined;
    const src = r ? responsibilityImage(r, young ? 256 : 128) : null;
    if (src) return el('img', { className: 'pk-sheet-art', src, alt: '', width: young ? 64 : 36, height: young ? 64 : 36 });
    return el('span', { className: 'pk-sheet-dot' });
  };
  function renderSheets() {
    sheets.replaceChildren();
    const pages: HTMLElement[] = [];
    const newSheet = (kicker: string, title: string, young = false) => {
      const sheet = el('div', { className: `pk-sheet${young ? ' is-young' : ''}`, dataset: { pkSheet: title } },
        el('div', { className: 'pk-sheet-kicker', textContent: kicker }),
        el('div', { className: 'pk-sheet-title' }, el('span', { className: 'pk-swipe', textContent: title })));
      sheets.append(el('div', { className: 'pk-sheet-wrap' }, sheet));
      pages.push(sheet);
      return sheet;
    };
    const foot = (sheet: HTMLElement, line: string) => sheet.append(el('div', { className: 'pk-sheet-foot' },
      el('p', { className: 'pk-sheet-cal', textContent: line }),
      el('p', { className: 'pk-sheet-brand', textContent: brand })));
    const kicker = `${s.family.trim() ? `${s.family.trim()} · ` : ''}${outingLabel()} · ${lengthLabel()}`;
    const who = s.printFor === 'all' ? s.helpers : s.printFor === 'shared' ? [] : s.helpers.filter((h) => h.id === s.printFor);
    for (const h of who) {
      const list = s.lists[h.id] ?? [];
      const child = h.group !== 'adult';
      const young = child && stageOf(h) === 'young';
      const sheet = newSheet(kicker, `${h.name}’s Packing List`, young);
      const pcu = packCheckUnpack(h);
      sheet.append(el('div', { className: 'pk-sheet-pcu' },
        el('div', {}, el('strong', { textContent: 'Pack' }), pcu.pack),
        el('div', {}, el('strong', { textContent: 'Check' }), pcu.check),
        el('div', {}, el('strong', { textContent: 'Unpack' }), pcu.unpack)));
      for (const sec of (child ? ['self', 'help'] : ['self']) as PackItem['section'][]) {
        const items = list.filter((x) => x.section === sec);
        if (!items.length) continue;
        sheet.append(el('div', { className: `pk-sheet-head${sec === 'help' ? ' is-help' : ''}`, textContent: child ? (sec === 'self' ? 'I can pack myself' : 'A grown-up helps with') : 'My list' }));
        for (const x of items) sheet.append(el('div', { className: 'pk-sheet-row' }, el('span', { className: 'pk-sheet-box' }), art(x, young), el('span', { textContent: x.title })));
      }
      const mine = s.shared.filter((x) => x.owner === h.id);
      if (mine.length) {
        sheet.append(el('div', { className: 'pk-sheet-head is-help', textContent: 'Shared things I’m bringing' }));
        for (const x of mine) sheet.append(el('div', { className: 'pk-sheet-row' }, el('span', { className: 'pk-sheet-box' }), el('span', { className: 'pk-sheet-dot' }), el('span', { textContent: x.title })));
      }
      foot(sheet, child ? 'When we get home: unpack, put my things away, help put shared things back.' : 'Add the outing to the family calendar so everyone knows when bags need to be ready.');
    }
    if (s.printFor === 'all' || s.printFor === 'shared') {
      const sheet = newSheet(kicker, 'Our Shared List');
      sheet.append(el('div', { className: 'pk-sheet-head', textContent: 'Shared supplies' }));
      for (const x of s.shared) {
        sheet.append(el('div', { className: 'pk-sheet-row has-owner' }, el('span', { className: 'pk-sheet-box' }), el('span', { textContent: x.title }),
          el('span', { className: 'pk-sheet-owner', textContent: helperById(x.owner)?.name ?? 'A grown-up' })));
      }
      sheet.append(el('div', { className: 'pk-sheet-notes', textContent: 'Notes' }), el('div', { className: 'pk-sheet-line' }), el('div', { className: 'pk-sheet-line' }));
      foot(sheet, 'Pack. Check. Unpack. When we get home, everyone helps put shared things back.');
    }
    // A long list sets a little tighter rather than spilling onto a second page.
    const over = () => pages.some((p) => p.clientHeight && p.scrollHeight > p.clientHeight + 1);
    sheets.classList.remove('is-compact');
    if (over()) sheets.classList.add('is-compact');
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--pk-a1', a1);
    host.style.setProperty('--pk-a2', a2);
    host.style.setProperty('--pk-a3', a3);
    for (const b of all<HTMLButtonElement>('[data-pk-palette]')) b.setAttribute('aria-pressed', String(b.dataset.pkPalette === s.palette));
    const pf = $<HTMLSelectElement>('[data-pk-print-for]');
    pf.replaceChildren(el('option', { value: 'all', textContent: 'Everyone’s lists and the shared list', selected: s.printFor === 'all' }),
      ...s.helpers.map((h) => el('option', { value: h.id, textContent: `${h.name}’s list`, selected: s.printFor === h.id })),
      el('option', { value: 'shared', textContent: 'The shared list', selected: s.printFor === 'shared' }));
    copyFallback.hidden = true;
    fit();
  }
  function fit() {
    for (const wrap of all<HTMLElement>('.pk-sheet-wrap')) {
      const sheet = wrap.firstElementChild as HTMLElement;
      const scale = Math.min(1, wrap.clientWidth / 816 || 1);
      sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
      wrap.style.height = `${Math.ceil(1056 * scale)}px`;
    }
  }

  // ---------------------------------------------------------------- saved lists (this device)
  const readTemplates = (): Template[] => {
    try {
      const arr = parse(localStorage.getItem(templatesKey));
      return Array.isArray(arr) ? arr.filter((t) => t && typeof t.name === 'string' && readPlan(t.plan)).slice(0, MAX_TEMPLATES) : [];
    } catch {
      return [];
    }
  };
  function renderSaved() {
    const list = readTemplates();
    $<HTMLElement>('[data-pk-saved-box]').hidden = !list.length;
    $<HTMLSelectElement>('[data-pk-saved]').replaceChildren(...list.map((t, i) => el('option', { value: String(i), textContent: t.name })));
  }

  function renderAll() {
    renderLists();
    renderSheets();
  }
  function update() {
    if (s.printFor !== 'all' && s.printFor !== 'shared' && !helperById(s.printFor)) s.printFor = 'all';
    save();
    renderQuestions();
    people.render();
    renderAll();
  }

  // ---------------------------------------------------------------- wiring
  for (const b of all<HTMLButtonElement>('[data-pk-outing]')) {
    b.addEventListener('click', () => {
      started();
      const o = b.dataset.pkOuting as Outing;
      if (o === s.outing) return;
      s.outing = o;
      s.length = outingOptions.find((x) => x.id === o)!.length;
      s.prefs = defaultPrefs(o);
      s.removed = {};
      s.sharedRemoved = [];
      build();
      update();
    });
  }
  for (const b of all<HTMLButtonElement>('[data-pk-length]')) b.addEventListener('click', () => { started(); s.length = b.dataset.pkLength as Length; build(); update(); });
  $<HTMLInputElement>('[data-pk-nights]').addEventListener('change', (e) => {
    const n = Number((e.target as HTMLInputElement).value);
    s.nights = Number.isInteger(n) ? Math.min(21, Math.max(1, n)) : 3;
    started();
    build();
    update();
  });
  for (const c of all<HTMLInputElement>('[data-pk-pref]')) {
    c.addEventListener('change', () => {
      started();
      const p = c.dataset.pkPref as Pref;
      s.prefs = c.checked ? [...s.prefs, p] : s.prefs.filter((x) => x !== p);
      build();
      update();
    });
  }
  $<HTMLButtonElement>('[data-pk-fresh]').addEventListener('click', () => {
    started();
    build();
    say('Fresh suggestions. Your wording, order, moves, checks and owners stayed.');
    update();
  });
  const nameBox = $<HTMLInputElement>('[data-pk-save-name]');
  nameBox.addEventListener('input', () => { delete nameBox.dataset.auto; });
  $<HTMLButtonElement>('[data-pk-save]').addEventListener('click', () => {
    const name = nameBox.value.trim() || templateName(input(), s.helpers);
    const list = readTemplates().filter((t) => t.name !== name);
    list.unshift({ name, at: new Date().toISOString(), plan: JSON.parse(JSON.stringify(s)) });
    try {
      localStorage.setItem(templatesKey, JSON.stringify(list.slice(0, MAX_TEMPLATES)));
      say(`Saved “${name}” on this device. Open it from “Your saved lists” next time.`);
    } catch {
      say('This browser won’t save lists right now.');
    }
    renderSaved();
  });
  $<HTMLButtonElement>('[data-pk-open]').addEventListener('click', () => {
    const t = readTemplates()[Number($<HTMLSelectElement>('[data-pk-saved]').value)];
    const plan = t && readPlan(t.plan as unknown as Record<string, unknown>);
    if (!plan) return;
    if (!confirm(`Open “${t.name}”? The lists on screen will be replaced (they’re not saved unless you saved them).`)) return;
    s = { ...plan, printFor: 'all' };
    nameBox.value = t.name;
    delete nameBox.dataset.auto;
    say(`Opened “${t.name}”. Uncheck what you packed last time and go.`);
    for (const list of Object.values(s.lists)) for (const x of list) delete x.done;
    for (const x of s.shared) delete x.done;
    update();
  });
  $<HTMLSelectElement>('[data-pk-print-for]').addEventListener('change', (e) => { s.printFor = (e.target as HTMLSelectElement).value; save(); renderSheets(); });
  for (const b of all<HTMLButtonElement>('[data-pk-palette]')) b.addEventListener('click', () => { s.palette = resolveToolPalette(b.dataset.pkPalette!); save(); renderSheets(); });
  downloadBtn.addEventListener('click', async () => {
    toolEvent('tool_download_click', 'packing');
    const pages = all<HTMLElement>('.pk-sheet', sheets);
    for (const [i, sheet] of pages.entries()) {
      const name = (sheet.dataset.pkSheet ?? 'packing-list').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
      await downloadPng(sheet, { filename: `${name || `packing-list-${i + 1}`}.png`, width: 816, height: 1056, layoutHost: host, exportClass: 'pk-exporting', button: downloadBtn });
    }
  });
  $<HTMLButtonElement>('[data-pk-copy]').addEventListener('click', () => {
    const lines = [`${outingLabel()} · ${lengthLabel()}`, ''];
    for (const h of s.helpers) {
      const list = s.lists[h.id] ?? [];
      lines.push(`${h.name.toUpperCase()}`);
      for (const sec of ['self', 'help'] as const) {
        const items = list.filter((x) => x.section === sec);
        if (!items.length) continue;
        if (h.group !== 'adult') lines.push(sec === 'self' ? 'I can pack myself:' : 'A grown-up helps with:');
        lines.push(...items.map((x) => `${x.done ? '[x]' : '[ ]'} ${x.title}`));
      }
      lines.push('');
    }
    lines.push('SHARED', ...s.shared.map((x) => `${x.done ? '[x]' : '[ ]'} ${x.title} (${helperById(x.owner)?.name ?? 'a grown-up'})`), '', 'Pack. Check. Unpack.');
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

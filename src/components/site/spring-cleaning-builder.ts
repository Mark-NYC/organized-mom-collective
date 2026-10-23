/**
 * The Family Spring Cleaning Builder's behavior, for every page that shows it (src/components/site/
 * SpringCleaningBuilder.astro). One implementation: improve it here and every entry point gets it.
 *
 * It opens with a plan straight away (one room, whoever's known, 30-minute sessions). Each room is planned on its own
 * (src/data/spring-cleaning.ts → planRoom): changing who's helping re-plans the rooms she hasn't edited and leaves
 * her edited ones alone (a removed helper's jobs say "Needs someone"); "New suggestions" redoes one room only.
 * Grown-ups-only jobs and a helper's limits can't be reassigned past; an age suggestion can, with a note.
 * Everything saves in this browser.
 *
 * `handoff` (src/lib/tool-handoff.ts): another page opening the builder for a family, e.g. a Club kit. Its own saved
 * plan (the storage key plus `handoff.key`); a first visit starts with `handoff.people` as helpers (first names,
 * children's ages, who the account holder is), `handoff.variant` as the first room, `handoff.name` on the printouts.
 */
import { toolPalettes, resolveToolPalette, type ToolPaletteId } from '../../data/tool-palettes';
import { toolEvent } from '../../lib/tool-engagement';
import { downloadPng } from '../../lib/printable';
import {
  cannotDo, coreJobs, groupFor, groupLabel, jobById, limitOptions, OTHER_ROOM, planRoom, roomById,
  sessionCount, sessionMinutes, sessionOptions, suppliesFor,
  type CleaningJob, type Group, type Helper, type Limit, type PlannedJob, type SessionLength,
} from '../../data/spring-cleaning';
import type { ToolHandoff } from '../../lib/tool-handoff';

interface RoomPlan {
  /** The room's id ('kitchen'), or 'other'. */
  key: string;
  name: string;
  length: SessionLength;
  jobs: PlannedJob[];
  /** She's changed something: re-planning for new helpers leaves it alone. */
  custom: boolean;
}
interface Saved {
  v: 1;
  helpers: Helper[];
  length: SessionLength;
  rooms: RoomPlan[];
  open: string | null;
  printRoom: string | null;
  family: string;
  palette: ToolPaletteId;
  next: number;
}

const GROUPS: Group[] = ['adult', 'teen', 'school', 'young'];
const LIMITS = limitOptions.map((l) => l.id);
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
const isLength = (v: unknown): v is SessionLength => sessionOptions.includes(v as SessionLength);

function read(key: string): Saved | null {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!o || o.v !== 1 || !Array.isArray(o.helpers) || !Array.isArray(o.rooms)) return null;
    const helpers: Helper[] = o.helpers.slice(0, 12).flatMap((h: Partial<Helper>) => (typeof h?.id === 'string' && GROUPS.includes(h.group as Group) ? [{
      id: h.id.slice(0, 20), name: clean(h.name, 30) || groupLabel[h.group as Group], group: h.group as Group,
      age: Number.isInteger(h.age) && h.age! >= 2 && h.age! < 18 ? h.age! : null,
      limits: Array.isArray(h.limits) ? h.limits.filter((l): l is Limit => LIMITS.includes(l as Limit)) : [],
      ...(h.holder ? { holder: true } : {}),
    }] : []));
    const ids = new Set(helpers.map((h) => h.id));
    const rooms: RoomPlan[] = o.rooms.slice(0, 12).flatMap((r: Partial<RoomPlan>) => (typeof r?.key === 'string' && roomById(r.key) && Array.isArray(r.jobs) ? [{
      key: r.key, name: clean(r.name, 40) || roomById(r.key)!.label, length: isLength(r.length) ? r.length : 30, custom: r.custom === true,
      jobs: r.jobs.slice(0, 60).flatMap((x: Partial<PlannedJob>) => (typeof x?.key === 'string' && typeof x.title === 'string' ? [{
        key: x.key.slice(0, 40), jobId: typeof x.jobId === 'string' && jobById(x.jobId) ? x.jobId : null, title: clean(x.title, 100),
        minutes: Number.isFinite(x.minutes) ? Math.min(60, Math.max(1, Number(x.minutes))) : 10,
        owner: typeof x.owner === 'string' && ids.has(x.owner) ? x.owner : null, session: Number.isInteger(x.session) ? Math.min(11, Math.max(0, x.session!)) : 0,
      }] : [])),
    }] : []));
    return {
      v: 1, helpers, rooms, length: isLength(o.length) ? o.length : 30,
      open: typeof o.open === 'string' ? o.open : null, printRoom: typeof o.printRoom === 'string' ? o.printRoom : null,
      family: clean(o.family, 40), palette: resolveToolPalette(String(o.palette ?? '')), next: Number.isInteger(o.next) ? o.next : 100,
    };
  } catch {
    return null;
  }
}

/** A custom job (or one whose library entry is gone): ten minutes, anyone, done mid-session. */
const asJob = (x: PlannedJob): CleaningJob => (x.jobId && jobById(x.jobId)) ? { ...jobById(x.jobId)!, id: x.key, title: x.title } : { id: x.key, title: x.title, minutes: x.minutes, minAge: 0, phase: 2 };

export function initSpringCleaningBuilder(host: HTMLElement, handoff?: ToolHandoff | null) {
  const key = handoff ? `${host.dataset.sbKey!}:${handoff.key}` : host.dataset.sbKey!;
  const brand = host.dataset.sbBrand ?? '';
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
  const status = $<HTMLElement>('[data-sb-status]');
  const roomsBox = $<HTMLElement>('[data-sb-rooms]');
  const peopleList = $<HTMLUListElement>('[data-sb-people]');
  const personTpl = $<HTMLTemplateElement>('[data-sb-person]');
  const sheets = $<HTMLElement>('[data-sb-sheets]');
  const printSelect = $<HTMLSelectElement>('[data-sb-print-room]');
  const downloadBtn = $<HTMLButtonElement>('[data-sb-download]');
  const copyFallback = $<HTMLTextAreaElement>('[data-sb-copy-fallback]');
  const otherName = $<HTMLInputElement>('[data-sb-other-name]');

  const saved = read(key);
  const fromProfile = (handoff?.people ?? []).map((p, i): Helper => {
    const group = p.adult ? 'adult' : groupFor(p.age ?? null);
    return { id: `h${i}`, name: p.name, group, age: p.adult ? null : p.age ?? null, limits: [], ...(p.holder ? { holder: true } : {}) };
  });
  const s: Saved = saved ?? {
    v: 1,
    helpers: fromProfile.length ? fromProfile : [{ id: 'h0', name: 'Adult 1', group: 'adult', age: null, limits: [] }],
    length: 30,
    rooms: [],
    open: null,
    printRoom: null,
    family: handoff?.name ?? '',
    palette: resolveToolPalette(''),
    next: 100,
  };
  const openSessions = new Set<string>();
  let firstAction = false;
  const started = () => {
    if (!firstAction) { firstAction = true; toolEvent('tool_first_action', 'spring-cleaning'); }
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
  const newId = (prefix: string) => `${prefix}${s.next++}`;

  const generate = (room: RoomPlan) => {
    room.jobs = planRoom(coreJobs(roomById(room.key)!), s.helpers, room.length);
    room.custom = false;
  };
  /** Re-divide the room's current jobs (her wording, her own jobs, her removals) for its session length. */
  const replan = (room: RoomPlan) => {
    const planned = planRoom(room.jobs.map(asJob), s.helpers, room.length);
    room.jobs = planned.map((p) => ({ ...room.jobs.find((x) => x.key === p.key)!, owner: p.owner, session: p.session }));
  };
  const addRoom = (k: string) => {
    const room: RoomPlan = { key: k, name: k === OTHER_ROOM ? otherName.value.trim() || 'Another space' : roomById(k)!.label, length: s.length, jobs: [], custom: false };
    generate(room);
    s.rooms.push(room);
    s.open = k;
    s.printRoom = k;
  };
  // A first visit starts with the room she chose in the kit, a space she named, or the living room.
  if (!saved) {
    if (roomById(handoff?.variant ?? '') && handoff?.variant !== OTHER_ROOM) addRoom(handoff!.variant!);
    else if (handoff?.text) { otherName.value = handoff.text.slice(0, 40); addRoom(OTHER_ROOM); }
    else addRoom('living');
  }

  /** Helpers changed: rooms she hasn't edited are planned again; edited ones keep everything, minus removed people. */
  const peopleChanged = () => {
    const ids = new Set(s.helpers.map((h) => h.id));
    for (const room of s.rooms) {
      if (!room.custom) generate(room);
      else for (const x of room.jobs) if (x.owner && !ids.has(x.owner)) x.owner = null;
    }
  };

  // ---------------------------------------------------------------- the three questions
  function renderQuestions() {
    for (const b of all<HTMLButtonElement>('[data-sb-room]')) b.setAttribute('aria-pressed', String(s.rooms.some((r) => r.key === b.dataset.sbRoom)));
    for (const b of all<HTMLButtonElement>('[data-sb-length]')) b.setAttribute('aria-pressed', String(Number(b.dataset.sbLength) === s.length));
    $<HTMLElement>('[data-sb-other]').hidden = !s.rooms.some((r) => r.key === OTHER_ROOM);
    if (document.activeElement !== otherName) otherName.value = s.rooms.find((r) => r.key === OTHER_ROOM)?.name ?? '';
    $<HTMLElement>('[data-sb-people-note]').textContent = fromProfile.length
      ? 'From your family profile. Remove anyone who isn’t helping, add anyone who is, and note any limits.'
      : 'Add everyone who’s joining in. Limits are optional: we’ll only suggest jobs that fit.';
  }

  function renderPeople() {
    peopleList.replaceChildren(...s.helpers.map((h) => {
      const li = (personTpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
      li.dataset.sbHelper = h.id;
      const name = $<HTMLInputElement>('[data-sb-name]', li);
      const group = $<HTMLSelectElement>('[data-sb-group]', li);
      const age = $<HTMLInputElement>('[data-sb-age]', li);
      const limitsBox = $<HTMLElement>('[data-sb-limits]', li);
      const toggle = $<HTMLButtonElement>('[data-sb-limits-toggle]', li);
      name.value = h.name;
      name.setAttribute('aria-label', `Name (${groupLabel[h.group]})`);
      group.value = h.group;
      age.value = h.age === null ? '' : String(h.age);
      age.hidden = h.group === 'adult';
      toggle.textContent = h.limits.length ? `Limits (${h.limits.length})` : 'Limits';
      toggle.setAttribute('aria-label', `Limits for ${h.name}`);
      $<HTMLButtonElement>('[data-sb-remove]', li).setAttribute('aria-label', `Remove ${h.name}`);
      limitsBox.replaceChildren(...limitOptions.map((l) => {
        const box = el('input', { type: 'checkbox', checked: h.limits.includes(l.id) });
        box.addEventListener('change', () => {
          started();
          h.limits = box.checked ? [...h.limits, l.id] : h.limits.filter((x) => x !== l.id);
          // A known limit always wins: jobs it rules out leave this person, even in rooms she's edited.
          for (const room of s.rooms) for (const x of room.jobs) if (x.owner === h.id && cannotDo(asJob(x), h)) x.owner = null;
          peopleChanged();
          update();
        });
        return el('label', {}, box, l.label);
      }));
      toggle.addEventListener('click', () => {
        limitsBox.hidden = !limitsBox.hidden;
        toggle.setAttribute('aria-expanded', String(!limitsBox.hidden));
      });
      name.addEventListener('input', () => {
        h.name = name.value.slice(0, 30) || groupLabel[h.group];
        save();
        renderRooms();
        renderSheets();
      });
      group.addEventListener('change', () => {
        started();
        h.group = group.value as Group;
        if (h.group === 'adult') h.age = null;
        else if (h.age !== null && groupFor(h.age) !== h.group) h.age = null;
        peopleChanged();
        update();
      });
      age.addEventListener('change', () => {
        started();
        const n = Number(age.value);
        h.age = age.value && Number.isInteger(n) && n >= 2 && n < 18 ? n : null;
        if (h.age !== null) h.group = groupFor(h.age);
        peopleChanged();
        update();
      });
      $<HTMLButtonElement>('[data-sb-remove]', li).addEventListener('click', () => {
        started();
        if (s.helpers.length === 1) return say('Keep at least one person. Add someone else first.');
        s.helpers = s.helpers.filter((x) => x !== h);
        peopleChanged();
        say(`${h.name} is off the plan.`);
        update();
      });
      return li;
    }));
  }

  // ---------------------------------------------------------------- the plan
  const helperById = (id: string | null) => s.helpers.find((h) => h.id === id);
  const sessionSummary = (room: RoomPlan) => {
    const n = sessionCount(room.jobs);
    const longest = Math.max(0, ...Array.from({ length: n }, (_, i) => sessionMinutes(room.jobs, s.helpers, i)));
    return n <= 1 ? `One session · about ${longest} minutes` : `${n} sessions · up to ${room.length} minutes each`;
  };

  function ownerSelect(x: PlannedJob | null, onChange: (owner: string | null) => void, label: string) {
    const job = x ? asJob(x) : null;
    const select = el('select', {});
    select.setAttribute('aria-label', label);
    select.append(el('option', { value: '', textContent: 'Needs someone' }));
    for (const h of s.helpers) {
      const why = job ? cannotDo(job, h) : null;
      const hard = why && !why.startsWith('suggested');
      select.append(el('option', { value: h.id, textContent: `${h.name}${hard ? ` (${why})` : ''}`, disabled: Boolean(hard), selected: x?.owner === h.id }));
    }
    select.addEventListener('change', () => onChange(select.value || null));
    return select;
  }

  function renderRooms() {
    roomsBox.replaceChildren(...s.rooms.map((room) => {
      const open = s.open === room.key;
      const n = sessionCount(room.jobs);
      const head = el('button', { type: 'button', className: 'sb-room-head' },
        el('span', { className: 'sb-room-name', textContent: room.name }),
        el('span', { className: 'sb-room-sum', textContent: `${sessionSummary(room)} ${open ? '▴' : '▾'}` }));
      head.setAttribute('aria-expanded', String(open));
      head.addEventListener('click', () => {
        s.open = open ? null : room.key;
        if (!open) s.printRoom = room.key;
        save();
        renderRooms();
        renderPrint();
      });
      const card = el('section', { className: 'sb-room', dataset: { sbRoomCard: room.key } }, head);
      if (!open) return card;

      const length = el('select', {});
      length.setAttribute('aria-label', `Session length for ${room.name}`);
      for (const m of sessionOptions) length.append(el('option', { value: String(m), textContent: `${m} min`, selected: m === room.length }));
      length.addEventListener('change', () => {
        started();
        room.length = Number(length.value) as SessionLength;
        replan(room);
        room.custom = true;
        say(`${room.name}: jobs divided into ${room.length}-minute sessions.`);
        update();
      });
      const fresh = el('button', { type: 'button', className: 'sb-link', textContent: 'New suggestions' });
      fresh.setAttribute('aria-label', `New suggestions for ${room.name}`);
      fresh.addEventListener('click', () => {
        started();
        generate(room);
        say(`Fresh suggestions for the ${room.name.toLowerCase()}. Your other rooms didn’t change.`);
        update();
      });
      const body = el('div', { className: 'sb-room-body' }, el('div', { className: 'sb-room-tools' }, el('label', {}, 'Sessions of', length), fresh));

      for (let i = 0; i < n; i++) {
        const sk = `${room.key}:${i}`;
        const shown = i === 0 || openSessions.has(sk);
        const jobs = room.jobs.filter((x) => x.session === i);
        const minutes = sessionMinutes(room.jobs, s.helpers, i);
        const supplies = suppliesFor(room.jobs, i);
        const section = el('div', { className: 'sb-session', dataset: { sbSession: String(i) } });
        const title = el('p', { className: 'sb-session-title', textContent: `${n > 1 ? `Session ${i + 1} · ` : ''}About ${minutes || '?'} minutes` });
        const headRow = el('div', { className: 'sb-session-head' }, title);
        if (i > 0) {
          const t = el('button', { type: 'button', className: 'sb-link', textContent: shown ? 'Hide' : 'Show' });
          t.setAttribute('aria-label', `${shown ? 'Hide' : 'Show'} session ${i + 1}`);
          t.addEventListener('click', () => {
            if (shown) openSessions.delete(sk); else openSessions.add(sk);
            renderRooms();
          });
          headRow.append(t);
        }
        section.append(headRow);
        if (!shown) {
          section.append(el('p', { className: 'sb-session-supplies', textContent: `${jobs.length} jobs, another time.` }));
          body.append(section);
          continue;
        }
        if (supplies.length) section.append(el('p', { className: 'sb-session-supplies', textContent: `Have ready: ${supplies.join(', ')}.` }));
        const list = el('ul', { className: 'sb-jobs' });
        for (const x of jobs) {
          const li = el('li', { className: `sb-job${x.owner ? '' : ' is-open'}`, dataset: { sbJob: x.key } });
          const text = el('textarea', { value: x.title, maxLength: 100, rows: 1 });
          text.setAttribute('aria-label', 'Job');
          // Grows to show the whole job; Enter finishes editing rather than adding a line.
          const grow = () => { text.style.height = 'auto'; text.style.height = `${text.scrollHeight + 2}px`; };
          requestAnimationFrame(grow);
          text.addEventListener('input', grow);
          text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); text.blur(); } });
          text.addEventListener('change', () => {
            started();
            x.title = text.value.trim() || x.title;
            room.custom = true;
            update();
          });
          const who = ownerSelect(x, (owner) => {
            started();
            x.owner = owner;
            room.custom = true;
            update();
          }, `Who does: ${x.title}`);
          const remove = el('button', { type: 'button', className: 'sb-x', textContent: '×' });
          remove.setAttribute('aria-label', `Remove: ${x.title}`);
          remove.addEventListener('click', () => {
            started();
            room.jobs = room.jobs.filter((y) => y !== x);
            room.custom = true;
            say(`Removed: ${x.title}`);
            update();
          });
          li.append(text, who, remove);
          const owner = helperById(x.owner);
          const why = owner ? cannotDo(asJob(x), owner) : null;
          if (!x.owner) li.append(el('p', { className: 'sb-job-note', textContent: 'Needs someone: nobody listed can safely do this one. Add a grown-up, or remove it.' }));
          else if (why) li.append(el('p', { className: 'sb-job-note', textContent: `${why.replace(/^s/, 'S')}: your call.` }));
          list.append(li);
        }
        section.append(list);
        body.append(section);
      }

      // Add a job: one of the room's other suggestions, or her own.
      const lib = roomById(room.key)!.jobs.filter((jb) => !room.jobs.some((x) => x.jobId === jb.id));
      const pick = el('select', {});
      pick.setAttribute('aria-label', `Add a job to ${room.name}`);
      pick.append(el('option', { value: '', textContent: 'Add a job…' }), ...lib.map((jb) => el('option', { value: jb.id, textContent: jb.title })), el('option', { value: '__own', textContent: 'My own job…' }));
      const own = el('input', { type: 'text', placeholder: 'Your job', maxLength: 100, hidden: true });
      own.setAttribute('aria-label', 'Your own job');
      const addBtn = el('button', { type: 'button', className: 'sb-link', textContent: 'Add' });
      pick.addEventListener('change', () => { own.hidden = pick.value !== '__own'; if (!own.hidden) own.focus(); });
      addBtn.addEventListener('click', () => {
        const jb = pick.value && pick.value !== '__own' ? jobById(pick.value) : null;
        const title = jb ? jb.title : own.value.trim();
        if (!title) return say('Choose a job, or type your own.');
        started();
        const x: PlannedJob = { key: jb ? jb.id : newId('own-'), jobId: jb?.id ?? null, title, minutes: jb?.minutes ?? 10, owner: null, session: 0 };
        const able = s.helpers.filter((h) => !cannotDo(asJob(x), h));
        // Whoever has least to do in the first session that has room; otherwise a new session.
        const load = (h: Helper, i: number) => sessionMinutes(room.jobs.filter((y) => y.owner === h.id), s.helpers, i);
        let placed = false;
        for (let i = 0; i < Math.max(1, sessionCount(room.jobs)) && !placed; i++) {
          const h = [...able].sort((a, b) => load(a, i) - load(b, i))[0];
          if (h && load(h, i) + x.minutes <= room.length) { x.owner = h.id; x.session = i; placed = true; }
        }
        if (!placed) { x.owner = able[0]?.id ?? null; x.session = sessionCount(room.jobs); }
        room.jobs.push(x);
        room.custom = true;
        say(`Added: ${title}`);
        update();
      });
      body.append(el('div', { className: 'sb-add-job' }, pick, own, addBtn));
      card.append(body);
      return card;
    }));
  }

  // ---------------------------------------------------------------- printouts: one room at a time
  const ROWS_PER_PAGE = 15;
  function sheetsFor(room: RoomPlan): HTMLElement[] {
    const n = sessionCount(room.jobs);
    // Sessions go together on a page while they fit; a long room continues on another page.
    const pages: number[][] = [];
    let rows = 0;
    for (let i = 0; i < n; i++) {
      const count = room.jobs.filter((x) => x.session === i).length + 1;
      if (!pages.length || rows + count > ROWS_PER_PAGE) { pages.push([]); rows = 0; }
      pages[pages.length - 1].push(i);
      rows += count;
    }
    return pages.map((sessions, pageIndex) => {
      const sheet = el('div', { className: 'sb-sheet', dataset: { sbSheet: room.key } },
        el('div', { className: 'sb-sheet-family', textContent: s.family.trim() }),
        el('div', { className: 'sb-sheet-title' }, el('span', { className: 'sb-swipe', textContent: `${room.name} Reset` })),
        el('p', { className: 'sb-sheet-sub', textContent: pages.length > 1 ? `Page ${pageIndex + 1} of ${pages.length}. Everyone has a part.` : 'Everyone has a part. Set a timer and work together.' }));
      for (const i of sessions) {
        const jobs = room.jobs.filter((x) => x.session === i);
        const block = el('div', { className: 'sb-sheet-session' },
          el('div', { className: 'sb-sheet-session-head' },
            el('span', { textContent: n > 1 ? `Session ${i + 1}` : 'One session' }),
            el('span', { textContent: `About ${sessionMinutes(room.jobs, s.helpers, i)} minutes` })));
        const owners = [...s.helpers.filter((h) => jobs.some((x) => x.owner === h.id)), ...(jobs.some((x) => !x.owner) ? [null] : [])];
        for (const h of owners) {
          const mine = jobs.filter((x) => x.owner === (h?.id ?? null));
          block.append(el('div', { className: 'sb-sheet-person' },
            el('div', { className: 'sb-sheet-name' }, h ? h.name : 'Needs someone', el('small', { textContent: h ? (h.group === 'adult' ? 'adult' : h.age !== null ? `age ${h.age}` : groupLabel[h.group].toLowerCase()) : 'or skip it' })),
            el('ul', { className: 'sb-sheet-jobs' }, ...mine.map((x) => el('li', {}, el('span', { className: 'sb-sheet-box' }), x.title)))));
        }
        sheet.append(block);
      }
      const supplies = suppliesFor(room.jobs.filter((x) => sessions.includes(x.session)));
      if (supplies.length) sheet.append(el('p', { className: 'sb-sheet-supplies' }, el('b', { textContent: 'Have ready ' }), supplies.join(', ')));
      sheet.append(
        el('div', { className: 'sb-sheet-note' }, el('p', { textContent: 'Our note' }), el('span'), el('span')),
        el('div', { className: 'sb-sheet-foot' },
          el('p', { className: 'sb-sheet-cal', textContent: 'Put the session on the family wall calendar so everyone knows when it’s happening.' }),
          el('p', { className: 'sb-sheet-brand', textContent: brand })),
      );
      return sheet;
    });
  }

  function renderSheets() {
    const room = s.rooms.find((r) => r.key === s.printRoom) ?? s.rooms[0];
    if (!room) return sheets.replaceChildren();
    sheets.replaceChildren(...sheetsFor(room).map((sheet) => el('div', { className: 'sb-sheet-wrap' }, sheet)));
    const [a1, a2, a3] = toolPalettes[s.palette].colors;
    host.style.setProperty('--sb-a1', a1);
    host.style.setProperty('--sb-a2', a2);
    host.style.setProperty('--sb-a3', a3);
    fit();
  }
  function renderPrint() {
    printSelect.replaceChildren(...s.rooms.map((r) => el('option', { value: r.key, textContent: r.name, selected: r.key === (s.printRoom ?? s.rooms[0]?.key) })));
    for (const b of all<HTMLButtonElement>('[data-sb-palette]')) b.setAttribute('aria-pressed', String(b.dataset.sbPalette === s.palette));
    downloadBtn.disabled = !s.rooms.length;
    copyFallback.hidden = true;
    renderSheets();
  }
  function fit() {
    for (const wrap of all<HTMLElement>('.sb-sheet-wrap')) {
      const sheet = wrap.firstElementChild as HTMLElement;
      const scale = Math.min(1, wrap.clientWidth / 816 || 1);
      sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
      wrap.style.height = `${Math.ceil(1056 * scale)}px`;
    }
  }

  function update() {
    save();
    renderQuestions();
    renderPeople();
    renderRooms();
    renderPrint();
  }

  // ---------------------------------------------------------------- wiring
  for (const b of all<HTMLButtonElement>('[data-sb-room]')) {
    b.addEventListener('click', () => {
      started();
      const k = b.dataset.sbRoom!;
      const had = s.rooms.find((r) => r.key === k);
      if (had) {
        s.rooms = s.rooms.filter((r) => r !== had);
        if (s.open === k) s.open = s.rooms[0]?.key ?? null;
        if (s.printRoom === k) s.printRoom = s.rooms[0]?.key ?? null;
        say(`${had.name} is off the plan.`);
      } else {
        addRoom(k);
        say(`${s.rooms[s.rooms.length - 1].name} added.`);
      }
      update();
      if (k === OTHER_ROOM && !had) otherName.focus();
    });
  }
  otherName.addEventListener('input', () => {
    const room = s.rooms.find((r) => r.key === OTHER_ROOM);
    if (!room) return;
    room.name = otherName.value.trim().slice(0, 40) || 'Another space';
    save();
    renderRooms();
    renderPrint();
  });
  for (const b of all<HTMLButtonElement>('[data-sb-length]')) {
    b.addEventListener('click', () => {
      started();
      s.length = Number(b.dataset.sbLength) as SessionLength;
      let kept = 0;
      for (const room of s.rooms) {
        if (room.custom) { kept++; continue; }
        room.length = s.length;
        generate(room);
      }
      if (kept) say(`Rooms you’ve changed kept their sessions. Change one with its own “Sessions of” setting.`);
      update();
    });
  }
  for (const b of all<HTMLButtonElement>('[data-sb-add]')) {
    b.addEventListener('click', () => {
      started();
      const group = b.dataset.sbAdd as Group;
      const count = s.helpers.filter((h) => h.group === group).length + 1;
      const h: Helper = { id: newId('h'), name: `${group === 'adult' ? 'Adult' : group === 'teen' ? 'Teen' : 'Child'} ${count}`, group, age: null, limits: [] };
      s.helpers.push(h);
      peopleChanged();
      update();
      all<HTMLInputElement>('[data-sb-name]').at(-1)?.select();
    });
  }
  printSelect.addEventListener('change', () => {
    s.printRoom = printSelect.value;
    save();
    renderSheets();
  });
  const familyInput = $<HTMLInputElement>('[data-sb-family]');
  familyInput.value = s.family;
  familyInput.addEventListener('input', () => {
    s.family = familyInput.value.slice(0, 40);
    save();
    renderSheets();
  });
  for (const b of all<HTMLButtonElement>('[data-sb-palette]')) {
    b.addEventListener('click', () => {
      s.palette = resolveToolPalette(b.dataset.sbPalette!);
      save();
      renderPrint();
    });
  }
  downloadBtn.addEventListener('click', async () => {
    const room = s.rooms.find((r) => r.key === s.printRoom) ?? s.rooms[0];
    if (!room) return;
    toolEvent('tool_download_click', 'spring-cleaning');
    const pages = all<HTMLElement>('.sb-sheet', sheets);
    for (const [i, sheet] of pages.entries()) {
      await downloadPng(sheet, { filename: `family-cleaning-plan-${room.key}${pages.length > 1 ? `-${i + 1}` : ''}.png`, width: 816, height: 1056, layoutHost: host, exportClass: 'sb-exporting', button: downloadBtn });
    }
  });
  $<HTMLButtonElement>('[data-sb-copy]').addEventListener('click', () => {
    const lines = ['Our Family Cleaning Plan', ''];
    for (const room of s.rooms) {
      const n = sessionCount(room.jobs);
      lines.push(room.name.toUpperCase());
      for (let i = 0; i < n; i++) {
        lines.push(`${n > 1 ? `Session ${i + 1}, a` : 'A'}bout ${sessionMinutes(room.jobs, s.helpers, i)} minutes`);
        for (const x of room.jobs.filter((y) => y.session === i)) lines.push(`[ ] ${helperById(x.owner)?.name ?? 'Needs someone'}: ${x.title}`);
      }
      lines.push('');
    }
    lines.push('Put the session on the family wall calendar so everyone knows when it’s happening.');
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
  update();
}


/**
 * The Family Meeting companion on a Club plan page (MeetingGuidePrintable.astro): draws the generated companion as two
 * US Letter sheets, keeps her corrections in the tab (saved to her account by the plan shell) and publishes the plan
 * controller (`clubPlan`, src/lib/club/plan/resource.ts) the shared rail, phone screen, approval and print use.
 * Presentation only: what it says comes from ./generate.ts and the month's content.
 */
import { anchorLine } from './anchor';
import { monthTints } from '../month-tints';
import { guideMonth } from '../../../data/club/meeting-guides';
import { routes } from '../../../routes';
import { el } from '../plan/dom';
import { onPlanFamily, type ReadyFamily } from '../plan/family';
import { PLAN_CHANGE, type PlanResource } from '../plan/resource';
import { readScoped, tabStorage } from '../plan/storage';
import { generateMeetingGuide, guideFingerprint, type GuideIdea, type MeetingGuide } from './generate';
import { STAGE_LABEL, type GuideStage } from './stages';
import { emptyGuideState, guideProfile, isGuideState, MAX_EDIT, type GuideState } from './state';
import type { GuideMonthContent } from './types';

export interface GuidePlan extends PlanResource<GuideState> {
  guide(): MeetingGuide | null;
  openEditor(): void;
  setLocked(on: boolean): void;
}

const SHEET_W = 816;
const SHEET_H = 1056;
const ACTIONS = ['pointerdown', 'keydown'] as const;

const list = (items: GuideIdea[], cls = 'mg-list') => el('ul', { class: cls }, ...items.map((i) => el('li', {}, i.text)));

/** The companion's blocks, in reading order. Each part supports the one focus at the top. */
/** A person's color chip: the color, their initial on it, and their name beside it (readable in grayscale). */
function chip(g: MeetingGuide, id: string, withName = true): HTMLElement {
  const c = g.colors[id];
  if (!c) return el('span', {});
  const dot = el('span', { class: 'mg-dot' }, c.name.charAt(0));
  dot.style.background = c.hex;
  return el('span', { class: 'mg-chip' }, dot, ...(withName ? [el('span', {}, c.name)] : []));
}

/** The Monthly Family Focus, in reading order: identity, the shared focus, habits worth trying, the words, the meeting. */
function blocks(g: MeetingGuide, monthLabel: string) {
  const focus = g.focus[0];
  const everyone = Object.keys(g.colors);
  const head = el('header', { class: 'mg-head' },
    el('div', { class: 'mg-head-row' },
      el('div', {},
        el('p', { class: 'mg-kicker' }, `${monthLabel} · ${g.familyName}`),
        el('h2', { class: 'mg-title' }, g.focusPage.title)),
      el('p', { class: 'mg-legend' }, ...everyone.map((id) => chip(g, id)))),
    el('p', { class: 'mg-sub' }, g.focusPage.monthPurpose));
  const focusBox = el('section', { class: 'mg-focus' },
    el('p', { class: 'mg-label' }, 'Our shared focus'),
    el('p', { class: 'mg-focus-title' }, focus?.title ?? ''),
    ...(focus?.opportunity ? [el('p', { class: 'mg-focus-opp' }, focus.opportunity)] : []));

  const experiment = (e: MeetingGuide['experiments'][number]) => {
    const card = el('li', { class: 'mg-exp' },
      el('p', { class: 'mg-exp-who' }, ...(e.memberIds.length ? e.memberIds.map((id) => chip(g, id, false)) : everyone.map((id) => chip(g, id, false))), el('strong', {}, e.who)),
      el('p', { class: 'mg-exp-title' }, e.title),
      ...(e.basis === 'consider' && e.memberIds.length ? [el('p', { class: 'mg-exp-why' }, g.considerLabel)] : []),
      el('p', { class: 'mg-exp-action' }, e.action),
      ...(e.adaptations ? [el('ul', { class: 'mg-exp-adapt' }, ...e.adaptations.map((x) => el('li', {}, chip(g, x.memberId), el('span', {}, x.action))))] : []),
      ...(e.anchor.text ? [el('p', { class: 'mg-exp-line' }, el('b', {}, 'When: '), anchorLine(e.anchor))] : []),
      el('p', { class: 'mg-exp-line' }, el('b', {}, 'Ownership: '), e.ownership),
      // A support only where it changes the odds: shared routines and environment-led habits.
      ...(e.support && (e.adaptations || e.principle === 'environment') ? [el('p', { class: 'mg-exp-line' }, el('b', {}, 'Help: '), e.support)] : []));
    return card;
  };
  const habits = el('section', { class: 'mg-part' },
    el('h3', {}, 'Small habits worth trying'),
    el('p', { class: 'mg-note' }, g.starterNote ?? g.experimentsNote),
    ...(g.experiments.length ? [el('ul', { class: `mg-exps${g.experiments.length > 1 ? ' mg-exps--two' : ''}` }, ...g.experiments.map(experiment))] : []),
    ...(g.partsDiscover ? [el('p', { class: 'mg-discover' }, g.partsDiscover)] : []),
    ...(g.recognized.length || g.grownUps.length ? [list([...g.recognized, ...g.grownUps], 'mg-list mg-small')] : []));

  const words = el('section', { class: 'mg-part' },
    el('h3', {}, 'Our Words of the Week'),
    el('ol', { class: 'mg-words' }, ...g.focusPage.words.map((w, i) => el('li', {},
      el('span', { class: 'mg-week' }, `Week ${i + 1}`), el('strong', {}, w.word), el('span', {}, w.question)))),
    el('p', { class: 'mg-note' }, g.focusPage.wordsNote));
  const bring = el('section', { class: 'mg-bring' },
    el('p', {}, el('strong', {}, 'Bring it to your Family Meeting: '), g.focusPage.bringIt.join(' · '), '.'));
  return { head, focusBox, habits, words, bring };
}

function sheet(kids: number, children: HTMLElement[], foot: string, side: 'front' | 'back', end: boolean, month: string): HTMLElement {
  // Fixed tiers by group size instead of shrinking type: 5–6 children in a shared habit tighter, 7+ in three columns.
  const dense = kids >= 7 ? ' mg-dense mg-xdense' : kids >= 5 ? ' mg-dense' : '';
  const s = el('article', { class: `mg-sheet${dense}` }, ...children, el('p', { class: 'mg-foot' }, foot));
  // The month's own calendar color, in tints (src/lib/club/month-tints.ts): the words, the focus wash, small labels.
  const t = monthTints(month);
  t.weeks.forEach((w, i) => s.style.setProperty(`--mg-w${i + 1}`, w));
  s.style.setProperty('--mg-wash', t.wash);
  s.style.setProperty('--mg-base', t.base);
  s.style.setProperty('--mg-accent', t.accent);
  s.dataset.planSheet = side;
  if (end) s.dataset.planSheetEnd = '';
  return s;
}

/**
 * One Letter page when everything fits at the normal type size; two only when the family's content needs them
 * (the habits on page 1, the words and meeting on page 2). Measured off-screen at the sheet's real size.
 */
function sheets(g: MeetingGuide, monthLabel: string, measure: HTMLElement): HTMLElement[] {
  const n = Math.max(0, ...g.experiments.map((e) => e.adaptations?.length ?? 0));
  const b = blocks(g, monthLabel);
  const one = sheet(n, [b.head, b.focusBox, b.habits, b.words, b.bring], `${g.familyName} · Organized Family Club`, 'front', true, g.plan.month);
  measure.replaceChildren(one);
  const fits = one.scrollHeight <= one.clientHeight + 1;
  measure.replaceChildren();
  if (fits) return [one];
  const c = blocks(g, monthLabel);
  return [
    sheet(n, [c.head, c.focusBox, c.habits], 'Our Words of the Week are on the back →', 'front', false, g.plan.month),
    sheet(n, [c.words, c.bring], `${g.familyName} · Organized Family Club`, 'back', true, g.plan.month),
  ];
}

/** Scale each 816 × 1056 sheet to its frame's width (screen only; print uses the real size). */
function fit(host: HTMLElement) {
  for (const frame of host.querySelectorAll<HTMLElement>('.mg-frame')) {
    const w = frame.parentElement?.clientWidth ?? SHEET_W;
    const scale = Math.min(1, w / SHEET_W) || 1;
    frame.style.setProperty('--mg-scale', String(scale));
    frame.style.height = `${SHEET_H * scale}px`;
    frame.style.width = `${SHEET_W * scale}px`;
  }
}

export function mountMeetingGuide(host: HTMLElement & { clubPlan?: GuidePlan }) {
  const root = host.closest<HTMLElement>('.club-plan');
  const month = host.dataset.guideMonth ?? '';
  const content: GuideMonthContent | null = guideMonth(month);
  const pages = host.querySelector<HTMLElement>('[data-mg-pages]')!;
  const dialog = host.querySelector<HTMLDialogElement>('[data-mg-editor]')!;
  const monthLabel = new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (!root || !content) {
    pages.replaceChildren(el('p', { class: 'mg-empty' }, 'This month’s companion isn’t ready yet.'));
    return;
  }
  const key = root.dataset.planKey ?? `omc:club:meeting-guide:${month}:v1`;
  // Where a sheet is laid out at its real size to see whether everything fits on one page.
  const measure = el('div', { class: 'mg-measure' });
  measure.setAttribute('aria-hidden', 'true');
  document.body.append(measure);
  let family: ReadyFamily | null = null;
  let state: GuideState = emptyGuideState();
  let guide: MeetingGuide | null = null;
  // Everything she could show (nothing hidden), for the editor's list.
  let full: MeetingGuide | null = null;
  let persist = true;
  let locked = false;

  const save = () => {
    if (!persist || !family) return;
    // The ideas as structured data go with her choices (src/lib/club/family-plan.ts), for later months to read.
    if (guide) state = { ...state, plan: guide.plan };
    tabStorage.set(key, JSON.stringify({ current: root.dataset.planFor, state }));
  };
  const paint = () => {
    if (!family) return;
    guide = generateMeetingGuide({ household: family.household, profile: state.profile, content, state });
    full = generateMeetingGuide({ household: family.household, profile: state.profile, content, state: { ...state, hidden: [] } });
    pages.replaceChildren(...sheets(guide, monthLabel, measure).map((s) => el('div', { class: 'mg-frame' }, s)));
    fit(host);
    if (dialog.open) fillEditor();
    host.dispatchEvent(new Event(PLAN_CHANGE, { bubbles: true }));
  };
  const update = (change: (s: GuideState) => void) => {
    if (locked) return;
    const next = structuredClone(state);
    change(next);
    state = next;
    paint();
    save();
  };

  // ---- Editor: fix a child's age group, hide ideas that don't fit ----
  const toggle = (idea: GuideIdea) => {
    const c = el('input', { type: 'checkbox', checked: !state.hidden.includes(idea.key), disabled: locked });
    c.addEventListener('change', () => update((s) => {
      s.hidden = c.checked ? s.hidden.filter((k) => k !== idea.key) : [...new Set([...s.hidden, idea.key])];
    }));
    return el('label', { class: 'mg-ed-choice' }, c, el('span', {}, idea.text));
  };
  const fillEditor = () => {
    if (!full) return;
    const g = full;
    const body = dialog.querySelector<HTMLElement>('[data-mg-editor-body]')!;
    const kids = g.people.map((p) => {
      const stages: GuideStage[] = ['toddler', 'preschool', 'early', 'middle', 'teen'];
      const sel = el('select', { disabled: locked }) as HTMLSelectElement;
      for (const s of stages) sel.append(el('option', { value: s, selected: s === p.stage }, STAGE_LABEL[s]));
      if (p.stage === 'child') sel.prepend(el('option', { value: 'child', selected: true }, STAGE_LABEL.child));
      sel.addEventListener('change', () => update((s) => { s.people[p.id] = { stage: sel.value as GuideStage }; }));
      return el('div', { class: 'mg-ed-person' },
        el('p', { class: 'mg-ed-name' }, el('strong', {}, p.name), p.age !== null ? ` · ${p.age}` : ''),
        el('label', { class: 'mg-ed-field' }, 'Ideas for their age', sel));
    });
    // Each suggestion: Keep it (fits our family), Change it (her words), Skip it (off the printable). None is a commitment.
    const exps = g.suggested.map((e) => {
      const skipped = state.hidden.includes(e.key);
      const kept = (state.kept ?? []).includes(e.key);
      const mine = state.edits?.[e.key] ?? {};
      const btn = (label: string, pressed: boolean, on: () => void) => {
        const b = el('button', { type: 'button', class: 'mg-ed-choice-btn', disabled: locked }, label);
        b.setAttribute('aria-pressed', String(pressed));
        b.addEventListener('click', on);
        return b;
      };
      const field = (label: string, key: 'title' | 'action' | 'anchor', value: string) => {
        const t = el('textarea', { maxLength: MAX_EDIT, value: mine[key] ?? value, rows: key === 'action' ? 2 : 1, disabled: locked || skipped });
        t.addEventListener('change', () => update((s) => {
          const v = t.value.trim();
          const cur = { ...(s.edits?.[e.key] ?? {}) };
          if (v && v !== value) cur[key] = v; else delete cur[key];
          s.edits = { ...(s.edits ?? {}), [e.key]: cur };
        }));
        return el('label', { class: 'mg-ed-field' }, label, t);
      };
      const box = el('div', { class: `mg-ed-exp${skipped ? ' is-skipped' : ''}` },
        el('p', { class: 'mg-ed-name' }, el('strong', {}, e.who), ` · ${mine.title ?? e.title}`),
        el('div', { class: 'mg-ed-choices', role: 'group' },
          btn('Keep it', kept && !skipped, () => update((s) => { s.hidden = s.hidden.filter((k) => k !== e.key); s.kept = [...new Set([...(s.kept ?? []), e.key])]; })),
          btn('Change it', Boolean(Object.keys(mine).length) && !skipped, () => { box.querySelector<HTMLElement>('.mg-ed-change')!.hidden = false; box.querySelector('textarea')?.focus(); }),
          btn('Skip it', skipped, () => update((s) => { s.hidden = skipped ? s.hidden.filter((k) => k !== e.key) : [...new Set([...s.hidden, e.key])]; s.kept = (s.kept ?? []).filter((k) => k !== e.key); }))),
        (() => {
          const c = el('div', { class: 'mg-ed-change' }, field('Title', 'title', e.title), field('What to try', 'action', e.action), field('When', 'anchor', e.anchor.text));
          c.hidden = !Object.keys(mine).length;
          return c;
        })());
      return box;
    });
    const familyLink = family?.source === 'account'
      ? el('p', { class: 'mg-ed-note' }, 'Names, ages or answers wrong? ', el('a', { href: routes.clubFamily }, 'Update your family page'), ' and your Family Focus updates.')
      : el('p', { class: 'mg-ed-note' }, 'Names, ages and answers come from the family profile.');
    const reset = el('button', { type: 'button', class: 'mg-ed-reset', disabled: locked }, 'Start over with the original suggestions');
    reset.addEventListener('click', () => update((s) => { s.hidden = []; s.people = {}; s.edits = {}; s.kept = []; }));
    body.replaceChildren(
      el('p', { class: 'mg-ed-note' }, 'These are suggestions. Keep what fits, change the wording or timing, or skip it: skipped ideas come off the printed page.'),
      el('section', {}, el('h3', {}, 'Small habits worth trying'), familyLink, ...exps, ...g.recognized.map(toggle), ...g.grownUps.map(toggle)),
      el('section', {}, el('h3', {}, 'Plan for each child’s age'), ...kids),
      reset);
  };
  dialog.querySelector('[data-mg-close]')?.addEventListener('click', () => dialog.close());

  const plan: GuidePlan = {
    ready: () => Boolean(guide),
    state: () => state,
    update,
    replace: (s) => update((t) => Object.assign(t, s)),
    setPersist: (on) => { persist = on; if (on) save(); },
    fingerprint: () => (guide ? guideFingerprint(guide) : ''),
    guide: () => guide,
    openEditor: () => { if (!guide) return; fillEditor(); dialog.showModal(); },
    setLocked: (on) => { locked = on; if (dialog.open) fillEditor(); },
  };
  host.clubPlan = plan;

  onPlanFamily(root, (f) => {
    family = f;
    guide = null;
    const saved = readScoped(tabStorage.get(key), root.dataset.planFor ?? '', isGuideState);
    state = saved ?? emptyGuideState();
    // What she opened is the baseline (written before anything is generated, so opening saves nothing).
    save();
    const fresh = guideProfile(f.profile);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(state.profile)) state = { ...state, profile: fresh };
    paint();
    // Generated from the answers she has now. Her companion, its profile answers and its ideas save with her first
    // click or key press (approving counts), so the owner's print view and later months read what she saw.
    if (JSON.stringify(state.plan) !== JSON.stringify(plan.guide()?.plan)) {
      const once = () => {
        for (const t of ACTIONS) document.removeEventListener(t, once, true);
        save();
      };
      for (const t of ACTIONS) document.addEventListener(t, once, true);
    }
  });
  window.addEventListener('resize', () => fit(host));
  // Page breaks depend on the real fonts: lay out again once they've loaded.
  document.fonts?.ready.then(() => { if (guide) paint(); });
}

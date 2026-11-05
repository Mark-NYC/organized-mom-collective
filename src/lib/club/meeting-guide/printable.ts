/**
 * The Family Meeting companion on a Club plan page (MeetingGuidePrintable.astro): draws the generated companion as two
 * US Letter sheets, keeps her corrections in the tab (saved to her account by the plan shell) and publishes the plan
 * controller (`clubPlan`, src/lib/club/plan/resource.ts) the shared rail, phone screen, approval and print use.
 * Presentation only: what it says comes from ./generate.ts and the month's content.
 */
import { guideMonth } from '../../../data/club/meeting-guides';
import { routes } from '../../../routes';
import { el } from '../plan/dom';
import { onPlanFamily, type ReadyFamily } from '../plan/family';
import { PLAN_CHANGE, type PlanResource } from '../plan/resource';
import { readScoped, tabStorage } from '../plan/storage';
import { generateMeetingGuide, guideFingerprint, type GuideIdea, type MeetingGuide } from './generate';
import { STAGE_LABEL, type GuideStage } from './stages';
import { emptyGuideState, guideProfile, isGuideState, type GuideState } from './state';
import type { GuideMonthContent, PartId } from './types';

export interface GuidePlan extends PlanResource<GuideState> {
  guide(): MeetingGuide | null;
  openEditor(): void;
  setLocked(on: boolean): void;
}

const SHEET_W = 816;
const SHEET_H = 1056;
const ACTIONS = ['pointerdown', 'keydown'] as const;

function sectionHead(g: MeetingGuide, id: PartId): HTMLElement {
  const s = g.sections.find((x) => x.id === id)!;
  return el('header', { class: 'mg-part-head' },
    el('span', { class: 'mg-num' }, String(s.n)),
    el('div', {}, el('h3', {}, s.title), el('p', { class: 'mg-goal' }, s.goal)));
}
const list = (items: GuideIdea[], cls = 'mg-list') => el('ul', { class: cls }, ...items.map((i) => el('li', {}, i.text)));

function sheets(g: MeetingGuide, monthLabel: string): HTMLElement[] {
  // Fixed tiers by number of children instead of shrinking type: 5–6 tighter, 7+ in three columns.
  const n = g.people.length;
  const dense = n >= 7 ? ' mg-dense mg-xdense' : n >= 5 ? ' mg-dense' : '';
  const front = el('article', { class: `mg-sheet${dense}` },
    el('header', { class: 'mg-head' },
      el('p', { class: 'mg-kicker' }, `${monthLabel} · ${g.familyName}`),
      el('h2', { class: 'mg-title' }, g.title),
      el('p', { class: 'mg-sub' }, g.subtitle),
      el('p', { class: 'mg-howto' }, g.howTo)),
    el('section', { class: 'mg-part' },
      sectionHead(g, 'focus'),
      el('div', { class: 'mg-focus' }, ...g.focus.map((f) => el('div', { class: 'mg-focus-item' },
        el('p', { class: 'mg-focus-title' }, f.title),
        ...(f.opportunity ? [el('p', { class: 'mg-focus-opp' }, f.opportunity)] : []))))),
    el('section', { class: 'mg-part' },
      sectionHead(g, 'talk'),
      el('p', { class: 'mg-label' }, 'Conversation starters'),
      list(g.talk, 'mg-list mg-talk'),
      ...(g.talkLittle ? [el('p', { class: 'mg-note' }, g.talkLittle)] : [])),
    el('p', { class: 'mg-foot' }, 'Everyone’s Part and Let’s Practice are on the back →'));
  front.dataset.planSheet = 'front';

  const kid = (p: MeetingGuide['people'][number]) => el('li', {},
    el('p', { class: 'mg-who' }, el('strong', {}, p.name), p.age !== null ? el('span', {}, ` · ${p.age}`) : ''),
    ...(p.joinsIn ? [el('p', { class: 'mg-help' }, 'Joins in and watches.')] : []),
    ...(p.ask && p.ideas.length ? [el('p', { class: 'mg-ask' }, p.ask)] : []),
    ...(p.ideas.length
      ? [el('p', { class: 'mg-label mg-label--tight' }, p.choose ? `Two ideas: ${p.name} chooses one` : 'An idea to try'),
         el('ul', { class: 'mg-ideas' }, ...p.ideas.map((i) => el('li', {}, i.text))),
         ...(p.support ? [el('p', { class: 'mg-help' }, p.support)] : [])]
      : []),
    ...(p.keeps ? [el('p', { class: 'mg-keeps' }, p.keeps)] : []));
  const back = el('article', { class: `mg-sheet${dense}` },
    el('section', { class: 'mg-part' },
      sectionHead(g, 'parts'),
      ...(g.people.some((p) => p.ideas.length) ? [el('p', { class: 'mg-note' }, g.partsNote)] : []),
      // Only children with something to say: an idea, or what they already do. Little ones join through Let's Talk.
      ...(g.people.some((p) => p.ideas.length || p.keeps) ? [el('ul', { class: 'mg-kids' }, ...g.people.filter((p) => p.ideas.length || p.keeps).map(kid))] : []),
      ...(g.partsDiscover ? [el('p', { class: 'mg-note' }, g.partsDiscover)] : []),
      ...(g.grownUps.length ? [list(g.grownUps, 'mg-list mg-grownups')] : [])),
    el('section', { class: 'mg-part' },
      sectionHead(g, 'practice'),
      ...(g.practice.length ? [el('p', { class: 'mg-label' }, 'Ways to make it stick'), list(g.practice)] : [])),
    el('section', { class: 'mg-checkin' }, el('p', {}, el('strong', {}, 'Coming back to it: '), g.checkIn)),
    el('p', { class: 'mg-foot' }, `${g.familyName} · Organized Family Club`));
  back.dataset.planSheet = 'back';
  back.dataset.planSheetEnd = '';
  return [front, back];
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
    pages.replaceChildren(...sheets(guide, monthLabel).map((s) => el('div', { class: 'mg-frame' }, s)));
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
        el('label', { class: 'mg-ed-field' }, 'Ideas for their age', sel),
        ...p.ideas.map(toggle));
    });
    const familyLink = family?.source === 'account'
      ? el('p', { class: 'mg-ed-note' }, 'Names, ages or answers wrong? ', el('a', { href: routes.clubFamily }, 'Update your family page'), ' and your companion updates.')
      : el('p', { class: 'mg-ed-note' }, 'Names, ages and answers come from the family profile.');
    const reset = el('button', { type: 'button', class: 'mg-ed-reset', disabled: locked }, 'Show every idea again');
    reset.addEventListener('click', () => update((s) => { s.hidden = []; s.people = {}; }));
    body.replaceChildren(
      el('p', { class: 'mg-ed-note' }, 'Untick anything that doesn’t fit your family; it comes off the page.'),
      el('section', {}, el('h3', {}, 'Our Focus'), ...g.focus.map(toggle)),
      el('section', {}, el('h3', {}, 'Let’s Talk'), ...g.talk.map(toggle)),
      el('section', {}, el('h3', {}, 'Everyone’s Part'), familyLink, ...kids, ...g.grownUps.map(toggle)),
      el('section', {}, el('h3', {}, 'Let’s Practice'), ...g.practice.map(toggle)),
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
}

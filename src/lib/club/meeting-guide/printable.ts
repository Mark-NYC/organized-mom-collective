/**
 * The Family Meeting guide on a Club plan page (MeetingGuidePrintable.astro): draws the generated guide as two US
 * Letter sheets, keeps her choices in the tab (saved to her account by the plan shell) and publishes the plan
 * controller (`clubPlan`, src/lib/club/plan/resource.ts) the shared rail, phone screen, approval and print use.
 * Presentation only: what the guide says comes from ./generate.ts and the month's content.
 */
import { guideMonth } from '../../../data/club/meeting-guides';
import { routes } from '../../../routes';
import { el } from '../plan/dom';
import { onPlanFamily, type ReadyFamily } from '../plan/family';
import { PLAN_CHANGE, type PlanResource } from '../plan/resource';
import { readScoped, tabStorage } from '../plan/storage';
import { generateMeetingGuide, guideFingerprint, type MeetingGuide } from './generate';
import { STAGE_LABEL, STAGE_RULES, type GuideStage } from './stages';
import { emptyGuideState, guideProfile, isGuideState, MAX_CUSTOM, type GuideState } from './state';
import { PART_ORDER, type GuideMonthContent, type PartId } from './types';

export interface GuidePlan extends PlanResource<GuideState> {
  guide(): MeetingGuide | null;
  openEditor(): void;
  setLocked(on: boolean): void;
}

const SHEET_W = 816;
const SHEET_H = 1056;
const ACTIONS = ['pointerdown', 'keydown'] as const;

function partBlock(g: MeetingGuide, id: PartId): HTMLElement {
  const p = g.parts.find((x) => x.id === id)!;
  const person = (pid: string) => g.people.find((x) => x.id === pid)!;
  return el('section', { class: 'mg-part' },
    el('header', { class: 'mg-part-head' },
      el('span', { class: 'mg-num' }, String(p.n)),
      el('h3', {}, p.title),
      el('span', { class: 'mg-min' }, `${p.minutes} min`),
      el('span', { class: 'mg-led' }, 'Led by ', el('strong', {}, p.leaderName))),
    el('p', { class: 'mg-goal' }, p.goal),
    el('p', { class: 'mg-say' }, el('span', {}, 'Say: '), `“${p.say}”`),
    ...(id === 'focus' ? [el('p', { class: 'mg-why' }, el('strong', {}, 'Why it matters for us: '), g.why)] : []),
    ...(p.questions ? [el('ol', { class: 'mg-questions' }, ...p.questions.map((q) => el('li', {}, q)))] : []),
    el('ul', { class: 'mg-lines' }, ...p.lines.map((l) => {
      const finished = id === 'parts' ? person(l.id).part?.finished : '';
      return el('li', {}, el('strong', {}, l.name), el('span', {}, l.text, ...(finished ? [el('em', {}, ` Finished: ${finished}`)] : [])));
    })));
}

function sheets(g: MeetingGuide, monthLabel: string): HTMLElement[] {
  // Fixed tiers by family size instead of shrinking type: 6–7 people tighter, 8+ in three columns.
  const dense = g.people.length >= 8 ? ' mg-dense mg-xdense' : g.people.length > 5 ? ' mg-dense' : '';
  const front = el('article', { class: `mg-sheet${dense}` },
    el('header', { class: 'mg-head' },
      el('p', { class: 'mg-kicker' }, `${monthLabel} · ${g.familyName}`),
      el('h2', { class: 'mg-title' }, g.title),
      el('p', { class: 'mg-sub' }, g.subtitle)),
    el('div', { class: 'mg-top' },
      el('section', { class: 'mg-prepare' },
        el('h3', {}, 'Before we start'),
        el('ul', {}, ...g.prepare.map((l) => el('li', {}, l)))),
      el('section', { class: 'mg-map' },
        el('h3', {}, 'The four parts'),
        el('ol', {}, ...g.parts.map((p) => el('li', {}, el('strong', {}, p.title), ` ${p.minutes} min · ${p.goal}`))))),
    partBlock(g, 'focus'),
    partBlock(g, 'talk'),
    el('p', { class: 'mg-foot' }, 'Turn over for parts 3 and 4 →'));
  front.dataset.planSheet = 'front';
  const back = el('article', { class: `mg-sheet${dense}` },
    partBlock(g, 'parts'),
    partBlock(g, 'practice'),
    // Writing lines where there's room: up to five people (a bigger family's sheet has none to spare).
    ...(g.people.length <= 5 ? [el('section', { class: 'mg-notes' }, el('h3', {}, 'Notes from our meeting'), el('div', {}))] : []),
    el('div', { class: 'mg-bottom' },
      el('section', { class: 'mg-agreed' },
        el('h3', {}, 'What we agreed'),
        el('p', { class: 'mg-hint' }, 'Read these out loud. Check them at next month’s meeting.'),
        el('ul', {}, ...g.actions.map((a) => el('li', {}, el('span', { class: 'mg-box' }), el('span', {}, a.text, el('em', {}, ` ${a.finished}`)))))),
      el('section', { class: 'mg-rhythm' },
        el('h3', {}, g.rhythm.title),
        el('p', { class: 'mg-when' }, 'Every month · ', el('strong', {}, g.rhythm.when)),
        el('ul', {}, ...g.rhythm.habits.map((h) => el('li', {}, h))))),
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
    pages.replaceChildren(el('p', { class: 'mg-empty' }, 'This month’s guide isn’t ready yet.'));
    return;
  }
  const key = root.dataset.planKey ?? `omc:club:meeting-guide:${month}:v1`;
  let family: ReadyFamily | null = null;
  let state: GuideState = emptyGuideState(content);
  let guide: MeetingGuide | null = null;
  let persist = true;
  let locked = false;

  const save = () => {
    if (persist && family) tabStorage.set(key, JSON.stringify({ current: root.dataset.planFor, state }));
  };
  const paint = () => {
    if (!family) return;
    guide = generateMeetingGuide({ household: family.household, profile: state.profile, content, state });
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
    save();
    paint();
  };

  // ---- Editor (desktop "Make changes", and the phone screen's rows) ----
  const fillEditor = () => {
    if (!guide) return;
    const g = guide;
    const body = dialog.querySelector<HTMLElement>('[data-mg-editor-body]')!;
    const people = g.people.map((p) => {
      const isAdult = p.stage === 'adult';
      const stages: GuideStage[] = isAdult ? ['adult'] : ['toddler', 'preschool', 'early', 'middle', 'teen'];
      const stageSel = el('select', { disabled: isAdult || locked }) as HTMLSelectElement;
      for (const s of stages) stageSel.append(el('option', { value: s, selected: s === p.stage }, STAGE_LABEL[s]));
      if (p.stage === 'child') stageSel.prepend(el('option', { value: 'child', selected: true }, STAGE_LABEL.child));
      stageSel.addEventListener('change', () => update((s) => { s.people[p.id] = { ...s.people[p.id], stage: stageSel.value as GuideStage, part: undefined }; }));
      const own = state.people[p.id]?.custom ?? '';
      const partField = STAGE_RULES[p.stage].ownsPart
        ? el('fieldset', { class: 'mg-ed-parts' }, el('legend', {}, `${p.name}’s part this month`),
            ...p.partOptions.map((o) => {
              const r = el('input', { type: 'radio', name: `mg-part-${p.id}`, value: o.id, checked: !own && p.part?.text === o.text, disabled: locked });
              r.addEventListener('change', () => update((s) => { s.people[p.id] = { ...s.people[p.id], part: o.id, custom: undefined }; }));
              return el('label', { class: 'mg-ed-choice' }, r, el('span', {}, o.text));
            }),
            (() => {
              const t = el('input', { type: 'text', maxLength: MAX_CUSTOM, value: own, placeholder: 'Or in your own words', disabled: locked });
              t.setAttribute('aria-label', `${p.name}’s part in your own words`);
              t.addEventListener('change', () => update((s) => { s.people[p.id] = { ...s.people[p.id], custom: t.value.trim() || undefined }; }));
              return t;
            })())
        : el('p', { class: 'mg-ed-note' }, 'Joins in and watches. No job yet.');
      return el('div', { class: 'mg-ed-person' },
        el('p', { class: 'mg-ed-name' }, el('strong', {}, p.name), p.age !== null ? ` · ${p.age}` : ''),
        // Children only: a child's stage can be corrected (an age not given, or a child who's ahead or behind).
        ...(isAdult ? [] : [el('label', { class: 'mg-ed-field' }, 'Plan for them as', stageSel)]),
        partField);
    });
    const leaders = PART_ORDER.map((id) => {
      const part = g.parts.find((x) => x.id === id)!;
      const sel = el('select', { disabled: locked }) as HTMLSelectElement;
      for (const p of g.people) {
        const r = STAGE_RULES[p.stage].leads;
        if (r === 'any' || (r === 'practice' && id === 'practice')) sel.append(el('option', { value: p.id, selected: p.id === part.leaderId }, p.name));
      }
      sel.addEventListener('change', () => update((s) => { s.leaders[id] = sel.value; }));
      return el('label', { class: 'mg-ed-field' }, part.title, sel);
    });
    const picked = new Set(g.actions.map((a) => a.id));
    const actions = g.actionChoices.map((a) => {
      const c = el('input', { type: 'checkbox', checked: picked.has(a.id), disabled: locked || (!picked.has(a.id) && picked.size >= content.maxActions) });
      c.addEventListener('change', () => update((s) => {
        const now = new Set(g.actions.map((x) => x.id));
        if (c.checked) now.add(a.id); else now.delete(a.id);
        s.actions = [...now].slice(0, content.maxActions);
        if (!s.actions.length) s.actions = [g.actionChoices[0].id];
      }));
      return el('label', { class: 'mg-ed-choice' }, c, el('span', {}, a.text, a.recommended ? el('em', {}, ' Suggested for your family') : ''));
    });
    const rhythm = g.rhythm.options.map((o) => {
      const r = el('input', { type: 'radio', name: 'mg-rhythm', checked: o.id === g.rhythm.chosen, disabled: locked });
      r.addEventListener('change', () => update((s) => { s.rhythm = o.id; }));
      return el('label', { class: 'mg-ed-choice' }, r, el('span', {}, o.label));
    });
    const reset = el('button', { type: 'button', class: 'mg-ed-reset', disabled: locked }, 'Start over with our family’s suggestions');
    reset.addEventListener('click', () => update((s) => { Object.assign(s, { ...emptyGuideState(content), profile: s.profile }); }));
    const familyLink = family?.source === 'account'
      ? el('p', { class: 'mg-ed-note' }, 'Names or ages wrong? ', el('a', { href: routes.clubFamily }, 'Fix them on your family page'), ' and your guide updates.')
      : el('p', { class: 'mg-ed-note' }, 'Names and ages come from the family profile.');
    body.replaceChildren(
      el('section', {}, el('h3', {}, 'Everyone’s part'), familyLink, ...people),
      el('section', {}, el('h3', {}, 'Who leads each part'), ...leaders),
      el('section', {}, el('h3', {}, `What we’ll agree on (up to ${content.maxActions})`), ...actions),
      el('section', {}, el('h3', {}, 'When we meet each month'), ...rhythm),
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
    const saved = readScoped(tabStorage.get(key), root.dataset.planFor ?? '', isGuideState);
    state = saved ?? emptyGuideState(content);
    // What she opened is the baseline. The profile answers she has now are kept with her guide from her first click
    // or key press, so the owner's print view (which has no profile) prints the guide she saw.
    save();
    const fresh = guideProfile(f.profile);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(state.profile)) {
      state = { ...state, profile: fresh };
      const once = () => {
        for (const t of ACTIONS) document.removeEventListener(t, once, true);
        save();
      };
      for (const t of ACTIONS) document.addEventListener(t, once, true);
    }
    paint();
  });
  window.addEventListener('resize', () => fit(host));
}

/**
 * The Monthly Family Meeting on a Club plan page (ClubFamilyMeeting.astro): switches between the month's tool and its
 * meeting, and draws the meeting from the family the page loaded (./family.ts → onPlanFamily) with the engine
 * (../family-meeting.ts) and its presentation rules (../family-meeting-view.ts). Nothing is saved or assigned
 * here except the family's optional "We agreed" (and its Undo) on Everyone's Part, on screen only.
 *
 * The view is `data-plan-view="tool" | "meeting"` on the `.club-plan` root, and `?view=meeting` in the address so a
 * link opens the meeting. Switching only hides and shows: the month's editor, its state and its approval are untouched.
 */
import { buildFamilyMeeting, suggestionKey, type FamilyMeeting } from '../family-meeting';
import { meetingView, monthTitle, type MeetingItemView, type MeetingPersonView } from '../family-meeting-view';
import { sampleStore } from '../store';
import { accountAgreementApi, conflictText, loadAgreements, persistAgreements, seedFromProfile, withAgreements } from '../../agreements/client';
import { adoptAgreements, newAgreementId, removeLocal, saveLocal, syncAgreements } from '../../agreements/store';
import { meetingMonth } from '../../../data/club/family-meeting';
import { el } from './dom';
import { familyLabel, onPlanFamily, type ReadyFamily } from './family';
import { printPlan } from './proof';
import { routes } from '../../../routes';
import { loadState } from '../../calendar/client';
import { localToday } from '../../calendar/recurrence';
import { weekAhead } from '../../family-meeting-support';
import { memberColors } from '../../../data/club/family-colors';

/**
 * Beside the meeting, on screen only: the family calendar's next seven days, there to look at during Let's Talk if the
 * family wants it. Not a step and not on the printed guide; the four parts are unchanged. Only a signed-in member's own
 * household calendar (saved on this device), never on a sample.
 */
function weekBlock(host: HTMLElement, family: ReadyFamily) {
  const box = q<HTMLElement>(host, '[data-fm-week]');
  if (!box || family.source !== 'account') return;
  const state = loadState();
  if (state.scope !== family.household.id) return;
  const week = weekAhead(Object.values(state.events), localToday(), new Date());
  if (!week.count) return;
  const colors = memberColors(family.household);
  const days = week.days.filter((d) => d.items.length);
  box.replaceChildren(
    el('p', { class: 'fm-rail-label' }, 'This week on our calendar'),
    el('ul', { class: 'fm-week' }, ...days.map((d) => el('li', {},
      el('strong', {}, d.label),
      ...d.items.map((i) => {
        const dot = el('span', { class: 'fm-week-dot', 'aria-hidden': 'true' });
        dot.style.background = colors[i.memberIds[0] ?? i.ownerId ?? '']?.hex ?? '#9aab8f';
        return el('span', { class: 'fm-week-item' }, dot, `${i.time === 'All day' ? '' : `${i.time} `}${i.title}`);
      })))),
    el('a', { href: routes.familyCalendar, class: 'fm-week-link' }, 'Open the family calendar →'));
  box.hidden = false;
}

export type PlanView = 'tool' | 'meeting';

export function setPlanView(root: HTMLElement, view: PlanView, opts: { focus?: boolean } = {}) {
  root.dataset.planView = view;
  root.querySelectorAll<HTMLButtonElement>('[data-fm-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fmView === view)));
  const url = new URL(location.href);
  if (view === 'meeting') url.searchParams.set('view', 'meeting');
  else url.searchParams.delete('view');
  history.replaceState(history.state, '', url);
  window.scrollTo({ top: 0 });
  // Printables size themselves on resize; give the tool a chance to re-measure when it comes back.
  window.dispatchEvent(new Event('resize'));
  if (opts.focus) root.querySelector<HTMLElement>(view === 'meeting' ? '[data-fm-title]' : '[data-fm-view="tool"]')?.focus();
}

const q = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel);

/** Screen only: what a grown-up can do to an item in Everyone's Part. Absent on paper and where nothing can be saved. */
interface PartActions {
  agree(memberId: string, item: MeetingItemView): void;
  undo(item: MeetingItemView): void;
}

function itemAction(p: MeetingPersonView, i: MeetingItemView, actions?: PartActions): HTMLElement[] {
  if (!actions) return [];
  if (i.status === 'suggested') {
    const b = el('button', { type: 'button', class: 'fm-agree', 'data-fm-agree': p.name }, 'We agreed');
    b.setAttribute('aria-label', `We agreed: ${p.name}, ${i.text}`);
    b.addEventListener('click', () => { b.disabled = true; actions.agree(p.memberId, i); });
    return [b];
  }
  if (i.status === 'confirmed' && i.rec.agreedFrom) {
    const b = el('button', { type: 'button', class: 'fm-undo', 'data-fm-undo': p.name }, 'Undo');
    b.setAttribute('aria-label', `Undo the agreement: ${p.name}, ${i.text}`);
    b.addEventListener('click', () => { b.disabled = true; actions.undo(i); });
    return [b];
  }
  return [];
}

function personCard(p: MeetingPersonView, dense: boolean, actions?: PartActions): HTMLElement {
  const items = p.joinsIn
    ? [el('p', { class: 'fm-joins' }, 'Joins in and watches. No job yet.')]
    : p.items.length
      ? p.items.map((i) => {
          const item = el('div', { class: 'fm-item' },
            el('span', { class: 'fm-pill' }, i.label),
            el('p', { class: 'fm-item-text' }, i.text),
            ...(i.detail || i.when ? [el('p', { class: 'fm-item-meta' }, [i.when, i.detail].filter(Boolean).join(' · '))] : []),
            ...(i.finished ? [el('p', { class: 'fm-finished' }, el('strong', {}, 'Finished looks like: '), i.finished)] : []),
            ...itemAction(p, i, actions));
          item.dataset.status = i.status;
          return item;
        })
      : [el('p', { class: 'fm-joins' }, 'Choose one small part together.')];
  const card = el('div', { class: 'fm-person' },
    el('p', { class: 'fm-person-name' }, el('strong', {}, p.name), el('span', {}, p.role)),
    ...items,
    ...(p.more && !dense ? [el('p', { class: 'fm-more' }, `+${p.more} more on screen`)] : []));
  return card;
}

function sectionHead(n: number, title: string, minutes: number, icon: string): HTMLElement {
  return el('div', { class: 'fm-sec-head' },
    el('img', { src: icon, alt: '', width: 44, height: 44, class: 'fm-sec-icon' }),
    el('span', { class: 'fm-num' }, String(n)),
    el('h3', {}, title),
    el('span', { class: 'fm-min' }, `${minutes} min`));
}

/** The guide itself: the same four sections on screen and on paper, with the print rules applied to the paper one. */
function guide(m: FamilyMeeting, family: string, print: boolean, icons: Record<string, string>, actions?: PartActions): HTMLElement[] {
  const v = meetingView(m, { print });
  return [
    el('header', { class: 'fm-sheet-head' },
      el('img', { src: icons.month, alt: '', width: 72, height: 60, class: 'fm-month-icon' }),
      el('div', {},
        el('p', { class: 'fm-sheet-kicker' }, `${monthTitle(m.month)} · ${family}`),
        el('h2', { class: 'fm-sheet-title' }, 'Our Family Meeting'),
        el('p', { class: 'fm-sheet-sub' }, `About 10 minutes, together · Introducing ${m.resourceTitle}`)),
      el('p', { class: 'fm-leader' }, v.leader.text)),

    el('section', { class: 'fm-sec', id: print ? '' : 'fm-focus' },
      sectionHead(1, 'Our Focus', m.focus.minutes, icons.focus),
      el('p', { class: 'fm-challenge' }, m.focus.challenge),
      el('p', { class: 'fm-why' }, m.focus.why),
      el('p', { class: 'fm-principle' }, m.focus.principle),
      ...(v.dense ? [] : [el('p', { class: 'fm-for' }, m.focus.forWhom)])),

    el('section', { class: 'fm-sec', id: print ? '' : 'fm-talk' },
      sectionHead(2, 'Let’s Talk', m.talk.minutes, icons.talk),
      el('ol', { class: 'fm-questions' }, ...m.talk.questions.map((x) => el('li', {}, x.text)))),

    el('section', { class: 'fm-sec', id: print ? '' : 'fm-parts' },
      sectionHead(3, 'Everyone’s Part', m.parts.minutes, icons.parts),
      el('p', { class: 'fm-note' }, m.parts.note),
      el('div', { class: `fm-people${v.dense ? ' fm-people--dense' : ''}` }, ...v.people.map((p) => personCard(p, v.dense, print ? undefined : actions))),
      ...(v.dense && v.people.some((p) => p.more) ? [el('p', { class: 'fm-more' }, 'Some people have more on screen in the full meeting.')] : [])),

    el('section', { class: 'fm-sec', id: print ? '' : 'fm-practice' },
      sectionHead(4, 'Let’s Practice', m.practice.minutes, icons.practice),
      el('p', { class: 'fm-practice-title' }, m.practice.title),
      el('ol', { class: 'fm-steps' }, ...m.practice.steps.map((s) => el('li', {}, s))),
      ...(v.dense ? [] : [el('p', { class: 'fm-then' }, `Then use ${m.resourceTitle} together.`)])),
  ];
}

export function mountFamilyMeeting(root: HTMLElement) {
  const host = q<HTMLElement>(root, '[data-family-meeting]');
  if (!host) return;
  const month = host.dataset.fmMonth!;
  const icons = JSON.parse(host.dataset.fmIcons ?? '{}') as Record<string, string>;

  // A meeting-only page (November) links to its tool: the member's own copy once we know she's signed in.
  let toolHref = host.dataset.fmToolHref;
  onPlanFamily(root, (f) => { if (f.source === 'account' && host.dataset.fmMemberToolHref) toolHref = host.dataset.fmMemberToolHref; });
  root.dataset.planView = toolHref || new URLSearchParams(location.search).get('view') === 'meeting' ? 'meeting' : 'tool';
  root.querySelectorAll<HTMLButtonElement>('[data-fm-view]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.fmView === root.dataset.planView));
    b.addEventListener('click', () => {
      if (b.dataset.fmView === 'tool' && toolHref) return void (location.href = toolHref);
      setPlanView(root, b.dataset.fmView === 'meeting' ? 'meeting' : 'tool', { focus: true });
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-fm-print]').forEach((b) => b.addEventListener('click', () => {
    if (root.dataset.planView !== 'meeting') setPlanView(root, 'meeting');
    printPlan();
  }));
  root.querySelectorAll<HTMLElement>('[data-fm-jump]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(a.dataset.fmJump!);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.querySelector<HTMLElement>('h3')?.setAttribute('tabindex', '-1');
    target?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  }));

  onPlanFamily(root, (family: ReadyFamily) => {
    const name = familyLabel(family);
    const familyName = name.replace(/^the /, 'The ');
    // "We agreed" saves to the household (the signed-in family) or to this tab (a labeled sample). Never on the
    // owner's print view. Suggestions stay suggestions until someone taps it.
    const sample = family.source === 'sample' && family.sample ? sampleStore(family.sample) : null;
    const account = family.source === 'account';
    let profile = family.profile;
    const status = q<HTMLElement>(host, '[data-fm-agree-status]');
    const say = (text: string) => { if (status) status.textContent = text; };

    // Signed in: agreements are saved on this phone first and synced with the household (src/lib/agreements), so
    // "We agreed" works with no signal and never overwrites the other adult.
    let ag = account ? seedFromProfile(adoptAgreements(loadAgreements(), family.household.id), family.profile) : null;
    const shown = () => (ag ? withAgreements(family.profile, ag) : profile);
    let syncing = false;
    const sync = async () => {
      if (!ag || syncing) return;
      syncing = true;
      try {
        const start = ag;
        const r = await syncAgreements(start, accountAgreementApi);
        let merged = r.state;
        for (const o of ag.outbox) if (!start.outbox.includes(o)) merged = o.kind === 'save' && o.row ? saveLocal(merged, o.row) : removeLocal(merged, o.id);
        ag = merged;
        persistAgreements(ag);
        render();
        if (r.offline && ag.outbox.length) say('Saved on this phone. It will sync with your family when you’re back online.');
        if (ag.conflicts.length) { say(ag.conflicts.map(conflictText).join(' ')); ag = { ...ag, conflicts: [] }; persistAgreements(ag); }
      } finally {
        syncing = false;
      }
    };
    const actions: PartActions | undefined = account || sample ? {
      agree: (memberId, item) => {
        const r = item.rec;
        const draft = {
          category: r.category ?? 'other', text: r.description, ...(r.finished ? { finished: r.finished } : {}),
          ...(r.when ? { when: r.when } : {}), month, ...(suggestionKey(r) ? { source: suggestionKey(r) } : {}), ownerIds: [memberId],
        };
        if (ag) {
          ag = saveLocal(ag, {
            id: newAgreementId(), category: draft.category, text: draft.text, owner_ids: draft.ownerIds, finished: draft.finished ?? null,
            when: draft.when ?? null, month, source: draft.source ?? null, confirmed_at: new Date().toISOString(),
          });
          persistAgreements(ag);
          render();
          say('Saved: agreed by our family.');
          void sync();
          return;
        }
        void sample!.saveAgreement(draft)
          .then((p) => { profile = p; render(); say('Saved: agreed by our family.'); })
          .catch(() => { render(); say('Couldn’t save that agreement. Try again.'); });
      },
      undo: (item) => {
        if (!item.rec.sourceId) return;
        if (ag) {
          ag = removeLocal(ag, item.rec.sourceId);
          persistAgreements(ag);
          render();
          say('Removed. It’s a suggestion again.');
          void sync();
          return;
        }
        void sample!.removeAgreement(item.rec.sourceId)
          .then((p) => { profile = p; render(); say('Removed. It’s a suggestion again.'); })
          .catch(() => { render(); say('Couldn’t undo that. Try again.'); });
      },
    } : undefined;
    let meeting: FamilyMeeting;
    const render = () => {
      meeting = buildFamilyMeeting({ household: family.household, profile: shown(), month });
      q<HTMLElement>(host, '[data-fm-screen]')!.replaceChildren(...guide(meeting, familyName, false, icons, actions));
      q<HTMLElement>(host, '[data-meeting-sheet]')!.replaceChildren(...guide(meeting, familyName, true, icons));
    };
    try {
      render();
    } catch {
      q<HTMLElement>(host, '[data-fm-screen]')!.replaceChildren(el('p', { class: 'fm-note' }, 'This month’s meeting isn’t ready yet.'));
      return;
    }
    q<HTMLElement>(host, '[data-fm-for]')!.textContent = family.source === 'sample' ? `Sample family: ${familyName}` : `Prepared for ${familyName}`;
    q<HTMLElement>(host, '[data-fm-leader]')!.textContent = meetingView(meeting!, { print: false }).leader.text;
    const content = meetingMonth(Number(month.slice(5)));
    const audio = q<HTMLElement>(host, '[data-fm-audio]');
    if (audio && content?.audio) {
      audio.replaceChildren(
        el('p', { class: 'fm-rail-label' }, 'Listen first'),
        el('p', {}, `A ${content.audio.minutes}-minute introduction from Megan for the whole family.`),
        el('audio', { controls: true, preload: 'none', src: content.audio.src }));
      audio.hidden = false;
    }
    // A link to her family page only for a signed-in member (Club member pages are never linked statically).
    const fam = q<HTMLElement>(host, '[data-fm-family-link]');
    if (fam && family.source === 'account') fam.replaceWith(el('a', { href: routes.clubFamily }, fam.textContent ?? 'your family page'));
    weekBlock(host, family);
    host.dataset.fmReady = 'true';
    if (ag) {
      void sync();
      window.addEventListener('online', () => void sync());
    }
  });
}

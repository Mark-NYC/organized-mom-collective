/**
 * The Monthly Family Meeting on a Club plan page (ClubFamilyMeeting.astro): switches between the month's tool and its
 * meeting, and draws the meeting from the family the page loaded (./family.ts → onPlanFamily) with the engine
 * (../family-meeting.ts) and its presentation rules (../family-meeting-view.ts). Reads only: nothing is saved, assigned
 * or confirmed here.
 *
 * The view is `data-plan-view="tool" | "meeting"` on the `.club-plan` root, and `?view=meeting` in the address so a
 * link opens the meeting. Switching only hides and shows: the month's editor, its state and its approval are untouched.
 */
import { buildFamilyMeeting, type FamilyMeeting } from '../family-meeting';
import { meetingView, monthTitle, type MeetingPersonView } from '../family-meeting-view';
import { meetingMonth } from '../../../data/club/family-meeting';
import { el } from './dom';
import { familyLabel, onPlanFamily, type ReadyFamily } from './family';
import { printPlan } from './proof';
import { routes } from '../../../routes';

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

function personCard(p: MeetingPersonView, dense: boolean): HTMLElement {
  const items = p.joinsIn
    ? [el('p', { class: 'fm-joins' }, 'Joins in and watches. No job yet.')]
    : p.items.length
      ? p.items.map((i) => {
          const item = el('div', { class: 'fm-item' },
            el('span', { class: 'fm-pill' }, i.label),
            el('p', { class: 'fm-item-text' }, i.text),
            ...(i.detail || i.when ? [el('p', { class: 'fm-item-meta' }, [i.when, i.detail].filter(Boolean).join(' · '))] : []),
            ...(i.finished ? [el('p', { class: 'fm-finished' }, el('strong', {}, 'Finished looks like: '), i.finished)] : []));
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
function guide(m: FamilyMeeting, family: string, print: boolean, icons: Record<string, string>): HTMLElement[] {
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
      el('div', { class: `fm-people${v.dense ? ' fm-people--dense' : ''}` }, ...v.people.map((p) => personCard(p, v.dense))),
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
    let meeting: FamilyMeeting;
    try {
      meeting = buildFamilyMeeting({ household: family.household, profile: family.profile, month });
    } catch {
      q<HTMLElement>(host, '[data-fm-screen]')!.replaceChildren(el('p', { class: 'fm-note' }, 'This month’s meeting isn’t ready yet.'));
      return;
    }
    const name = familyLabel(family);
    const familyName = name.replace(/^the /, 'The ');
    q<HTMLElement>(host, '[data-fm-for]')!.textContent = family.source === 'sample' ? `Sample family: ${familyName}` : `Prepared for ${familyName}`;
    q<HTMLElement>(host, '[data-fm-leader]')!.textContent = meetingView(meeting, { print: false }).leader.text;
    q<HTMLElement>(host, '[data-fm-screen]')!.replaceChildren(...guide(meeting, familyName, false, icons));
    q<HTMLElement>(host, '[data-meeting-sheet]')!.replaceChildren(...guide(meeting, familyName, true, icons));
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
    host.dataset.fmReady = 'true';
  });
}

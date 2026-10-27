/**
 * The shared Club plan screen below 1100px (ClubPlanScreen.astro): who it's for, the editing window, approval,
 * the compact printable preview, the action bar, one focused edit sheet, a one-time copy and a toast. A month
 * supplies only its sections (`render`) and its sheets; everything else is here, tested once.
 *
 * Approval is a prototype: kept in this tab against the printable's fingerprint (production: approved_revision).
 * Mail by default: approval means "I've checked it", never a condition for receiving the resource.
 */
import { editingWindow } from '../edition-status';
import { el } from './dom';
import { printPlan } from './proof';
import { PLAN_CHANGE, type PlanResource, type PlanResourceHost } from './resource';
import { tabStorage } from './storage';

export interface PlanScreen<S> {
  resource(): PlanResource<S>;
  readOnly(): boolean;
  copying(): boolean;
  openSheet(title: string, ...body: Node[]): void;
  closeSheet(): void;
  doneButton(): HTMLButtonElement;
  toast(text: string, undo?: () => void): void;
  refresh(): void;
}

export interface PlanScreenOptions<S> {
  /** The plan page root (`.club-plan`), with data-plan-for / -source / -label once the family is ready. */
  root: HTMLElement;
  /** The printable's root, which publishes `clubPlan` and fires PLAN_CHANGE. */
  host: PlanResourceHost<S>;
  /** sessionStorage key for this resource's prototype approval. */
  approvalKey: string;
  /** Paint the month's own sections from the current state. */
  render(screen: PlanScreen<S>, state: S, locked: boolean): void;
}

type Approval = { for: string; print: string; at: string };

export function mountPlanScreen<S>(o: PlanScreenOptions<S>): PlanScreen<S> | null {
  const screen = o.root.querySelector<HTMLElement>('[data-plan-screen]');
  if (!screen) return null;
  const { root, host } = o;
  const $ = <T extends HTMLElement>(sel: string) => screen.querySelector<T>(sel)!;
  const sheet = $<HTMLDialogElement>('[data-cp-sheet]');
  const resource = () => host.clubPlan!;
  let copySnapshot: S | null = null;
  let toastTimer = 0;
  let thumbTimer = 0;

  const readApproval = (): Approval | null => {
    try {
      const a = JSON.parse(tabStorage.get(o.approvalKey) ?? 'null') as Approval | null;
      return a && a.for === root.dataset.planFor ? a : null;
    } catch { return null; }
  };
  const writeApproval = (a: Approval | null) => (a ? tabStorage.set(o.approvalKey, JSON.stringify(a)) : tabStorage.remove(o.approvalKey));

  const now = () => {
    const d = import.meta.env.DEV ? new URLSearchParams(location.search).get('preview-date') : null;
    return d ? new Date(d) : new Date();
  };
  const windowState = () => editingWindow(screen.dataset.deadline ?? '', now());
  const readOnly = () => windowState().phase === 'closed' && !copySnapshot;

  const toast = (text: string, undo?: () => void) => {
    const t = $('[data-cp-toast]');
    $('[data-cp-toast-text]').textContent = text;
    const u = $<HTMLButtonElement>('[data-cp-toast-undo]');
    u.hidden = !undo;
    u.onclick = undo ? () => { undo(); t.hidden = true; } : null;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { t.hidden = true; }, 6000);
  };

  // Thumbnails are scaled copies of the real sheets; the print DOM itself never moves.
  const paintThumbs = () => {
    screen.querySelectorAll<HTMLElement>('[data-cp-thumb]').forEach((box) => {
      const src = host.querySelector<HTMLElement>(`[data-plan-sheet="${box.dataset.cpThumb}"]`);
      if (!src) return;
      const copy = src.cloneNode(true) as HTMLElement;
      for (const n of [copy, ...copy.querySelectorAll('*')]) {
        for (const a of [...n.attributes]) if (/^data-(osr|plan)/.test(a.name) || ['contenteditable', 'role', 'aria-label', 'spellcheck', 'id', 'tabindex'].includes(a.name)) n.removeAttribute(a.name);
      }
      copy.style.cssText = `--osr-scale:${box.clientWidth / 816};transform:scale(${box.clientWidth / 816})`;
      box.replaceChildren(copy);
    });
  };

  const api: PlanScreen<S> = {
    resource,
    readOnly,
    copying: () => Boolean(copySnapshot),
    openSheet(title, ...body) {
      $('[data-cp-sheet-title]').textContent = title;
      $('[data-cp-sheet-body]').replaceChildren(...body);
      if (!sheet.open) sheet.showModal();
      sheet.scrollTop = 0;
    },
    closeSheet: () => sheet.close(),
    doneButton() {
      const b = el('button', { type: 'button', class: 'cp-btn cp-btn-dark' }, 'Done');
      b.addEventListener('click', () => sheet.close());
      return b;
    },
    toast,
    refresh: () => render(),
  };

  const render = () => {
    const r = host.clubPlan;
    if (!r?.ready()) return;
    const s = r.state();
    const locked = readOnly();
    const copy = Boolean(copySnapshot);
    screen.toggleAttribute('data-readonly', locked);
    screen.dataset.mode = copy ? 'copy' : 'plan';
    $('[data-cp-for]').textContent = 'Prepared for ' + (root.dataset.planLabel || 'your family');
    $('[data-cp-sample]').hidden = root.dataset.planSource !== 'sample';

    o.render(api, s, locked);

    const w = windowState();
    screen.dataset.window = w.phase;
    $('[data-cp-window]').textContent = w.phase === 'closed' ? `${w.text}. You can still print a copy.` : w.text;
    const a = readApproval();
    const approval = !a ? 'none' : a.print === r.fingerprint() ? 'approved' : 'changed';
    screen.dataset.approval = approval;
    const day = a ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(a.at)) : '';
    $('[data-cp-approval-text]').textContent =
      approval === 'approved' ? `Approved ${day} · preview only` : approval === 'changed' ? 'Changed since you approved' : 'Not approved yet';
    const primary = $<HTMLButtonElement>('[data-plan-primary]');
    primary.textContent = copy ? 'Print this copy' : locked ? 'Print a copy' : approval === 'approved' ? '✓ Approved' : approval === 'changed' ? 'Approve changes' : 'Approve this plan';
    primary.setAttribute('aria-disabled', String(!copy && !locked && approval === 'approved'));
    $<HTMLButtonElement>('[data-cp-print]').hidden = copy || locked;
    $<HTMLButtonElement>('[data-cp-copy-done]').hidden = !copy;
    $('[data-cp-copy-banner]').hidden = !copy;

    const sample = root.dataset.planSource === 'sample';
    $('[data-cp-foot]').textContent = (sample ? `${root.dataset.planLabel?.replace(/^the /, 'The ') ?? 'This family'} is a made-up sample family for this preview. ` : '')
      + 'Changes and approval stay in this browser tab for now. Nothing is saved to an account or mailed yet.';

    clearTimeout(thumbTimer);
    thumbTimer = window.setTimeout(paintThumbs, 120);
  };

  $('[data-cp-sheet-close]').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

  $('[data-plan-primary]').addEventListener('click', () => {
    if (copySnapshot || readOnly()) return printPlan();
    const a = readApproval();
    const print = resource().fingerprint();
    if (a && a.print === print) return;
    writeApproval({ for: root.dataset.planFor ?? '', print, at: new Date().toISOString() });
    render();
    toast('Approved in this preview. Nothing is mailed yet.', () => { writeApproval(a); render(); });
  });
  $('[data-plan-copy]').addEventListener('click', () => {
    copySnapshot = structuredClone(resource().state());
    resource().setPersist(false);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('[data-cp-copy-done]').addEventListener('click', () => {
    const snap = copySnapshot;
    copySnapshot = null;
    if (snap) resource().replace(snap);
    resource().setPersist(true);
    render();
    toast('Back to your plan. The copy wasn’t saved.');
  });

  // Keep the action bar above the app's bottom tab bar (shown on small screens only).
  const nav = document.querySelector<HTMLElement>('nav[data-chrome]');
  const fitBar = () => {
    // offsetParent is always null for a fixed element, so ask for its display instead.
    const shown = Boolean(nav && getComputedStyle(nav).display !== 'none');
    root.style.setProperty('--cp-nav', `${shown ? nav!.offsetHeight : 0}px`);
    root.style.setProperty('--cp-safe', shown ? '0px' : 'env(safe-area-inset-bottom, 0px)');
  };
  fitBar();
  if (nav && typeof ResizeObserver !== 'undefined') new ResizeObserver(fitBar).observe(nav);
  window.addEventListener('resize', fitBar);

  host.addEventListener(PLAN_CHANGE, render);
  render();
  return api;
}

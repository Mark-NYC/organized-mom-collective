/**
 * The shared desktop rail (ClubPlanDesktop.astro): the editing window, Make changes, approval and whose family it
 * is. A month supplies only how to open its editor and how to paint its details; approval is the same one the
 * mobile plan screen reads (status.ts), so a family that approves on one screen sees it on the other.
 *
 * Past the editing cutoff the printable is locked through `lock` and the rail offers printing only.
 */
import { editingWindow } from '../edition-status';
import { earlierCopyLink, PLAN_SAVE, saveText, type PlanSaveStatus } from './account';
import { onPlanFamily } from './family';
import { inWelcomeKit, isWelcomeResource, PLAN_APPROVAL, PLAN_CHANGE, PLAN_WELCOME, PLAN_WELCOME_APPROVE, type PlanResource, type PlanResourceHost } from './resource';
import { approvalDay, approvalState, planNow, readApproval, writeApproval, type Approval } from './status';

export interface PlanDesktopOptions<S> {
  root: HTMLElement;
  host: PlanResourceHost<S>;
  approvalKey: string;
  /** Open the month's editor (Make changes). */
  edit(): void;
  /** Paint the month's details in the rail; `locked` once the editing window has closed. */
  render?(resource: PlanResource<S>, locked: boolean): void;
  /** Stop or allow edits on the printable itself. */
  lock?(on: boolean): void;
}

const ET = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' });

export function mountPlanDesktop<S>(o: PlanDesktopOptions<S>) {
  const rail = o.root.querySelector<HTMLElement>('[data-plan-desktop]');
  if (!rail) return null;
  const { root, host } = o;
  const $ = <T extends HTMLElement>(sel: string) => rail.querySelector<T>(sel)!;
  const deadline = rail.dataset.deadline ?? '';
  const edit = $<HTMLButtonElement>('[data-cpd-edit]');
  const approve = $<HTMLButtonElement>('[data-cpd-approve]');
  const note = $('[data-cpd-approval]');
  const undo = $<HTMLButtonElement>('[data-cpd-undo]');
  let locked = false;
  let previous: Approval | null = null;

  const isClosed = () => editingWindow(deadline, planNow()).phase === 'closed';

  const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  // One small line: the print deadline and how long is left (the exact cutoff in its title).
  const paintDeadline = () => {
    const ms = Date.parse(deadline) - planNow().getTime();
    const status = $('[data-cpd-status]');
    const detail = $('[data-cpd-detail]');
    const box = $('[data-cpd-countdown]');
    box.hidden = true;
    // The Welcome resource has no deadline: it's hers to change and print whenever she likes.
    if (isWelcomeResource(root)) {
      status.textContent = 'Yours to keep. Change it or print it anytime.';
      detail.textContent = '';
      return;
    }
    if (!Number.isFinite(ms)) {
      status.textContent = 'Print deadline not scheduled yet';
      detail.textContent = '';
      return;
    }
    const minutes = Math.max(0, Math.ceil(ms / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const left = days >= 1 ? `${days} ${days === 1 ? 'day' : 'days'} left` : hours >= 1 ? `${hours} ${hours === 1 ? 'hour' : 'hours'} left` : `${minutes % 60} min left`;
    status.textContent = minutes ? `Print deadline ${DAY.format(Date.parse(deadline))} · ${left}` : `${editingWindow(deadline, planNow()).text}. You can still print a copy.`;
    $('[data-cpd-days]').textContent = String(days).padStart(2, '0');
    $('[data-cpd-hours]').textContent = String(hours).padStart(2, '0');
    $('[data-cpd-minutes]').textContent = String(minutes % 60).padStart(2, '0');
    detail.textContent = minutes ? `Changes save as you go until ${ET.format(Date.parse(deadline))} ET.` : '';
    rail.dataset.deadlineSoon = String(minutes > 0 && minutes < 3 * 1440);
  };

  const paint = () => {
    const r = host.clubPlan;
    if (!r?.ready()) return;
    const closed = isClosed();
    if (closed !== locked) {
      locked = closed;
      o.lock?.(closed);
    }
    edit.disabled = locked;
    edit.textContent = locked ? 'Editing closed' : 'Make changes';
    const a = readApproval(o.approvalKey, root.dataset.planFor);
    const state = approvalState(a, r.fingerprint());
    approve.hidden = locked;
    const welcome = inWelcomeKit(root);
    const evergreen = isWelcomeResource(root);
    approve.textContent = welcome ? 'Approve for printing' : state === 'approved' ? '✓ Approved' : state === 'changed' ? 'Approve changes' : evergreen ? 'Approve my plan' : 'Approve preview';
    approve.setAttribute('aria-disabled', String(!welcome && state === 'approved'));
    // A member's plan saves to her account (./account.ts); approval here is still this tab's check mark only.
    const member = root.dataset.planSource === 'account';
    if (welcome) note.textContent = 'Review your family’s plan. Make any changes, then approve it for printing. You’ll confirm all three printed pieces together at the end.';
    else if (evergreen) note.textContent = !member
      ? (state === 'approved' ? `Approved ${approvalDay(a)} in this preview. Nothing is saved to an account.` : 'Approval is kept in this preview only. Nothing is saved to an account.')
      : state === 'approved' ? `Approved ${approvalDay(a)}. Change it whenever life changes; print it as often as you like.`
      : state === 'changed' ? 'Changed since you approved it. Approve it again when it looks right.'
      : 'Look it over and change anything that doesn’t fit, then approve it. That’s all it needs.';
    else if (state === 'approved') note.textContent = member
      ? `Approved ${approvalDay(a)} on this device. Approval is optional: it only says you’ve checked it. Nothing is submitted or mailed from here.`
      : `Approved ${approvalDay(a)} in this preview. Approval is optional: it only says you’ve checked it. Nothing is saved to an account, submitted or mailed.`;
    else if (state === 'changed') note.textContent = 'Changed since you approved. Approve again when you’ve checked it, or leave it: approval is optional.';
    else if (member) note.textContent = locked ? 'Printing is unlimited. Nothing is mailed from this page.' : 'Approval is optional: it only says you’ve checked it, and doesn’t submit or mail anything.';
    else note.textContent = locked ? 'Printing is unlimited. Nothing is saved to an account or mailed from this preview.' : 'Approval is optional and preview only: it doesn’t save, submit or mail anything. Mailing isn’t active yet.';
    undo.hidden = welcome || !previous || state !== 'approved';
    o.render?.(r, locked);
  };

  onPlanFamily(root, (family) => {
    const who = family.source === 'sample'
      ? `Sample family: ${family.sampleLabel.replace(/^Sample:\s*/, '')}, made up for this preview.`
      : `Prepared for ${family.household.displayName ?? 'your family'}.`;
    const source = () => {
      const where = family.source === 'sample' ? 'Changes stay in this browser tab.' : saveText(root.dataset.planSave as PlanSaveStatus | undefined);
      $('[data-cpd-source]').replaceChildren(`${who} ${where}`, ...earlierCopyLink(root));
    };
    source();
    root.addEventListener(PLAN_SAVE, source);
    paint();
  });

  edit.addEventListener('click', () => { if (!locked) o.edit(); });
  approve.addEventListener('click', () => {
    const r = host.clubPlan;
    if (!r?.ready() || locked) return;
    const a = readApproval(o.approvalKey, root.dataset.planFor);
    const print = r.fingerprint();
    if (inWelcomeKit(root)) {
      if (a?.print !== print) writeApproval(o.approvalKey, { for: root.dataset.planFor ?? '', print, at: new Date().toISOString() });
      root.dispatchEvent(new Event(PLAN_WELCOME_APPROVE));
      return;
    }
    if (a?.print === print) return;
    previous = a;
    writeApproval(o.approvalKey, { for: root.dataset.planFor ?? '', print, at: new Date().toISOString() });
    root.dispatchEvent(new Event(PLAN_APPROVAL));
  });
  undo.addEventListener('click', () => {
    writeApproval(o.approvalKey, previous);
    previous = null;
    root.dispatchEvent(new Event(PLAN_APPROVAL));
  });

  host.addEventListener(PLAN_CHANGE, paint);
  root.addEventListener(PLAN_APPROVAL, paint);
  root.addEventListener(PLAN_WELCOME, paint);
  paintDeadline();
  paint();
  const timer = window.setInterval(() => { paintDeadline(); paint(); }, 15000);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  return { refresh: paint };
}


/**
 * The shared desktop rail (ClubPlanDesktop.astro): the editing window, Make changes, approval and whose family it
 * is. A month supplies only how to open its editor and how to paint its details; approval is the same one the
 * mobile plan screen reads (status.ts), so a family that approves on one screen sees it on the other.
 *
 * Past the editing cutoff the printable is locked through `lock` and the rail offers printing only.
 */
import { editingWindow } from '../edition-status';
import { onPlanFamily } from './family';
import { PLAN_APPROVAL, PLAN_CHANGE, type PlanResource, type PlanResourceHost } from './resource';
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

  const paintDeadline = () => {
    const ms = Date.parse(deadline) - planNow().getTime();
    const status = $('[data-cpd-status]');
    const detail = $('[data-cpd-detail]');
    const box = $('[data-cpd-countdown]');
    if (!Number.isFinite(ms)) {
      status.textContent = 'Editing cutoff not scheduled yet.';
      detail.textContent = '';
      box.hidden = true;
      return;
    }
    const minutes = Math.max(0, Math.ceil(ms / 60000));
    box.hidden = !minutes;
    status.textContent = minutes ? 'Time left to make changes' : `${editingWindow(deadline, planNow()).text}. You can still print a copy.`;
    $('[data-cpd-days]').textContent = String(Math.floor(minutes / 1440)).padStart(2, '0');
    $('[data-cpd-hours]').textContent = String(Math.floor((minutes % 1440) / 60)).padStart(2, '0');
    $('[data-cpd-minutes]').textContent = String(minutes % 60).padStart(2, '0');
    detail.textContent = `Cutoff: ${ET.format(Date.parse(deadline))} ET.`;
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
    approve.textContent = state === 'approved' ? '✓ Approved' : state === 'changed' ? 'Approve changes' : 'Approve preview';
    approve.setAttribute('aria-disabled', String(state === 'approved'));
    if (state === 'approved') note.textContent = `Approved ${approvalDay(a)} in this preview. Approval is optional: it only says you’ve checked it. Nothing is saved to an account, submitted or mailed.`;
    else if (state === 'changed') note.textContent = 'Changed since you approved. Approve again when you’ve checked it, or leave it: approval is optional.';
    else note.textContent = locked ? 'Printing is unlimited. Nothing is saved to an account or mailed from this preview.' : 'Approval is optional and preview only: it doesn’t save, submit or mail anything. Mailing isn’t active yet.';
    undo.hidden = !previous || state !== 'approved';
    o.render?.(r, locked);
  };

  onPlanFamily(root, (family) => {
    const who = family.source === 'sample'
      ? `Sample family: ${family.sampleLabel.replace(/^Sample:\s*/, '')}, made up for this preview.`
      : `Prepared for ${family.household.displayName ?? 'your family'}.`;
    const where = family.source === 'sample' ? ' Changes stay in this browser tab.' : ' Changes stay in this browser tab; saving to your account isn’t available yet.';
    $('[data-cpd-source]').textContent = who + where;
    paint();
  });

  edit.addEventListener('click', () => { if (!locked) o.edit(); });
  approve.addEventListener('click', () => {
    const r = host.clubPlan;
    if (!r?.ready() || locked) return;
    const a = readApproval(o.approvalKey, root.dataset.planFor);
    const print = r.fingerprint();
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
  paintDeadline();
  paint();
  const timer = window.setInterval(() => { paintDeadline(); paint(); }, 15000);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  return { refresh: paint };
}

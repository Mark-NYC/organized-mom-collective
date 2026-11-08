/**
 * The Club's shared marks, one implementation for January, March, May, August and every month after (styles:
 * src/styles/club-marks.css, imported by each printable and phone screen):
 *
 * - `habitCue(text)`: [clock] WHEN After breakfast. The existing daily event a recurring responsibility follows, placed
 *   directly below that responsibility. Neutral warm background, charcoal text, the approved hand-drawn monochrome
 *   clock (assets/icons/ofc/updatedicons/svg/clock.svg). A cue is a habit trigger, never a due date.
 * - `ownerTag(name, color)`: who owns it: the person's marker dot and their name in the same hue (darkened for
 *   reading, ./colors.ts). Color is never alone: the name is always printed.
 * - `doneLine(text)`: DONE WHEN …: how you know you're finished.
 *
 * Reading order everywhere: responsibility, then owner, then WHEN, then DONE WHEN (where it isn't said once for the
 * whole section).
 */
import clockUrl from '../../../../assets/icons/ofc/updatedicons/svg/clock.svg?url';
import { el } from '../plan/dom';
import { NEUTRAL_COLOR, type MemberColor } from './colors';

export { CUE_LIMIT, tidyCue } from './marks-text';
export const CLOCK_ICON = clockUrl;

export function habitCue(text: string): HTMLElement {
  const icon = el('img', { class: 'hc-cue-icon', src: CLOCK_ICON, alt: '', width: 12, height: 12 });
  const cue = el('span', { class: 'hc-cue' }, icon, el('span', { class: 'hc-cue-label' }, 'When'), el('span', { class: 'hc-cue-text' }, text));
  cue.setAttribute('aria-label', `When: ${text}`);
  return cue;
}

export function ownerTag(name: string, color: MemberColor = NEUTRAL_COLOR): HTMLElement {
  const tag = el('span', { class: 'mc-owner' }, el('span', { class: 'mc-dot', 'aria-hidden': 'true' }), el('span', { class: 'mc-name' }, name));
  tag.style.setProperty('--mc', color.hex);
  tag.style.setProperty('--mc-ink', color.ink);
  if (color.id === NEUTRAL_COLOR.id) tag.classList.add('mc-owner--neutral');
  return tag;
}

/** Several owners: one tag each, in order (a group like "Everyone" is one neutral tag). */
export function ownerTags(owners: readonly { name: string; color?: MemberColor }[]): HTMLElement {
  return el('span', { class: 'mc-owners' }, ...owners.map((o) => ownerTag(o.name, o.color)));
}

export function doneLine(text: string): HTMLElement {
  return el('p', { class: 'hc-done' }, el('span', { class: 'hc-done-label' }, 'Done when'), el('span', {}, text));
}

/**
 * Routine helpers for three-part kits: the worked example printed on the back of the letter comes from the same rules
 * the routine tool uses, so the letter and the tool never disagree.
 */
import { kitItems } from '../../data/club/kits';
import type { KitConfig, KitItem } from '../../data/club/types';
import { eligible, ROUTINE_MAX_STEPS, routineSteps } from './engines/responsibilities';
import type { PlannedMember } from './profile';
import { defaultSchool } from './school';

/** The letter's example routine (`mailer.example`): what the tool suggests for a child of that age. */
export function exampleRoutine(kit: KitConfig): KitItem[] {
  const ex = kit.mailer.example;
  if (!ex) return [];
  const child: PlannedMember = { id: 'example', firstName: '', stage: ex.age >= 13 ? 'teen' : 'child', age: ex.age, isAccountHolder: false, school: defaultSchool(ex.age, {}) };
  const fits = (kitItems(kit, ex.items) ?? []).filter((i) => i.scope === 'each' && i.section === ex.section && eligible(i, child, {}));
  return routineSteps(fits, ROUTINE_MAX_STEPS);
}

/** The printed QR code's address (the site's canonical origin, as in astro.config.mjs). */
export const qrUrl = (qrPath: string) => `https://www.organizedmomcollective.com${qrPath}`;

/** The readable form of a kit's address for print, without the tracking parameter. */
export const readableUrl = (qrPath: string) => `organizedmomcollective.com${qrPath.split('?')[0]}`;

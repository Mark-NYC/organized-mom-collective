/**
 * Routine helpers for three-part kits. The letter's worked example is the site routine chart's own starter
 * (src/data/routines.ts), with the same illustrations the chart gives those lines, so the letter and the tool it
 * points to never disagree.
 */
import { matchResponsibility } from '../../data/responsibilities';
import { routineTypes } from '../../data/routines';
import type { KitConfig } from '../../data/club/types';

/** The letter's example routine (`mailer.example`): the routine chart's starter steps, with their illustrations. */
export function exampleRoutine(kit: KitConfig): { title: string; illustration?: string }[] {
  const type = kit.mailer.example ? routineTypes[kit.mailer.example.variant] : undefined;
  if (!type) return [];
  return type.steps.map(([, title]) => {
    const illustration = matchResponsibility(title);
    return { title, ...(illustration ? { illustration } : {}) };
  });
}

/** The printed QR code's address (the site's canonical origin, as in astro.config.mjs). */
export const qrUrl = (qrPath: string) => `https://www.organizedmomcollective.com${qrPath}`;

/** The readable form of a kit's address for print, without the tracking parameter. */
export const readableUrl = (qrPath: string) => `organizedmomcollective.com${qrPath.split('?')[0]}`;

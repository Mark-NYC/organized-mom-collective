/**
 * March chore chart icons: one place that says which illustration each March chore uses
 * (src/lib/club/engines/march-chore-charts.ts), daily and weekly alike.
 *
 * Artwork: assets/icons/ofc/march/<name>.webp (transparent, square, no background circle; see the README there).
 * The owner is drawing the set; a file is picked up by name at build time, so adding one needs no code change.
 * Until a file exists the chore shows its responsibility-library illustration when it has one
 * (public/images/responsibilities/), otherwise no picture: never a broken image or an empty box.
 */
import { responsibilityById, responsibilityImage } from '../responsibilities';

export const MARCH_ICONS = [
  'toys-away', 'make-bed', 'set-table', 'clear-dishes', 'clothes-away', 'tidy-desk', 'wipe-surface', 'feed-pets',
  'take-out-trash', 'empty-dishwasher', 'make-dinner', 'fluff-pillows', 'dust', 'vacuum', 'clean-floor', 'change-sheets',
  'shoes-away', 'wipe-sink', 'bathroom-trash', 'clean-bathroom', 'clean-fridge', 'sock-dusting', 'home-project',
  'finish-missed-jobs',
] as const;
export type MarchIcon = (typeof MARCH_ICONS)[number];

/** Chore id (DAILY_CHORES and ZONE_CHORES in the engine) → icon. Some icons serve two chores. */
export const MARCH_CHORE_ICONS: Readonly<Record<string, MarchIcon>> = {
  'put-toys-away': 'toys-away',
  'make-my-bed': 'make-bed',
  'set-the-table': 'set-table',
  'clear-the-table': 'clear-dishes',
  'my-dishes': 'clear-dishes',
  'put-clothes-away': 'clothes-away',
  'tidy-my-desk': 'tidy-desk',
  'wipe-the-counters': 'wipe-surface',
  'feed-pets': 'feed-pets',
  'take-out-the-trash': 'take-out-trash',
  dishwasher: 'empty-dishwasher',
  'help-dinner': 'make-dinner',
  pillows: 'fluff-pillows',
  'dust-living': 'dust',
  'dust-room': 'dust',
  'vacuum-living': 'vacuum',
  'vacuum-room': 'vacuum',
  'clean-my-floor': 'clean-floor',
  'sweep-kitchen': 'clean-floor',
  sheets: 'change-sheets',
  shoes: 'shoes-away',
  sink: 'wipe-sink',
  'bath-trash': 'bathroom-trash',
  bathroom: 'clean-bathroom',
  fridge: 'clean-fridge',
  'sock-dust': 'sock-dusting',
  project: 'home-project',
  'catch-up': 'finish-missed-jobs',
};

/** Existing artwork shown until an icon's file is added: the responsibility-library illustration that fits. */
const STAND_INS: Partial<Record<MarchIcon, string>> = {
  'toys-away': 'put-toys-away',
  'make-bed': 'make-my-bed',
  'set-table': 'set-the-table',
  'clear-dishes': 'clear-the-table',
  'clothes-away': 'put-clothes-away',
  'tidy-desk': 'tidy-my-desk',
  'wipe-surface': 'wipe-the-counters',
  'take-out-trash': 'take-out-the-trash',
  'clean-floor': 'clean-my-floor',
};

const ART_DIR = '../../../assets/icons/ofc/march/';
const art = import.meta.glob<string>('../../../assets/icons/ofc/march/*.webp', { eager: true, query: '?url', import: 'default' });

export interface MarchIconArt { name: MarchIcon; src: string; final: boolean }

/** The picture for an icon: its March file if added, else a stand-in, else null (the chart shows no picture). */
export const marchIconArt = (name: MarchIcon): MarchIconArt | null => {
  const own = art[`${ART_DIR}${name}.webp`];
  if (own) return { name, src: own, final: true };
  const r = STAND_INS[name] ? responsibilityById(STAND_INS[name]) : undefined;
  const src = r ? responsibilityImage(r, 256) : null;
  return src ? { name, src, final: false } : null;
};

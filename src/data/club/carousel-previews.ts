/**
 * The /club monthly carousel: one close-up of each month's real printable, filled in for one sample household.
 *
 * Images are captures of the member printables themselves (scripts/render-club-carousel-previews.mjs: each month's
 * own page with ?sample=rivera, print media, 2x), so names, ages and assignments come from the app, never from here.
 * Regenerate them whenever a month's printable or the Rivera sample changes.
 *
 * Each month frames the part of its sheet that shows the family. A crop is a region of the captured sheet, as
 * fractions of its width and height: `x0`-`x1` is always shown in full (so names and assignments inside it are never
 * cut), `y0` is the top of the window; the frame's shape decides how far down it reaches. Desktop shows nearly the
 * whole width at about print size; phones show one block (a child's card, the dinner team) and get their own crop.
 */
import { sampleHouseholds } from './samples';

export interface PreviewCrop { x0: number; x1: number; y0: number }
export interface CarouselPreview {
  month: string;
  /** Captured sheet, in public/. */
  image: string;
  width: number;
  height: number;
  /** What the close-up shows, for the alt text. */
  shows: string;
  desktop: PreviewCrop;
  mobile: PreviewCrop;
  /** Where personalization is thin, said plainly (shown nowhere; for the team). */
  limitation?: string;
}

export const CAROUSEL_SAMPLE_ID = 'rivera';

const img = (month: string) => `/images/club/carousel/${CAROUSEL_SAMPLE_ID}-${month.toLowerCase()}.webp`;
const portrait = { width: 1632, height: 2112 };

export const carouselPreviews: CarouselPreview[] = [
  { month: 'January', image: img('January'), ...portrait, shows: 'the Rivera family’s Family Focus, with habits written for Sofia and Mateo',
    desktop: { x0: 0.04, x1: 0.96, y0: 0.02 }, mobile: { x0: 0.03, x1: 0.5, y0: 0.3 } },
  { month: 'February', image: img('February'), ...portrait, shows: 'the Rivera family’s laundry guide for Mateo and Elena',
    desktop: { x0: 0.04, x1: 0.96, y0: 0.03 }, mobile: { x0: 0.04, x1: 0.52, y0: 0.06 } },
  { month: 'March', image: img('March'), width: 2112, height: 1632, shows: 'Sofia’s weekly chore chart',
    desktop: { x0: 0.03, x1: 0.97, y0: 0 }, mobile: { x0: 0.03, x1: 0.7, y0: 0 } },
  { month: 'April', image: img('April'), ...portrait, shows: 'the Rivera family’s dinner team: Dad, Sofia, Mateo and Mom',
    desktop: { x0: 0.04, x1: 0.96, y0: 0 }, mobile: { x0: 0.04, x1: 0.5, y0: 0.17 } },
  { month: 'May', image: img('May'), ...portrait, shows: 'the Rivera family’s summer rhythm',
    desktop: { x0: 0.04, x1: 0.96, y0: 0 }, mobile: { x0: 0.04, x1: 0.6, y0: 0.02 },
    limitation: 'Family name only: the rhythm is one shared day, with no child named on the sheet.' },
  { month: 'June', image: img('June'), ...portrait, shows: 'the Rivera family’s snack station, with rules for Elena and for Sofia and Mateo',
    desktop: { x0: 0.04, x1: 0.96, y0: 0 }, mobile: { x0: 0.04, x1: 0.72, y0: 0.2 } },
  { month: 'July', image: img('July'), ...portrait, shows: 'Sofia’s activity ideas',
    desktop: { x0: 0.04, x1: 0.96, y0: 0 }, mobile: { x0: 0.1, x1: 0.9, y0: 0 },
    limitation: 'One child per sheet, named only in the small subtitle (“Sofia’s activity ideas”).' },
  { month: 'August', image: img('August'), ...portrait, shows: 'Sofia’s morning and after-school routine',
    desktop: { x0: 0.04, x1: 0.96, y0: 0 }, mobile: { x0: 0.04, x1: 0.72, y0: 0 },
    limitation: 'One child per sheet, named only in the small subtitle (“Sofia’s morning & after-school routines”).' },
  { month: 'September', image: img('September'), ...portrait, shows: 'habit cards for Sofia’s morning and Mateo’s backpack',
    desktop: { x0: 0, x1: 1, y0: 0.06 }, mobile: { x0: 0, x1: 0.5, y0: 0.16 } },
  { month: 'October', image: img('October'), ...portrait, shows: 'the Rivera family’s daily reset, with Sofia responsible for toys',
    desktop: { x0: 0.04, x1: 0.96, y0: 0.17 }, mobile: { x0: 0.24, x1: 0.76, y0: 0.38 },
    limitation: 'One name, small (“Person responsible: Sofia”); the second job is for “Everyone”.' },
  { month: 'November', image: img('November'), width: 1634, height: 2114, shows: 'the Rivera family’s evening reset, with jobs for Dad, Sofia and Mateo',
    desktop: { x0: 0.04, x1: 0.96, y0: 0.08 }, mobile: { x0: 0.04, x1: 0.82, y0: 0.1 } },
  { month: 'December', image: img('December'), ...portrait, shows: 'a Christmas mission for Sofia, Mateo and Elena',
    desktop: { x0: 0.04, x1: 0.96, y0: 0.03 }, mobile: { x0: 0.05, x1: 0.88, y0: 0.06 } },
];

/** "Sofia, 10 · Mateo, 7 · Elena, 4": the sample's children, ages as of the program's first month. */
export function carouselSampleChildren(at = new Date(2027, 0, 1)) {
  const sample = sampleHouseholds.find((s) => s.id === CAROUSEL_SAMPLE_ID);
  if (!sample) throw new Error(`Sample household ${CAROUSEL_SAMPLE_ID} missing`);
  return {
    family: sample.household.displayName ?? 'The Rivera Family',
    children: sample.household.members
      .filter((m) => m.kind === 'child' && m.birthYear)
      .map((m) => {
        const months = (at.getFullYear() - m.birthYear!) * 12 + (at.getMonth() + 1 - (m.birthMonth ?? 1));
        return { name: m.firstName, age: Math.floor(months / 12) };
      }),
  };
}

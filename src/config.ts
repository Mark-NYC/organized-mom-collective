/**
 * App-wide settings you're likely to change.
 */

/** A printed edition. Dates are optional until confirmed against the print files. */
export interface Edition {
  label: string;
  start?: string;
  end?: string;
}

/**
 * The two calendars offered on Reorder (/app/reorder). All purchases happen on Etsy.
 *
 * ⚠️ UPDATE `etsyUrl` with each live Etsy listing, e.g. 'https://www.etsy.com/listing/1234567890/…'.
 * Until it's a real listing URL (null or a placeholder), that option's button stays
 * disabled and shows "Coming soon to Etsy". Prices are in whole US dollars.
 *
 * `editions`: what each printed edition covers. Exact dates are shown on the page only
 * when both `start` and `end` are set (Monday and Sunday, YYYY-MM-DD, inclusive), and
 * tests/reorder.test.ts then checks each span is exactly `weeks` long.
 *
 * ⚠️ DATES NOT CONFIRMED. Verified from the Etsy listing images (design/etsy-listing/):
 * the 2027 calendar's first page is the week of Mon Dec 28 2026. Not verifiable here
 * (no print files in this repo): the last page of each edition. Note: Dec 28 2026 through
 * Sun Jan 2 2028 is 53 weeks, which doesn't match 52 weeks / two 26-week sets. Confirm the
 * first and last page of each printed edition, then fill in start/end below.
 */
export const CALENDAR_OPTIONS = [
  {
    id: 'half-year',
    name: 'Half-Year Calendar',
    price: 34,
    weeks: 26,
    editions: [{ label: 'January–June 2027' }, { label: 'July–December 2027' }] as Edition[],
    etsyUrl: null as string | null, // PLACEHOLDER: half-year Etsy listing URL
  },
  {
    id: 'full-year',
    name: 'Full-Year Calendar',
    price: 54,
    weeks: 52,
    editions: [{ label: 'All of 2027' }] as Edition[],
    etsyUrl: null as string | null, // PLACEHOLDER: full-year Etsy listing URL
  },
] as const;

/** Which option carries the "Best value" tag. */
export const BEST_VALUE_ID = 'full-year';

export const SITE_NAME = 'Organized Mom';
export const BRAND_NAME = 'Organized Mom Collective';

/**
 * Where the printed QR code (/start) sends people.
 * The QR itself always encodes https://organizedmomcollective.com/start — never
 * change that. Change THIS to move calendar owners somewhere else later.
 * `source=calendar` marks the visit as coming from the physical calendar.
 */
export const START_DESTINATION = '/app?source=calendar';

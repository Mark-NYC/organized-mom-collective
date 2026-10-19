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
 * The two calendars, on /calendar, the homepage and Reorder (/app/reorder). An option with a
 * `websiteProduct` is bought through the website checkout in shop-enabled builds; otherwise on Etsy.
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
    etsyUrl: 'https://www.etsy.com/listing/4591398377/2027-family-wall-calendar-organizer' as string | null, // live listing; 26-week is a variation
    // Sold through the website checkout (shop product slug) in shop-enabled builds; that product's edition.
    websiteProduct: 'calendar-26-week' as string | null,
    websiteEdition: 'January–June 2027' as string | null,
  },
  {
    id: 'full-year',
    name: 'Full-Year Calendar',
    price: 54,
    weeks: 52,
    editions: [{ label: 'All of 2027' }] as Edition[],
    etsyUrl: 'https://www.etsy.com/listing/4591398377/2027-family-wall-calendar-organizer' as string | null, // live listing; 52-week is a variation
    // Not on the website yet (calendar-52-week is off, 0 stock): set both once it has real stock.
    websiteProduct: null as string | null,
    websiteEdition: null as string | null,
  },
] as const;

/** Which option carries the "Best value" tag. */
export const BEST_VALUE_ID = 'full-year';

/** The main offer on the homepage for the first 2027 print run: the 26-week calendar. */
export const PRIMARY_OPTION_ID = 'half-year';

export const SITE_NAME = 'Organized Mom';
export const BRAND_NAME = 'Organized Mom Collective';

/**
 * The plain "what is it, who's it for, what does it do" sentence. Used in the site footer,
 * the homepage and Organization structured data so people and AI answer engines don't have
 * to infer it from the tagline. Keep it true to what ships today (see docs/brand/VISION.md).
 */
export const BRAND_DEFINITION = `${BRAND_NAME} makes a printed 11 × 17-inch weekly family wall calendar for busy families with school-age kids, with a cleaning companion website for daily routines included.`;

/**
 * When the site's prices (CALENDAR_OPTIONS and the shop products) were last checked. Shown as "Prices as of …" wherever
 * prices appear. ⚠️ Update it whenever prices change or are re-confirmed.
 */
export const PRICES_AS_OF = 'October 2026';

/**
 * Where the printed QR code (/start) sends people.
 * The QR itself always encodes https://organizedmomcollective.com/start — never
 * change that. Change THIS to move calendar owners somewhere else later.
 * `source=calendar` marks the visit as coming from the physical calendar.
 */
export const START_DESTINATION = '/app?source=calendar';

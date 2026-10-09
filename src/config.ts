/**
 * App-wide settings you're likely to change.
 */

/**
 * The two calendars offered on Reorder (/app/reorder). All purchases happen on Etsy.
 *
 * ⚠️ UPDATE `etsyUrl` with each live Etsy listing, e.g. 'https://www.etsy.com/listing/1234567890/…'.
 * Until it's a real listing URL (null or a placeholder), that option's button stays
 * disabled and shows "Coming soon to Etsy". Prices are in whole US dollars.
 */
export const CALENDAR_OPTIONS = [
  {
    id: 'half-year',
    name: 'Half-Year Calendar',
    price: 34,
    weeks: 26,
    etsyUrl: null as string | null, // PLACEHOLDER: half-year Etsy listing URL
  },
  {
    id: 'full-year',
    name: 'Full-Year Calendar',
    price: 54,
    weeks: 52,
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

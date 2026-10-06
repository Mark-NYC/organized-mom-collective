/**
 * App-wide settings you're likely to change.
 */

/**
 * ⚠️ UPDATE THIS: where "Order My Next Calendar" sends people.
 * Placeholder until the real shop / product URL is ready.
 */
export const REORDER_URL = 'https://organizedmomcollective.com/shop';

export const SITE_NAME = 'Organized Mom';
export const BRAND_NAME = 'Organized Mom Collective';

/**
 * Where the printed QR code (/start) sends people.
 * The QR itself always encodes https://organizedmomcollective.com/start — never
 * change that. Change THIS to move calendar owners somewhere else later.
 * `source=calendar` marks the visit as coming from the physical calendar.
 */
export const START_DESTINATION = '/app?source=calendar';

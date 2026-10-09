/**
 * Etsy social proof for the public pages (/ and /calendar).
 *
 * Every figure and quote here is verified, historical feedback on EARLIER editions of
 * the family calendar, sold through the Etsy shop before the 2027 redesign. None of it
 * is a review of the 2027 calendar or the cleaning companion website, and the pages must
 * say so wherever it appears. Don't add a quote, round a number up or put these into
 * Product structured data (aggregateRating/review): they don't describe the 2027 product.
 */

export const ETSY_SHOP_URL = 'https://www.etsy.com/shop/OrgMomCollective';
/** The older family calendar listing the quotes come from. */
export const ETSY_REVIEWS_URL = 'https://www.etsy.com/listing/1075914661/family-organizer-and-wall-calendar-meal';

/** The whole Etsy shop, all items. */
export const shopStats = { rating: '4.9', reviews: 112, sales: '1,000+' };
/** The older family calendar listing on its own. */
export const listingStats = { rating: '4.6', reviews: 13 };

export interface Review {
  id: string;
  quote: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  /** The quote is part of a longer review. */
  excerpt?: boolean;
}

export const reviews: Review[] = [
  { id: 'quality', quote: 'Great calendar! I love the size of it. Quality printing and paper.', name: 'Chelsea H.', date: '2022-04-15' },
  { id: 'as-described', quote: 'Exactly as described - fast shipping - we love our calendar!', name: 'Etsy buyer', date: '2022-12-28' },
  { id: 'service', quote: 'Great customer service with quick replies!', name: 'Toni Clements', date: '2022-06-06', excerpt: true },
];

export const review = (id: string) => reviews.find((r) => r.id === id)!;

/** "April 15, 2022" */
export const reviewDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

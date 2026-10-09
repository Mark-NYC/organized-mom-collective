import { describe, expect, it } from 'vitest';
import { BEST_VALUE_ID, CALENDAR_OPTIONS } from '../src/config';
import { etsyListingUrl, formatPrice, savingsVersus } from '../src/lib/reorder';

describe('reorder', () => {
  it('accepts only real Etsy listing URLs', () => {
    expect(etsyListingUrl('https://www.etsy.com/listing/1234567890/family-wall-calendar')).toBe(
      'https://www.etsy.com/listing/1234567890/family-wall-calendar',
    );
    expect(etsyListingUrl('https://etsy.com/listing/42')).toBe('https://etsy.com/listing/42');
    for (const bad of [null, undefined, '', 'TODO', 'https://www.etsy.com/shop/OrganizedMom', 'http://www.etsy.com/listing/1', 'https://etsy.com.evil.com/listing/1', 'https://example.com/listing/1']) {
      expect(etsyListingUrl(bad)).toBeNull();
    }
  });

  it('formats prices and savings', () => {
    expect(formatPrice(34)).toBe('$34');
    expect(formatPrice(34.5)).toBe('$34.50');
    expect(savingsVersus({ price: 54, weeks: 52 }, { price: 34, weeks: 26 })).toBe(14);
    expect(savingsVersus({ price: 70, weeks: 52 }, { price: 34, weeks: 26 })).toBe(0);
  });

  it('offers half-year and full-year, with full-year as best value', () => {
    expect(CALENDAR_OPTIONS.map((o) => [o.id, o.price, o.weeks])).toEqual([
      ['half-year', 34, 26],
      ['full-year', 54, 52],
    ]);
    expect(CALENDAR_OPTIONS.some((o) => o.id === BEST_VALUE_ID)).toBe(true);
  });
});

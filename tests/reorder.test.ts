import { describe, expect, it } from 'vitest';
import { BEST_VALUE_ID, CALENDAR_OPTIONS } from '../src/config';
import { daysCovered, etsyListingUrl, formatPrice, formatSpan, savingsVersus } from '../src/lib/reorder';

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

  it('each edition runs Monday to Sunday for exactly its number of weeks', () => {
    for (const o of CALENDAR_OPTIONS) {
      for (const e of o.editions) {
        if (!e.start || !e.end) continue; // dates not confirmed yet; nothing shown on the page
        expect(new Date(e.start + 'T12:00:00Z').getUTCDay()).toBe(1);
        expect(new Date(e.end + 'T12:00:00Z').getUTCDay()).toBe(0);
        expect(daysCovered(e.start, e.end)).toBe(o.weeks * 7);
      }
    }
  });

  it('formats date spans', () => {
    expect(formatSpan('2026-12-28', '2027-06-27')).toBe('Dec 28, 2026 – Jun 27, 2027');
    expect(formatSpan('2027-06-28', '2027-12-26')).toBe('Jun 28 – Dec 26, 2027');
  });
});

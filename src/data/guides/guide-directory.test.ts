import { describe, expect, it } from 'vitest';
import { guides, guideUrl } from './guide-directory';

describe('Practical Guide library', () => {
  const categories = ['room-resets', 'family-systems', 'meals'];

  it('has a unique navigable URL for every registered guide', () => {
    const urls = guides.map(guideUrl);
    expect(new Set(urls).size).toBe(guides.length);
    expect(urls.every(url => url.startsWith('/guides/') && url.endsWith('/'))).toBe(true);
  });

  it('can filter every guide by one of the visible topics', () => {
    expect(guides.length).toBeGreaterThan(0);
    expect(guides.every(guide => categories.includes(guide.browseCategory))).toBe(true);
    for (const category of categories) {
      expect(guides.filter(guide => guide.browseCategory === category).length).toBeGreaterThan(0);
    }
  });

  it('keeps its real preview and PDF metadata for the mobile cards', () => {
    for (const guide of guides) {
      expect(guide.title.length).toBeGreaterThan(3);
      expect(guide.teaser.length).toBeGreaterThan(3);
      expect(guide.image).toMatch(/^\/images\/guides\/.+\.webp$/);
      expect(guide.pdf).toMatch(/^\/downloads\/.+\.pdf$/);
      expect(guide.pages).toBeGreaterThan(0);
    }
  });
});

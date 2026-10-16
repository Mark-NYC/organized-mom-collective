import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { choreSets } from '../src/data/chore-chart';
import { routineTypes } from '../src/data/routines';
import { matchResponsibility, responsibilities, responsibilityCategories, responsibilityImage } from '../src/data/responsibilities';
import { responsibilityCards } from '../src/data/responsibility-cards';

describe('responsibility library', () => {
  it('has the 17 jobs, unique ids, in the three categories with their colors', () => {
    expect(responsibilities).toHaveLength(17);
    expect(new Set(responsibilities.map((r) => r.id)).size).toBe(17);
    expect(responsibilities.filter((r) => r.category === 'myself')).toHaveLength(7);
    expect(responsibilities.filter((r) => r.category === 'room')).toHaveLength(5);
    expect(responsibilities.filter((r) => r.category === 'home')).toHaveLength(5);
    expect(Object.fromEntries(Object.entries(responsibilityCategories).map(([id, c]) => [id, c.color]))).toEqual({
      myself: '#D4DFC4',
      room: '#CDDDE1',
      home: '#F1D8A8',
    });
  });

  it('only marks a job illustrated when both web sizes and the kept original exist', () => {
    const originals = readdirSync('design/responsibilities').map((f) => f.replace(/\.\w+$/, ''));
    for (const r of responsibilities) {
      const files = ([128, 256] as const).map((s) => `public${responsibilityImage({ ...r, image: true }, s)}`);
      expect(files.every(existsSync), r.id).toBe(r.image);
      if (r.image) expect(originals, r.id).toContain(r.id);
    }
  });

  it('never carries the physical cards’ how-to steps', () => {
    for (const r of responsibilities) expect(Object.keys(r).sort()).toEqual(expect.arrayContaining(['id', 'title']));
    for (const r of responsibilities) for (const key of Object.keys(r)) expect(['id', 'title', 'category', 'image', 'routines', 'minAge', 'aliases']).toContain(key);
  });

  it('matches chart wording to library jobs', () => {
    expect(matchResponsibility('Brush teeth')).toBe('brush-my-teeth');
    expect(matchResponsibility('Make bed (with help)')).toBe('make-my-bed');
    expect(matchResponsibility('  take out THE trash ')).toBe('take-out-the-trash');
    expect(matchResponsibility('Feed pets')).toBeUndefined();
    // Starter content that should pick up art.
    expect(routineTypes.morning.steps.map(([, step]) => matchResponsibility(step))).toContain('make-my-bed');
    expect(choreSets['6-7'].daily.map(matchResponsibility)).toContain('pack-my-backpack');
  });

  it('has no invented purchase link for the cards', () => {
    expect(responsibilityCards.pageUrl).toBeNull();
  });
});

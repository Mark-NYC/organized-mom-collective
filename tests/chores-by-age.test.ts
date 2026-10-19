import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ageBands, printables } from '../src/data/chores-by-age';
import { responsibilityById } from '../src/data/responsibilities';
import { gatedTools } from '../src/lib/tool-email';

describe('chores by age (IF-03)', () => {
  it('covers ages 2–12 in four bands with 8–12 jobs each, split between on their own and with help', () => {
    expect(ageBands.map((b) => b.id)).toEqual(['2-3', '4-5', '6-8', '9-12']);
    for (const b of ageBands) {
      expect(b.own.length + b.help.length).toBeGreaterThanOrEqual(8);
      expect(b.own.length + b.help.length).toBeLessThanOrEqual(12);
      expect(b.own.length).toBeGreaterThan(0);
      expect(b.help.length).toBeGreaterThan(0);
      expect(new Set([...b.own, ...b.help]).size).toBe(b.own.length + b.help.length);
    }
  });

  it('gives the infographic 3–5 short examples per band and only real illustrations', () => {
    for (const b of ageBands) {
      expect(b.highlights.length).toBeGreaterThanOrEqual(3);
      expect(b.highlights.length).toBeLessThanOrEqual(5);
      for (const h of b.highlights) expect(h.text.length).toBeLessThanOrEqual(26);
      expect(responsibilityById(b.illustration)?.image).toBe(true);
    }
  });

  it('ships every printable it links to', () => {
    for (const p of Object.values(printables)) expect(existsSync(join('public', p.href))).toBe(true);
  });

  it('stores the free chart under its own tool id in the shared download signup', () => {
    expect(printables.starterChart.toolId).toBe('responsibility-chart');
    expect(Object.keys(gatedTools)).toEqual(['chore-chart', 'responsibility-chart']);
  });
});

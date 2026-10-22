import { describe, expect, it } from 'vitest';
import { chartLayout } from '../src/lib/club/print';

describe('club print: the chart layout guess (fitChart measures and settles it in the browser)', () => {
  it('puts up to five people side by side', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(chartLayout(Array(n).fill(6)).columns).toBe(n);
    expect(chartLayout(Array(5).fill(6)).cardRows).toBe(1);
  });

  it('flows bigger families into rows of up to four', () => {
    expect(chartLayout(Array(6).fill(6))).toMatchObject({ columns: 3, cardRows: 2 });
    expect(chartLayout(Array(8).fill(6))).toMatchObject({ columns: 4, cardRows: 2 });
    expect(chartLayout(Array(9).fill(4))).toMatchObject({ columns: 3, cardRows: 3 });
  });

  it('steps down in density as charts get longer, and only then onto a second page', () => {
    expect(chartLayout([4, 4, 4]).density).toBe('roomy');
    expect(chartLayout([14, 4, 4]).density).not.toBe('roomy');
    const huge = chartLayout(Array(8).fill(20));
    expect(huge.density).toBe('tight');
    expect(huge.pages).toBeGreaterThan(1);
    expect(chartLayout([]).columns).toBe(1);
  });
});

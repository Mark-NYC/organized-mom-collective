import { describe, expect, it } from 'vitest';
import { countdownCopy } from '../src/lib/countdown';

const at = (m: number, d: number, y = 2026) => countdownCopy(new Date(y, m - 1, d, 9));

describe('countdown bar copy', () => {
  it('announces the Christmas order date while the cutoff is more than three weeks out', () => {
    expect(at(10, 23)).toEqual({ text: 'The 2027 calendar is here · Order by Dec\u00a017 for Christmas' });
    expect(at(11, 26)?.count).toBeUndefined();
  });

  it('counts down to the Dec 17 order cutoff in the last three weeks', () => {
    expect(at(11, 27)).toEqual({ count: '21', text: 'days left to order for Christmas' });
    expect(at(12, 17)).toEqual({ count: '1', text: 'day left to order for Christmas' });
  });

  it('counts down to the new year after the cutoff, then disappears', () => {
    expect(at(12, 18)).toEqual({ count: '14', text: 'days left to get your 2027 calendar' });
    expect(at(12, 31)).toEqual({ count: '1', text: 'day left to get your 2027 calendar' });
    expect(at(1, 1, 2027)).toBeNull();
  });
});

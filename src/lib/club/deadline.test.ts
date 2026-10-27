import { describe, expect, it } from 'vitest';
import { clubEditingDeadline } from './deadline';

describe('Club second Sunday editing cutoff', () => {
  it('ends October 2027 on the second Sunday at 11:59 p.m. Eastern', () => {
    expect(clubEditingDeadline('2027-10')).toBe('2027-10-10T23:59:59-04:00');
  });
  it('uses standard time for winter cutoffs', () => {
    expect(clubEditingDeadline('2027-01')).toBe('2027-01-10T23:59:59-05:00');
  });
  it('uses daylight time after spring transition', () => {
    expect(clubEditingDeadline('2027-03')).toBe('2027-03-14T23:59:59-04:00');
  });
  it('rejects an invalid month', () => {
    expect(() => clubEditingDeadline('2027-13')).toThrow();
  });
});

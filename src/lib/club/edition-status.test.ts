import { describe, expect, it } from 'vitest';
import { clubEditingDeadline } from './deadline';
import { editingWindow } from './edition-status';

const cutoff = clubEditingDeadline('2027-10'); // Sun Oct 10 2027, 11:59:59 PM ET
describe('editingWindow', () => {
  it('shows only the date while there is plenty of time', () => {
    expect(editingWindow(cutoff, new Date('2026-10-27T12:00:00Z'))).toEqual({ phase: 'open', text: 'Changes open until Sun, Oct 10, 2027' });
    expect(editingWindow(cutoff, new Date('2027-10-01T12:00:00Z')).text).toBe('Changes open until Sun, Oct 10');
  });
  it('names the day in the last 72 hours', () => {
    expect(editingWindow(cutoff, new Date('2027-10-08T12:00:00-04:00'))).toEqual({ phase: 'soon', text: 'Changes close Sunday at 11:59 PM ET' });
    expect(editingWindow(cutoff, new Date('2027-10-09T23:00:00-04:00')).phase).toBe('soon');
    expect(editingWindow(cutoff, new Date('2027-10-07T12:00:00-04:00')).phase).toBe('open');
  });
  it('says tonight on the cutoff day in New York', () => {
    expect(editingWindow(cutoff, new Date('2027-10-10T08:00:00-04:00'))).toEqual({ phase: 'today', text: 'Changes close tonight at 11:59 PM ET' });
  });
  it('closes after the cutoff', () => {
    expect(editingWindow(cutoff, new Date('2027-10-11T00:00:30-04:00'))).toEqual({ phase: 'closed', text: 'Changes closed Oct 10' });
  });
});

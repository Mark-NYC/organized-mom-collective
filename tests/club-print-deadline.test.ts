import { describe, expect, it } from 'vitest';
import { nextClubPrintDeadline, clubPrintMessages } from '../src/lib/club-print-deadline';
describe('Club print deadline in Eastern time', () => {
 it('closes after the second Sunday, including the full final minute', () => {
  expect(nextClubPrintDeadline(new Date('2026-11-09T04:59:59Z')).toISOString()).toBe('2026-11-09T05:00:00.000Z');
  expect(nextClubPrintDeadline(new Date('2026-11-09T05:00:00Z')).toISOString()).toBe('2026-12-14T05:00:00.000Z');
 });
 it('handles daylight saving on the second Sunday in March', () => {
  expect(nextClubPrintDeadline(new Date('2027-03-01T12:00:00Z')).toISOString()).toBe('2027-03-15T04:00:00.000Z');
 });
 it('handles a month beginning on Sunday and a year rollover', () => {
  expect(nextClubPrintDeadline(new Date('2026-11-01T12:00:00Z')).toISOString()).toBe('2026-11-09T05:00:00.000Z');
  expect(nextClubPrintDeadline(new Date('2026-12-14T05:00:00Z')).toISOString()).toBe('2027-01-11T05:00:00.000Z');
 });
 it('shows the correct Sunday date and current monthly price', () => {
  const messages = clubPrintMessages(new Date('2026-10-29T20:00:00Z'));
  expect(messages[0]).toContain('Nov 8');
  expect(messages[0]).toContain('11:59 p.m. ET');
  expect(messages[1]).toContain('$5.90/month');
 });
});

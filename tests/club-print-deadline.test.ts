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
 it('counts down to January\u2019s print run before the program starts, never a November or December kit', () => {
  const messages = clubPrintMessages(new Date('2026-10-29T20:00:00Z'));
  // Benefit-led banner since Nov 2026: the month's offer, then the order-by date (the day before the Monday cutoff).
  expect(messages[0]).toContain('January');
  expect(messages[0]).toContain('Order by Dec 13');
  expect(messages[0]).not.toMatch(/November|December/);
  expect(messages[1]).toContain('$5.90/month');
  expect(clubPrintMessages(new Date('2026-12-14T05:00:00Z'))[0]).toContain('Order by Jan 10');
  expect(clubPrintMessages(new Date('2027-03-01T12:00:00Z'))[0]).toContain('Order by Mar 14');
 });
 it('shows Your First Month FREE once enrollment is open', () => {
  expect(clubPrintMessages(new Date('2026-11-02T12:00:00Z'), true)[1]).toBe('Your First Month FREE · Then $5.90/month · Explore the Club →');
 });
});

import { describe, expect, it } from 'vitest';
import { retryLater } from '../src/lib/sync-errors';

describe('offline outboxes: try again later, or refused?', () => {
  it('keeps the change when the server was never reached or is in trouble', () => {
    for (const e of [new TypeError('Failed to fetch'), new Error('Load failed'), new Error('request_failed_0'),
      new Error('request_failed_500'), new Error('request_failed_503'), new Error('request_failed_429'),
      new Error('Could not find the function public.calendar_event_save in the schema cache'),
      new Error('canceling statement due to statement timeout')]) {
      expect(retryLater(e), String(e.message)).toBe(true);
    }
  });
  it('keeps the change when her sign-in expired or she has no household right now', () => {
    for (const m of ['signed_out', 'not_signed_in', 'no_household', 'request_failed_401']) expect(retryLater(new Error(m)), m).toBe(true);
  });
  it('treats the database\'s own answers as answers', () => {
    for (const m of ['conflict', 'removed', 'invalid', 'request_failed_400', 'request_failed_404', 'stale_profile']) expect(retryLater(new Error(m)), m).toBe(false);
  });
});

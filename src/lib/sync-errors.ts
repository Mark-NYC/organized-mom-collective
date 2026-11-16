/**
 * One rule for the offline outboxes (the family calendar, src/lib/calendar/store.ts, and Family Meeting agreements,
 * src/lib/agreements/store.ts): when a queued change fails, is it "try again later" or "the household said no"?
 *
 * Getting this wrong loses data either way. Treat a refusal as "later" and one bad change blocks every change behind
 * it forever. Treat "later" as a refusal and a server hiccup or an expired sign-in throws away what she did offline.
 *
 * Later (keep the change, stop this round): no signal, signed out or the sign-in expired, a rate limit, server trouble,
 * and no household right now. Everything else is the database's own answer about this change.
 */
export function retryLater(e: unknown): boolean {
  if (e instanceof TypeError) return true; // fetch never reached the server
  const m = String((e as { message?: unknown } | null)?.message ?? '');
  if (/failed to fetch|network|load failed|timed? ?out/i.test(m)) return true;
  if (/^(signed_out|not_signed_in|no_household)$/.test(m)) return true;
  // src/lib/account.ts reports a response without a database message as request_failed_<status>.
  const status = /^request_failed_(\d+)$/.exec(m)?.[1];
  if (status) return ['0', '401', '403', '408', '425', '429'].includes(status) || status.startsWith('5');
  // PostgREST's own trouble (connection pool, schema cache, statement timeout), not an answer about this change.
  return /JWT|schema cache|statement timeout|too many connections|connection/i.test(m);
}

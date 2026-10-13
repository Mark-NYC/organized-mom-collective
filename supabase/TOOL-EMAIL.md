# Printable download email collection

Implemented for `/chore-chart`, disabled until database setup is complete. Shared `src/lib/tool-email.ts` popup is called before export through `src/lib/printable.ts`. Other tools stay unchanged for this initial test.

## Activate
1. In Supabase → SQL Editor, run `supabase/migrations/20261013010000_tool_email_signup.sql`. This depends on the existing customer-survey migration (admin permissions and salted-IP throttling).
2. Test a signup against the live project and confirm a row exists in Table Editor → `tool_email_contacts`. Confirm an anonymous table read is denied.
3. In Vercel → project Settings → Environment Variables, add `PUBLIC_TOOL_EMAIL_GATE_ENABLED=true`, then redeploy. Existing `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are reused. Never put a service-role key in public build variables.
4. Test: click Download → popup; cancel leaves chart editable; submit email → stored row → immediate PNG. Reload/revisit skips signup in that browser. Test a backend failure: show retry message, never mark access granted. Check on a phone and confirm all selected colors appear in the PNG.

## What is collected
Email, first/last tool, timestamps and optional marketing consent. No child name, age or chart content sent. No email stored in localStorage: only a browser access flag. This is a convenience gate, not secure entitlement or verified identity; email ownership is not verified. Marketing checkbox is optional and initially unchecked. Only rows with marketing_opt_in=true may be imported into an email marketing list. Unchecking on a later download is not an unsubscribe request; offer unsubscribe through the sending provider when campaigns are set up. No marketing or delivery email is sent by this implementation. Download happens in the browser.

## View/export
Supabase Table Editor → `tool_email_contacts`. For marketing export, filter `marketing_opt_in` to true, then export CSV. Existing survey admins can read through authenticated REST; anonymous users can only call the validated signup function. Direct inserts, updates and email-list reads are denied. Signup is case-insensitively deduplicated and throttled to 10/hour per salted IP hash, with a honeypot and concurrency lock.

## Rollback
Set PUBLIC_TOOL_EMAIL_GATE_ENABLED=false and redeploy. Existing contacts remain stored. Do not delete the table to turn off the popup.

## Status
Frontend and migration code are implemented and tested locally. Migration must be applied in the live Supabase project before activation. Email provider connection and sending campaigns are separate work.

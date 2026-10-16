# Support requests (/support form)

The `/support` contact form posts to the `support-request` Edge Function. Policy and the owner's
day-to-day workflow: [docs/operations/CUSTOMER_SUPPORT.md](../docs/operations/CUSTOMER_SUPPORT.md).

## What happens on submit

1. The browser validates (`src/data/support.ts`), resizes an optional photo to a JPEG of at most 1600 px / 1.5 MB (which also strips its location data) and posts JSON to `/functions/v1/support-request`.
2. The function (`supabase/functions/_shared/handlers/support.ts`) validates again, checks the photo is a real JPEG, and calls `support_submit`, which validates a third time, applies the limits below and saves the request with a reference like `OMC-7K3QX9`.
3. Two emails through Resend:
   - **To the support inbox** (`SUPPORT_INBOX`), subject `[OMC-…] Topic: Name`, reply-to the customer, photo attached. The photo is never stored anywhere else.
   - **To the customer**: "We received your message | Organized Mom Collective", with the reference, reply-to the support inbox. It never repeats her message (so the form can't be used to send someone else's words to a stranger).
4. Each outcome is recorded on the row (`notify_status`, `ack_status`). A saved request counts as success even if an email fails; the owner sees it in `support_open`.

## Database (migration `20261019000000_support_requests.sql`, applied 2026-10-16)

| Object | What |
| --- | --- |
| `support_requests` | One row per request: reference, created_at, status (`open` / `waiting` / `resolved`), topic, name, email, order_number, message, has_photo, notify_status, ack_status, notes, resolved_at (set automatically when status becomes `resolved`). |
| `support_open` | View: unresolved requests, oldest first, message trimmed to 200 characters. |
| `support_submit(...)` | Service role only. Validates, throttles, saves. |
| `support_email_result(...)` | Service role only. Records email outcomes. |

**Access:** RLS on with no policies, and every privilege revoked from `anon` and `authenticated`: nothing is readable or writable through the public API. Only the Edge Function (service role) and the dashboard can see requests. Support contacts are separate from `tool_email_contacts` and never feed a marketing list.

**Spam and abuse:** hidden honeypot field; 5 requests per connection per hour (salted, daily-rotating IP hash, shared `survey_throttle` ledger); 5 requests per email address per 24 hours; at most 3 acknowledgment emails per address per 24 hours (`ack_status = limited` after that); size limits on every field; photos JPEG only, 1.5 MB max.

## Edge Function `support-request`

Deployed 2026-10-16 (Verify JWT **off**: guests call it; it checks its own callers as above). Source: `supabase/functions/support-request/index.ts` → `_shared/handlers/support.ts`. After editing: `npm run build:functions`, then paste `supabase/dashboard/support-request.ts` into the dashboard (or deploy the folder with the CLI).

| Secret | Default | Purpose |
| --- | --- | --- |
| `SUPPORT_INBOX` | `SHOP_EMAIL_REPLY_TO`, else `contact@organizedmomcollective.com` | Where requests go. **Set it explicitly** to the inbox you read. |
| `SUPPORT_EMAIL_FROM` | `STARTER_KIT_EMAIL_FROM`, else `Organized Mom Collective <hello@organizedmomcollective.com>` | Sender (verified in Resend 2026-10-16). Falls back once to `SHOP_EMAIL_FROM` if Resend refuses it. |
| `RESEND_API_KEY`, `SHOP_SITE_URL`, `SHOP_ALLOWED_ORIGINS` | shared with the shop | Sending, links, allowed browser origins (the site and its www twin are always allowed). |

Without `RESEND_API_KEY` requests are still saved (`notify_status = skipped`).

The site needs `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` at build time (already set on Vercel). Without them `/support` shows the email address instead of the form.

## Returns and the return address

There's no automation for returns. The owner approves each return by hand and sends the return address personally (private email or Etsy Messages); the address is never stored in the database, the code or this repository. Process: [docs/operations/CUSTOMER_SUPPORT.md](../docs/operations/CUSTOMER_SUPPORT.md) → The return address.

Migration `20261019010000_support_returns.sql` (applied 2026-10-16) adds `return_status` (`requested` / `approved` / `received` / `refunded` / `declined`) so the owner can track returns in the Table Editor; `support_open` shows it. Its `return_instructions_*` columns and `support_return_*` functions belong to an automated approval email that was decided against: unused.

A `support-return` Edge Function from that abandoned approach was deployed on 2026-10-16. It has no secret, so it refuses every call (503). Delete it in Supabase → Edge Functions → `support-return` → Delete; don't set `RETURN_ADDRESS` or create a webhook for it.

## Testing

- `npm test` → `tests/support.test.ts`: validation, photo checks, both emails, the handler's success, failure, rate-limit and fallback paths, the browser client, and that the migration matches the form's topics and limits.
- The SQL was tested on a local Postgres 16 with `supabase/tests/supabase-stub.sql`: validation, honeypot, both rate limits, the acknowledgment cap, the resolve stamp, and `anon` / `authenticated` denied on the table, the view and the function.
- Live test on 2026-10-16 (from the database with the `http` extension): bad email, bad photo, non-JSON and GET were refused; a full request with a photo returned `OMC-SGAM48`, with `notify_status = sent` and `ack_status = sent` (customer side sent to Resend's `delivered@resend.dev` test address).
- **Clean-up:** that test row (`OMC-SGAM48`, email `delivered@resend.dev`, order `TEST-0001`) is still in `support_requests`; the SQL tool used for launch couldn't run writes. Delete it in Table Editor:
  `delete from public.support_requests where reference = 'OMC-SGAM48';`
- To test again without a real inbox: submit as `delivered@resend.dev`, then delete the row.

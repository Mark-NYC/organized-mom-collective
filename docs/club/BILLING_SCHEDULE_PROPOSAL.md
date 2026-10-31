# Billing schedule: how it works today, and a proposal (for the owner's review)

**Nothing here is implemented.** Billing dates, Stripe settings and prices are unchanged ($5.90/month). This page shows
exactly what members joining on the 1st, 15th and 30th get today, and the decision needed to put everyone on one
monthly mailing schedule after the Welcome Kit. Dates come from the database rules (`club_checkout_state`,
`club_intro_grant`, `club_invoice_apply`, `club_cutoff_at`), checked on a local copy.

## The rules today

- **Free month = the month she joins** (2027 onward). Checkout saves her card; the Stripe trial ends **one month after
  she joins**; that first $5.90 buys **the next month**. Each renewal after that buys the following month, on her own
  monthly date. Before January 2027 (founding), the free month is **January 2027** and every founding trial ends
  **February 1, 2027**.
- **Welcome Kit** (print + Family Meeting guide + her first month): its own track, no cutoff. It's submitted when she
  approves her print and confirms her first month; target **mail within two business days** (`kit_ship_by`).
- **Monthly mailings:** month M's regular list closes on the **second Sunday of the month before** (April's: Sunday
  March 14, 2027). A copy paid after that goes in M's **catch-up batch**. A monthly renewal is always paid during its
  own month, so **every monthly member's copy after the kit is catch-up**; the regular batch only ever holds
  prepaid months (annual) and the one-time November 2026 launch exception.
- **No duplicates:** one live subscription per member (a second Checkout is cancelled and refunded), one welcome print
  per household, one entitlement and one mailing per month (database constraints), and the kit's first-month order
  is left out of that month's monthly list.

## Joining on the 1st, 15th and 30th (2027, free month available)

| | Joins Mon Mar 1, 2027 | Joins Mon Mar 15, 2027 | Joins Tue Mar 30, 2027 |
| --- | --- | --- | --- |
| Charged at checkout | $0 (card saved) | $0 | $0 |
| Earned now | March (free): digital + its printed copy | March (free) | March (free), even this late |
| Welcome Kit | Print + guide + March; if she approves the same day, mail by **Wed Mar 3** | mail by **Wed Mar 17** | mail by **Thu Apr 1** |
| First $5.90 | **Thu Apr 1** → April | **Thu Apr 15** → April | **Fri Apr 30** → April |
| April's printed copy | catch-up (April's list closed Mar 14) | catch-up | catch-up, prepared after Apr 30 |
| Next $5.90 | Sat May 1 → May (catch-up; list closed Apr 11) | Sat May 15 → May (catch-up) | Sun May 30 → May (catch-up) |
| Then | the 1st of each month | the 15th | the 30th (28th/29th/30th in short months) |

So after the kit, all three are in the catch-up batch every month, but **their copies can only be prepared once each
payment lands**: the 1st-joiner's April copy on April 1, the 30th-joiner's on April 30. That's three different
effective mailing dates, not one schedule.

**No free month (same household again), 2027:** charged $5.90 at checkout (disclosed on the join page and in Stripe
Checkout); that payment buys the current month, so she gets the normal Welcome Kit right away; renewals on her
checkout date, as above.

## Founding members (joining before January 1, 2027)

| | Joins Sun Nov 1, 2026 | Joins Sun Nov 15, 2026 | Joins Mon Nov 30, 2026 |
| --- | --- | --- | --- |
| Charged at checkout | $0 | $0 | $0 |
| Earned now | January 2027 (free) | January 2027 (free) | January 2027 (free) |
| Welcome Kit | Print + guide + January; approved the same day → mail by **Tue Nov 3** | **Tue Nov 17** | **Wed Dec 2** |
| First $5.90 | **Mon Feb 1, 2027** → February | Feb 1 → February | Feb 1 → February |
| Then | the 1st of each month: all founding members renew the same day; copies catch-up (February's list closed Jan 10) | same | same |

**No free month (same household again), founding:** today the trial moves to **January 1, 2027**: charged $5.90
then, which buys January, and her Welcome Kit opens that day. Not yet "charged now, kit now" (decision 4): see B below.

## Proposal (needs your billing decision)

**A. One mailing date for everyone: renew on the 1st.** After the free month, every subscription renews on the 1st
(Stripe `trial_end` set to the 1st of next month at checkout; later renewals follow on the 1st). The month's
regular list closes a few days into the month (for example the 3rd business day, after Stripe's first retry), and
one regular batch prints then. Catch-up stays only for failed-then-recovered payments and late joiners' first
paid month.

| | Joins Mar 1 | Joins Mar 15 | Joins Mar 30 |
| --- | --- | --- | --- |
| Free | March (kit now) | March (kit now) | March (kit now) |
| First $5.90 | Thu Apr 1 → April | Thu Apr 1 → April | Thu Apr 1 → April (2 days after joining) |
| April's copy | regular batch (early April) | regular batch | regular batch |
| Then | the 1st | the 1st | the 1st |

What changes: the offer reads "your first month free, then $5.90 on the 1st of each month" instead of "one month
after you join"; a late-month joiner's free period is shorter (the free thing is the current month's resource and kit,
not 30 days); Stripe requires a trial of at least 48 hours, so a join on the last day of a month would move to the 1st
of the month after next (decide: give two free months, or charge the 1st and still send the kit). Stripe sets this
with `trial_end` only (no proration, no extra charge). Existing subscriptions keep their dates unless you choose to
move them (each would need a one-time trial extension to the next 1st; nobody is charged twice).

**B. Founding household without a free month, charged now.** Keep the trial to February 1, 2027 (the founding
schedule) and add one one-off $5.90 invoice at once, labeled "January 2027 (founding month)", which grants January
and opens her Welcome Kit now. Needs a webhook change so that invoice grants January instead of the month it's paid
in. Alternative: keep today's January 1 charge.

**C. Leave it as is.** Rolling dates, catch-up mailings prepared as payments land; disclose "your monthly copy is
prepared once each payment goes through".

Recommendation: **A** for 2027 (true single schedule, matches "current month free, kit now"), **B** for the founding
window if you want "charged now, kit now" before January. Both need your approval before any code changes, and A needs
updated checkout and offer copy.

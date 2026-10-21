# Customer support and returns

How Organized Mom Collective handles customer questions, returns and refunds. Written for one person
fulfilling the first calendar orders; structured so new products add their own terms later.

- Customer pages: [/support](https://organizedmomcollective.com/support) (help topics, FAQs, contact form) and [/returns](https://organizedmomcollective.com/returns) (policy). `/refunds` redirects permanently (301, `dist/_redirects` from `astro.config.mjs`) to `/returns`.
- Digital downloads keep their existing 30-day money-back guarantee, word for word as before; the calendar terms never apply to them.
- The support form never adds anyone to a marketing list: requests live only in `support_requests`, separate from `tool_email_contacts`, with no consent checkbox.
- Copy, topics, FAQs and policy numbers: `src/data/support.ts`. Change terms there and on this page together, and bump `POLICY.effective`.
- Form backend (database, emails, setup, testing): [supabase/SUPPORT.md](../../supabase/SUPPORT.md).

## Official return policy: physical wall calendars

Approved by the owner, effective **October 16, 2026**. Applies to the printed family wall calendars only.

| Term | Policy |
| --- | --- |
| Return window | 14 calendar days from confirmed delivery. The customer must contact us within that period. |
| Condition | Unused, in original, resalable condition (nothing written in, no missing or torn pages). |
| Proof of purchase | Required (order number or receipt). |
| Return shipping | Customer pays for change-of-mind returns. |
| Original shipping | Nonrefundable for change-of-mind returns. |
| Restocking fee | None. |
| Refund method | Through the platform the order was placed on (Etsy orders in Etsy, website orders in the shop dashboard / Stripe), to the original payment method, subject to that platform. |
| Refund timing | Initiated within 5 business days after the returned calendar is received and inspected. |
| Cancellations | Before shipment, subject to actual fulfillment status. Once shipped, it becomes a return. |
| Exchanges | No direct exchanges for change-of-mind returns: return the unused calendar and reorder. |
| Damaged, defective or incorrect | Free replacement or refund at no additional cost, **without requiring the customer to ship it back**. **No reporting cutoff**: the 14-day window doesn't apply, and nothing here limits rights customers have by law or under Etsy's protections. Ask for photos when useful. |
| Shipping problems, lost packages | Handled individually with the carrier and the sales platform. |
| Outside the window | Customer can contact us for individual consideration. |
| Return address | The owner's home address, used privately for approved physical returns (decided 2026-10-16; no PO box for launch). Never displayed on the website, never in the repository, code, database or public documentation, never in automatic emails. Sent by hand, only after approval (below). |

**Why 14 days:** the calendar is dated week by week. Present this as practical (a returned calendar only helps another family while its weeks are ahead), never as a penalty.

**Not covered:** other physical goods (the mug), personalized products and digital downloads need their own terms before they're sold. Downloads already carry a published 30-day money-back guarantee (on `/weekly-reset`, `/take-back-control` and `/returns`), separate from the calendar terms. The mug has no published terms yet: write them before it goes on sale.

## The return address (manual, private)

Launch decision (2026-10-16): approved physical returns go to the owner's home address. No PO box, no automation.

1. **Never public.** The address is not on the website, in the repository, in frontend code, in the database or in any public document (this guide included). `tests/support.test.ts` fails if site or function code ever reads a return-address setting.
2. **Approval first.** The customer contacts support (form, email or Etsy Messages) and gets approval before mailing anything. `/returns` and the FAQ say so.
3. **Sent by hand.** After approving, the owner sends the address and instructions personally: a private email reply (website orders, or anyone who used the form) or Etsy Messages (Etsy orders). Never in the automatic acknowledgment, never in a group or public message.
4. **Keep it handy, privately.** Save the reply below as an email template or note on your own phone or computer, with the address typed in there. Not in this repository.
5. **Damaged or incorrect items don't come back.** Issue the replacement or refund from her photo or description. Don't send the address unless you genuinely need to inspect the item, and then cover the postage.

Reply to copy into your own template (fill in the brackets; the address goes in only in your private copy):

> Hi [first name],
>
> Your return is approved. Please send your calendar to:
>
> [return address]
>
> A few quick notes:
> - Pop a note in the box with your reference ([OMC-… or order number]) so I can match it to you.
> - The calendar should be unused and in its original condition.
> - Return postage is yours to cover; a trackable service protects you if anything goes astray.
> - I'll let you know when it arrives and start your refund within 5 business days, back through [Etsy / our checkout].
>
> Please keep this address just for your return. Thanks so much!

## Service expectations

- **Response time:** "We aim to respond within one business day." A goal, not a guarantee. Never promise faster.
- **Tone:** warm, calm, personal. One person answers; don't imply a team. Apologize once when something went wrong, then fix it.
- **Channel:** Etsy orders → Etsy Messages (keeps the order attached and Etsy's records complete). Website orders and everything else → the support form or contact@organizedmomcollective.com.
- **Privacy:** support details are used only to answer the request. They're never added to a marketing list.
- **Product honesty:** the cleaning companion is a website (never "an app"), included with the calendar, no account, checkmarks saved on that phone. Don't promise features or sync that don't exist.

## Etsy or website order? Route by where she bought

| | Etsy order | Website order |
| --- | --- | --- |
| How to spot it | Etsy receipt / order number (on Etsy → Orders); she may write via Etsy Messages | Order number like `#1003` from her receipt email; in Admin → Orders |
| Where to talk | Etsy Messages (ask her to message there if she used the form, or answer by email and log it on the Etsy order) | Reply to the form email, or her receipt email |
| Cancel | Etsy → Orders → cancel | Admin → Orders → full refund (marks it canceled) |
| Refund | **Always in Etsy** (Orders → Refund). Never refund an Etsy order off-platform (PayPal, Venmo, Stripe) | Admin → Orders → Refund (Stripe, original payment method) |
| Replacement | Ship it and note it on the Etsy order | Ship it; Inventory → Add / remove, reason "Replacement for #…" |

Not sure? Ask for the order number, or search both Etsy Orders and Admin → Orders by her name or email.

## Daily routine (five minutes)

1. Check the support inbox for `[OMC-…]` emails, and Etsy Messages.
2. Supabase → Table Editor → **support_open**: anything older than a business day, or with `notify_status` = `failed`, needs a reply now.
3. Reply from the inbox (Reply goes straight to the customer). Keep the reference in the subject.
4. Set the request's `status` in **support_requests**: `waiting` (ball's in her court), `resolved` (done; `resolved_at` is stamped automatically). Add a line to `notes` if useful.

## How to handle each case

### Standard (change-of-mind) return
1. Check: within 14 days of delivery (use the carrier's delivery date), unused, proof of purchase.
2. Approve: send the approved-return reply above by hand (private email, or Etsy Messages for Etsy orders). If the request came through the form, set its `return_status` to `approved` in Supabase → Table Editor → `support_requests` so you can see it's pending.
3. Set `return_status` to `received` when it arrives. Inspect it within a couple of days. Resalable → refund the item price within 5 business days. Not resalable → explain kindly with a photo; offer to send it back.
4. Etsy order: refund through Etsy (Orders → the order → Refund). Website order: Admin → Orders → Refund; return it to stock only if it's sellable.
5. Set `return_status` to `refunded` (or `declined`) and `status` to `resolved`.

### Damaged, defective or incorrect
1. Ask for the order number and a photo (unless the description is already clear).
2. Offer a replacement or a full refund, her choice, at no cost. She doesn't ship it back. Only if you genuinely need to inspect it, ask nicely, cover the postage, and send the address by hand as above.
3. Replacement: ship a new calendar and note it (website orders: Inventory → Add / remove, reason "Replacement for #…"). Refund: full, including shipping.
4. Keep the photos: they're your evidence for the printer or carrier.

### Lost or stuck shipment
1. Check tracking. Under ~5 business days without movement: reassure, share tracking, ask her to check with neighbors / the mailroom.
2. Longer, or marked delivered but not received: open a claim with the carrier; for Etsy orders, follow Etsy's process (Etsy may step in through its purchase protection).
3. Decide replacement or refund case by case; tell her what happens next and when.

### Refund request (other than a return)
- Before shipment: cancel and refund in full (Etsy: cancel the order; website: Admin → full refund marks it canceled; return units to stock).
- After shipment: it's a return (above) or a damaged/incorrect case.
- Outside the window: consider individually. A one-off exception is fine; don't change the public policy for it.
- Downloads: honor the 30-day guarantee with a full refund (the download link stops working).

### Cleaning companion website problems
1. Ask: phone and browser, what she sees, and whether she's opening it from the QR code or `/app`.
2. Common fixes: scan the QR code again; open `organizedmomcollective.com/app` directly; turn off private browsing (checkmarks don't save there); checkmarks don't move between phones, by design.
3. On iPhone, the Home Screen version has its own storage: progress from Safari may not carry over.
4. If it's a real bug, note the details and fix it in the code; tell her when it's fixed. Never promise a feature that isn't built.

## Etsy settings to match the website (owner checklist)

These live in Etsy (Shop Manager → Settings → Policies, and each listing). **Nothing here has been changed by the website work**: update them yourself, then tick them off.

- [ ] Return & exchange policy: **accepts returns**; **does not accept exchanges** (the site says no direct exchanges for change-of-mind returns; damaged or incorrect items get a free replacement).
- [ ] Return window: **14 days** from delivery.
- [ ] Buyer contacts you within 14 days; the item must be sent back within the period Etsy allows.
- [ ] Buyer is responsible for return shipping costs (change of mind).
- [ ] Return conditions: unused, original condition.
- [ ] Cancellations: **accepted before the order ships** (Etsy asks for a request window; pick "before item has shipped" or the closest option).
- [ ] Items that can't be returned: none for calendars (if Etsy lists exceptions like "custom or personalized orders", only add them to personalized listings).
- [ ] Apply the policy to each calendar listing (half-year, full-year) and check each listing's own return settings match.
- [ ] Shop "FAQs" / "More information" section: link to `https://organizedmomcollective.com/returns` and `/support` if you use it.
- [ ] Processing time and shipping profile: match what you can actually do (the website makes no delivery-time promises).
- [ ] Message auto-reply (optional): "Thanks for your message! We aim to respond within one business day."
- [ ] Damaged items: Etsy has no policy field for this; your website promise (replacement or refund at no cost) stands, and Etsy's purchase protection may also apply.

If Etsy's options can't express a term exactly (for example the cancellation window), Etsy's setting governs Etsy orders. Match it as closely as possible and adjust the website if they disagree.

## Future: one admin dashboard

The plan for managing the website, products, orders, support, refunds and returns from one `/admin` is in [ADMIN_DASHBOARD_PLAN.md](ADMIN_DASHBOARD_PLAN.md). Until it exists, support runs from the inbox and Supabase's Table Editor as described above.

## Open decisions and flags (not legal advice)

1. **Earlier 30-day promise.** `/refunds` promised 30-day calendar returns and a 30-day damage window from 2026-10-15 until this change. No live website orders exist (checkout is in preview), and Etsy orders follow Etsy's settings, so nobody was sold under it on the website. If any Etsy buyer bought under a 30-day Etsy setting, honor what their listing said.
2. **Damage reporting: decided (2026-10-16).** No cutoff. The site tells customers the 14-day window doesn't apply to damage and to tell us whenever they notice it.
3. **Etsy's rules win on Etsy orders.** Etsy's own return settings and purchase protection apply to Etsy purchases. Keep them matched (checklist above).
4. **State consumer law.** Some states require a posted refund policy to be conspicuous or treat an unposted policy as allowing returns (e.g. California, New York). The policy is now posted on `/returns`, linked from the footer and beside the buy buttons. If you sell in person or ship internationally, review again.
5. **Stripe refunds** go back to the original payment method only, and some payment methods limit how long after the charge a refund is possible. "Subject to the payment platform's capabilities" covers this; refund promptly.
6. **Return address privacy.** The owner's home address is shared by hand, one approved customer at a time. A customer can still forward it, so share it only after approval and only for physical change-of-mind returns. Revisit a PO box or mailbox service if return volume grows past the first orders.
7. **Data retention.** Support requests are kept until you delete them. Suggest deleting resolved requests after 12 months (Table Editor → filter `status = resolved` and `resolved_at` older than a year → delete).
8. **Mug, personalized products, future products:** write their terms before they go on sale; add a section to `/returns` and a product line to `src/data/support.ts`.

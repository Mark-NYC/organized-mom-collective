# Customer support and returns

How Organized Mom Collective handles customer questions, returns and refunds. Written for one person
fulfilling the first calendar orders; structured so new products add their own terms later.

- Customer pages: [/support](https://organizedmomcollective.com/support) (help topics, FAQs, contact form) and [/returns](https://organizedmomcollective.com/returns) (policy). `/refunds` redirects to `/returns`.
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
| Refund method | Original payment method, subject to the payment platform (Etsy or Stripe). |
| Refund timing | Initiated within 5 business days after the returned calendar is received and inspected. |
| Cancellations | Before shipment, subject to actual fulfillment status. Once shipped, it becomes a return. |
| Damaged, defective or incorrect | Replacement or refund at no additional cost. Ask for photos when useful. Don't require the item back unless genuinely necessary; if it is, we pay return postage. |
| Shipping problems, lost packages | Handled individually with the carrier and the sales platform. |
| Outside the window | Customer can contact us for individual consideration. |
| Return address | Never published. Sent by email only after a return is approved. |

**Why 14 days:** the calendar is dated week by week. Present this as practical (a returned calendar only helps another family while its weeks are ahead), never as a penalty.

**Not covered:** other physical goods (the mug), personalized products and digital downloads need their own terms before they're sold. Downloads already carry a published 30-day money-back guarantee (on `/weekly-reset`, `/take-back-control` and `/returns`), separate from the calendar terms. The mug has no published terms yet: write them before it goes on sale.

## Service expectations

- **Response time:** "We aim to respond within one business day." A goal, not a guarantee. Never promise faster.
- **Tone:** warm, calm, personal. One person answers; don't imply a team. Apologize once when something went wrong, then fix it.
- **Channel:** Etsy orders → Etsy Messages (keeps the order attached and Etsy's records complete). Website orders and everything else → the support form or contact@organizedmomcollective.com.
- **Privacy:** support details are used only to answer the request. They're never added to a marketing list.
- **Product honesty:** the cleaning companion is a website (never "an app"), included with the calendar, no account, checkmarks saved on that phone. Don't promise features or sync that don't exist.

## Daily routine (five minutes)

1. Check the support inbox for `[OMC-…]` emails, and Etsy Messages.
2. Supabase → Table Editor → **support_open**: anything older than a business day, or with `notify_status` = `failed`, needs a reply now.
3. Reply from the inbox (Reply goes straight to the customer). Keep the reference in the subject.
4. Set the request's `status` in **support_requests**: `waiting` (ball's in her court), `resolved` (done; `resolved_at` is stamped automatically). Add a line to `notes` if useful.

## How to handle each case

### Standard (change-of-mind) return
1. Check: within 14 days of delivery (use the carrier's delivery date), unused, proof of purchase.
2. Approve by email with the return address and a reminder: unused, original condition, trackable shipping recommended, return postage is hers, original shipping isn't refunded.
3. When it arrives, inspect it within a couple of days. Resalable → refund the item price within 5 business days. Not resalable → explain kindly with a photo; offer to send it back.
4. Etsy order: refund through Etsy (Orders → the order → Refund). Website order: Admin → Orders → Refund; return it to stock only if it's sellable.
5. Mark the request resolved.

### Damaged, defective or incorrect
1. Ask for the order number and a photo (unless the description is already clear).
2. Offer a replacement or a full refund, her choice, at no cost. Don't ask for it back unless you genuinely need to inspect it; if you do, send a prepaid label.
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

- [ ] Return & exchange policy: **accepts returns**; **does not accept exchanges** (the site says "we don't do direct swaps").
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

## Open decisions and flags (not legal advice)

1. **Earlier 30-day promise.** `/refunds` promised 30-day calendar returns and a 30-day damage window from 2026-10-15 until this change. No live website orders exist (checkout is in preview), and Etsy orders follow Etsy's settings, so nobody was sold under it on the website. If any Etsy buyer bought under a 30-day Etsy setting, honor what their listing said.
2. **Damage reporting window.** The approved terms set no deadline for reporting damage. The site says "let us know" without a deadline. Decide whether you want one (e.g. 14 days from delivery) and add it in one place.
3. **Etsy's rules win on Etsy orders.** Etsy's own return settings and purchase protection apply to Etsy purchases. Keep them matched (checklist above).
4. **State consumer law.** Some states require a posted refund policy to be conspicuous or treat an unposted policy as allowing returns (e.g. California, New York). The policy is now posted on `/returns`, linked from the footer and beside the buy buttons. If you sell in person or ship internationally, review again.
5. **Stripe refunds** go back to the original payment method only, and some payment methods limit how long after the charge a refund is possible. "Subject to the payment platform's capabilities" covers this; refund promptly.
6. **Return address privacy.** A home address is only ever emailed after approval. Consider a PO box or mailbox service before volume grows.
7. **Data retention.** Support requests are kept until you delete them. Suggest deleting resolved requests after 12 months (Table Editor → filter `status = resolved` and `resolved_at` older than a year → delete).
8. **Mug, personalized products, future products:** write their terms before they go on sale; add a section to `/returns` and a product line to `src/data/support.ts`.

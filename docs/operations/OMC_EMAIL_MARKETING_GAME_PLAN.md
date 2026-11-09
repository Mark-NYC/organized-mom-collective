# OMC Email Marketing Game Plan

**Owner:** Organized Mom Collective  
**Last updated:** 2026-11-09  
**Status:** Strategy approved for drafting. Sending is OFF. Copy, templates, links, and automation must be reviewed before launch.  
**Platform:** Resend Marketing + Supabase + existing Astro website.  
**Implementation companion:** [RESEND_MARKETING_MVP.md](./RESEND_MARKETING_MVP.md)

## 1. Core strategy

Give away practical, genuinely useful help to moms with school-aged children. Each message solves **one small family problem** so the reader can try something today. Build trust through repeated wins, then make a relevant, low-pressure invitation to a paid offer.

Our repeatable editorial franchise is **One Small Win**. It should be worth reading even when someone never purchases.

- The email is valuable on its own; a website click is not required to get the takeaway.
- One specific problem, one short action plan, one primary call to action.
- No manufactured urgency, guilt, or spammy scarcity.
- Lead with results, not features. Favor kids taking responsibility, lighter mental load, and a home that works better for everyone.
- Sell the **Organized Family Club** as personalized, mailed tools that help a family put ideas into action. Offer calendars and responsibility cards when directly related to the email's problem.
- Do not assume any particular email ratio is a proven Hormozi rule. Use the mix below as our own starting hypothesis; adjust using results.

## 2. Audience paths

| Path | Trigger | Planned messages | Conditions |
| --- | --- | --- | --- |
| Free guide / tool / quiz opt-in | Explicit unchecked-by-default marketing consent | Day 2 useful tip, Day 6 useful tip, then One Small Win | Match the first tip/link to the resource interest where practical |
| One Small Win | Opted-in and eligible contact | **Weekly** helpful email as the editorial target, starting with prepared drafts and controlled rollout | Roughly 3 useful/value emails to 1 more directly product-connected email as an initial editorial mix; even offer emails must teach |
| Club onboarding | Confirmed member activation | Day 3 and Day 10 practical coaching | Existing transactional messages remain; avoid overlapping or redundant messages |
| Calendar buyer follow-up | **Confirmed delivery** | One practical getting-started email, then a follow-up ~7 days later | Promotional follow-up only with marketing consent; avoid Club pitch to active Club members |
| Transactional | Checkout, account, delivery, payment, resource availability | Existing operational emails | Separate from marketing consent and marketing broadcasts |

**Cadence decision:** Earlier engineering MVP proposed One Small Win twice monthly. The updated editorial goal is weekly, but we can launch twice monthly if production or list quality requires it. Do not change live sending frequency without approval. Cap marketing to **one email per person per day** and coordinate welcome/onboarding vs broadcasts.

## 3. Email format and design

**Default: text-first, visual-supported.** Do not paste a 1000×1500 Pinterest infographic into an email.

- Georgia for headings where safely supported, with serif fallback. Montserrat for supporting text where available, with system sans-serif fallback.
- OMC palette: Charcoal `#545454`, Warm Ivory `#FBF7F1`, Soft Frost Blue `#CDDDE1`, Soft Leaf Green `#D4DFC4`, Pale Apricot `#F1D8A8`, Powder Blush `#E8D2D6`.
- Prefer a restrained header/logo, short paragraphs, clear spacing, one prominent link or button, modest footer.
- Body usually ~100–180 words for One Small Win. Shorter when the idea is simple.
- Keep the valuable instruction in real HTML text, not only inside an image. Supply alt text and a plain-text email. Check mobile, dark mode, Gmail, and Outlook.
- For value emails: usually **zero or one** relevant image (existing black-and-white hand-drawn icon, cropped mini-checklist, or printable preview). Do not require an image if it does not help.
- For offer emails: one stronger actual-product or Club-printable preview. Still text first.
- Avoid faces, generic stock photography, made-up printable previews, and changing the artwork/text of a real product.
- Product imagery must accurately show the real calendar/card/Club resource; no Gemini asset unless an actual gap remains.

## 4. Asset sourcing: assistant owns production

**Default: the assistant finds and prepares assets. The user should not be asked for new Gemini images as routine work.**

1. Inspect the **live OMC site** to identify the relevant guide, resource, generator, shop or Club page.
2. Search the **GitHub repository** for the actual image, PDF, hand-drawn icon and source assets. Prefer originals over screenshots.
3. Reuse existing **black-and-white hand-drawn icons** across guides. Do not substitute the pastel icon set. Ensure no visible white rectangle outside illustration; size icons consistently.
4. Use an actual screenshot, existing PDF preview or carefully generated branded HTML/CSS mini-card if it materially helps the message.
5. Optimize image dimensions/weight and host on stable public URLs. Confirm email client rendering. Never hotlink private member-only files.
6. Only if existing assets cannot cover the need, generate a simple graphic with the available image/design tooling.
7. **Ask for Gemini input only if genuinely necessary** for faithful lifestyle staging/complex mockups that cannot be built from the existing photos and source files. Supply the exact prompt, original asset, dimensions and filename. Do not invent a dependency on Gemini.

**Never claim an asset has been verified without inspecting the live page or repository file.** Maintain an asset inventory inside the email production record, including source path, use license/ownership where applicable, public CDN URL and email usage.

## 5. First eight One Small Win topics

These are the editorial queue. Titles, actual links, images and chronology must be checked against the real site before creating final drafts.

| # | Working angle | Actionable takeaway | Candidate existing asset |
| --- | --- | --- | --- |
| 01 | Stop reminding them about backpacks | Give the backpack one home; practice the after-school arrival routine | Backpack hand-drawn icon / routine guide preview |
| 02 | The five-minute living-room reset | Toys back, books/papers home, blankets folded, dishes/trash out, surfaces cleared | Living-room-reset guide artwork or existing 5-step visual |
| 03 | Get kids helping with laundry | Give each child one laundry step they can own | Family Laundry System guide icon / printable |
| 04 | One question to ask at dinner | Ask one easy family-connection question; let everyone respond | Actual Family Meeting / family connection resource preview |
| 05 | Stop the morning scramble | Build one visible cue for the next day's essentials | Routine-chart generator preview |
| 06 | Give every item a home | Choose one entryway landing zone for shoes/bags | Existing entryway guide illustration |
| 07 | Make dinner a team effort | Assign a tiny, repeatable dinner role | Dinner Team / responsibilities resource preview |
| 08 | The ten-minute family reset | Reset one shared space together in a repeatable ten-minute window | Existing Ten-Minute Family Reset printable or guide |

The site may use different precise titles or URLs; do not manufacture live links. Each email should be useful without clicking. Link only to a confirmed matching page.

## 6. Draft structure for One Small Win

**Subject:** One Small Win: [concrete result or tension]  
**Preview text:** [one clear benefit, distinct from subject]

**Opening:** Name a problem she recognizes in 1–2 sentences.

**Try this today:** 2–4 concrete steps she can do with her family.

**Payoff:** Explain how the step moves ownership to a child or reduces reminders/mental load.

**Primary link:** [verified matching free guide/tool] or an offer link when the email is intentionally offer-focused.

**Optional P.S.:** Light Club mention only when relevant and not too frequent. Do not put a Club promotion in every value email. Exclude active Club members from Club pitches.

**Footer:** sender identity, physical mailing address as required, unsubscribe link, and privacy/permission language. Resend Marketing's native unsubscribe and suppression features must remain functional.

## 7. Production and approval workflow

For each batch, assistant should:

1. Confirm whether the batch is drafts-only, and verify the live email sending state.
2. Choose topics and map each to one verified live landing URL and one verified asset.
3. Write subject, preview, HTML body, plain-text body, alt text, CTA and UTM parameters.
4. Reuse the shared responsive email template. Render preview on mobile and desktop. Verify accessible image alternatives and links.
5. Create **draft** messages/templates/broadcasts in Resend. **Do not publish, schedule or activate** without explicit user approval.
6. Show the user the full email copy and preferably previews for review, with a succinct change list.
7. After approval, test through controlled internal delivery, verify deliverability, unsubscribe and actual click destinations. Then seek approval to turn on scheduled automations.
8. Record each asset mapping, Resend draft ID/URL, audience, sequence, send status, approvals and results.

The user only needs to review strategy/copy, flag asset mismatches, and approve sending. Assistant handles writing, sourcing, layouts, drafts, QA, and connector work where supported.

## 8. Metrics and learning

Measure unique clicks to relevant resources and offers, Club trials/conversions, calendar purchases attributable to email when possible, unsubscribes/complaints, bounce rate, and relevant replies. Open rates can be directional but are less reliable due to privacy protections. With a tiny initial subscriber cohort, avoid reading too much into percentages.

Start with **weekly content production**, but enable sending only after explicit approval. When enough data exists, test text-only vs one-image variants on comparable topics. Keep the winner based on engaged clicks and downstream conversions, not visual preference alone.

## 9. Infrastructure and current verified baseline (2026-11-09)

- GitHub foundation PR #445 merged; see [technical MVP](./RESEND_MARKETING_MVP.md).
- Supabase migration installed: `marketing_suppressions` table and `marketing_suppression_guard` trigger verified.
- Supabase functions `resend-marketing-webhook` and `resend-contact-sync` deployed and active.
- Resend webhook created with `contact.updated`, `email.bounced`, `email.complained` events. Secret was added by the user.
- **Verified live:** A synthetic Resend contact was unsubscribed; event delivered successfully and Supabase recorded `reason=unsubscribed`.
- The user added `EMAIL_SYNC_SECRET` to Supabase, but the **Edge Function importer has not had its authenticated dry-run tested**.
- Three consented, unsuppressed free-resource contacts were imported directly through the Resend plugin into `OMC | Free Resource Opt-Ins` segment and verified.
- Remaining contacts without consent were **not** imported.
- **No marketing messages have been sent by this setup. No automation activated.**

### Next engineering steps

- Run the secret-authenticated **dry run** of `resend-contact-sync`; inspect eligibility, duplicate and suppression behavior.
- Implement and test **automatic future signup syncing**. A one-time manual import is not an ongoing integration. Ensure unsubscribes cannot be reactivated on subsequent syncs.
- Check signup consent capture, topic/segment handling, sender identity/domain verification, physical address and unsubscribe footer.
- Confirm that contact updates and suppression cases are handled for actual Resend payload versions. Existing unsubscribe path passed; bounce and complaint cases still need explicit testing.
- Build the branded responsive email template and first eight **drafts**, using the live site/repo assets.
- Review final copy with user before enabling sequences. Build Day 2/6 welcome and later Club/Calendar paths, coordinating cadence and suppressions.
- Add measurement and a simple production status record before first live marketing send.

## 10. Non-negotiables

- Never send promotional email without demonstrable marketing consent, or to suppressed/unsubscribed contacts.
- Never silently reactivate an unsubscribed contact. Test repeat-signup behavior.
- Transactional receipts, account/payment notices and access links remain separate from promotional marketing.
- No campaigns, automated sequences or imported contacts are a reason to begin sending without user approval.
- Reuse existing artwork first. Preserve brand consistency. Make the email useful even without its image.
- Record changes and operational status here when the plan evolves. Keep lower-level deployment notes in [RESEND_MARKETING_MVP.md](./RESEND_MARKETING_MVP.md).

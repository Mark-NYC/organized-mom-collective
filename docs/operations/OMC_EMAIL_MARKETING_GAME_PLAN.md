# OMC Email Marketing Game Plan

**Owner:** Organized Mom Collective  
**Last updated:** 2026-11-09  
**Status:** Two-email welcome automation LIVE for net-new marketing opt-ins. Sunday Family Reset and Wednesday One Small Win broadcasts are DRAFTS ONLY, not scheduled. Subscriber Access backend is deployed; actual tracked email-click-to-browser journey awaits QA.  
**Platform:** Resend Marketing + Supabase + existing Astro website.  
**Implementation companion:** [RESEND_MARKETING_MVP.md](./RESEND_MARKETING_MVP.md)

## 1. Core strategy

Give away practical, genuinely useful help to moms with school-aged children. Each message solves **one small family problem** so the reader can try something today. Build trust through repeated wins, then make a relevant, low-pressure invitation to a paid offer.

Our repeatable editorial franchises are **Sunday Family Reset** and **One Small Win**. Each should be worth reading even when someone never purchases.

- The email is valuable on its own; a website click is not required to get the takeaway.
- One specific problem and one short action plan. Most issues need **no outbound CTA**; the reader can finish the win inside the email.
- No manufactured urgency, guilt, or spammy scarcity.
- Lead with results, not features. Favor kids taking responsibility, lighter mental load, and a home that works better for everyone.
- Sell the **Organized Family Club** as personalized, mailed tools that help a family put ideas into action. Offer calendars and responsibility cards when directly related to the email's problem.
- Do not assume any particular email ratio is a proven Hormozi rule. Use the mix below as our own starting hypothesis; adjust using results.

## 2. Audience paths

| Path | Trigger | Planned messages | Conditions |
| --- | --- | --- | --- |
| Free guide / tool opt-in | Explicit, unchecked-by-default marketing consent | Day 2 and Day 6 welcome emails **live**; then Sunday Family Reset and One Small Win **planned** | Newsletter audience segmentation must exclude anyone still in welcome |
| Sunday Family Reset | Welcome-completed and opted-in contact | **Weekly Sunday** family meeting/rhythm email; four Resend drafts prepared | Use seasonal Club theme and a small family action, not a hard sell |\n| One Small Win | Welcome-completed and opted-in contact | **Weekly Wednesday** practical tip; eight usable Resend drafts prepared | Self-contained quick win, occasional deeper resource or product link |
| Club onboarding | Confirmed member activation | Day 3 and Day 10 practical coaching | Existing transactional messages remain; avoid overlapping or redundant messages |
| Calendar buyer follow-up | **Confirmed delivery** | One practical getting-started email, then a follow-up ~7 days later | Promotional follow-up only with marketing consent; avoid Club pitch to active Club members |
| Transactional | Checkout, account, delivery, payment, resource availability | Existing operational emails | Separate from marketing consent and marketing broadcasts |

**Cadence decision (current):** Two editorial emails per week are the approved **target**, Sunday Family Reset on Sundays and One Small Win on Wednesdays. Neither series is scheduled yet. A monthly Family Toolkit/resource announcement and separate short promotional campaigns are optional, not automatic extra sends. Keep marketing to **one email per recipient per day**, avoid welcome/newsletter overlap, and only schedule with approval.

## 2026-11-09 strategy update: what we learned from Clean Mama's actual emails

**Evidence examined:** 27 Clean Mama emails found in the owner's Gmail, dated October 14 through November 9, 2026. The sample is **one subscriber's received mail**, not Clean Mama's whole list, and does not establish her open/click/conversion metrics or exact segmentation.

| Observed in received mail | Implication for OMC |
| --- | --- |
| Recurring Sunday Routine Reset, Tuesday Quick Tip, and Friday Catch-All editorial formats | Give readers recognizable recurring series rather than unrelated blasts |
| Dense welcome/teaching sequence in mid-October, introducing an accessible paid offer alongside practical guidance | Our live Day 2 and Day 6 are a minimal welcome, not yet a full educational sales sequence. Evaluate expansion only after measuring and reviewing copy |
| Additional membership/class/product launch messages, with varied education, testimonials, FAQ and time-limited offers | Separate short, relevant promotions from the regular value cadence |
| Monthly routine and calendar themes tying free advice to paid systems | Anchor Sunday Family Reset to our Family Meeting and the Organized Family Club monthly theme |
| Editorial-style sender and campaign-style sender addresses | Useful concept, **not** proof of her internal audience routing |

**Our deliberate adaptation, not a copy:** Begin with **two** recognizable weekly emails, not her three. Sunday is the family's whole-week rhythm; Wednesday is a single practical win. Let Club's personalized *printed* resources support putting the ideas into practice. Consider a monthly Family Toolkit touchpoint and focused Club/calendar offers when there is a strong reason, rather than stacking automatic weekly promotions.

**Editorial rule:** Each email must stand alone. Sunday Family Reset gives a question and a doable shared action, usually with a quiet guide link; One Small Win helps with one friction point. Sell naturally where the offered tool directly helps. The Family Meeting is the conceptual backbone, not a request to create a complicated weekly project.

### Actual campaign status and authoritative source documents

- **Day 0:** Requested free download/guide via site's existing signup gate; *optional* marketing checkbox. Download is not promotional consent.
- **Day 2 / Day 6:** Published, tested welcome templates and automated Supabase delivery **enabled for new explicit opt-ins**. No historical opt-in backfill. See [welcome copy](./OMC_WELCOME_SEQUENCE_REVIEW_DRAFTS.md) and [technical state](./RESEND_MARKETING_MVP.md).
- **Sunday:** Four branded **draft** broadcasts, intended Nov 15 / 22 / 29 / Dec 6. See [Sunday rollout](./SUNDAY_FAMILY_RESET_LAUNCH_PLAN.md).
- **Wednesday:** Eight usable One Small Win **draft** broadcasts. See [first eight copy](./ONE_SMALL_WIN_FIRST_8_DRAFTS.md). Broken superseded editor drafts exist in Resend and must not be scheduled.
- **Subscriber Access:** Three existing opted-in contacts now have token properties synced to Resend; free resource links in Sunday 01–03 and One Small Win 05 carry `#omc_pass={{{contact.RESOURCE_PASS}}}`. Valid/invalid token API QA passed. The browser deploy, click tracking, and actual cross-device journey have **not** passed end-to-end QA. See [Subscriber Access runbook](./SUBSCRIBER_RESOURCE_ACCESS.md).
- **Unsent audiences (resolved for drafts):** All 12 usable broadcasts now target a separate `OMC | Newsletter Ready` audience. SQL simulation and initial provider sync passed; real new-subscriber Day 6 handoff and the personalized link still need full end-to-end QA before scheduling.
- **Resend controls:** Reserve broadcast dates in Supabase before Resend scheduling. The scheduler remains locked; the direct Resend dashboard can bypass it, so off-cycle sends must not bypass reservation and suppression checks.

### Immediate priorities

1. Smoke-test deployed website and one real Resend personalized tracked link into the free guide library or generator, including a fresh browser and an unsubscribed/consent-free scenario.
2. Build and verify a **newsletter-ready audience** separate from new subscribers still in Day 2/Day 6 welcome.
3. Review and schedule the four Sunday and eight Wednesday drafts only once audience, link, mobile and scheduling tests pass.
4. Keep monthly Club themes integrated: November 2026 **Our Family, Our Team**; December **Give to Others**; January 2027 **Family Meeting Introduction**. The paid Club provides personalized mailed resources, not just links to free PDF guides.
5. After meaningful data arrives, evaluate whether expanding welcome education to five/six messages improves activation without hurting unsubscribe rates. **No longer welcome drip has been built or approved.**

## 3. Email format and design

**Default: text-first, visual-supported.** Do not paste a 1000×1500 Pinterest infographic into an email.

- Georgia for headings where safely supported, with serif fallback. Montserrat for supporting text where available, with system sans-serif fallback.
- OMC palette: Charcoal `#545454`, Warm Ivory `#FBF7F1`, Soft Frost Blue `#CDDDE1`, Soft Leaf Green `#D4DFC4`, Pale Apricot `#F1D8A8`, Powder Blush `#E8D2D6`.
- Prefer a restrained header/logo, short paragraphs, clear spacing, one prominent link or button, modest footer.
- Body usually ~100–180 words for One Small Win. Shorter when the idea is simple.
- Keep the valuable instruction in real HTML text, not only inside an image. Supply alt text and a plain-text email. Check mobile, dark mode, Gmail, and Outlook.
- For value emails: usually **zero or one** relevant image (existing black-and-white hand-drawn icon or mini-checklist). Do not require an image if it does not help. Do not over-package short tips into downloadable multi-page guides.
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

## Subscriber resource links

Existing browser downloads already remember access locally. For opted-in readers on another device, use the private `RESOURCE_PASS` Resend contact property in a fragment link, e.g. `https://www.organizedmomcollective.com/guides/#omc_pass={{{contact.RESOURCE_PASS}}}`. The public site verifies this token and grants remembered access to **free** guide and generator downloads without asking for the email again. Never expose email addresses or private/member access in these URLs. Do not add tokens to public Pinterest links. See [Subscriber Access](./SUBSCRIBER_RESOURCE_ACCESS.md) for expiration, verification and outstanding live tests.

Direct public `/downloads/*.pdf` links remain a simple alternative for a specific file (these assets are public). However, when referring readers to an interactive generator or guide library, prefer a tested Subscriber Access URL so they can browse further without repeated capture.

**First eight complete drafts:** [ONE_SMALL_WIN_FIRST_8_DRAFTS.md](./ONE_SMALL_WIN_FIRST_8_DRAFTS.md).

## 6. Draft structure for One Small Win

**Subject:** One Small Win: [concrete result or tension]  
**Preview text:** [one clear benefit, distinct from subject]

**Opening:** Name a problem she recognizes in 1–2 sentences.

**Try this today:** 2–4 concrete steps she can do with her family.

**Payoff:** Explain how the step moves ownership to a child or reduces reminders/mental load.

**Optional link:** Only when the deeper guide, tool, or offer genuinely adds value. Most weeks end with one concrete invitation to try the action, **not** a button or download.

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
- **Historical snapshot, superseded by the 2026-11-09 update above:** welcome automation was later activated; Sunday/Wednesday broadcasts remain unscheduled.

### Next engineering steps

- Run the secret-authenticated **dry run** of `resend-contact-sync`; inspect eligibility, duplicate and suppression behavior.
- Implement and test **automatic future signup syncing**. A one-time manual import is not an ongoing integration. Ensure unsubscribes cannot be reactivated on subsequent syncs.
- Check signup consent capture, topic/segment handling, sender identity/domain verification, physical address and unsubscribe footer.
- Confirm that contact updates and suppression cases are handled for actual Resend payload versions. Existing unsubscribe path passed; bounce and complaint cases still need explicit testing.
- First eight visually editable branded drafts were created in Resend and revised to reduce resource overload: Emails 01, 02, 06, 08 are email-only; 03 includes a short checklist; 04 has a soft Club text link; 05 an optional routine chart generator link; 07 an optional four-page dinner PDF and calendar P.S. No automatic sending. Extra duplicate drafts from an interrupted build must not be scheduled.
- Review final copy with user before enabling sequences. Build Day 2/6 welcome and later Club/Calendar paths, coordinating cadence and suppressions.
- Add measurement and a simple production status record before first live marketing send.

## 10. Non-negotiables

- Never send promotional email without demonstrable marketing consent, or to suppressed/unsubscribed contacts.
- Never silently reactivate an unsubscribed contact. Test repeat-signup behavior.
- Transactional receipts, account/payment notices and access links remain separate from promotional marketing.
- No campaigns, automated sequences or imported contacts are a reason to begin sending without user approval.
- Reuse existing artwork first. Preserve brand consistency. Make the email useful even without its image.
- Record changes and operational status here when the plan evolves. Keep lower-level deployment notes in [RESEND_MARKETING_MVP.md](./RESEND_MARKETING_MVP.md).

### Newsletter audience separation implemented (2026-11-09)

**Done:** A new Resend segment `OMC | Newsletter Ready` (`98ec76b1-fe2e-42d4-898d-b235b9c9df8b`) is populated by a consent-aware Supabase job every five minutes. Existing eligible prelaunch opt-ins qualify; new opt-ins qualify only after a confirmed Day 6 welcome send. Suppressed/nonconsenting and welcome-incomplete contacts are ineligible. All 12 usable Sunday/Wednesday broadcasts now target this segment and remain `draft`, unsent, unscheduled. The guarded broadcast scheduler also requires that audience. See [NEWSLETTER_AUDIENCE_HANDOFF.md](./NEWSLETTER_AUDIENCE_HANDOFF.md).

**Next:** Real personalized email-link / new-browser QA; genuine Day 6-to-audience handoff observation; reviewed broadcast scheduling. No editorial broadcasts were activated by audience separation.


### Verified contact-property syntax and broadcast link, November 9, 2026

**Resolved:** Resend's broadcast interpolation for custom contact properties uses `{{{contact.RESOURCE_PASS}}}`, **not** `{{{RESOURCE_PASS}}}`. The latter rendered blank even though the contact property exists. A diagnostic one-person broadcast confirmed `{{{contact.RESOURCE_PASS}}}` expands to the actual 64-character pass. A subsequent one-person broadcast `55bec597-3270-4e9a-8c05-c410dca2a15f` was delivered to Gmail with a complete clickable `/guides/#omc_pass=<64-hex-pass>` URL. Domain click tracking was disabled during this test. No production newsletter was sent.

**Resend drafts corrected and read back:** Sunday Family Reset 01–03 and One Small Win 05 now contain `{{{contact.RESOURCE_PASS}}}` in HTML and plain text, with zero old placeholders; all remain `draft`, assigned to `OMC | Newsletter Ready`. The 15-minute pass sync and Supabase token verifier are active. A fresh valid-token POST returned `200 {ok:true}` and invalid-token POST returned `200 {ok:false}`.

**Final pending browser QA:** A human must open the delivered one-person test email in a fresh private browser and try a real PDF and generator download. Static production website deployment cannot be independently confirmed from the available connectors. Do not claim that the live site's popup behavior has been verified. Further schedule approval is still separate from testing.


## Approved weekly newsletter schedule, November 10, 2026

The owner confirmed in a fresh private browser that the personalized subscriber guide link no longer prompts again for email. Earlier Resend delivered test emails verified `{{{contact.RESOURCE_PASS}}}` expands to the actual pass. This closes the outstanding human browser QA item for the guide path; a separate generator-specific visit has not been explicitly confirmed.

**Scheduled in Resend and recorded in the Supabase marketing broadcast calendar** (each checked as status `scheduled`; no immediate sends):

| Local send (America/New_York) | Series | Broadcast ID |
| --- | --- | --- |
| Sun Nov 15, 2026, 8:30 AM | Sunday Family Reset 01 | `a042b85c-d216-4fc1-9a19-9caf8660ee4a` |
| Wed Nov 18, 2026, 9 AM | One Small Win 01 | `36761fdf-d316-4921-9c20-bdf44bce02fd` |
| Sun Nov 22, 2026, 8:30 AM | Sunday Family Reset 02 | `9a9acbdc-8150-4f0b-9ce3-bc3e9b7b4a37` |
| Wed Nov 25, 2026, 9 AM | One Small Win 02 | `71b315ae-e4b4-41d5-b2c1-f67769eb310b` |
| Sun Nov 29, 2026, 8:30 AM | Sunday Family Reset 03 | `cb0061d6-7faf-49fe-b823-ce338b9d5960` |
| Wed Dec 2, 2026, 9 AM | One Small Win 03 | `f754f259-ad49-450e-95fc-c490b5f38298` |
| Sun Dec 6, 2026, 8:30 AM | Sunday Family Reset 04 | `c0570537-539b-4976-80fe-ebd30949b205` |

**Remaining five Wednesdays beyond the 28-day protected scheduler horizon**, still drafts:

| Intended local date, 9 AM | Draft |
| --- | --- |
| Dec 9, 2026 | `cb6b9c36-696c-4006-a039-93519616db73` |
| Dec 16, 2026 | `5745766c-36c5-4ab1-a3c1-0becd37ba0a5` |
| Dec 23, 2026 | `f821718f-f926-4b09-b3bf-baf17d5d89e6` |
| Dec 30, 2026 | `ce4ae542-4759-438d-a422-077c35c582a8` |
| Jan 6, 2027 | `fa2fb8e7-1305-449e-a0e6-816e99f259f3` |

**Follow-through task:** ChatGPT automation `6af3131b85d88191a553f26bcc60e2b1`, titled `Finish OMC Newsletter Schedule`, checks daily starting Nov 11 to schedule the remaining five one by one as they enter the 28-day window. It is instructed to verify status and consented segment, reserve the Supabase local date before the Resend call, verify scheduled status, and stop on ambiguity rather than retry blindly. The task is not proof the future broadcasts have been scheduled; verify future run results and calendar rows.

Schedule timezone is EST (UTC-5) on all listed dates. Resend sends to `OMC | Newsletter Ready` rather than the general opt-in segment. Welcome Day 2 and Day 6 emails remain live and blocked from overlapping reserved broadcast dates. The calendar records the seven dates above.

## Email reporting shipped (November 10, 2026)

Owner-only `/admin/email` page added to the existing admin Growth menu. It shows actual opt-ins, newsletter-ready contacts, welcome jobs, planned broadcasts, suppressions/unsubscribes, signed Resend provider deliveries/failures once received, and un-attributed Club/shop totals. It **does not** claim email clicks or conversions while the domain's click tracking and per-order attribution are unavailable. Existing GA4 tracks site visits, but no GA4 email UTM funnel was imported into the admin. See [EMAIL_REPORTING.md](./EMAIL_REPORTING.md) for exact metrics, safeguards and remaining browser/webhook QA.

### Tagged editorial links, November 10, 2026

One Small Win 04's Club URL, issue 05's routine-chart URL and issue 07's calendar URL now carry `utm_source=omc_email&utm_medium=email&utm_campaign=one_small_win_XX`; all three remain **unscheduled** drafts. The routine chart keeps `#omc_pass={{{contact.RESOURCE_PASS}}}` after the UTM query, preserving subscriber access. The owner-only email admin scorecard now counts **first-touch email-sourced free signups**, separate from total signups, while site traffic remains reviewable in GA4. The seven already scheduled broadcasts were left unchanged and are **not guaranteed** to have attribution tags. Do not call site totals email-attributed purchases. Details: [EMAIL_REPORTING.md](./EMAIL_REPORTING.md).

## Email-associated paid conversion tracking added (November 10, 2026)

Seven-day, same-browser email UTM attribution now travels from public pages through both Shop and Club checkout creation. Supabase stores only a sanitized campaign and Stripe Checkout Session ID, never email addresses or resource tokens. The service-role-only ledger records after a real session is attached. Owner-only `/admin/email` reports paid live shop orders, calendar-paid orders, shop net revenue after refunds, and completed live Club enrollments, broken down by email campaign. Club trial enrollment is **not** paid subscription revenue. Attribution indicates association after a tagged visit, not marketing causation. The two Edge Functions were deployed and safe-smoke-tested; the RLS and live reporting RPC were verified. A real tagged live purchase and the deployed admin browser view still require acceptance testing. The seven scheduled broadcasts remain untouched. Detailed design and test limitations: [EMAIL_CHECKOUT_ATTRIBUTION.md](./EMAIL_CHECKOUT_ATTRIBUTION.md).

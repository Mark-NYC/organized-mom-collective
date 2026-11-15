# Our Week, the website and Family Meeting Club: names and boundaries

Status: owner decision 2026-11-15. **Internal documentation.** Customer-facing website copy is unchanged until the
release plan is approved; nothing here is a claim that the app is available.

| Name | What it is | Price | Where |
| --- | --- | --- | --- |
| **Organized Mom Collective** | The parent brand and its website: articles, free tools, the shop, the wall calendar's product page, the cleaning companion website | — | organizedmomcollective.com |
| **Our Week** | The free family planning **app** and the main entry point into Organized Mom Collective: shared calendar, the complete cleaning companion, the weekly Family Meeting, family responsibilities and agreements, two adult accounts per household | Free | iPhone app (Capacitor; `ios/`, `npm run build:app`) |
| **The wall calendar** | The printed 11 × 17 weekly family calendar | Paid (physical) | Shop / Etsy |
| **Family Meeting Club** | The premium membership: personalized monthly Family Focus resources, the Welcome Kit, printed monthly mailings, for the whole household | Paid (membership) | Joined and billed on the website |

## Rules

- **App vs website.** "Our Week" names the iPhone app only. The cleaning companion **website** (`/app` on the website,
  the printed calendar's QR) stays "the cleaning companion" / "website" in website copy, as CLAUDE.md says, until the
  release plan changes it. Don't call the website "Our Week" or the app "the website".
- **Free means free.** In Our Week nothing asks for payment, a Club membership or a calendar purchase to use the
  calendar, cleaning, the weekly meeting, responsibilities or the second adult.
- **No purchasing in the app** until a compliant App Store approach is decided (owner, 2026-11-15): no in-app Club
  purchase, upgrade or "join" buttons, no links to checkout, the Club offer or billing. Enforced by
  `scripts/app-shell-smoke.mjs` (fails on any such link or wording on a bundled page) and by the app's link rules
  (`src/data/app/shell-routes.json`: the Club's sales page opens Club Home, its account & billing page opens the app's
  Account). Members see their Club content in the app; they join and manage billing on the website.
- **One Family Meeting.** Four parts, ten minutes (`src/data/club/meeting-guide.ts`). Our Week's free weekly meeting
  uses the guide as is; the Club adds the personalized monthly Family Focus.
- **The parent brand stays.** Our Week is "from Organized Mom Collective"; the brand promise, voice and philosophy
  (VISION.md, BRAND_VOICE.md) apply to the app unchanged.

## Open before launch copy

- How the website introduces Our Week (and whether the companion website points to it).
- App Store name, subtitle and listing (Our Week by Organized Mom Collective?).
- The App Store purchase approach for the Club.

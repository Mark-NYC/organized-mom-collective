# Getting Organized Family onto an iPhone (TestFlight)

What's done in code, what only the owner can do, in order. Nothing here publishes to the App Store.

## Done in the repository

| Item | Where |
| --- | --- |
| Display name **Organized Family** | `ios/App/App/Info.plist` (`CFBundleDisplayName`), `capacitor.config.ts` |
| App icon and launch screen: the real Organized Mom Collective seal from `public/icons/` (no invented art) | `ios/App/App/Assets.xcassets/` |
| Privacy manifest: no tracking; email, name and family content, linked, app functionality only; UserDefaults reason CA92.1 | `ios/App/App/PrivacyInfo.xcprivacy` |
| No export-compliance question per build (`ITSAppUsesNonExemptEncryption` = false: HTTPS only) | `Info.plist` |
| iPhone only (iPad can be added later; it can't be removed once shipped) | `project.pbxproj` (`TARGETED_DEVICE_FAMILY = 1`) |
| Signed archive + TestFlight upload, started by hand | `.github/workflows/ios-testflight.yml`, `ios/ExportOptions.plist` |
| Simulator checks: one round per push, five for a release | `.github/workflows/ios-app.yml` (Run workflow → rounds 5, or a `release-*` tag) |

**Not verified:** the signed upload has never run (it needs the Apple secrets below). The archive is made unsigned and
signed on export with the API key, so no registered device or certificate is needed; expect at most one fix on the
first signed run. The icon is the 512px seal enlarged to 1024px: fine for TestFlight; supply a
1024px master (or an Organized Family icon) before the App Store listing.

## Check first (no Apple account needed)

Actions → **iPhone app: TestFlight** → Run workflow → branch `claude/stoic-albattani-esdhkp` (or `main` once merged) →
tick **Check only**. It builds the real Release archive with the newest Xcode on the runner and prints its bundle id,
version and SDK. Green means the only things left are Apple's.

## Owner, once

1. Apple Developer Program membership (organization or individual).
2. developer.apple.com → Identifiers → register `com.organizedmomcollective.app`.
3. App Store Connect → Apps → New App: iOS, name "Organized Family", that bundle id.
4. App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key with role **Admin**;
   download the `.p8` once.
5. GitHub → repository Settings → Secrets and variables → Actions: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`,
   `ASC_KEY_P8` (paste the whole file).
6. App Store Connect → TestFlight → Internal Testing: add yourself as a tester.

## Each build

1. Done 2026-11-17: every migration the app's family features need is live (sessions A, B, C, E); the app talks to
   production.
2. Actions → **iPhone app** → Run workflow → rounds 5 (release verification). Green.
3. Actions → **iPhone app: TestFlight** → Run workflow. About 20 minutes, then Apple processes the build.
4. Open TestFlight on the iPhone and install.

## Still owed before the App Store (not needed for TestFlight)

Privacy policy published with the 90-day recovery paragraph, App Privacy answers matching `PrivacyInfo.xcprivacy`,
screenshots, support URL, account-deletion path shown to review (it is in the app: Account → Delete account).

/**
 * Family Meeting Club by invitation (public App Store launch, owner decision 2026-11-20; docs/ios/APP_STORE_LAUNCH.md).
 * The iPhone app sells nothing and links to no checkout: where a free family meets a Club feature, it says this,
 * plainly, and points back into the app. The website keeps its own offer and billing.
 */
export const CLUB_INVITATION = 'Family Meeting Club is currently available by invitation.';

/** What stays free for everyone (docs/ios/ACCESS_MODEL_ASSESSMENT.md, owner decisions 2026-11-15). */
export const FREE_FOR_EVERYONE = 'The calendar, the cleaning companion, the weekly Family Meeting and shared responsibilities are free for everyone.';

/** A Club month or resource a free family tries to open in the app. */
export const CLUB_INVITATION_GATE = (what: string): [string, string] => [
  `${what} is part of Family Meeting Club`,
  `${CLUB_INVITATION} ${FREE_FOR_EVERYONE}`,
];

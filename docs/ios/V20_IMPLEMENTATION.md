# Organized Family V20 production implementation

The approved baseline is V20_BASELINE.md. Main before integration is 55b7693. The live /app used TodayDashboard at audit. Preview checks exercise fictional data and simulated phones.

## Foundation

- [x] Inspected active production schema and the account, household, calendar, cleaning, Club, development and meeting paths. At preflight: 11 households, 23 members, 11 subscriptions, 12 entitlements. Migration history ended at 20261212000000.
- [x] Requested a new production backup. The backup job in GitHub Actions run 45895975974 completed successfully, including restore verification.
- [x] Bind private feed cache reads, offline reads and pending responses to the signed-in adult, household and audience. Legacy caches without an adult identity are ignored. Three regression cases passed.
- [x] Implement shared meeting checkpoints on the existing Today and guided Family Meeting routes. Scope each RPC to the signed-in household, compare revisions, retry queued operations and preserve pre-existing device progress. The additive table stores only timestamps and a step number. Offline and concurrent devices still require browser verification.
- [ ] Wire the locked views to the existing auth, onboarding, invitation, member-color, calendar, cleaning, agreement, development, Club entitlement, resource and billing services. Production identities must come from household membership. The preview constructs fictional events inside eventsFor and titleOf as well as in the top-level seed.
- [ ] Verify universal calendar access. The existing feed, Google and event-task global switches were all off at preflight. Enable for all households only with the functional launch.
- [ ] Verify empty, loading, error, offline, and account transitions. Replace /app after verification.

## Intelligence

- [ ] Connect V18 classification and V19 attention ranking to the recipient's real, permitted data. Compute shared meeting snapshots from shared calendars. Persist feedback, memory, history, presentation, claims, timing and reports. Verify one prominent insight and explicit family decisions.
- [ ] Benchmark candidate interpreters on minimized, synthetic cases before any provider selection or household traffic. No provider selected.

## Notifications

- [ ] Implement adult-specific registered devices, durable delivery and deduplication, preference and quiet-hour enforcement, and authenticated responses. Test opt-in meeting reminders. Require delivery on an installed PWA and physical iPhone for signoff.

## Verification and recovery

- Existing unit suite and private-calendar tests: 1,673 passed, 107 skipped. Type checking and production build must pass at the final revision.
- Meeting RPC tested in isolated PostgreSQL with two adults sharing a household, another household, anonymous access, stale revisions, duplicate delivery and a delayed edit after completion.
- [ ] Verify two actual sessions, account registration/deletion, calendar OAuth and permissions, activity planning, cleaning, agreements, Club and billing, Safari, offline replay, iOS, device notifications and mobile/desktop visual comparison.
- [ ] Confirm deployed version from the production app and verify authenticated journeys there.
- App rollback: redeploy the preceding known-good Pages deployment. The prior app can ignore the additive checkpoint table. Retain the table when rolling back clients so family progress can be recovered. Encrypted database restore procedure is in docs/operations/DATABASE_BACKUPS.md.

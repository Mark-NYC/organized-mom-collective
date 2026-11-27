-- V20 launch (docs/ios/V20_LAUNCH.md): calendar links (iCal) and event responsibilities for every household.
-- Google Calendar stays on its own switch (off) until Google's OAuth verification (docs/calendar/GOOGLE_CALENDAR.md).
-- Rollback: update public.calendar_feed_rollout set everyone = false, event_tasks_everyone = false where id;
update public.calendar_feed_rollout set everyone = true, event_tasks_everyone = true, updated_at = now() where id;

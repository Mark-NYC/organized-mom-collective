/**
 * /app (Today): the date, today's cleaning zone and this month's Club plan, worked out on the device.
 * The page is static, so anything date-based has to be rendered here, not at build time (before Nov 2026 the
 * page baked the build day's date and zone into the HTML). Refreshes when the day rolls over or the app returns
 * to the foreground (useToday listens to focus; the app's resume also fires focus).
 */
import { useEffect, useState } from 'react';
import { useToday } from '../../lib/hooks';
import { getSession } from '../../lib/account';
import { accountStore } from '../../lib/club/store';
import { planFor } from '../../lib/schedule';
import { visibleFeatures } from '../../data/app/features';
import { isDemo, useCalendar } from '../../lib/calendar/client';
import { localToday, occurrences, timeLabel } from '../../lib/calendar/recurrence';
import { routes } from '../../routes';
import { monthAgreements, monthOf, weekAhead } from '../../lib/family-meeting-support';
import AgreedParts from '../family/AgreedParts';
import { useFamilyProfile } from '../../lib/family-meeting-client';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const title = (s: string) => s[0].toUpperCase() + s.slice(1);

export function TodayDate() {
  const today = useToday();
  return <>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today).toUpperCase()}</>;
}

export function TodayZone() {
  const plan = planFor(useToday());
  const zone = plan.kind === 'weekday' ? plan.focus.zone : plan.day.zone;
  const minutes = plan.kind === 'weekday' ? plan.focus.minutes : 'Optional';
  return (
    <div className="flex items-start justify-between gap-3" data-today-zone={zone}>
      <h2 className="family-panel-title">{zone}</h2>
      <span className="family-preview-pill shrink-0">{minutes}</span>
    </div>
  );
}

/**
 * Family Meeting Club cards are for households that have the Club, on the website and in the app (owner decision
 * 2026-11-17): a free family never sees a membership card it can't open, an upgrade or a price. Selling the Club stays
 * on the public /club page. Remembered for the visit so the card doesn't flicker in on every screen.
 */
const CLUB_SEEN = 'omc:app:club-access';
export function useShowsClub(): boolean {
  const [has, setHas] = useState(() => { try { return sessionStorage.getItem(CLUB_SEEN) === '1'; } catch { return false; } });
  useEffect(() => {
    void getSession().then(async (s) => {
      const access = s ? Boolean((await accountStore.me().catch(() => null))?.access) : false;
      setHas(access);
      try { sessionStorage.setItem(CLUB_SEEN, access ? '1' : '0'); } catch { /* this screen only */ }
    });
  }, []);
  return has;
}

export function ClubThisMonth() {
  const month = MONTHS[useToday().getMonth()];
  const club = visibleFeatures().find((f) => f.id === 'club');
  const shows = useShowsClub();
  if (!club || !shows) return null;
  return (
    <a href={`/app/club/${month}`} className="family-panel block transition-colors hover:bg-[#f8f8f6]" data-club-month={month}>
      <p className="label text-[#71866c]">FAMILY MEETING CLUB · {month.toUpperCase()}</p>
      <h2 className="family-panel-title mt-4">{title(month)}’s family plan</h2>
      <p className="mt-2 text-sm leading-relaxed text-warm-soft">One shared plan for the month, with a part for everyone.</p>
      <span className="family-link mt-5">Open {title(month)} →</span>
    </a>
  );
}

/**
 * Today's plans from the family calendar, in each person's color (iPhone app), then what supports the family's weekly
 * Family Meeting (src/lib/family-meeting-support.ts): the next seven days with what's new or changed, and everyone's
 * part as this month's meeting lists it. Reads the calendar saved on this phone, so it shows even offline.
 */
export function TodayPlans() {
  const today = useToday();
  const cal = useCalendar();
  const profile = useFamilyProfile(cal.state.scope !== 'local' ? cal.state.scope : null);
  const date = localToday(today);
  const events = Object.values(cal.state.events);
  const list = occurrences(events, date, date);
  const name = (id?: string | null) => (id ? cal.household?.members.find((m) => m.id === id)?.firstName : undefined);
  const color = (id?: string | null) => cal.colors[id ?? '']?.hex ?? '#9aab8f';
  const week = weekAhead(events, date, today);
  const agreed = monthAgreements(cal.household, profile, monthOf(today));
  const meetingHref = agreed ? `${agreed.route}?view=meeting` : null;
  return (
    <div className="space-y-9">
      {isDemo() && (
        <div className="family-note" data-today-demo><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm">A made-up family, to show how Today looks. Nothing here is shared or synced. <a href="/app" className="underline">Leave the demo</a>.</p></div>
      )}
      <section className="family-panel" aria-labelledby="today-plans-h" data-today-plans>
        <div className="flex items-baseline justify-between gap-3">
          <p id="today-plans-h" className="label text-[#71866c]">TODAY’S PLANS</p>
          <a href={routes.familyCalendar} className="family-link !min-h-0">Week →</a>
        </div>
        {list.length ? (
          <ul className="mt-3 space-y-2.5">
            {list.map((o) => (
              <li key={o.event.id} className="flex items-stretch gap-3">
                <span aria-hidden="true" className="w-[4px] shrink-0" style={{ background: color(o.event.member_ids[0] ?? o.event.owner_member_id) }} />
                <span><span className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">{o.continued ? 'Continues' : timeLabel(o.event)}</span>
                  <span className="font-semibold">{o.event.title}</span>{name(o.event.owner_member_id) && <span className="text-sm text-warm-soft"> · {name(o.event.owner_member_id)} handles it</span>}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-warm-soft">Nothing on the family calendar today.</p>}
      </section>

      {week.count > 0 && (
        <section className="family-panel" aria-labelledby="meeting-week-h" data-meeting-week>
          <p id="meeting-week-h" className="label text-[#71866c]">FOR YOUR FAMILY MEETING · NEXT 7 DAYS</p>
          <h2 className="family-panel-title mt-4">{week.count === 1 ? 'One plan' : `${week.count} plans`} on the family calendar.</h2>
          <p className="mt-2 text-sm leading-relaxed text-warm-soft">
            {[
              week.changes.length ? `${week.changes.length} new or changed this week` : null,
              week.unhandled ? `${week.unhandled} nobody has said they’ll handle yet` : null,
            ].filter(Boolean).join(' · ') || 'Ready to look at together whenever you meet.'}
          </p>
          {week.changes.length > 0 && (
            <ul className="mt-3 space-y-1.5" data-meeting-changes>
              {week.changes.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-baseline gap-2 text-[0.92rem]"><span className="cal-change" data-change={c.change}>{c.change === 'new' ? 'New' : 'Changed'}</span>{c.title}</li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <a href={routes.familyCalendar} className="family-link">See the week →</a>
            {meetingHref && <a href={meetingHref} className="family-link" data-open-meeting>This month’s Family Meeting →</a>}
          </div>
        </section>
      )}

      {agreed && (
        <section className="family-panel" aria-labelledby="everyones-part-h" data-everyones-part>
          <p id="everyones-part-h" className="label text-[#71866c]">EVERYONE’S PART · {MONTHS[today.getMonth()].toUpperCase()}</p>
          {agreed.people.length ? (
            <>
              <AgreedParts people={agreed.people} colors={cal.colors} />
              <p className="mt-4 text-[0.8rem] text-warm-soft">Agreed in your Family Meeting.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-warm-soft" data-no-agreements>Nothing agreed yet this month. In your Family Meeting, tap “We agreed” when someone takes a part.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
            <a href={meetingHref!} className="family-link">This month’s Family Meeting →</a>
            <a href="/app/family/responsibilities" className="family-link">Who does what →</a>
          </div>
        </section>
      )}
    </div>
  );
}

/** The Family tab's Club card: only for a household that has the Club (useShowsClub). */
export function ClubFamilyCard() {
  if (!useShowsClub()) return null;
  return (
    <a href="/app/club" className="family-panel block transition-colors hover:bg-[#f8f8f6]" data-family-club-card>
      <p className="label text-[#71866c]">FAMILY MEETING CLUB</p>
      <h2 className="family-panel-title mt-4">Your membership and monthly resources.</h2>
      <p className="mt-2 text-sm leading-relaxed text-warm-soft">Each month’s Family Focus and its prepared meeting page.</p>
      <span className="family-link mt-5">Open the Club →</span>
    </a>
  );
}

/**
 * Club Home's tiles that connect the Club to the family's actual week and membership (docs/ios/CLUB_INTEGRATION.md).
 * Everything comes from data the app already has: the shared calendar (this phone's copy, so it works offline), the
 * family profile's agreements, and `club_me` (src/lib/club/membership.ts). Nothing new is stored or synced.
 */
import { useCalendar } from '../../lib/calendar/client';
import { useFamilyProfile } from '../../lib/family-meeting-client';
import { localToday } from '../../lib/calendar/recurrence';
import { monthAgreements, monthOf, weekAhead } from '../../lib/family-meeting-support';
import { shortDate, type Membership } from '../../lib/club/membership';
import { routes } from '../../routes';
import { Avatar, Chevron, TileHead } from '../app/ui';

const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/**
 * This week's meeting, connected: what's on the family calendar worth talking over (new or changed, or nobody has said
 * they'll handle it) and what the family already agreed this month. Suggestions to talk about, never assignments.
 */
export function MeetingConnect({ meetingHref }: { meetingHref: string }) {
  const cal = useCalendar();
  const profile = useFamilyProfile(cal.state.scope !== 'local' ? cal.state.scope : null);
  const today = new Date();
  const week = weekAhead(Object.values(cal.state.events), localToday(today), today);
  const agreed = monthAgreements(cal.household, profile, monthOf(today));
  const changed = new Map(week.changes.map((c) => [c.id, c.change]));
  const items = week.days.flatMap((d) => d.items.map((i) => ({ ...i, day: d.date })))
    .filter((i) => !i.ownerId || changed.has(i.id))
    .filter((i, n, all) => all.findIndex((x) => x.id === i.id) === n)
    .slice(0, 4);
  if (!items.length && !agreed?.people.length) return null;
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2" data-meeting-connect>
      {items.length > 0 && (
        <div className="rounded-[9px] bg-white/80 p-4" data-meeting-talk>
          <p className="of-eyebrow">Worth talking about · next 7 days</p>
          <ul className="mt-2 space-y-1.5 text-[0.9rem]">
            {items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-2">
                <span className="w-9 shrink-0 text-[0.75rem] font-semibold text-warm-soft">{dayName(i.day)}</span>
                <span className="min-w-0"><span className="font-semibold">{i.title}</span>
                  <span className="text-warm-soft"> · {!i.ownerId ? 'nobody handling it yet' : changed.get(i.id) === 'new' ? 'new' : 'changed'}</span></span>
              </li>
            ))}
          </ul>
          <a href={routes.familyCalendar} className="of-tile-action mt-1">See the week <Chevron /></a>
        </div>
      )}
      {agreed && agreed.people.length > 0 && (
        <div className="rounded-[9px] bg-white/80 p-4" data-meeting-agreed>
          <p className="of-eyebrow">Already agreed this month</p>
          <ul className="mt-2 space-y-2">
            {agreed.people.slice(0, 4).map((p) => (
              <li key={p.memberId} className="flex items-center gap-2.5 text-[0.9rem]"><Avatar name={p.name} color={cal.colors[p.memberId]} size="sm" /><span className="min-w-0"><span className="font-semibold">{p.name}</span><span className="text-warm-soft"> · {p.parts.map((x) => x.text).join('; ')}</span></span></li>
            ))}
          </ul>
          <a href={meetingHref} className="of-tile-action mt-1">Check in on them <Chevron /></a>
        </div>
      )}
    </div>
  );
}

const fmt = (iso: string | null | undefined) => (iso && Number.isFinite(Date.parse(iso)) ? shortDate(iso) : null);

/**
 * The membership, in plain words: what kind, when it renews or ends, the next month and its printed-copy cutoff, the
 * months she holds. Billing and the mailing address are the paying owner's and the website's: the other adult sees
 * the household's access only, and the iPhone app never links to billing.
 */
export function MembershipTile({ me }: { me: Membership }) {
  const partner = (me as Membership & { household_role?: string }).household_role === 'partner';
  const app = import.meta.env.PUBLIC_APP_SHELL === 'ios';
  const held = me.months.filter((m) => m.state === 'available').length;
  const status = partner ? 'Shared through your household'
    : me.payment_problem ? 'Your last payment didn’t go through'
    : me.status === 'trialing' ? 'Free first month'
    : me.ends ? `Ends ${fmt(me.ends) ?? 'soon'}`
    : me.member ? 'Member'
    : me.grant ? 'Complimentary access'
    : 'Membership';
  const lines = [
    !partner && me.renews && !me.ends ? `Renews ${fmt(me.renews)}` : null,
    me.ends && !partner ? 'Your months stay yours after it ends.' : null,
    me.next?.payment_on ? `${me.next.title ?? 'Next month'} opens ${fmt(me.next.payment_on)}` : null,
    me.next?.regular_cutoff_at ? `Printed copy: approve by ${fmt(me.next.regular_cutoff_at)}` : null,
  ].filter(Boolean) as string[];
  return (
    <section className={`of-tile ${me.payment_problem && !partner ? 'of-tile--month' : ''}`} aria-labelledby="club-membership-h" data-club-membership data-membership-status={partner ? 'partner' : me.status ?? (me.grant ? 'grant' : 'none')}>
      <TileHead eyebrow="Our membership" title={<span id="club-membership-h">{status}</span>} />
      {lines.length > 0 && <ul className="mt-2 space-y-1 text-[0.9rem] text-warm-soft">{lines.map((l) => <li key={l}>{l}</li>)}</ul>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={routes.appClubMonths} className="rounded-[9px] border border-[var(--of-rule)] px-3 py-2.5">
          <span className="block font-serif text-[1.5rem] leading-none tabular-nums">{held}</span>
          <span className="mt-1 block text-[0.75rem] font-semibold text-warm-soft">{held === 1 ? 'monthly resource' : 'monthly resources'} yours</span>
        </a>
        <a href={routes.clubMeetingGuide} className="rounded-[9px] border border-[var(--of-rule)] px-3 py-2.5">
          <span className="block font-serif text-[1.05rem] leading-tight">Meeting Guide</span>
          <span className="mt-1 block text-[0.75rem] font-semibold text-warm-soft">How every meeting works</span>
        </a>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5">
        {/* Billing is the payer's, on the website only (docs/brand/OUR_WEEK.md: nothing is bought in the app). */}
        {!partner && !app && <a href={routes.clubDashboard} className="of-tile-action">Account &amp; Billing <Chevron /></a>}
        <a href={routes.appAccount} className="of-tile-action">Account <Chevron /></a>
      </div>
    </section>
  );
}

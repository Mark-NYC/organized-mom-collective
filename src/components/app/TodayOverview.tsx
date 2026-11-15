/**
 * /app (Today): the date, today's cleaning zone and this month's Club plan, worked out on the device.
 * The page is static, so anything date-based has to be rendered here, not at build time (before Nov 2026 the
 * page baked the build day's date and zone into the HTML). Refreshes when the day rolls over or the app returns
 * to the foreground (useToday listens to focus; the app's resume also fires focus).
 */
import { useToday } from '../../lib/hooks';
import { planFor } from '../../lib/schedule';
import { visibleFeatures } from '../../data/app/features';
import { useCalendar } from '../../lib/calendar/client';
import { localToday, occurrences, timeLabel } from '../../lib/calendar/recurrence';
import { routes } from '../../routes';

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

export function ClubThisMonth() {
  const month = MONTHS[useToday().getMonth()];
  const club = visibleFeatures().find((f) => f.id === 'club');
  if (!club) return null;
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
 * Today's plans from the family calendar, in each person's color, and the way into Sunday Setup (iPhone app).
 * Reads the calendar saved on this phone (src/lib/calendar/client.ts), so it shows even offline.
 */
export function TodayPlans() {
  const today = useToday();
  const cal = useCalendar();
  const date = localToday(today);
  const list = occurrences(Object.values(cal.state.events), date, date);
  const name = (id?: string | null) => (id ? cal.household?.members.find((m) => m.id === id)?.firstName : undefined);
  return (
    <section className="family-panel" aria-labelledby="today-plans-h" data-today-plans>
      <div className="flex items-baseline justify-between gap-3">
        <p id="today-plans-h" className="label text-[#71866c]">TODAY’S PLANS</p>
        <a href={routes.familyCalendar} className="family-link !min-h-0">Week →</a>
      </div>
      {list.length ? (
        <ul className="mt-3 space-y-2.5">
          {list.map((o) => (
            <li key={o.event.id} className="flex items-stretch gap-3">
              <span aria-hidden="true" className="w-[4px] shrink-0" style={{ background: cal.colors[o.event.member_ids[0] ?? o.event.owner_member_id ?? '']?.hex ?? '#9aab8f' }} />
              <span><span className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">{o.continued ? 'Continues' : timeLabel(o.event)}</span>
                <span className="font-semibold">{o.event.title}</span>{name(o.event.owner_member_id) && <span className="text-sm text-warm-soft"> · {name(o.event.owner_member_id)} handles it</span>}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-warm-soft">Nothing on the family calendar today.</p>}
    </section>
  );
}

export function SundaySetupCard() {
  const sunday = useToday().getDay() === 0;
  return (
    <a href={routes.sundaySetup} className="family-panel block transition-colors hover:bg-[#f8f8f6]" data-sunday-card>
      <p className="label text-[#71866c]">SUNDAY SETUP</p>
      <h2 className="family-panel-title mt-4">{sunday ? 'Ten minutes for the week ahead.' : 'Set up the week together.'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-warm-soft">Who’s handling what, dinners and cleaning help, then copy it to the wall calendar.</p>
      <span className="family-link mt-5">Start Sunday Setup →</span>
    </a>
  );
}

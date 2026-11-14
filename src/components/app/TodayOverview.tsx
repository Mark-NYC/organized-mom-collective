/**
 * /app (Today): the date, today's cleaning zone and this month's Club plan, worked out on the device.
 * The page is static, so anything date-based has to be rendered here, not at build time (before Nov 2026 the
 * page baked the build day's date and zone into the HTML). Refreshes when the day rolls over or the app returns
 * to the foreground (useToday listens to focus; the app's resume also fires focus).
 */
import { useToday } from '../../lib/hooks';
import { planFor } from '../../lib/schedule';
import { visibleFeatures } from '../../data/app/features';

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

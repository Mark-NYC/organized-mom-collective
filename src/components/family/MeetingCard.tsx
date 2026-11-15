/**
 * The Family tab's primary card: this month's Family Meeting. The four parts and their minutes come from the standard
 * guide (src/data/club/meeting-guide.ts), never retyped; the month is worked out on the device (the page is static).
 */
import { useToday } from '../../lib/hooks';
import { MEETING_GUIDE } from '../../data/club/meeting-guide';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export default function MeetingCard() {
  const month = MONTHS[useToday().getMonth()];
  const name = month[0].toUpperCase() + month.slice(1);
  return (
    <section className="family-feature" aria-labelledby="our-meeting-h" data-our-meeting>
      <p className="label text-[#5c7357]">OUR FAMILY MEETING · {month.toUpperCase()}</p>
      <h2 id="our-meeting-h" className="family-panel-title mt-4">{MEETING_GUIDE.subtitle}</h2>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2" data-meeting-parts>
        {MEETING_GUIDE.parts.map((p, i) => (
          <li key={p.title} className="flex items-center gap-3 text-[0.95rem]">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[0.8rem] font-semibold">{i + 1}</span>
            <span className="font-semibold">{p.title}</span><span className="text-sm text-warm-soft">{p.minutes} min</span>
          </li>
        ))}
      </ol>
      <a href={`/app/club/${month}?view=meeting`} className="family-action mt-6" data-open-meeting>Open {name}’s Family Meeting <span aria-hidden="true" className="ml-2">→</span></a>
      <a href="/club/family-meeting-guide" className="family-link mt-4 block">How our meeting works →</a>
    </section>
  );
}

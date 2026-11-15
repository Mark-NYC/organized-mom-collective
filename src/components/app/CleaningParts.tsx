/**
 * Below the cleaning companion in the iPhone app: who already takes care of cleaning and laundry, or agreed to, from the
 * family profile the Family Meeting uses (src/lib/family-meeting-support.ts → cleaningParts). Reads only; shows nothing
 * without a household or without cleaning parts.
 */
import { useCalendar } from '../../lib/calendar/client';
import { useFamilyProfile } from '../../lib/family-meeting-client';
import { cleaningParts } from '../../lib/family-meeting-support';

export default function CleaningParts() {
  const cal = useCalendar();
  const profile = useFamilyProfile(cal.state.scope !== 'local' ? cal.state.scope : null);
  const people = cleaningParts(cal.household, profile);
  if (!people.length) return null;
  return (
    <section className="mt-10 border-t border-warm-rule pt-6" aria-labelledby="cleaning-parts-h" data-cleaning-parts>
      <p id="cleaning-parts-h" className="label text-[#71866c]">EVERYONE’S PART IN CLEANING</p>
      <ul className="mt-3 space-y-3">
        {people.map((p) => (
          <li key={p.memberId} data-part-person={p.name}>
            <p className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: cal.colors[p.memberId]?.hex ?? '#9aab8f' }} />{p.name}</p>
            <ul className="mt-0.5 pl-[18px] text-[0.92rem] text-warm-soft">{p.parts.map((x) => <li key={x.text}>{x.text}</li>)}</ul>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.8rem] text-warm-soft">From your family profile. Change who does what at your next Family Meeting.</p>
    </section>
  );
}

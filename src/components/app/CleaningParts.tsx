/**
 * Below the cleaning companion in the iPhone app: the cleaning and laundry parts the family agreed in its Family
 * Meeting (src/lib/family-meeting-support.ts → cleaningAgreements). Agreements only, never suggestions; nothing shows
 * without a household or without such an agreement.
 */
import { useCalendar } from '../../lib/calendar/client';
import { useFamilyProfile } from '../../lib/family-meeting-client';
import { cleaningAgreements } from '../../lib/family-meeting-support';
import AgreedParts from '../family/AgreedParts';

export default function CleaningParts() {
  const cal = useCalendar();
  const profile = useFamilyProfile(cal.state.scope !== 'local' ? cal.state.scope : null);
  const people = cleaningAgreements(cal.household, profile);
  if (!people.length) return null;
  return (
    <section className="of-tile mt-4" aria-labelledby="cleaning-parts-h" data-cleaning-parts>
      <p id="cleaning-parts-h" className="of-eyebrow">Everyone’s part in cleaning</p>
      <AgreedParts people={people} colors={cal.colors} compact />
      <p className="mt-3 text-[0.8rem] text-warm-soft">Agreed in your Family Meeting. <a href="/app/family/responsibilities" className="underline underline-offset-4">Change who does what</a></p>
    </section>
  );
}

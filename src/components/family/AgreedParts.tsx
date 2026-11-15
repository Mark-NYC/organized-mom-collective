/**
 * What the family agreed ("We agreed" in the Family Meeting's Everyone's Part), by person, in each person's color from
 * the one household profile. Read-only; shared by Today, the calendar and the cleaning companion. Only confirmed
 * agreements reach it (src/lib/family-meeting-support.ts), never suggestions or what was already done.
 */
import type { MarkerColor } from '../../data/club/family-colors';
import type { PersonAgreements } from '../../lib/family-meeting-support';

export default function AgreedParts({ people, colors, compact = false }: { people: PersonAgreements[]; colors: Record<string, MarkerColor>; compact?: boolean }) {
  return (
    <ul className={compact ? 'mt-3 space-y-2.5' : 'mt-4 space-y-4'} data-agreed-parts>
      {people.map((p) => (
        <li key={p.memberId} data-part-person={p.name}>
          <p className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colors[p.memberId]?.hex ?? '#9aab8f' }} />{p.name}</p>
          <ul className="mt-0.5 space-y-0.5 pl-[18px] text-[0.92rem] text-warm-soft">
            {p.parts.map((x) => <li key={x.id} data-agreement={x.id}>{x.text}{x.when && <span className="text-[0.8rem]"> · {x.when}</span>}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}

import { useEffect, useState } from 'react';
import { appPreviewFamily } from '../lib/app-family';
import { ageInMonth, monthOf, type Household } from '../lib/club/profile';
export default function FamilySummary() {
  const [family,setFamily] = useState<Household | null>(null);
  useEffect(() => { appPreviewFamily().then(setFamily).catch(() => setFamily(null)); },[]);
  if (!family) return <p className="text-warm-soft">Family preview unavailable.</p>;
  const month=monthOf(new Date());
  return <section className="family-panel mt-6">
    <p className="label">FAMILY PROFILE · SAMPLE ONLY</p>
    <h2 className="family-panel-title mt-4">{family.displayName ?? 'Our family'}</h2>
    <ul className="mt-5 divide-y divide-warm-rule">{family.members.filter(m=>!m.archived).map(m=><li key={m.id} className="flex min-h-14 items-center justify-between gap-3 py-3"><span className="font-semibold">{m.firstName}</span><span className="text-sm text-warm-soft">{m.kind === 'child' ? 'Child · '+ageInMonth(m.birthYear!,m.birthMonth,month)+' years' : 'Adult'}</span></li>)}</ul>
    <p className="mt-4 text-xs text-warm-soft">Read from the existing Club sample store. This is not your personal account.</p>
  </section>;
}
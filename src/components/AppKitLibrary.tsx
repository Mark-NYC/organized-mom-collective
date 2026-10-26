import { useEffect, useState } from 'react';
import { appPreviewStore } from '../lib/app-family';
import { kitBySlug } from '../data/club/kits';
import { monthLabel } from '../data/club/labels';
import type { ClubMe } from '../lib/club/store';
export default function AppKitLibrary() {
  const [me,setMe] = useState<ClubMe | null>(null);
  useEffect(() => { appPreviewStore()?.me().then(setMe).catch(() => setMe(null)); },[]);
  if (!me) return <p role="status" className="mt-6 text-sm text-warm-soft">Loading preview library…</p>;
  return <div className="mt-5 grid gap-3 sm:grid-cols-2">{me.kits.map(({slug})=>{
    const k=kitBySlug(slug);
    if(!k) return null;
    return <article key={slug} className="rounded-2xl border border-warm-rule bg-white p-5"><p className="label text-[#71866c]">{monthLabel(k.month)}</p><h3 className="mt-2 font-serif text-[1.25rem] leading-snug">{k.theme}</h3><p className="mt-2 text-sm text-warm-soft">{k.shift}</p><span className="mt-4 inline-block text-xs font-semibold text-[#71866c]">PREVIEW ONLY</span></article>;
  })}</div>;
}
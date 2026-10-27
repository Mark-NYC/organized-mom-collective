import { useEffect, useState } from 'react';
import { appPreviewStore } from '../lib/app-family';
import { kitBySlug } from '../data/club/kits';
import { monthLabel } from '../data/club/labels';
import type { ClubMe } from '../lib/club/store';
export default function AppKitLibrary() {
  const [me,setMe] = useState<ClubMe | null>(null);
  useEffect(() => { appPreviewStore()?.me().then(setMe).catch(() => setMe(null)); },[]);
  if (!me) return <p role="status" className="mt-6 text-sm text-warm-soft">Loading preview library…</p>;
  return <div className="family-card-grid mt-6">{me.kits.map(({slug})=>{
    const k=kitBySlug(slug);
    if(!k) return null;
    return <article key={slug} className="family-panel"><p className="label">{monthLabel(k.month)}</p><h3 className="family-panel-title mt-4">{k.theme}</h3><p className="mt-2 text-sm text-warm-soft">{k.shift}</p><span className="label mt-5 inline-block">PREVIEW ONLY</span></article>;
  })}</div>;
}
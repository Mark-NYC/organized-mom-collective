import { useEffect, useState } from 'react';
import { appPreviewStore } from '../lib/app-family';
import { kitBySlug } from '../data/club/kits';
import { monthLabel } from '../data/club/labels';
import type { ClubMe } from '../lib/club/store';
const previewByMonth: Record<string, string> = {
  '2026-11': '/club/worksheet-generator/',
  '2026-12': '/club/december-preview/',
  '2027-01': '/preview/january-habit-cards',
  '2027-02': '/club/february-preview/',
  '2027-03': '/club/march-preview/',
  '2027-04': '/club/april-preview/',
  '2027-05': '/club/may-preview/',
  '2027-06': '/club/june-preview/',
  '2027-07': '/club/july-preview/',
  '2027-08': '/club/august-preview/',
  '2027-09': '/club/september-preview/',
  '2027-10': '/club/october-preview/',
};
export default function AppKitLibrary() {
  const [me,setMe] = useState<ClubMe | null>(null);
  useEffect(() => { appPreviewStore()?.me().then(setMe).catch(() => setMe(null)); },[]);
  if (!me) return <p role="status" className="mt-6 text-sm text-warm-soft">Loading preview library…</p>;
  return <div className="mt-5 grid gap-3 sm:grid-cols-2">{me.kits.map(({slug})=>{
    const k=kitBySlug(slug);
    if(!k) return null;
    return <article key={slug} className="rounded-2xl border border-warm-rule bg-white p-5"><p className="label text-[#71866c]">{monthLabel(k.month)}</p><h3 className="mt-2 font-serif text-[1.25rem] leading-snug">{k.theme}</h3><p className="mt-2 text-sm text-warm-soft">{k.shift}</p>{previewByMonth[k.month] ? <a href={previewByMonth[k.month]} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#536e4e] underline underline-offset-4">Open monthly preview →</a> : <span className="mt-4 inline-block text-xs font-semibold text-[#71866c]">PREVIEW COMING SOON</span>}</article>;
  })}</div>;
}
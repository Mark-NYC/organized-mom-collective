import { useEffect, useState } from 'react';
import { dailyEssentials } from '../data/cleaning';
import { dateKey } from '../lib/dates';
import { useToday } from '../lib/hooks';
import { keys, readList } from '../lib/storage';
import { planFor } from '../lib/schedule';
import { appPreviewFamily } from '../lib/app-family';
export default function HomeStatus() {
  const today = useToday();
  const [revision,setRevision] = useState(0);
  const [name,setName] = useState<string | null>(null);
  useEffect(() => { appPreviewFamily().then(h => setName(h?.displayName ?? null)).catch(() => setName(null)); },[]);
  useEffect(() => {
    const refresh = () => setRevision(n => n + 1);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('pageshow',refresh);
    window.addEventListener('focus',refresh);
    window.addEventListener('storage',refresh);
    document.addEventListener('visibilitychange',onVisible);
    return () => { window.removeEventListener('pageshow',refresh); window.removeEventListener('focus',refresh); window.removeEventListener('storage',refresh); document.removeEventListener('visibilitychange',onVisible); };
  },[]);
  const plan = planFor(today);
  const checkedDaily = new Set(readList(keys.daily(dateKey(today))));
  const zone = plan.kind === 'weekday' ? plan.focus.tasks : [];
  const checkedZone = new Set(readList(keys.focus(dateKey(today))));
  const done = dailyEssentials.tasks.filter(t => checkedDaily.has(t.id)).length + zone.filter(t => checkedZone.has(t.id)).length;
  const total = dailyEssentials.tasks.length + zone.length;
  return <div data-revision={revision} className="space-y-4">
    <p className="text-sm text-warm-soft">{name ? name + ' · Sample family' : 'Family preview'} </p>
    <div className="flex items-end justify-between gap-3"><span className="text-sm font-semibold">{done} of {total} cleaning tasks done today</span><span className="text-xs text-warm-soft">{total ? Math.round(done / total * 100) : 0}%</span></div>
    <div role="progressbar" aria-label="Today's cleaning progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} className="family-progress-track overflow-hidden"><div className="family-progress-fill transition-all" style={{width: (total ? done / total * 100 : 0) + '%'}} /></div>
    <p className="text-sm text-warm-soft">{done === total ? 'You finished your daily routine.' : done ? 'Every checked task counts.' : 'Start with one small task.'}</p>
  </div>;
}
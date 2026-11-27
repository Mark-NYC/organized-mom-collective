import { useEffect, useState } from 'react';
import { accountRpc } from '../../lib/account';
import { localToday, weekStart } from '../../lib/calendar/recurrence';
import { useCalendar } from '../../lib/calendar/client';
import { useCleaningShare, useToday } from '../../lib/hooks';
import { thisDevice } from '../../lib/native/platform';
import { CLEANING_SYNC_EVENT } from '../../lib/cleaning-sync/client';
import { cleaningChecks, decodeRhythm, rhythmChanges, toggleCleaningCheck, type Rhythm, type Settings } from '../../lib/cleaning-sync/rhythm';
import { CleaningView } from '../v16/Cleaning';
import CleaningParts from '../app/CleaningParts';

function readSettings(key: string): Settings {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') ?? {}; } catch { return {}; }
}
function Routine({ scope }: { scope: string | null }) {
  const key = 'omc:household:rhythm:' + (scope ?? 'local');
  const today = localToday(useToday());
  const monday = weekStart(today, 1);
  const [settings, setSettings] = useState(() => readSettings(key));
  const [checks, setChecks] = useState(() => cleaningChecks(monday));
  const [notice, setNotice] = useState('');
  const [writing, setWriting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const rhythm = decodeRhythm(settings, checks);
  function remember(value: Settings) {
    setSettings(value);
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { setNotice('These choices could not be kept on this device.'); }
  }
  useEffect(() => {
    const marks = () => setChecks(cleaningChecks(monday));
    marks();
    window.addEventListener('storage', marks);
    window.addEventListener(CLEANING_SYNC_EVENT, marks);
    return () => { window.removeEventListener('storage', marks); window.removeEventListener(CLEANING_SYNC_EVENT, marks); };
  }, [monday]);
  useEffect(() => {
    if (!scope || writing) return;
    let active = true;
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const value = await accountRpc<Settings>('family_cleaning_rhythm', { p_household: scope });
        if (active) remember(value);
      } catch { /* Cached rhythm and offline marks remain usable. */ }
      finally { busy = false; }
    };
    void load();
    window.addEventListener('online', load);
    window.addEventListener('focus', load);
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('online', load); window.removeEventListener('focus', load); };
  }, [scope, writing, refresh]);
  async function save(patch: Partial<Rhythm>) {
    if (writing) return;
    setWriting(true); setNotice('');
    try {
      let next = { ...settings };
      for (const [field, value] of Object.entries(rhythmChanges(rhythm, patch))) {
        if (scope) next = await accountRpc<Settings>('family_cleaning_rhythm', {
          p_household: scope, p_setting: field, p_value: value, p_expected: settings[field] ?? null,
        });
        else if (value === null) delete next[field]; else next[field] = value;
      }
      remember(next);
    } catch (error) {
      setNotice(String(error).includes('changed_on_another_device') ? 'Another adult changed this rhythm. Check their choice and try again.'
        : 'Your rhythm change could not be shared. Try again when connected.');
    } finally { setWriting(false); setRefresh(n => n + 1); }
  }
  return <>
    <ShareStatus />
    {notice && <p role="status" className="v16-meta">{notice}</p>}
    <div aria-busy={writing} inert={writing}>
      <CleaningView today={today} weekOfToday={monday} ctx={{ look: 'v17', names: {}, colors: {} }}
        c={rhythm} setC={save} toggle={id => {
          if (!toggleCleaningCheck(id)) setNotice('These checks will last for this visit only.');
          setChecks(cleaningChecks(monday));
        }} owners={() => []} back={() => location.assign('/app')} />
    </div>
    <CleaningParts />
  </>;
}
export default function HouseholdCleaning() {
  const cal = useCalendar();
  const scope = cal.state.scope === 'local' ? null : cal.state.scope;
  return <Routine key={scope ?? 'local'} scope={scope} />;
}

/** Whether checkmarks are shared with the household right now (the cleaning companion's one status line). */
function ShareStatus() {
  const share = useCleaningShare();
  if (share.status === 'local') return null;
  return (
    <p className="v16-meta mb-3" role="status" data-cleaning-share={share.status}>
      {share.status === 'shared' ? 'Shared with your family · up to date' : `Saved on ${thisDevice()}${share.waiting ? ` · ${share.waiting} ${share.waiting === 1 ? 'change' : 'changes'} will share when you’re back online` : ' · sharing…'}`}
    </p>
  );
}

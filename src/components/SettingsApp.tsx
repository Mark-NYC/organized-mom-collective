import { useState } from 'react';
import type { ReactNode } from 'react';
import { dateKey, isWeekend, weekendStart } from '../lib/dates';
import { resetAllProgress, resetDay, setOnboarded } from '../lib/storage';
import ConfirmationDialog from './ConfirmationDialog';

export default function SettingsApp() {
  const [confirmAll, setConfirmAll] = useState(false);
  const [status, setStatus] = useState('');

  const replay = () => {
    setOnboarded(false);
    window.location.href = '/';
  };

  const resetToday = () => {
    const now = new Date();
    resetDay(dateKey(now), isWeekend(now) ? dateKey(weekendStart(now)) : undefined);
    setStatus('Today’s checklist has been cleared.');
  };

  const resetAll = () => {
    resetAllProgress();
    setConfirmAll(false);
    setStatus('All cleaning progress has been cleared.');
  };

  return (
    <>
      <ul className="border-t-[3px] border-ink">
        <Row
          title="Replay the introduction"
          detail="See the three welcome screens again."
          action={
            <button type="button" onClick={replay} className="btn-secondary">
              Replay
            </button>
          }
        />
        <Row
          title="Reset today’s checklist"
          detail="Uncheck everything for today. Monthly progress is kept."
          action={
            <button type="button" onClick={resetToday} className="btn-secondary">
              Reset today
            </button>
          }
        />
        <Row
          title="Reset all progress"
          detail="Clear every checkmark, including monthly projects."
          action={
            <button type="button" onClick={() => setConfirmAll(true)} className="btn-secondary border-[#8c3b3b] text-[#8c3b3b] hover:bg-[#8c3b3b]">
              Reset all
            </button>
          }
        />
      </ul>

      <p role="status" className="mt-4 min-h-6 text-sm text-sage">
        {status}
      </p>

      <ConfirmationDialog
        open={confirmAll}
        title="Reset all progress?"
        message="This clears every checkmark — daily, weekly and monthly. It can’t be undone."
        confirmLabel="Reset everything"
        onConfirm={resetAll}
        onCancel={() => setConfirmAll(false)}
      />
    </>
  );
}

function Row({ title, detail, action }: { title: string; detail: string; action: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-rule py-5">
      <div>
        <p className="font-serif text-[1.3rem] leading-tight font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-snug text-muted">{detail}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

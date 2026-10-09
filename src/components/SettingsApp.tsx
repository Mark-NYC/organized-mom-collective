import { useState } from 'react';
import type { ReactNode } from 'react';
import { dateKey } from '../lib/dates';
import { resetAllProgress, resetDay, setOnboarded } from '../lib/storage';
import ConfirmationDialog from './ConfirmationDialog';
import { InstallSteps } from './InstallInvite';
import { currentPlatform, isStandalone, saveHandoff } from '../lib/install';
import { routes } from '../routes';

export default function SettingsApp() {
  const [confirmAll, setConfirmAll] = useState(false);
  const [status, setStatus] = useState('');
  const [platform] = useState(currentPlatform);
  const [standalone] = useState(isStandalone);
  const [howOpen, setHowOpen] = useState(false);

  const replay = () => {
    setOnboarded(false);
    window.location.href = routes.today;
  };

  const resetToday = () => {
    const now = new Date();
    resetDay(dateKey(now));
    setStatus('Today’s checklist has been cleared.');
  };

  const resetAll = () => {
    resetAllProgress();
    setConfirmAll(false);
    setStatus('All cleaning progress has been cleared.');
  };

  return (
    <>
      <ul className="border-t border-rule-strong">
        <Row
          title="Add to Home Screen"
          detail={
            standalone
              ? 'You’re using the Home Screen app. Your checkmarks are kept on this phone.'
              : 'Open it with one tap, like an app. Works without signal once loaded.'
          }
          action={
            standalone ? null : (
              <button
                type="button"
                onClick={() => {
                  if (!howOpen && platform.startsWith('ios')) void saveHandoff();
                  setHowOpen(!howOpen);
                }}
                aria-expanded={howOpen}
                className="btn-secondary"
              >
                {howOpen ? 'Hide' : 'How'}
              </button>
            )
          }
        />
        {howOpen && (
          <li className="border-b border-rule pb-5">
            <InstallSteps platform={platform} />
          </li>
        )}
        <Row
          title="See the welcome screen again"
          detail="How the app works with your calendar. Your checkmarks are kept."
          action={
            <button type="button" onClick={replay} className="btn-secondary">
              Show
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
          detail="Clear every checkmark, including monthly home projects."
          action={
            <button type="button" onClick={() => setConfirmAll(true)} className="btn-secondary border-[#8c3b3b] text-[#8c3b3b] hover:bg-[#8c3b3b]">
              Reset all
            </button>
          }
        />
      </ul>

      <p role="status" className="mt-4 min-h-6 text-sm font-medium">
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
        <p className="text-[0.95rem] font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-snug text-muted">{detail}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

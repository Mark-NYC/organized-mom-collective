import { useEffect, useId, useState } from 'react';
import {
  currentPlatform,
  dismissInvite,
  installGuide,
  installPromptAvailable,
  promptInstall,
  saveHandoff,
} from '../lib/install';
import type { Platform } from '../lib/install';

/** True once the app is saved for offline use (the service worker is running this page). */
function useOfflineReady(): boolean {
  const [ready, setReady] = useState(() => !!navigator.serviceWorker?.controller);
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const update = () => setReady(!!sw.controller);
    sw.addEventListener('controllerchange', update);
    return () => sw.removeEventListener('controllerchange', update);
  }, []);
  return ready;
}

/** Android: whether the browser's own Install dialog is available. */
function useInstallable(): boolean {
  const [can, setCan] = useState(installPromptAvailable);
  useEffect(() => {
    const update = () => setCan(installPromptAvailable());
    window.addEventListener('omc:installable', update);
    return () => window.removeEventListener('omc:installable', update);
  }, []);
  return can;
}

/** Numbered steps for this phone, plus what installing does and doesn't do. */
export function InstallSteps({ platform }: { platform: Platform }) {
  const guide = installGuide(platform);
  const offlineReady = useOfflineReady();
  return (
    <div>
      <ol className="space-y-2">
        {guide.steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-[0.95rem] leading-snug">
            <span className="mt-[1px] w-4 shrink-0 text-[0.7rem] font-semibold tracking-[0.1em] text-muted tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {guide.note && <p className="mt-3 text-[0.9rem] leading-snug">{guide.note}</p>}
      <p className="mt-3 text-[0.85rem] leading-snug text-muted">
        {offlineReady ? 'This app is saved on your phone, so it opens without signal too.' : 'It will work without signal once it has finished loading.'}{' '}
        Your checkmarks are kept on this phone only — clearing browsing data or deleting the app removes them.
      </p>
    </div>
  );
}

/**
 * A small card above the bottom navigation, offered after a checkmark.
 * Never a modal, never steals focus, and gone for good once she closes it.
 */
export default function InstallInvite({ onClose }: { onClose: () => void }) {
  const [platform] = useState(currentPlatform);
  const installable = useInstallable();
  const [open, setOpen] = useState(false);
  const stepsId = useId();

  const close = () => {
    dismissInvite();
    onClose();
  };

  useEffect(() => {
    window.addEventListener('appinstalled', close);
    return () => window.removeEventListener('appinstalled', close);
  });

  const install = async () => {
    if (await promptInstall()) close();
  };

  const showHow = () => {
    if (!open && platform.startsWith('ios')) void saveHandoff();
    setOpen(!open);
  };

  return (
    <aside
      aria-label="Add to Home Screen"
      className="invite-in fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-3 sm:bottom-4"
    >
      <div className="mx-auto max-h-[calc(100dvh-8rem)] max-w-md overflow-y-auto border border-rule-strong border-l-[3px] border-l-month bg-paper px-4 py-3.5 shadow-[0_6px_24px_rgba(84,84,84,0.14)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[1rem] leading-snug font-semibold">Keep this on your Home Screen</p>
            <p className="mt-1 text-[0.95rem] leading-snug text-muted">One tap to open, right next to your other apps.</p>
            {!open && <p className="mt-0.5 text-[0.8rem] leading-snug text-muted">You can always find this in Settings.</p>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close. Don’t show this again"
            className="-mt-1.5 -mr-2 grid size-11 shrink-0 place-items-center text-muted hover:text-ink"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {open && (
          <div id={stepsId} className="mt-3 border-t border-rule pt-3">
            <InstallSteps platform={platform} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {installable && platform === 'android' ? (
            <button type="button" onClick={install} className="btn-primary min-h-11 px-5">
              Install
            </button>
          ) : (
            <button type="button" onClick={showHow} aria-expanded={open} aria-controls={open ? stepsId : undefined} className="btn-secondary">
              {open ? 'Hide steps' : 'Show me how'}
            </button>
          )}
          <button type="button" onClick={close} className="text-link min-h-11">
            No thanks
          </button>
        </div>
      </div>
    </aside>
  );
}

import { useEffect, useState } from 'react';
import { accountRpc, loadSession } from '../account';
import { cacheProgress, MEETING_EDIT, readProgress, type MeetingProgress } from './meeting-progress';

interface Reply { revision: number; conflict: boolean; progress: MeetingProgress | null }
interface Change { id: string; base: number; progress: MeetingProgress }

/** Keep individual pending writes so an acknowledgement cannot erase a newer offline change. */
export function useSharedMeetingProgress(scope: string | null, onProgress: (p: MeetingProgress | null) => void) {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setNotice('');
    const adult = loadSession()?.user_id;
    if (!scope || !adult) return;
    const prefix = `omc:household:meeting:${scope}:${adult}:`;
    const revisionKey = prefix + 'revision';
    const queue = prefix + 'change:';
    let active = true;
    let syncing = false;
    let again = false;
    const current = () => active && loadSession()?.user_id === adult;
    const pending = (): Change[] => {
      const changes: Change[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(queue)) changes.push(JSON.parse(localStorage.getItem(key)!));
      }
      return changes.sort((a, b) => a.base - b.base || a.id.localeCompare(b.id));
    };
    async function sync() {
      if (!current()) return;
      if (syncing) { again = true; return; }
      syncing = true;
      try {
        const changes = pending();
        const change = changes[0];
        const p = change?.progress;
        const reply = await accountRpc<Reply>('family_meeting_progress', {
          p_household: scope,
          ...(change && p ? { p_operation: change.id, p_base: change.base, p_step: p.step,
            p_started: p.startedAt, p_updated: p.updatedAt, p_completed: p.completedAt } : {}),
        });
        if (!current()) return;
        const known = Number(localStorage.getItem(revisionKey) || 0);
        if (reply.revision < known) { again = true; return; }
        localStorage.setItem(revisionKey, String(reply.revision));
        if (change) localStorage.removeItem(queue + change.id);
        if (reply.conflict) {
          // Later steps were based on the losing checkpoint. Restore the shared position.
          for (const c of changes) localStorage.removeItem(queue + c.id);
          setNotice('The meeting changed on another device. Your family’s saved place is shown.');
        } else if (change) setNotice('');
        if (pending().length) { again = true; return; }
        if (reply.progress) {
          cacheProgress(scope, reply.progress);
          onProgress(reply.progress);
        } else {
          // Existing local-only progress remains resumable until the next explicit meeting action.
          onProgress(readProgress(scope));
        }
      } catch {
        if (current()) setNotice('Meeting progress is on this device. Sharing will retry.');
      } finally {
        syncing = false;
        if (again && current()) { again = false; void sync(); }
      }
    }
    const edit = (event: Event) => {
      const detail = (event as CustomEvent<{scope: string; progress: MeetingProgress}>).detail;
      if (!current() || detail.scope !== scope) return;
      try {
        const changes = pending();
        const base = Math.max(Number(localStorage.getItem(revisionKey) || 0), ...changes.map(c => c.base + 1));
        const change: Change = { id: crypto.randomUUID(), base, progress: detail.progress };
        localStorage.setItem(queue + change.id, JSON.stringify(change));
        void sync();
      } catch { setNotice('This device could not save the meeting for sharing.'); }
    };
    const refresh = () => { if (!document.hidden) void sync(); };
    window.addEventListener(MEETING_EDIT, edit);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 15000);
    void sync();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(MEETING_EDIT, edit);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [scope, onProgress]);
  return notice;
}

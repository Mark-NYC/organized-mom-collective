/**
 * Progressive profiling for a family without the Club (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §8, owner decision
 * 2026-11-18): after a meeting where the family wrote something down, ONE question from the Club's own intake, the
 * next one they haven't answered, and only because it changes their next meeting. Never the five-step intake.
 *
 *   1. "What's hardest to share at home?" (challenges) → next week's Let's Talk asks about it.
 *   2. "The one thing you'd love to stop managing alone?" (priority) → Our Focus names it.
 *
 * Saved with the same function the Club intake uses (club_focus_save through useFamily().saveFocus), which marks that
 * setup step, so if the family joins the Club later its intake skips the question. "Not now" only hides it on this
 * device for two weeks; it never marks the step, so nothing is decided for her.
 */
import { useState } from 'react';
import { CHALLENGES, PRIORITIES } from '../../data/club/family-profile';
import type { FamilyProfile } from '../../lib/club/family-profile';

const LATER = 'omc:family:profile-question-later';
const hiddenUntil = () => { try { return Number(localStorage.getItem(LATER) ?? 0); } catch { return 0; } };

export default function ProfileQuestion({ profile, saveFocus }: {
  profile: FamilyProfile | null;
  saveFocus: (step: 'challenges' | 'priority', change: { challenges?: string[]; priority?: string }) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [state, setState] = useState<'ask' | 'saving' | 'saved' | 'later' | 'error'>(() => (hiddenUntil() > Date.now() ? 'later' : 'ask'));
  if (!profile || state === 'later') return null;
  const done = profile.setupDone ?? [];
  const step: 'challenges' | 'priority' | null = !done.includes('challenges') && !profile.challenges.length ? 'challenges'
    : !done.includes('priority') && !profile.priority ? 'priority' : null;
  if (!step && state !== 'saved') return null;
  const many = step === 'challenges';
  const choices = (step === 'challenges' ? CHALLENGES : PRIORITIES).filter((c) => c.id !== 'other');
  const save = async () => {
    if (!step || !picked.length) return;
    setState('saving');
    try {
      await saveFocus(step, step === 'challenges' ? { challenges: picked } : { priority: picked[0] });
      setState('saved');
    } catch { setState('error'); }
  };
  const later = () => { try { localStorage.setItem(LATER, String(Date.now() + 14 * 86400e3)); } catch { /* this visit only */ } setState('later'); };

  if (state === 'saved') {
    return <section className="of-tile of-tile--sage" data-profile-question="saved" role="status"><p className="font-semibold">Thanks. Your next meeting will start from that.</p></section>;
  }
  return (
    <section className="of-tile" aria-labelledby="pq-h" data-profile-question={step}>
      <p className="of-eyebrow">For next week’s meeting · optional</p>
      <h2 id="pq-h" className="of-tile-title mt-1">{step === 'challenges' ? 'What’s hardest to share at home right now?' : 'What’s the one thing you’d love to stop managing alone?'}</h2>
      <p className="of-tile-sub">{step === 'challenges' ? 'Next week’s Let’s Talk will ask about it. Pick any that fit.' : 'Next week’s Our Focus will name it, so the whole family works on the same thing.'}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={step === 'challenges' ? 'What’s hardest' : 'The one thing'}>
        {choices.map((c) => {
          const on = picked.includes(c.id);
          return <button key={c.id} type="button" aria-pressed={on} data-profile-choice={c.id}
            onClick={() => setPicked((p) => (many ? (on ? p.filter((x) => x !== c.id) : [...p, c.id]) : [c.id]))}
            className={`min-h-[44px] rounded-[8px] border px-3 text-left text-[0.9rem] ${on ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>{c.label}</button>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="of-btn" disabled={!picked.length || state === 'saving'} onClick={() => void save()} data-profile-save>Save for next week</button>
        <button type="button" className="of-tile-action !mt-0" onClick={later} data-profile-later>Not now</button>
      </div>
      {state === 'error' && <p role="alert" className="mt-2 text-sm">Couldn’t save that. Try again when you’re online.</p>}
      <p className="mt-3 text-[0.78rem] text-warm-soft">Only your household can see this. Change it any time.</p>
    </section>
  );
}

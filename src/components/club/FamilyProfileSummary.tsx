/**
 * /club/family below the people: what she told us about her week, who does what, where the family wants to grow and
 * the current priority, each with an Edit link that opens that one step (FamilySetup, mode 'single'). A review page,
 * not a task manager: no tracking, scores or schedules.
 */
import type { ReactNode } from 'react';
import { ACTIVITY_CATEGORIES, CHALLENGES, GROWTH_ITEMS, labelOf, PRIORITIES, RESPONSIBILITY_CATEGORIES } from '../../data/club/family-profile';
import { byStatus, nextOpenStep, type FamilyProfile, type SetupStep } from '../../lib/club/family-profile';
import type { FamilyMember } from '../../lib/club/profile';
import { summary } from './FamilySetup';

interface Props {
  profile: FamilyProfile;
  members: FamilyMember[];
  onEdit: (step: SetupStep) => void;
  onFinish: () => void;
}

export default function FamilyProfileSummary({ profile, members, onEdit, onFinish }: Props) {
  const name = (id: string) => members.find((m) => m.id === id)?.firstName ?? 'Someone who moved out';
  const names = (ids: string[]) => ids.map(name).join(' & ');
  const existing = byStatus(profile, 'existing');
  const desired = byStatus(profile, 'desired');
  const open = nextOpenStep(profile);

  return (
    <section className="mt-14 max-w-2xl border-t border-warm-rule pt-8" aria-labelledby="profile-title">
      <h2 id="profile-title" className="font-serif text-[1.7rem] leading-tight text-warm-ink">How your family runs</h2>
      <p className="mt-2 leading-relaxed text-warm-soft">We use this to make your monthly resources fit your real week. Change anything, anytime.</p>
      {open && (
        <div className="mt-5 border-l-[3px] border-sage bg-sage-wash px-4 py-3">
          <p className="text-warm-ink">A few questions are still open. It takes about two minutes.</p>
          <button type="button" className="btn-primary mt-3" onClick={onFinish}>Finish your family profile</button>
        </div>
      )}

      <Block title="Your typical week" onEdit={() => onEdit('week')}>
        {profile.activities.length ? (
          <ul className="space-y-1.5">
            {profile.activities.map((a, i) => (
              <li key={a.id ?? i}><span className="font-semibold">{labelOf(ACTIVITY_CATEGORIES, a.category)}</span>{summary(a, members) && <span className="text-warm-soft"> · {summary(a, members)}</span>}</li>
            ))}
          </ul>
        ) : <Empty />}
      </Block>

      <Block title="Who takes care of what" onEdit={() => onEdit('responsibilities')}>
        {existing.length ? (
          <ul className="space-y-1.5">
            {existing.map((r, i) => (
              <li key={r.id ?? i}>
                <span className="font-semibold">{r.label ?? labelOf(RESPONSIBILITY_CATEGORIES, r.category)}</span>
                {r.ownerIds.length > 0 && <span className="text-warm-soft"> · {names(r.ownerIds)}{r.scope === 'shared' ? ' (shared)' : ''}</span>}
                {r.helperIds.length > 0 && <span className="text-warm-soft"> · {names(r.helperIds)} helps</span>}
              </li>
            ))}
          </ul>
        ) : <Empty />}
      </Block>

      <Block title="Where you want to grow" onEdit={() => onEdit('growth')}>
        {desired.length ? (
          <ul className="space-y-1.5">
            {desired.map((r, i) => (
              <li key={r.id ?? i}>
                <span className="font-semibold">{r.label ?? labelOf(GROWTH_ITEMS, r.item)}</span>
                {r.ownerIds.length > 0 && <span className="text-warm-soft"> · {names(r.ownerIds)}</span>}
              </li>
            ))}
          </ul>
        ) : <Empty />}
      </Block>

      <Block title="Hard to stay on the same page" onEdit={() => onEdit('challenges')}>
        {profile.challenges.length ? (
          <p>{profile.challenges.map((c) => labelOf(CHALLENGES, c)).filter(Boolean).join(' · ')}{profile.challengeNote && <span className="text-warm-soft"> · “{profile.challengeNote}”</span>}</p>
        ) : <Empty />}
      </Block>

      <Block title="Your current priority" onEdit={() => onEdit('priority')}>
        {profile.priority || profile.priorityNote ? (
          <p><span className="font-semibold">{labelOf(PRIORITIES, profile.priority)}</span>{profile.priorityNote && <span className="text-warm-soft">{profile.priority ? ' · ' : ''}“{profile.priorityNote}”</span>}</p>
        ) : <Empty />}
      </Block>
    </section>
  );
}

function Block({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="label text-warm-soft">{title}</h3>
        <button type="button" className="min-h-11 text-[0.92rem] font-semibold text-warm-ink underline underline-offset-4" onClick={onEdit}>Edit<span className="sr-only"> {title.toLowerCase()}</span></button>
      </div>
      <div className="mt-1 text-[1rem] leading-relaxed text-warm-ink">{children}</div>
    </div>
  );
}

const Empty = () => <p className="text-warm-soft">Nothing added yet.</p>;

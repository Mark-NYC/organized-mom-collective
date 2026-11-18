/**
 * Family (/app/family): the family's shared headquarters, the same on the website and in the iPhone app
 * (docs/ios/APP_DESIGN_SYSTEM.md). This month's Family Meeting first, then the family's own data: members in their
 * permanent colors, who does what (agreements only), who shares the family, and the Family Meeting Club for households
 * that have it. Nothing here is a new feature: every tile opens a page that already exists.
 */
import { useEffect, useState } from 'react';
import { useToday } from '../../lib/hooks';
import { isDemo, useCalendar } from '../../lib/calendar/client';
import { useFamilyProfile } from '../../lib/family-meeting-client';
import { agreementsByPerson } from '../../lib/family-meeting-support';
import { householdAccess, type HouseholdAccess } from '../../lib/household/api';
import { ageInMonth, monthOf } from '../../lib/club/profile';
import { MEETING_GUIDE } from '../../data/club/meeting-guide';
import { useKeptClubMonths, useShowsClub } from '../app/TodayOverview';
import { Avatar, Chevron, Icon, TileHead } from '../app/ui';
import { appShellBuild } from '../../lib/native/platform';
import { monthPage } from '../../data/club/month-pages';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export default function FamilyHub() {
  const today = useToday();
  const month = MONTHS[today.getMonth()];
  const cal = useCalendar();
  const household = cal.household;
  const profile = useFamilyProfile(cal.state.scope !== 'local' ? cal.state.scope : null);
  const agreed = agreementsByPerson(household, profile);
  const members = (household?.members ?? []).filter((m) => !m.archived);
  const showsClub = useShowsClub();
  const kept = useKeptClubMonths();
  const [access, setAccess] = useState<HouseholdAccess | null>(null);
  useEffect(() => {
    if (!cal.signedIn || isDemo()) return;
    void householdAccess().then(setAccess, () => setAccess(null));
  }, [cal.signedIn]);
  const shared = (access?.adults.length ?? 1) > 1;
  const Month = month[0].toUpperCase() + month.slice(1);
  // Getting started, in the owner's order: household, week, the other grown-up, the meeting, then the Club.
  const steps = [
    { id: 'household', done: Boolean(household), label: 'Set up your household', href: cal.signedIn ? '/app/family/setup' : '/app/sign-in?next=/app/family' },
    { id: 'week', done: Object.keys(cal.state.events).length > 0, label: 'Put this week on the family calendar', href: '/app/family-calendar' },
    { id: 'adult', done: shared, label: 'Invite the other grown-up (if there is one)', href: '/app/account#sharing-h' },
    { id: 'meeting', done: agreed.length > 0, label: 'Hold your first ten-minute Family Meeting', href: '/app/family/meeting' },
    // Website only, and only while a new family is getting started: the one place a free family hears about the Club.
    // Never in the iPhone app (nothing is sold there), never as a card (owner decision 2026-11-17).
    ...(appShellBuild() || showsClub ? [] : [{ id: 'club', done: false, label: 'Discover Family Meeting Club', href: '/club' }]),
  ];
  const showSteps = !isDemo() && steps.slice(0, 3).some((x) => !x.done);

  return (
    <div className="of-grid of-grid--2 mt-6">
      <section className="of-tile of-tile--month of-span-2" aria-labelledby="our-meeting-h" data-our-meeting>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <div>
            <p className="of-eyebrow">Our Family Meeting · {month[0].toUpperCase() + month.slice(1)}</p>
            <h2 id="our-meeting-h" className="of-tile-title of-tile-title--lg">{MEETING_GUIDE.subtitle}</h2>
            <a href="/app/family/meeting" className="of-btn mt-5" data-open-meeting>Start our Family Meeting</a>
          </div>
          <ol className="grid grid-cols-2 gap-2" data-meeting-parts>
            {MEETING_GUIDE.parts.map((p, i) => (
              <li key={p.title} className="rounded-[9px] bg-white/80 px-3 py-2.5">
                <span className="font-serif text-[1.1rem] text-[var(--of-month-accent)]">{i + 1}</span>
                <span className="block text-[0.88rem] font-semibold leading-tight">{p.title}</span>
                <span className="text-[0.75rem] text-warm-soft">{p.minutes} min</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="of-tile" aria-labelledby="our-family-h" data-family-members>
        <TileHead eyebrow="Our family" title={<span id="our-family-h">{household?.displayName ?? 'Everyone in it'}</span>}
          action={household ? <a href="/app/family/setup" className="of-tile-action">Edit <Chevron /></a> : undefined} />
        {members.length ? (
          <ul className="of-rows">
            {members.map((m) => (
              <li key={m.id} className="of-row" data-family-member={m.firstName}>
                <Avatar name={m.firstName} color={cal.colors[m.id]} />
                <span className="min-w-0">
                  <span className="of-row-title">{m.firstName}</span>
                  <span className="of-row-meta">{m.kind === 'child' ? (m.birthYear ? `Child · ${ageInMonth(m.birthYear, m.birthMonth, monthOf(today))} years` : 'Child') : 'Adult'}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-3 text-[0.92rem] text-warm-soft">Add everyone once: names, ages and each person’s color. The calendar, cleaning and your Family Meeting all use the same family.</p>
            <a href={cal.signedIn ? '/app/family/setup' : '/app/sign-in?next=/app/family'} className="of-btn of-btn--soft mt-4">{cal.signedIn ? 'Set up our family' : 'Sign in to set up your family'}</a>
          </>
        )}
      </section>

      <a href="/app/family/responsibilities" className="of-tile" data-family-responsibilities-card>
        <TileHead eyebrow="Family responsibilities" title="Who does what." chevron />
        {agreed.length ? (
          <ul className="of-rows">
            {agreed.slice(0, 4).map((p) => (
              <li key={p.memberId} className="of-row !items-start">
                <Avatar name={p.name} color={cal.colors[p.memberId]} size="sm" />
                <span className="min-w-0"><span className="of-row-title">{p.name}</span><span className="of-row-meta">{p.parts.slice(0, 2).map((x) => x.text).join(' · ')}{p.parts.length > 2 ? ` · ${p.parts.length - 2} more` : ''}</span></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-tile-sub">What your family agreed in your meeting, and what everyone already does.</p>
        )}
      </a>

      {household && (
        <a href="/app/account#sharing-h" className="of-tile" data-family-sharing-card>
          <div className="flex items-center gap-4">
            <span className="of-icon-box of-icon-box--sage"><Icon name={shared ? 'family' : 'people-plus'} /></span>
            <span className="min-w-0 flex-1">
              <span className="of-eyebrow block">{shared ? 'Shared family' : 'Two grown-ups'}</span>
              <span className="mt-1 block font-serif text-[1.2rem] leading-snug">{shared ? 'Both grown-ups share this family' : 'Invite another adult'}</span>
              <span className="of-tile-sub block">{shared ? 'Calendar, cleaning and agreements stay in sync for both of you.' : 'Share the calendar, cleaning and agreements with the other grown-up at home.'}</span>
            </span>
            <Chevron />
          </div>
        </a>
      )}

      {showSteps && (
        <section className="of-tile of-span-2" aria-labelledby="getting-started-h" data-getting-started>
          <TileHead eyebrow="Getting started" title={<span id="getting-started-h">Your family, one step at a time</span>} />
          <ol className="mt-3 grid gap-2 md:grid-cols-2">
            {steps.map((x, i) => (
              <li key={x.id}>
                <a href={x.href} className={`flex min-h-12 items-center gap-3 rounded-[9px] border px-3 py-2 ${x.done ? 'border-transparent bg-[var(--of-sage)]' : 'border-[var(--of-rule)] bg-[var(--of-surface)]'}`} data-step={x.id} data-done={x.done ? '' : undefined}>
                  <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-[0.8rem] font-semibold ${x.done ? 'bg-[var(--of-sage-bar)] text-white' : 'border border-[var(--of-rule-strong)]'}`}>{x.done ? '✓' : i + 1}</span>
                  <span className={`min-w-0 text-[0.9rem] ${x.done ? 'text-warm-soft line-through decoration-[var(--of-rule-strong)]' : 'font-semibold'}`}>{x.label}<span className="sr-only">{x.done ? ' (done)' : ''}</span></span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {showsClub && (
        <section className="of-tile of-tile--month of-span-2" aria-labelledby="family-club-h" data-family-club-card>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <p className="of-eyebrow">Family Meeting Club · {Month}</p>
              <h2 id="family-club-h" className="of-tile-title">{monthPage(today.getMonth() + 1).name}</h2>
              <p className="of-tile-sub">Your monthly Family Focus, prepared from your family profile. Its ideas come into your weekly meeting.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* The month's own page and its resources (March: Family Rhythm and Spring Prep). */}
              <a href={monthPage(today.getMonth() + 1).route} className="of-btn">Open {Month}</a>
              {monthPage(today.getMonth() + 1).resources.filter((r) => r.route !== monthPage(today.getMonth() + 1).route).map((r) => <a key={r.route} href={r.route} className="of-btn of-btn--soft !normal-case !tracking-normal">{r.name}</a>)}
              {/* One meeting: this week's carries the month's plan (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §2). */}
              <a href="/app/family/meeting" className="of-btn of-btn--soft">This week’s meeting</a>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5">
            <a href="/app/club" className="of-tile-action">Club Home <Chevron /></a>
            <a href="/app/club/months" className="of-tile-action">Past and upcoming months <Chevron /></a>
          </div>
        </section>
      )}

      {!showsClub && kept > 0 && (
        <a href="/app/club/months" className="of-tile of-span-2" data-family-club-kept>
          <TileHead eyebrow="Family Meeting Club" title={`Your ${kept === 1 ? 'month stays' : `${kept} months stay`} yours`} chevron />
          <p className="of-tile-sub">Every month your family received is still here to open, print and use.</p>
        </a>
      )}

    </div>
  );
}

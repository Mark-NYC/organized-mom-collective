/**
 * /app/family/meeting: THE Family Meeting, the same page for every family, on the website and in the iPhone app
 * (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §2). Once a week, about ten minutes, the four approved parts in their
 * order, timing and words (src/data/club/meeting-guide.ts: Our Focus 2 · Let's Talk 3 · Everyone's Part 3 ·
 * Let's Practice 2).
 *
 * Free: the family's own week (look ahead), what they agreed last time (celebrate), one honest question, and "We
 * agreed" for the week ahead (saved on this phone first, then the household; src/lib/agreements).
 *
 * Family Meeting Club: the same meeting, with this month's prepared content inside the same parts, from the same engine
 * the month's own meeting page uses (src/lib/club/family-meeting.ts → buildFamilyMeeting, with the family's household
 * and profile): the month's focus, its questions, an age-fit suggestion per person (never more than one, never for a
 * toddler, never making the account holder everyone's organizer), and the month's practice step. Suggestions stay
 * suggestions until the family taps "We agreed", which saves the same agreement, with the same source key, the
 * monthly page would. There is no second meeting system.
 *
 * Club families also get the development layer (src/components/family/DevelopmentCoach.tsx, engine in
 * src/lib/family-development/engine.ts): what each child is learning, a MAWL-stage check-in in Let's Talk, and one
 * next step per child in Everyone's Part, built once when the meeting opens from the family's saved development
 * records. A child with a development step gets no month suggestion as well (one next step per person). If the
 * records can't be read, the layer is absent and the meeting is exactly as before. Free families never see it.
 * The plan is tied to who is signed in, the household, Club access and the day (meeting-plan.ts), never kept across
 * them. "We agreed" for a skill is saved by the database with its agreement in one step; the returned agreement goes
 * onto this phone's lists (fam.adoptAgreement), so there is no second agreement save that could fail on its own.
 *
 * Two-tab redesign (docs/ios/TWO_TAB_REDESIGN.md): this page is the Family Meeting TAB. It opens on a short landing
 * (the family's focus, the four parts, one Start button, what they agreed last time) and the guided meeting begins on
 * Start. Continue appears only when this phone recorded an unfinished meeting (src/lib/app/meeting-progress.ts), and
 * "you met on Sunday" only after Finish meeting was tapped. Missing weeks are never counted. The development
 * conversation (one child, "What went well?", the engine's own question, our next step) is in Everyone's Part; the
 * stages themselves never show.
 */
import { useEffect, useMemo, useState } from 'react';
import { track } from '../../lib/app/events';
import { MEETING_GUIDE } from '../../data/club/meeting-guide';
import { CHALLENGES, PRIORITIES, RESPONSIBILITY_CATEGORIES } from '../../data/club/family-profile';
import { isDemo, useCalendar } from '../../lib/calendar/client';
import { useExternalCalendars } from '../../lib/calendar/feeds';
import { localToday } from '../../lib/calendar/recurrence';
import { useToday } from '../../lib/hooks';
import { agreementsByPerson, monthOf, weekAhead } from '../../lib/family-meeting-support';
import { useFamily } from '../../lib/family-meeting-client';
import { activityCues } from '../../lib/app/onboarding-bridge';
import { conflictText } from '../../lib/agreements/client';
import { buildFamilyMeeting, suggestionKey, type FamilyMeeting, type PartRecommendation } from '../../lib/club/family-meeting';
import AgreedParts from '../family/AgreedParts';
import { monthPage } from '../../data/club/month-pages';
import FollowThrough from '../family/FollowThrough';
import ProfileQuestion from '../family/ProfileQuestion';
import { Avatar } from '../app/ui';
import type { ResponsibilityCategory } from '../../data/club/family-profile';
import { useDevelopment, useMeetingAccess } from '../../lib/family-development/client';
import { buildDevelopmentPlan } from '../../lib/family-development/engine';
import { planKey, reconcilePlan, recordScope, type PlanSlot } from '../../lib/family-development/meeting-plan';
import { DevelopmentConversation, DevelopmentNextSteps, DevelopmentPractice, leadPerson } from '../family/DevelopmentCoach';
import { GettingReady, PlanSummary, WeekReview } from './MeetingPlan';
import { currentPriorities, usePriorities, weekOf } from '../../lib/app/priorities';
import { useEventTasks } from '../../lib/calendar/event-tasks';
import { dayWord, meetingState, nextScheduledMeeting, readProgress, recordFinished, recordStep, startOver, type MeetingProgress } from '../../lib/app/meeting-progress';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const label = (list: { id: string; label: string }[], id: string) => list.find((c) => c.id === id)?.label ?? id;

/** Basic guidance for a family without the Club's month: the approved parts, with what to do when there's no monthly focus. */
const FREE_TEXT: Record<string, string> = {
  'Let’s Talk': 'Start with what went well since last time. Then each person names one thing that was hard. Everyone answers, the youngest first. No wrong answers, no fixing anyone.',
};
/** The guide's Let's Talk, where this month's questions are on this page rather than a separate sheet. */
const CLUB_TALK = 'Ask this month’s questions below. Everyone answers, the youngest first. No wrong answers, no fixing anyone.';

export default function WeeklyMeeting({ discussionQuestions }: { discussionQuestions?: string[] } = {}) {
  const today = useToday();
  const month = monthOf(today);
  const cal = useCalendar();
  const scope = cal.state.scope !== 'local' ? cal.state.scope : null;
  const fam = useFamily(scope);
  // Who is signed in and whether they have Club, rechecked on resume, tab focus and sign-in/out in another tab.
  const access = useMeetingAccess();
  const club = access.club;
  // Only calendars an adult shared with the household: a meeting is for everyone, so private ones stay out.
  const shared = useExternalCalendars(scope && cal.signedIn ? scope : null, 'household');
  const week = weekAhead([...Object.values(cal.state.events), ...shared.events], localToday(today), today);
  const people = (cal.household?.members ?? []).filter((m) => !m.archived && m.firstName.trim());
  const agreed = agreementsByPerson(cal.household, fam.profile);
  const agreedCount = new Set(agreed.flatMap((p) => p.parts.map((x) => x.id))).size; // a shared agreement counts once
  // The Club's month, prepared from this family: the same call the month's meeting page makes.
  const meeting: FamilyMeeting | null = useMemo(
    () => (club && cal.household ? buildFamilyMeeting({ household: cal.household, profile: fam.profile, month }) : null),
    [club, cal.household, fam.profile, month],
  );
  // Development (Club only; src/lib/family-development/meeting-plan.ts): one plan per signed-in adult, household, Club
  // access and day. Same key: the same plan all meeting (a decision never swaps the step on screen; live records show
  // its result). New key (sign-out, another account or household, access lost, a new day): the old plan is gone at
  // once, and a new one is built only from records loaded for the new key.
  const identity = { userId: access.userId, householdId: cal.household?.id ?? null, club, today: localToday(today) };
  const key = planKey(identity);
  const dev = useDevelopment(recordScope(identity));
  const [slot, setSlot] = useState<PlanSlot | null>(null);
  useEffect(() => {
    setSlot((prev) => reconcilePlan(prev, identity, { records: dev.records, householdOnScreen: cal.household?.id ?? null, profileLoaded: Boolean(fam.profile) },
      (records) => buildDevelopmentPlan({ household: cal.household, profile: fam.profile, records, today: identity.today })));
  }, [key, dev.records, cal.household, fam.profile]); // eslint-disable-line react-hooks/exhaustive-deps
  // Checked at render time too, so not even one frame shows a plan that no longer matches who and where we are.
  const devPlan = slot && slot.key === key ? slot.plan : null;
  const devLive = useMemo(() => new Map((dev.records ?? []).map((r) => [r.id, r] as const)), [dev.records]);
  const devStepFor = new Set(devPlan?.people.filter((p) => p.step).map((p) => p.memberId) ?? []);
  /** Whether Everyone's Part leads with personalized next steps (then agreements and the manual form start closed). */
  const hasNextSteps = devStepFor.size > 0;
  const [who, setWho] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ResponsibilityCategory>('other');
  const [msg, setMsg] = useState('');
  const [activeStep, setActiveStep] = useState(discussionQuestions ? 1 : 0);
  const [questionIndex, setQuestionIndex] = useState(0);
  // The landing first; the guided meeting once the family taps Start (or Continue). ?step=N opens a part directly.
  const [inMeeting, setInMeeting] = useState(() => { try { return Boolean(discussionQuestions) || new URLSearchParams(location.search).has('step'); } catch { return false; } });
  const [progress, setProgress] = useState<MeetingProgress | null>(null);
  useEffect(() => { setProgress(readProgress(scope)); }, [scope]);
  useEffect(() => {
    try {
      const n = Number(new URLSearchParams(location.search).get('step'));
      if (n >= 1 && n <= MEETING_GUIDE.parts.length) setActiveStep(n - 1);
    } catch { /* the first part */ }
  }, []);
  const goStep = (index: number) => {
    if (index > 0) track('meeting_started');
    const i = Math.max(0, Math.min(MEETING_GUIDE.parts.length - 1, index));
    setActiveStep(i);
    setProgress(recordStep(scope, i));
    setStartIds((ids) => ids ?? new Set(agreed.flatMap((x) => x.parts.map((y) => y.id))));
    document.querySelector('[data-weekly-meeting]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const begin = (fresh: boolean) => {
    if (fresh) startOver(scope);
    const resume = !fresh && progress && !progress.completedAt ? progress.step : 0;
    setInMeeting(true);
    goStep(resume);
  };
  const Month = MONTHS[today.getMonth()][0].toUpperCase() + MONTHS[today.getMonth()].slice(1);
  const challenges = fam.profile?.challenges ?? [];

  const add = async () => {
    if (!text.trim() || !who.length) return;
    setMsg('');
    try {
      await fam.saveAgreement({ category, text, ownerIds: who, month });
      setText(''); setWho([]);
      setMsg('Saved: agreed by our family.');
    } catch {
      setMsg('Sign in to save your family’s agreements.');
    }
  };
  const agreeTo = async (memberId: string, r: PartRecommendation) => {
    setMsg('');
    try {
      const source = suggestionKey(r);
      await fam.saveAgreement({ category: r.category ?? 'other', text: r.description, ownerIds: [memberId], month, ...(r.finished ? { finished: r.finished } : {}), ...(r.when ? { when: r.when } : {}), ...(source ? { source } : {}) });
      setMsg('Saved: agreed by our family.');
    } catch {
      setMsg('Couldn’t save that agreement. Try again.');
    }
  };
  const suggestions = meeting?.parts.people.filter((p) => p.suggested.length && !devStepFor.has(p.memberId)) ?? [];
  // The family plan (docs/ios/FAMILY_PLAN.md): this week's chosen priorities, shared by both adults, and the existing
  // event responsibilities for getting ready. Hidden until the database has them; never in the demo.
  const live = scope && cal.signedIn && !isDemo() ? scope : null;
  const prio = usePriorities(live, localToday(today));
  const eventTasks = useEventTasks(live);
  const weekStart = weekOf(localToday(today));
  const own = Object.values(cal.state.events);
  const plan = currentPriorities(prio.items.filter((x) => x.week_of === weekStart), [...own, ...shared.events], localToday(today)).list;
  const [planDone, setPlanDone] = useState(false);
  // What the family agreed DURING this meeting (for "We have a plan."): the agreements there when it started.
  const [startIds, setStartIds] = useState<Set<string> | null>(null);
  const newIds = startIds ? new Set(agreed.flatMap((p) => p.parts.map((x) => x.id)).filter((id) => !startIds.has(id))) : null;

  const state = meetingState(progress, agreedCount > 0);
  // The family's own focus (chosen in a meeting); a Club month's topic is labeled as the month's, never as agreed.
  const ownFocus = fam.profile?.priority ? (fam.profile.priority === 'other' ? fam.profile.priorityNote?.trim() || null : label(PRIORITIES, fam.profile.priority)) : null;
  const scheduled = nextScheduledMeeting(Object.values(cal.state.events), localToday(today), today);
  const lead = devPlan ? leadPerson(devPlan) : null;
  // A focused conversation: while the guided meeting is open the app's tabs step aside (global.css,
  // html[data-meeting-active]); Back/Next and "Exit meeting" stay. The landing, "We have a plan." and every other
  // screen keep the tabs. Progress is saved at each step (recordStep), so leaving never loses the family's place.
  const guided = inMeeting && !planDone;
  useEffect(() => {
    document.documentElement.toggleAttribute('data-meeting-active', guided);
    return () => document.documentElement.removeAttribute('data-meeting-active');
  }, [guided]);

  if (planDone) {
    return (
      <div className="mx-auto max-w-3xl" data-weekly-meeting data-meeting-done>
        <PlanSummary current={plan} agreed={agreed} newIds={newIds} external={shared.events} tasks={eventTasks} household={cal.household} colors={cal.colors} onAgain={() => { setPlanDone(false); }} />
      </div>
    );
  }

  if (!inMeeting) {
    return (
      <div className="mx-auto max-w-3xl space-y-5" data-weekly-meeting data-meeting-landing data-meeting-state={state} data-meeting-kind={meeting ? 'club' : 'free'}>
        <header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="of-page-title">Family Meeting</h1>
            <span className="rounded-full bg-[var(--of-sage)] px-3 py-1 text-[0.85rem] font-semibold text-warm-ink" data-meeting-minutes>About 10 min</span>
          </div>
          <p className="mt-3 text-[1rem] leading-relaxed text-warm-soft">{MEETING_GUIDE.subtitle}</p>
        </header>

        {ownFocus ? (
          <section className="of-tile of-tile--month" aria-labelledby="focus-h" data-meeting-landing-focus="family">
            <p className="of-eyebrow">Our family focus</p>
            <h2 id="focus-h" className="mt-2 font-serif text-[1.6rem] leading-tight">{ownFocus}</h2>
            <p className="mt-2 text-[0.95rem] text-warm-soft">What would help with it this week?</p>
          </section>
        ) : meeting ? (
          <section className="of-tile of-tile--month" aria-labelledby="focus-h" data-meeting-landing-focus="club-month">
            <p className="of-eyebrow">This month · prepared for your family</p>
            <h2 id="focus-h" className="mt-2 font-serif text-[1.6rem] leading-tight">{monthPage(today.getMonth() + 1).name}</h2>
            <p className="mt-2 text-[0.95rem] text-warm-soft">{meeting.focus.challenge}</p>
          </section>
        ) : state === 'first' ? (
          <section className="of-tile of-tile--month" aria-labelledby="focus-h" data-meeting-landing-focus="first">
            <p className="of-eyebrow">Your first Family Meeting</p>
            <h2 id="focus-h" className="mt-2 font-serif text-[1.45rem] leading-snug">Everyone at the table, about ten minutes.</h2>
            <p className="mt-2 text-[0.95rem] text-warm-soft">We’ll walk you through it: look at the week together, talk, and agree one part each.</p>
          </section>
        ) : null}

        <ol className="grid grid-cols-4 gap-1" aria-label="The four parts" data-meeting-parts-preview>
          {MEETING_GUIDE.parts.map((part, i) => {
            const current = state === 'in-progress' ? progress!.step === i : i === 0;
            // Tapping a part opens the meeting there (e.g. straight to Everyone's Part).
            return (
              <li key={part.title}>
                <button type="button" className="flex min-h-[44px] w-full flex-col items-center text-center" aria-current={current ? 'step' : undefined}
                  aria-label={`Step ${i + 1}: ${part.title}, ${part.minutes} minutes`} onClick={() => { setInMeeting(true); goStep(i); }} data-meeting-step={i}>
                  <span className={`grid size-10 place-items-center rounded-full border-2 font-serif text-[1.1rem] ${current ? 'border-[var(--of-sage-bar)] bg-[var(--of-sage-bar)] text-white' : 'border-[var(--of-rule-strong)] bg-white text-warm-ink'}`}>{i + 1}</span>
                  <span className={`mt-1.5 text-[0.8rem] leading-tight ${current ? 'font-semibold text-warm-ink' : 'text-warm-soft'}`}>{part.title}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div>
          {state === 'in-progress' ? (
            <>
              <button type="button" className="of-btn of-btn--block !min-h-[52px] !normal-case !tracking-normal !text-[1.05rem]" onClick={() => begin(false)} data-meeting-start data-meeting-continue>
                Continue: {MEETING_GUIDE.parts[progress!.step]?.title ?? MEETING_GUIDE.parts[0].title}
              </button>
              <button type="button" className="mt-2 min-h-11 w-full text-[0.9rem] text-warm-soft underline underline-offset-4" onClick={() => begin(true)} data-meeting-start-over>Start over</button>
            </>
          ) : (
            <button type="button" className="of-btn of-btn--block !min-h-[52px] !normal-case !tracking-normal !text-[1.05rem]" onClick={() => begin(true)} data-meeting-start>Start Our Family Meeting</button>
          )}
          {state === 'recent' && progress?.completedAt && (
            <p className="mt-3 text-center text-[0.92rem] text-warm-soft" data-meeting-recent>You met {dayWord(progress.completedAt, today) === 'today' || dayWord(progress.completedAt, today) === 'yesterday' ? dayWord(progress.completedAt, today) : `on ${dayWord(progress.completedAt, today)}`}. Everyone’s parts are on <a href="/app" className="underline underline-offset-4">Today</a>.</p>
          )}
          {state === 'ready' && <p className="mt-3 text-center text-[0.92rem] text-warm-soft" data-meeting-ready>Ready when you are. Pick up right where your family is.</p>}
          {scheduled && <p className="mt-2 text-center text-[0.92rem] text-warm-soft" data-meeting-scheduled>On your calendar: {new Date(`${scheduled.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}{scheduled.time ? ` · ${scheduled.time}` : ''}</p>}
        </div>

        {agreedCount > 0 && (
          <a href="/app/family/responsibilities" className="of-tile" data-meeting-last-time>
            <div className="flex items-center gap-4">
            <span className="of-icon-box of-icon-box--sage shrink-0"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-4.8" /></svg></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Last time together</span>
              <span className="block text-[0.9rem] text-warm-soft">{agreedCount === 1 ? 'One part agreed' : `${agreedCount} parts agreed`}{lead ? `, and how ${lead.firstName}’s is going` : ''}.</span>
            </span>
            <span aria-hidden="true" className="text-warm-soft">›</span>
            </div>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-weekly-meeting data-meeting-kind={meeting ? 'club' : 'free'}>
      {/* Compact while the family is meeting: the way back to the landing, and where they are. */}
      <header className="flex items-center justify-between gap-3">
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-warm-ink" onClick={() => { setInMeeting(false); window.scrollTo(0, 0); }} aria-label="Exit the meeting. Your place is saved." data-meeting-back-to-landing data-meeting-exit>
          <span aria-hidden="true">‹</span><span>Exit meeting</span>
        </button>
        <span className="rounded-full bg-[var(--of-sage)] px-3 py-1 text-[0.85rem] font-semibold" data-meeting-step-count>Step {activeStep + 1} of {MEETING_GUIDE.parts.length}</span>
        <h1 className="sr-only">{MEETING_GUIDE.title} · {Month}</h1>
      </header>

      {/* The four parts as one compact segmented row: the current one filled, the others quiet. */}
      <nav aria-label="Family Meeting steps" data-meeting-navigation>
        <div className="grid grid-cols-4 gap-1 rounded-[10px] border border-[var(--of-rule)] bg-white p-1">
          {MEETING_GUIDE.parts.map((part, i) => (
            <button key={part.title} type="button" onClick={() => goStep(i)}
              aria-current={activeStep === i ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${part.title}, ${part.minutes} minutes`}
              className={`flex min-h-[44px] items-center justify-center rounded-[7px] px-1 py-1 text-center text-[0.78rem] leading-tight sm:text-[0.88rem] ${activeStep === i ? 'bg-[var(--of-sage)] font-semibold text-warm-ink' : i < activeStep ? 'text-warm-ink' : 'text-warm-soft'}`}
              data-meeting-step={i}>
              {part.title}
            </button>
          ))}
        </div>
      </nav>

      {MEETING_GUIDE.parts.map((p, i) => activeStep === i && (
        <section key={p.title} className={`of-tile ${meeting && (p.title === 'Our Focus') ? 'of-tile--month' : ''}`} aria-labelledby={`wm-${i}`} data-meeting-part={p.title}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`wm-${i}`} className="of-tile-title"><span className="mr-2 font-serif text-[var(--of-month-accent)]">{i + 1}</span>{p.title}</h2>
            <span className="text-sm text-warm-soft">{p.minutes} min</span>
          </div>

          {p.title === 'Our Focus' && (meeting ? (
            <div className="mt-3" data-club-month-meeting data-meeting-focus>
              <p className="of-eyebrow">This month · prepared for your family</p>
              <p className="mt-2 font-serif text-[1.25rem] leading-snug">{meeting.focus.challenge}</p>
              <p className="mt-2 text-[0.95rem] leading-relaxed">{meeting.focus.principle} {meeting.focus.why}</p>
              {meeting.focus.forWhom && <p className="mt-2 text-[0.85rem] text-warm-soft">{meeting.focus.forWhom}</p>}
            </div>
          ) : (
            <>
              {/* The part's question ("What matters most this week?") is WeekReview's own heading, just below. */}
              {fam.profile?.priority && fam.profile.priority !== 'other' && <p className="mt-3 rounded-[9px] bg-[var(--of-surface)] px-3 py-2.5 text-[0.95rem]" data-meeting-priority>Our family is working on: <strong>{label(PRIORITIES, fam.profile.priority)}</strong>. What would help with it this week?</p>}
            </>
          ))}
          {p.title !== 'Our Focus' && !(meeting && p.title === 'Let’s Practice') && <p className="mt-2 text-[0.95rem] leading-relaxed">{!meeting && FREE_TEXT[p.title] ? FREE_TEXT[p.title] : meeting && p.title === 'Let’s Talk' ? CLUB_TALK : p.text}</p>}

          {/* Look ahead and choose what matters: the family plan's priorities (MeetingPlan.tsx). */}
          {p.title === 'Our Focus' && <WeekReview week={week} priorities={prio.available ? prio : null} current={plan} weekStart={weekStart} colors={cal.colors} intakeActivities={activityCues(fam.profile)} />}

          {p.title === 'Let’s Talk' && discussionQuestions?.map(q => <p key={q} className="of-tile p-4">{q}</p>)}
          {p.title === 'Let’s Talk' && (
            <div className="mt-4 space-y-4">
              <FollowThrough household={cal.household} profile={fam.profile} colors={cal.colors} {...(devPlan ? { skipSkillAgreements: true } : {})} />
              {meeting ? (
                <div className="rounded-[9px] bg-[var(--of-surface)] p-4" data-meeting-questions>
                  <p className="of-eyebrow">Question {Math.min(questionIndex + 1, meeting.talk.questions.length)} of {meeting.talk.questions.length}</p>
                  {meeting.talk.questions[questionIndex] && (
                    <p className="mt-3 font-serif text-[1.15rem] leading-relaxed" data-meeting-question>
                      {meeting.talk.questions[questionIndex].text}
                      {meeting.talk.questions[questionIndex].audience !== 'everyone' && <span className="ml-2 font-sans text-[0.8rem] text-warm-soft">{meeting.talk.questions[questionIndex].audience === 'kids' ? 'for the kids' : 'for the grown-ups'}</span>}
                    </p>
                  )}
                  {meeting.talk.questions.length > 1 && <div className="mt-4 flex items-center justify-between gap-3">
                    <button type="button" className="of-btn of-btn--soft" disabled={questionIndex === 0} onClick={() => setQuestionIndex((i) => Math.max(0, i - 1))}>Previous question</button>
                    <button type="button" className="of-btn of-btn--soft" disabled={questionIndex >= meeting.talk.questions.length - 1} onClick={() => setQuestionIndex((i) => Math.min(meeting.talk.questions.length - 1, i + 1))}>Next question</button>
                  </div>}
                </div>
              ) : challenges.length > 0 && (
                <p className="rounded-[9px] bg-[var(--of-surface)] px-3 py-2.5 text-[0.95rem]" data-meeting-challenge>You said this is hard at home: <strong>{challenges.map((c) => label(CHALLENGES, c)).join(', ')}</strong>. What would make it a little easier this week?</p>
              )}
            </div>
          )}

          {p.title === 'Everyone’s Part' && (
            <div className="mt-4" data-meeting-parts-agreed>
              <GettingReady current={plan} external={shared.events} own={own} tasks={eventTasks} household={cal.household} colors={cal.colors} />
              {devPlan && <DevelopmentConversation plan={devPlan} live={devLive} decide={dev.decide} colors={cal.colors} onAgreement={fam.adoptAgreement} onAccessLost={access.revoke} />}
              {devPlan && <DevelopmentNextSteps plan={devPlan} live={devLive} decide={dev.decide} colors={cal.colors} onAgreement={fam.adoptAgreement} onAccessLost={access.revoke} exclude={lead?.memberId ?? ''} />}
              {suggestions.length > 0 && (
                <div className="mb-5" data-meeting-suggestions>
                  <p className="of-eyebrow">Ideas for this month, by age</p>
                  <ul className="mt-2 space-y-2">
                    {suggestions.map((person) => person.suggested.slice(0, 1).map((r) => (
                      <li key={person.memberId + r.description} className="rounded-[9px] border border-[var(--of-rule)] px-3 py-2.5" data-meeting-suggestion={person.firstName}>
                        <details className="group">
                          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3">
                            <Avatar name={person.firstName} color={cal.colors[person.memberId]} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">{person.firstName}{person.age !== null && person.kind === 'child' ? <span className="font-normal text-warm-soft"> · {person.age}</span> : null}</span>
                              <span className="block truncate text-[0.88rem] text-warm-soft">{r.description}</span>
                            </span>
                            <span aria-hidden="true" className="text-warm-soft group-open:rotate-180">⌄</span>
                          </summary>
                          <div className="border-t border-[var(--of-rule)] pt-3">
                            <p className="text-[0.95rem]">{r.description}</p>
                            {r.finished && <p className="mt-1 text-[0.8rem] text-warm-soft">{r.finished}</p>}
                            <button type="button" className="of-btn of-btn--soft mt-3 !min-h-[44px] w-full sm:w-auto" onClick={() => void agreeTo(person.memberId, r)} aria-label={`We agreed: ${person.firstName}`} data-agree-suggestion>We agreed</button>
                          </div>
                        </details>
                      </li>
                    )))}
                  </ul>
                  <p className="mt-2 text-[0.8rem] text-warm-soft">Suggestions only. Change the words, pick someone else, or skip them.</p>
                </div>
              )}
              {/* Secondary, so the first view is the one next step for each child. Open by default when there's no
                  personalized step to show (a free family, or nothing suggested), so that meeting is unchanged. */}
              <details className="group border-t border-[var(--of-rule)]" open={!hasNextSteps} data-agreed-section>
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 text-[0.95rem] font-semibold [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="inline-flex size-4 items-center justify-center leading-none text-warm-soft transition-transform group-open:rotate-90">›</span>
                  What we’ve already agreed{agreedCount > 0 && <span className="font-normal text-warm-soft"> ({agreedCount})</span>}
                </summary>
                <div className="pb-3">
                  {agreed.length ? <AgreedParts people={agreed} colors={cal.colors} compact /> : <p className="text-sm text-warm-soft">Nothing written down yet.</p>}
                  {agreed.length > 0 && cal.household && <a href="/app/family/responsibilities" className="mt-2 inline-flex min-h-[44px] items-center text-[0.88rem] text-warm-soft underline underline-offset-4" data-agreed-edit>Change or remove one in Who does what</a>}
                </div>
              </details>
              {cal.household ? (
                <details className="group border-t border-[var(--of-rule)]" open={!hasNextSteps} data-add-agreement-section>
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 text-[0.95rem] font-semibold [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="inline-flex size-4 items-center justify-center leading-none text-warm-soft transition-transform group-open:rotate-90">›</span>
                  Add another responsibility
                </summary>
                <form className="pb-2" onSubmit={(e) => { e.preventDefault(); void add(); }} data-add-agreement>
                  <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">What we agreed
                    <input value={text} maxLength={160} onChange={(e) => setText(e.target.value)} placeholder="Feed the dog before school" className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] normal-case tracking-normal text-warm-ink" data-agreement-new />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Whose part">
                    {people.map((m) => (
                      <button key={m.id} type="button" aria-pressed={who.includes(m.id)} onClick={() => setWho((w) => (w.includes(m.id) ? w.filter((x) => x !== m.id) : [...w, m.id]))} data-owner-chip={m.firstName}
                        className={`inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border px-3 text-sm ${who.includes(m.id) ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>
                        <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: cal.colors[m.id]?.hex }} />{m.firstName}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">Kind of job
                    <select value={category} onChange={(e) => setCategory(e.target.value as ResponsibilityCategory)} className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] normal-case tracking-normal text-warm-ink">
                      {RESPONSIBILITY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <button type="submit" className="of-btn mt-4" disabled={!text.trim() || !who.length} data-save-new-agreement>We agreed</button>
                </form>
                </details>
              ) : (
                <a href="/app/sign-in?next=/app/family/meeting" className="of-tile-action mt-4">Sign in to write down your family’s parts →</a>
              )}
              {/* Outside the collapsed sections, so sync news and conflicts are never hidden. */}
              {fam.pending > 0 && fam.status === 'offline' && <p className="text-sm text-warm-soft">Saved on this phone. It will sync when you’re back online.</p>}
              {fam.conflicts.map((c) => <p key={c.id + c.at} role="alert" className="text-sm">{conflictText(c)}</p>)}
              <p role="status" className="mt-2 text-sm text-[var(--of-sage-ink)]">{msg}</p>
            </div>
          )}

          {p.title === 'Let’s Practice' && meeting && (
            <div className="mt-3" data-meeting-practice>
              <p className="font-semibold">{meeting.practice.title}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.95rem]">{meeting.practice.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              {/* The month's own page names and opens its resources (src/data/club/month-pages.ts). */}
              <div className="mt-4 flex flex-wrap gap-2">
                {monthPage(today.getMonth() + 1).resources.map((r, i) => <a key={r.route} href={r.route} className={`of-btn ${i ? 'of-btn--soft' : ''} !normal-case !tracking-normal`} data-meeting-resource>{r.name}</a>)}
              </div>
              {devPlan && <DevelopmentPractice plan={devPlan} live={devLive} />}
            </div>
          )}
        </section>
      ))}

      {/* Back and Next stay within reach at the bottom of phones and tablets, above the home indicator (the tabs are
          hidden during the guided meeting; global.css). With a field focused (the keyboard open) they return to the
          page flow, so they never cover what's being typed. The 65px offset is the fallback if the tabs ever show. */}
      <div className="sticky bottom-[calc(65px+env(safe-area-inset-bottom))] z-30 -mx-5 flex items-center justify-between gap-3 border-t border-[var(--of-rule)] bg-ivory px-5 py-2.5 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:pb-6" data-meeting-step-actions>
        <button type="button" className="of-btn of-btn--soft !min-h-[44px] !normal-case !tracking-normal !text-[0.92rem]" disabled={activeStep === 0} onClick={() => goStep(activeStep - 1)}>Back</button>
        {activeStep < MEETING_GUIDE.parts.length - 1 ? (
          <button type="button" className="of-btn !min-h-[44px] !normal-case !tracking-normal !text-[0.92rem]" onClick={() => goStep(activeStep + 1)}>Next: {MEETING_GUIDE.parts[activeStep + 1].title} →</button>
        ) : (
          <button type="button" className="of-btn !min-h-[44px] !normal-case !tracking-normal !text-[0.92rem]" onClick={() => { track('meeting_completed'); setProgress(recordFinished(scope)); setPlanDone(true); window.scrollTo(0, 0); }} data-meeting-finish>Finish meeting ✓</button>
        )}
      </div>
      {/* One question at a time for a free family, only once it pays off in the next meeting (§8). */}
      {!meeting && activeStep === 2 && cal.household && agreed.length > 0 && <ProfileQuestion profile={fam.profile} saveFocus={fam.saveFocus} />}
    </div>
  );
}

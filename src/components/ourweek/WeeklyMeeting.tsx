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
 */
import { useEffect, useMemo, useState } from 'react';
import { MEETING_GUIDE } from '../../data/club/meeting-guide';
import { CHALLENGES, PRIORITIES, RESPONSIBILITY_CATEGORIES } from '../../data/club/family-profile';
import { useCalendar } from '../../lib/calendar/client';
import { useExternalCalendars } from '../../lib/calendar/feeds';
import { localToday } from '../../lib/calendar/recurrence';
import { useToday } from '../../lib/hooks';
import { agreementsByPerson, monthOf, weekAhead } from '../../lib/family-meeting-support';
import { useFamily } from '../../lib/family-meeting-client';
import { conflictText } from '../../lib/agreements/client';
import { accountStore } from '../../lib/club/store';
import { getSession } from '../../lib/account';
import { buildFamilyMeeting, suggestionKey, type FamilyMeeting, type PartRecommendation } from '../../lib/club/family-meeting';
import AgreedParts from '../family/AgreedParts';
import { monthPage } from '../../data/club/month-pages';
import FollowThrough from '../family/FollowThrough';
import ProfileQuestion from '../family/ProfileQuestion';
import { Avatar } from '../app/ui';
import type { ResponsibilityCategory } from '../../data/club/family-profile';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const label = (list: { id: string; label: string }[], id: string) => list.find((c) => c.id === id)?.label ?? id;

/** Basic guidance for a family without the Club's month: the approved parts, with what to do when there's no monthly focus. */
const FREE_TEXT: Record<string, string> = {
  'Our Focus': 'Look at the week ahead together: what’s coming, and what does it need from us?',
  'Let’s Talk': 'Start with what went well since last time. Then each person names one thing that was hard. Everyone answers, the youngest first. No wrong answers, no fixing anyone.',
};
/** The guide's Let's Talk, where this month's questions are on this page rather than a separate sheet. */
const CLUB_TALK = 'Ask this month’s questions below. Everyone answers, the youngest first. No wrong answers, no fixing anyone.';

export default function WeeklyMeeting() {
  const today = useToday();
  const month = monthOf(today);
  const cal = useCalendar();
  const scope = cal.state.scope !== 'local' ? cal.state.scope : null;
  const fam = useFamily(scope);
  const [club, setClub] = useState(false);
  useEffect(() => {
    void getSession().then(async (s) => { if (s) setClub(Boolean((await accountStore.me().catch(() => null))?.access)); });
  }, []);
  // Only calendars an adult shared with the household: a meeting is for everyone, so private ones stay out.
  const shared = useExternalCalendars(scope && cal.signedIn ? scope : null, 'household');
  const week = weekAhead([...Object.values(cal.state.events), ...shared.events], localToday(today), today);
  const people = (cal.household?.members ?? []).filter((m) => !m.archived && m.firstName.trim());
  const agreed = agreementsByPerson(cal.household, fam.profile);
  // The Club's month, prepared from this family: the same call the month's meeting page makes.
  const meeting: FamilyMeeting | null = useMemo(
    () => (club && cal.household ? buildFamilyMeeting({ household: cal.household, profile: fam.profile, month }) : null),
    [club, cal.household, fam.profile, month],
  );
  const [who, setWho] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ResponsibilityCategory>('other');
  const [msg, setMsg] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const goStep = (index: number) => {
    setActiveStep(Math.max(0, Math.min(MEETING_GUIDE.parts.length - 1, index)));
    document.querySelector('[data-weekly-meeting]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const suggestions = meeting?.parts.people.filter((p) => p.suggested.length) ?? [];
  const weekHighlights = week.days.flatMap((d) => d.items.map((item) => ({ day: d.label, item }))).slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-weekly-meeting data-meeting-kind={meeting ? 'club' : 'free'}>
      <header className="pb-2">
        <a href="/app/family" className="of-tile-action !mt-0">← Family</a>
        <p className="of-eyebrow mt-5">Our Family Meeting · {Month}</p>
        <h1 className="of-page-title mt-2">{MEETING_GUIDE.title}</h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-warm-soft">{MEETING_GUIDE.subtitle}</p>
      </header>

      <nav className="of-tile !p-4 sm:!p-5" aria-label="Family Meeting steps" data-meeting-navigation>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="of-eyebrow">Step {activeStep + 1} of {MEETING_GUIDE.parts.length}</span>
          <span className="text-sm text-warm-soft">10 minutes together</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MEETING_GUIDE.parts.map((part, i) => (
            <button key={part.title} type="button" onClick={() => goStep(i)}
              aria-current={activeStep === i ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${part.title}, ${part.minutes} minutes`}
              className={`min-h-[52px] rounded-[8px] border px-1.5 py-2 text-center text-[0.72rem] sm:text-[0.82rem] ${activeStep === i ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white text-warm-soft'}`}
              data-meeting-step={i}>
              <span className="block font-serif text-[1.05rem]">{i + 1}</span>
              <span className="block leading-tight">{part.title}</span>
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
              <p className="mt-2 text-[0.95rem] leading-relaxed">{FREE_TEXT[p.title]}</p>
              {fam.profile?.priority && fam.profile.priority !== 'other' && <p className="mt-3 rounded-[9px] bg-[var(--of-surface)] px-3 py-2.5 text-[0.95rem]" data-meeting-priority>Our family is working on: <strong>{label(PRIORITIES, fam.profile.priority)}</strong>. What would help with it this week?</p>}
            </>
          ))}
          {p.title !== 'Our Focus' && !(meeting && p.title === 'Let’s Practice') && <p className="mt-2 text-[0.95rem] leading-relaxed">{!meeting && FREE_TEXT[p.title] ? FREE_TEXT[p.title] : meeting && p.title === 'Let’s Talk' ? CLUB_TALK : p.text}</p>}

          {p.title === 'Our Focus' && week.count > 0 && (
            <div className="mt-5 rounded-[9px] border border-[var(--of-rule)] bg-white/70 p-3 sm:p-4" data-meeting-week>
              <div className="flex items-center justify-between gap-3">
                <p className="of-eyebrow">This week on our calendar</p>
                <span className="text-xs text-warm-soft">{week.count} events</span>
              </div>
              <p className="mt-1 text-sm text-warm-soft">What needs our family's attention this week?</p>
              <ul className="mt-3 space-y-2 text-[0.9rem]" data-meeting-week-highlights>
                {weekHighlights.map(({ day, item }, i) => (
                  <li key={item.id + item.date + i} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-1.5 inline-block size-2 shrink-0 rounded-full" style={{ background: cal.colors[item.memberIds[0] ?? item.ownerId ?? '']?.hex ?? '#9aab8f' }} />
                    <span className="min-w-0"><strong>{day}</strong> · {item.time === 'All day' ? '' : `${item.time} · `}{item.title}</span>
                  </li>
                ))}
              </ul>
              {week.count > 5 && (
                <details className="mt-3 border-t border-[var(--of-rule)] pt-3" data-meeting-week-all>
                  <summary className="cursor-pointer text-sm font-semibold">See the full week ({week.count} events)</summary>
                  <ul className="mt-3 space-y-3 text-[0.88rem]">
                    {week.days.filter((d) => d.items.length).map((d) => (
                      <li key={d.date}><strong className="block">{d.label}</strong>
                        <ul className="mt-1 space-y-1">
                          {d.items.map((x) => (
                            <li key={x.id + x.date} className="flex items-start gap-2 text-warm-soft">
                              <span aria-hidden="true" className="mt-1.5 inline-block size-2 shrink-0 rounded-full" style={{ background: cal.colors[x.memberIds[0] ?? x.ownerId ?? '']?.hex ?? '#9aab8f' }} />
                              <span>{x.time === 'All day' ? '' : `${x.time} · `}{x.title}{x.source ? ` · ${x.source}` : !x.ownerId ? ' · nobody handling it yet' : ''}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {p.title === 'Let’s Talk' && (
            <div className="mt-4 space-y-4">
              <FollowThrough household={cal.household} profile={fam.profile} colors={cal.colors} />
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
              {agreed.length ? <AgreedParts people={agreed} colors={cal.colors} compact /> : <p className="text-sm text-warm-soft">Nothing written down yet.</p>}
              {cal.household ? (
                <form className="mt-5 border-t border-[var(--of-rule)] pt-4" onSubmit={(e) => { e.preventDefault(); void add(); }} data-add-agreement>
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
                  {fam.pending > 0 && fam.status === 'offline' && <p className="text-sm text-warm-soft">Saved on this phone. It will sync when you’re back online.</p>}
                  {fam.conflicts.map((c) => <p key={c.id + c.at} role="alert" className="text-sm">{conflictText(c)}</p>)}
                </form>
              ) : (
                <a href="/app/sign-in?next=/app/family/meeting" className="of-tile-action mt-4">Sign in to write down your family’s parts →</a>
              )}
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
            </div>
          )}
        </section>
      ))}

      <div className="flex items-center justify-between gap-3 pb-6" data-meeting-step-actions>
        <button type="button" className="of-btn of-btn--soft" disabled={activeStep === 0} onClick={() => goStep(activeStep - 1)}>Back</button>
        {activeStep < MEETING_GUIDE.parts.length - 1 ? (
          <button type="button" className="of-btn" onClick={() => goStep(activeStep + 1)}>Next: {MEETING_GUIDE.parts[activeStep + 1].title} →</button>
        ) : (
          <a className="of-btn" href="/app/family">Finish meeting ✓</a>
        )}
      </div>
      {/* One question at a time for a free family, only once it pays off in the next meeting (§8). */}
      {!meeting && activeStep === 2 && cal.household && agreed.length > 0 && <ProfileQuestion profile={fam.profile} saveFocus={fam.saveFocus} />}
    </div>
  );
}

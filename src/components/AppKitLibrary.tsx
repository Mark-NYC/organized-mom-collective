import { useEffect, useState } from 'react';
import { monthColors } from '../theme';
import { clubAccountsEnabled } from '../data/club/config';
import { getSession } from '../lib/account';
import { loadMembership, mailingText, monthName, shortDate, type Membership, type MembershipMonth } from '../lib/club/membership';
import { firstMonth, kitProgress, kitText, loadMeetingGuideSeen, nextStep, profileDeferred, startsWithFirstPayment, stepHref, type KitStage, type OnboardingStep } from '../lib/club/onboarding';
import { accountStore } from '../lib/club/store';
import { ageInMonth, monthOf, type Household } from '../lib/club/profile';
import { SETUP_STEPS, type FamilyProfile } from '../lib/club/family-profile';
import ClubNav from './club/ClubNav';
import KitSteps from './club/KitSteps';
import { routes } from '../routes';
import { memberPlanHref } from '../lib/club/plan/account';
// The app Club library mirrors the benefit-first public Club month descriptions.
// Reuse the original month artwork, with resource-specific icons for laundry, snacks, and independent play.
import laundryIcon from '../../assets/icons/ofc/february/laundry-basket.webp?url';
import snackIcon from '../../assets/icons/ofc/updatedicons/june/strawberries.png?url';
import playIcon from '../../assets/icons/ofc/updatedicons/july/building-blocks.png?url';
const icons = import.meta.glob('../../assets/icons/ofc/month-icons/*-OFC-icon.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const months = [
  {
    "month": "January",
    "title": "Mornings Without the Nagging",
    "responsibility": "Following routines",
    "how": "A ready-made morning or evening plan shows everyone what to do next.",
    "url": "/app/club/january/"
  },
  {
    "month": "February",
    "title": "Laundry That Isn't All on You",
    "responsibility": "Caring for their own things",
    "how": "A picture laundry guide for each child, matched to their age: My Clothes, My Job or I Can Do My Own Laundry.",
    "url": "/app/club/february/"
  },
  {
    "month": "March",
    "title": "Chores Without Chasing Everyone",
    "responsibility": "Owning their chores",
    "how": "A family chore chart shows who does what, with a cleaning plan that explains the steps and what finished looks like.",
    "url": "/app/club/march/"
  },
  {
    "month": "April",
    "title": "Dinner Isn't All on You",
    "responsibility": "Sharing meal ownership",
    "how": "A prepared dinner plan gives family members roles from ingredients to cleanup.",
    "url": "/app/club/april/"
  },
  {
    "month": "May",
    "title": "Summer Days Without Constant Questions",
    "responsibility": "Managing their day",
    "how": "A flexible daily rhythm and activity menu help kids choose what comes next.",
    "url": "/app/club/may/"
  },
  {
    "month": "June",
    "title": "Snack Time Without Calling Mom",
    "responsibility": "Making their own snacks",
    "how": "An I Can Make My Own Snack guide gives kids simple snack choices and picture steps to practice making snacks themselves.",
    "url": "/app/club/june/"
  },
  {
    "month": "July",
    "title": "Less ‘I’m Bored.’ More Independent Play.",
    "responsibility": "Choosing something to do",
    "how": "An I’m Bored! What Can I Do? activity board gives kids ideas they can choose themselves, so you don’t have to come up with something every time.",
    "url": "/app/club/july/"
  },
  {
    "month": "August",
    "title": "Back to School Without the Scramble",
    "responsibility": "Taking initiative",
    "how": "A personalized countdown gives everyone their own school-ready responsibilities.",
    "url": "/app/club/august/"
  },
  {
    "month": "September",
    "title": "Stop Being the Family's Calendar",
    "responsibility": "Planning together",
    "how": "A Sunday Reset around the wall calendar, plus a monthly activity calendar that shows everyone's recurring activities.",
    "url": "/app/club/september/"
  },
  {
    "month": "October",
    "title": "Less Asking. More Doing.",
    "responsibility": "Caring for shared spaces",
    "how": "A daily reset with one familiar cue, picture jobs and a clear finish line kids can recognize.",
    "url": "/app/club/october/"
  },
  {
    "month": "November",
    "title": "Stop Being Everyone's Reminder",
    "responsibility": "Owning a whole responsibility",
    "how": "Each family member gets a whole job with a clear owner, timing, and finish line.",
    "url": "/club/worksheet-generator/"
  },
  {
    "month": "December",
    "title": "Raise Kids Who Love to Give",
    "responsibility": "Being a blessing to others",
    "how": "Two cards give kids space to draw a picture, write a poem, or share a letter, then send it to someone like a grandparent or teacher.",
    "url": "/app/club/december/"
  }
];

/** A member's month for a card (any year): the one she holds that's open now or soonest. */
const heldMonth = (me: Membership | null, index: number) =>
  me?.months.filter((m) => Number(m.month.slice(5, 7)) === index + 1).sort((a, b) => a.month.localeCompare(b.month))[0] ?? null;

/**
 * /app/club. Signed out, or signed in without a membership: the preview library (every month's sample). A member: her
 * Club. Her Welcome Kit while it's on its way, each month she holds marked as hers and opening her family's own
 * version (/club/resources/<slug>), the month her next payment brings, and her account (billing, family, address).
 */
export default function AppKitLibrary() {
  const [me, setMe] = useState<Membership | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);

  useEffect(() => {
    if (!clubAccountsEnabled()) return;
    getSession().then(async (s) => {
      if (!s) return;
      const m = await loadMembership();
      if (!m.member && !m.grant) return;
      const [household, profile, guideSeen] = await Promise.all([
        accountStore.household().catch(() => null),
        accountStore.profile().catch(() => null),
        loadMeetingGuideSeen(s.user_id),
      ]);
      setHome({ household, profile, deferred: profileDeferred(s.user_id), guideSeen });
      setMe(m);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const intro = document.getElementById('club-preview-intro');
    if (intro) intro.hidden = Boolean(me);
  }, [me]);

  return (
    <>
      {me && home && <ClubHome me={me} {...home} />}
      <div className="ofc-app-month-grid" id="months">
        {months.map((m, index) => {
          const src = m.month === 'February' ? laundryIcon
            : m.month === 'June' ? snackIcon
            : m.month === 'July' ? playIcon
            : icons[`../../assets/icons/ofc/month-icons/${m.month}-OFC-icon.png`];
          const calendarColor = monthColors[index].hex;
          const held = heldMonth(me, index);
          const coming = me?.next && Number(me.next.month.slice(5, 7)) === index + 1 && !held ? me.next : null;
          return (
            <article className="ofc-app-month" key={m.month} style={{ display: 'block' }}>
              <div className="ofc-app-month-header" style={{ backgroundColor: calendarColor }}>
                <div className="ofc-app-month-header-text">
                  <p className="ofc-app-month-name">{m.month}</p>
                  <h3>{m.title}</h3>
                </div>
                {src ? (
                  <div className="ofc-app-month-icon">
                    <img src={src} alt="" loading="lazy" width="88" height="88" />
                  </div>
                ) : null}
              </div>
              <div className="ofc-app-month-detail">
                {held && <p className="ofc-app-month-tag">{monthName(held.month)} · Yours{held.free ? ' · Free' : ''}</p>}
                {coming && <p className="ofc-app-month-tag">Next · {monthName(coming.month)}</p>}
                <p><strong>Builds:</strong> {m.responsibility}</p>
                <p><strong>How:</strong> {m.how}</p>
                <MonthLink m={m} held={held} />
                {/* Every month's ten-minute Family Meeting, beside its tool (ClubFamilyMeeting on /app/club/<month>). */}
                <a className="ofc-app-month-meeting" href={routes.clubMeeting(m.month.toLowerCase())}>Our family meeting <span aria-hidden="true">→</span></a>
                {coming && coming.payment_on && <p>Opens with your {shortDate(coming.payment_on)} payment.</p>}
              </div>
            </article>
          );
        })}
      </div>
      {me && (
        <p className="ofc-member-account">
          <a href={routes.clubFamily}>My Family</a> · <a href={routes.clubDashboard}>Account &amp; Billing</a> (plan, mailing address, email)
        </p>
      )}
    </>
  );
}

function MonthLink({ m, held }: { m: (typeof months)[number]; held: MembershipMonth | null }) {
  if (held?.state === 'available' && held.slug) return <a href={memberPlanHref(held.slug)}>Open your {m.month} plan <span aria-hidden="true">→</span></a>;
  if (held?.state === 'welcome_vision') return <a href={routes.clubFamilyVision}>See your print <span aria-hidden="true">→</span></a>;
  if (held) return <><p>Yours. We’re finishing it; it opens here when it’s ready.</p><a href={m.url}>Preview the tool <span aria-hidden="true">→</span></a></>;
  return <a href={m.url}>Preview the tool <span aria-hidden="true">→</span></a>;
}

interface HomeData { household: Household | null; profile: FamilyProfile | null; deferred: boolean; guideSeen: boolean }

/** Where her Welcome Kit is, as the four steps (null once nothing is left for her to do). */
function kitStage(step: OnboardingStep): KitStage | null {
  if (step === 'family' || step === 'profile') return 'family';
  if (step === 'address' || step === 'print' || step === 'meeting_guide' || step === 'first_resource') return step;
  return null;
}

/**
 * Club Home (/app/club, signed in): her family and an edit link, her one next step, her Welcome Kit's progress, her
 * current month, what's coming, then every month (#months). One page; billing is Account & Billing.
 */
function ClubHome({ me, household, profile, deferred, guideSeen }: { me: Membership } & HomeData) {
  const step = nextStep(me, { profile: household ? profile : null, profileDeferred: deferred, meetingGuideSeen: guideSeen });
  const first = firstMonth(me);
  const kitOpen = Boolean(me.welcome && !me.welcome.satisfies_month && !['mailed', 'canceled'].includes(me.welcome.status));
  const waiting = startsWithFirstPayment(me);
  const submitted = Boolean(me.welcome && ['needs_pdf', 'ready'].includes(me.welcome.readiness) && me.welcome.approved);
  const stage = kitStage(step) ?? (submitted ? 'done' : null);
  const people = household?.members.filter((m) => !m.archived) ?? [];
  const month = monthOf(new Date());
  const profileLeft = profile && !profile.setupCompleted ? SETUP_STEPS.filter((s) => !profile.setupDone.includes(s)).length : 0;
  const current = me.months.find((m) => m.month === me.current_month && m.state === 'available')
    ?? [...me.months].reverse().find((m) => m.state === 'available' && m.month <= me.current_month)
    ?? me.months.find((m) => m.state === 'available');
  const upcoming = me.months.filter((m) => m !== current && m.month > me.current_month && m.fulfilled_by === 'monthly_resource');
  // The same title as the month's card below (the resource registry's titles can differ from the tools, PR #268).
  const title = (iso: string) => months[Number(iso.slice(5, 7)) - 1]?.title ?? 'Monthly resource';
  const short = (iso: string) => monthName(iso).split(' ')[0];

  // Her one next step, in setup order.
  const action: { text: string; label: string; href: string } | null =
    step === 'family' || step === 'address' ? { text: 'Finish setting up your family and mailing address so we can prepare your Welcome Kit.', label: 'Continue setup', href: routes.clubWelcome }
    : step === 'profile' ? { text: `A few questions about your week are left (${profileLeft} of ${SETUP_STEPS.length}). Every one is optional.`, label: 'Continue your family profile', href: routes.clubWelcome }
    : step === 'print' ? { text: 'Your Family Vision print is ready. Make it yours and approve it.', label: 'Approve your welcome print', href: stepHref(me, 'print') }
    : step === 'meeting_guide' ? { text: 'Your print is approved. Next, a quick look at the Family Meeting guide that comes in your Welcome Kit.', label: 'See the Family Meeting guide', href: stepHref(me, 'meeting_guide') }
    : step === 'first_resource' ? { text: `Your print is approved. Take a quick look at ${first ? short(first.month) : 'your first month'}, change anything, then confirm it.`, label: 'Review your first resource', href: stepHref(me, 'first_resource') }
    : waiting ? null
    : current?.slug ? { text: `${short(current.month)} is ready for your family.`, label: `Open your ${short(current.month)} plan`, href: memberPlanHref(current.slug) }
    : null;

  return (
    <>
      <div className="ofc-club-nav-wrap"><ClubNav current="home" /></div>
      <header className="ofc-club-intro" data-club-home>
        <p className="label text-[#71866c]">ORGANIZED FAMILY CLUB · CLUB HOME</p>
        <h1 className="family-title mt-4">{household?.displayName ?? 'Your family'}</h1>
        {people.length > 0 && (
          <ul className="ofc-family-people" aria-label="Your family">
            {people.map((m) => (
              <li key={m.id}>{m.firstName}{m.kind === 'child' && m.birthYear ? <span> · {ageInMonth(m.birthYear, m.birthMonth, month)}</span> : null}</li>
            ))}
          </ul>
        )}
        <a className="ofc-home-link" href={routes.clubFamily}>Edit my family <span aria-hidden="true">→</span></a>
      </header>

      {action && (
        <section className="ofc-member-kit ofc-next-step" aria-labelledby="ofc-next-title">
          <p className="label text-[#71866c]">Your next step</p>
          <p id="ofc-next-title" className="ofc-kit-status">{action.text}</p>
          <a className="ofc-member-cta" href={action.href}>{action.label}</a>
          {step !== 'profile' && profileLeft > 0 && (
            <p className="ofc-kit-status">Also open: <a href={`${routes.clubFamily}?setup=1`}>finish your family profile</a> ({profileLeft} optional {profileLeft === 1 ? 'question' : 'questions'}).</p>
          )}
        </section>
      )}

      {waiting && me.next && (
        <section className="ofc-member-kit" aria-labelledby="ofc-starts-title" data-club-starts>
          <p className="label text-[#71866c]">Your membership</p>
          <h2 id="ofc-starts-title" className="family-panel-title mt-1">Your Club starts with {short(me.next.month)}</h2>
          <p className="ofc-kit-status">The free first month is one per household, and this household has already had it. Your membership starts with your first payment on <strong>{shortDate(me.next.payment_on!)}</strong>: {short(me.next.month)} opens here that day, and your Welcome Kit (your Family Vision print, our Family Meeting guide and {short(me.next.month)}) is ready for you to approve then.</p>
          {profileLeft > 0 && <a className="ofc-member-cta" href={`${routes.clubFamily}?setup=1`}>Finish your family profile meanwhile</a>}
        </section>
      )}

      {kitOpen && (
        <section className="ofc-member-kit" aria-labelledby="ofc-kit-title">
          <p className="label text-[#71866c]">Your Welcome Kit</p>
          <h2 id="ofc-kit-title" className="family-panel-title mt-1">Your first mailing, together</h2>
          {stage && <KitSteps steps={kitProgress(stage)} className="mt-3" />}
          <ul>
            <li>Your Family Vision watercolor print, our gift</li>
            <li>Our one-page Family Meeting guide</li>
            {first && <li>{short(first.month)}: {title(first.month)}</li>}
          </ul>
          <p className="ofc-kit-status">{kitText(me)} All three come in one mailing.</p>
        </section>
      )}

      {current?.slug && action?.href !== memberPlanHref(current.slug) && (
        <section className="ofc-member-kit" aria-labelledby="ofc-current-title">
          <p className="label text-[#71866c]">{current.month === me.current_month ? 'This month' : 'Your month'} · {monthName(current.month)}</p>
          <h2 id="ofc-current-title" className="family-panel-title mt-1">{title(current.month)}</h2>
          {mailingText(current.mailing) && <p className="ofc-kit-status">Printed copy: {mailingText(current.mailing)}</p>}
          <a className="ofc-member-cta" href={memberPlanHref(current.slug)}>Open your {short(current.month)} plan</a>
        </section>
      )}

      {(upcoming.length > 0 || me.next) && (
        <section className="ofc-member-kit" aria-labelledby="ofc-upcoming-title">
          <p className="label text-[#71866c]">Coming up</p>
          <ul id="ofc-upcoming-title">
            {upcoming.map((m) => <li key={m.month}>{monthName(m.month)}: {title(m.month)} · yours{m.state === 'available' ? '' : ', opens when it’s ready'}</li>)}
            {me.next && <li>{monthName(me.next.month)}: {title(me.next.month)} · opens with your {me.next.payment_on ? shortDate(me.next.payment_on) : 'next'} payment</li>}
          </ul>
        </section>
      )}

      <h2 className="family-panel-title mt-9">Monthly Resources</h2>
      <p className="mt-2 text-sm text-warm-soft">Months marked “Yours” open your family’s own version. The others are a preview of what’s coming.</p>
    </>
  );
}

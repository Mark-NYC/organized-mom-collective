import { useEffect, useState } from 'react';
import { monthColors } from '../theme';
import { clubAccountsEnabled } from '../data/club/config';
import { getSession } from '../lib/account';
import { loadMembership, mailingText, monthName, shortDate, type Membership, type MembershipMonth } from '../lib/club/membership';
import { firstMonth, firstResourceReviewed, homeState, kitItems, kitText, loadMeetingGuideSeen, nextStep, profileDeferred } from '../lib/club/onboarding';
import { clubResourceBySlug } from '../data/club/resources';
import { clubEditingDeadline } from '../lib/club/deadline';
import { accountStore } from '../lib/club/store';
import { ageInMonth, monthOf, type Household } from '../lib/club/profile';
import { SETUP_STEPS, type FamilyProfile } from '../lib/club/family-profile';
import ClubNav from './club/ClubNav';
import WelcomeKitItems from './club/WelcomeKitItems';
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
    "title": "Stop Being the Family's Calendar",
    "responsibility": "Planning together",
    "how": "Our Family Weekly Meeting: a personalized weekly family meeting that helps everyone look ahead, prepare, and own their part.",
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
    "title": "School Routines Without the Nagging",
    "responsibility": "Building independent routines",
    "how": "Our Family Habit Cards: personalized reminder cards help kids practice one small school-day responsibility without constant reminders.",
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
      setHome({ household, profile, deferred: profileDeferred(s.user_id), guideSeen, uid: s.user_id });
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

interface HomeData { household: Household | null; profile: FamilyProfile | null; deferred: boolean; guideSeen: boolean; uid: string | null }

const DAY = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });
const day = (iso: string | null | undefined) => (iso && Number.isFinite(Date.parse(iso)) ? DAY.format(Date.parse(iso)) : null);

/**
 * Club Home (/app/club, signed in): built around where she is, not a setup checklist. Setting up: one next step.
 * Her Welcome Kit: almost ready (the three pieces with their statuses, "Finish My Welcome Kit"), getting ready, on its
 * way (only once it's marked mailed; no delivery dates we don't have). After that, an ongoing membership: this month,
 * what's next and its print deadline, her printables to open and print again, and her family. Every month (#months)
 * stays below. Billing is Account & Billing.
 */
function ClubHome({ me, household, profile, deferred, guideSeen, uid }: { me: Membership } & HomeData) {
  const step = nextStep(me, { profile: household ? profile : null, profileDeferred: deferred, meetingGuideSeen: guideSeen });
  const state = homeState(me, step);
  const first = firstMonth(me);
  const people = household?.members.filter((m) => !m.archived) ?? [];
  const month = monthOf(new Date());
  const profileLeft = profile && !profile.setupCompleted ? SETUP_STEPS.filter((s) => !profile.setupDone.includes(s)).length : 0;
  const current = me.months.find((m) => m.month === me.current_month && m.state === 'available')
    ?? [...me.months].reverse().find((m) => m.state === 'available' && m.month <= me.current_month)
    ?? me.months.find((m) => m.state === 'available');
  const upcoming = me.months.filter((m) => m !== current && m.month > me.current_month && m.fulfilled_by === 'monthly_resource');
  const opened = me.months.filter((m) => m.state === 'available' && m.slug && m.fulfilled_by === 'monthly_resource');
  // The printed resource's name (src/data/club/resources.ts: what prints), else the month card's headline.
  const title = (m: { month: string; slug?: string | null }) => clubResourceBySlug(m.slug)?.title ?? months[Number(m.month.slice(5, 7)) - 1]?.title ?? 'Monthly resource';
  const short = (iso: string) => monthName(iso).split(' ')[0];
  const items = me.welcome ? kitItems(me, firstResourceReviewed(first?.slug, uid), (slug) => clubResourceBySlug(slug)?.title ?? null) : [];
  const next = upcoming[0] ?? null;
  const nextDeadline = next ? day(clubEditingDeadline(next.month.slice(0, 7))) : null;

  return (
    <>
      <ClubNav current="home" />
      <div className="ofc-home-family" data-club-home>
        <p className="ofc-home-family-name">{household?.displayName ?? 'Your family'}</p>
        {people.length > 0 && (
          <ul className="ofc-family-people" aria-label="Your family">
            {people.map((m) => (
              <li key={m.id}>{m.firstName}{m.kind === 'child' && m.birthYear ? <span> · {ageInMonth(m.birthYear, m.birthMonth, month)}</span> : null}</li>
            ))}
          </ul>
        )}
        <a className="ofc-home-link" href={routes.clubFamily}>Edit my family</a>
      </div>

      {state === 'setup' && (
        <section className="ofc-home-hero" aria-labelledby="ofc-hero" data-home-state="setup">
          <p className="label text-[#71866c]">Your Welcome Kit</p>
          <h1 id="ofc-hero" className="ofc-home-title">Let’s finish setting up your family.</h1>
          <p className="ofc-home-lede">{step === 'profile' ? `A few questions about your week are left (${profileLeft} of ${SETUP_STEPS.length}). Every one is optional.` : 'A few details about your family and where to mail your Welcome Kit, then you’ll see the three printed resources we make for you.'}</p>
          <a className="ofc-member-cta" href={routes.clubWelcome}>Continue setup</a>
        </section>
      )}

      {state === 'starts' && me.next && (
        <section className="ofc-home-hero" aria-labelledby="ofc-starts-title" data-club-starts data-home-state="starts">
          <p className="label text-[#71866c]">Your membership</p>
          <h1 id="ofc-starts-title" className="ofc-home-title">Your Club starts with {short(me.next.month)}</h1>
          <p className="ofc-home-lede">The free first month is one per household, and this household has already had it. Your membership starts with your first payment on <strong>{shortDate(me.next.payment_on!)}</strong>: {short(me.next.month)} opens here that day, and your Welcome Kit (your Family Vision Print, the Family Meeting Guide and {short(me.next.month)}) is ready for you to make yours then.</p>
          {profileLeft > 0 && <a className="ofc-member-cta" href={`${routes.clubFamily}?setup=1`}>Finish your family profile meanwhile</a>}
        </section>
      )}

      {state === 'kit_open' && (
        <section className="ofc-home-hero" aria-labelledby="ofc-hero" data-home-state="kit_open">
          <p className="label text-[#71866c]">Your Welcome Kit</p>
          <h1 id="ofc-hero" className="ofc-home-title">Your Welcome Kit is almost ready.</h1>
          <p className="ofc-home-lede">Three printed resources, made for your family and mailed together. {kitText(me)}</p>
          <WelcomeKitItems items={items} firstSlug={first?.slug ?? null} compact />
          <a className="ofc-member-cta" href={routes.clubWelcomeKit}>Finish My Welcome Kit</a>
        </section>
      )}

      {state === 'kit_submitted' && (
        <section className="ofc-home-hero" aria-labelledby="ofc-hero" data-home-state="kit_submitted">
          <p className="label text-[#71866c]">Your Welcome Kit</p>
          <h1 id="ofc-hero" className="ofc-home-title">Your Welcome Kit is getting ready!</h1>
          <p className="ofc-home-lede">{['needs_pdf', 'ready'].includes(me.welcome?.readiness ?? '') && me.welcome?.status === 'pending' ? 'We’re preparing your three printed resources together and aim to mail them in one package within two business days.' : kitText(me)}</p>
          <WelcomeKitItems items={items} firstSlug={first?.slug ?? null} compact />
        </section>
      )}

      {state === 'kit_mailed' && (
        <section className="ofc-home-hero" aria-labelledby="ofc-hero" data-home-state="kit_mailed">
          <p className="label text-[#71866c]">Your Welcome Kit</p>
          <h1 id="ofc-hero" className="ofc-home-title">Your Welcome Kit is on its way.</h1>
          <p className="ofc-home-lede">{day(me.welcome?.mailed_at) ? `We mailed it on ${day(me.welcome?.mailed_at)}.` : 'It’s in the mail.'} When it arrives, here’s where to start:</p>
          <ol className="ofc-home-start">
            <li><strong>Hang your Family Vision Print</strong> where everyone will see it.</li>
            <li><strong>Hold your first family meeting.</strong> <a href={routes.clubMeetingGuide}>The Family Meeting Guide</a> is here too, if you’d like to read it first.</li>
            {first?.slug && <li><strong>Start your {short(first.month)} plan together.</strong> <a href={memberPlanHref(first.slug)}>Open it here</a> anytime to change or print it.</li>}
          </ol>
        </section>
      )}

      {(state === 'ongoing' || state === 'kit_mailed' || state === 'kit_submitted') && (
        <div className="ofc-home-grid">
          {current?.slug && (
            <section className="ofc-member-kit" aria-labelledby="ofc-current-title" data-home-current>
              <p className="label text-[#71866c]">{current.month === me.current_month ? 'This month' : 'Your month'} · {monthName(current.month)}</p>
              <h2 id="ofc-current-title" className="family-panel-title mt-1">{title(current)}</h2>
              {mailingText(current.mailing) && <p className="ofc-kit-status">Printed copy: {mailingText(current.mailing)}</p>}
              <a className="ofc-member-cta" href={memberPlanHref(current.slug)}>Open your {short(current.month)} plan</a>
            </section>
          )}
          {(next || me.next) && (
            <section className="ofc-member-kit" aria-labelledby="ofc-upcoming-title" data-home-next>
              <p className="label text-[#71866c]">Coming up</p>
              {next ? (
                <>
                  <h2 id="ofc-upcoming-title" className="family-panel-title mt-1">{monthName(next.month)}: {title(next)}</h2>
                  <p className="ofc-kit-status">{next.state === 'available' ? `Ready to preview and make yours.${nextDeadline ? ` Changes until ${nextDeadline}, then it goes to print.` : ''}` : 'Yours. It opens here when it’s ready.'}</p>
                  {next.state === 'available' && next.slug && <a className="ofc-home-link" href={memberPlanHref(next.slug)}>Preview and edit {short(next.month)}</a>}
                </>
              ) : me.next && (
                <>
                  <h2 id="ofc-upcoming-title" className="family-panel-title mt-1">{monthName(me.next.month)}: {title(me.next)}</h2>
                  <p className="ofc-kit-status">Opens with your {me.next.payment_on ? shortDate(me.next.payment_on) : 'next'} payment{me.next.regular_cutoff_at && day(me.next.regular_cutoff_at) ? `; print deadline ${day(me.next.regular_cutoff_at)}` : ''}.</p>
                </>
              )}
            </section>
          )}
          <section className="ofc-member-kit" aria-labelledby="ofc-printables-title" data-home-printables>
            <p className="label text-[#71866c]" id="ofc-printables-title">Your printables</p>
            <ul className="ofc-home-list">
              {opened.map((m) => <li key={m.month}><a href={memberPlanHref(m.slug!)}>{short(m.month)}: {title(m)}</a></li>)}
              {me.welcome && <li><a href={routes.clubMeetingGuide}>Family Meeting Guide</a></li>}
              {me.welcome && <li><a href={routes.clubFamilyVision}>Your Family Vision Print</a></li>}
            </ul>
          </section>
          {profileLeft > 0 && (
            <section className="ofc-member-kit" aria-labelledby="ofc-profile-title">
              <p className="label text-[#71866c]" id="ofc-profile-title">Your family profile</p>
              <p className="ofc-kit-status">{profileLeft} optional {profileLeft === 1 ? 'question' : 'questions'} left. The more we know, the better each month fits.</p>
              <a className="ofc-home-link" href={`${routes.clubFamily}?setup=1`}>Finish your family profile</a>
            </section>
          )}
        </div>
      )}

      <h2 className="family-panel-title mt-10">Monthly Resources</h2>
      <p className="mt-2 text-sm text-warm-soft">Months marked “Yours” open your family’s own version. The others are a preview of what’s coming.</p>
    </>
  );
}

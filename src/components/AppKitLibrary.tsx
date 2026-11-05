import { useEffect, useState } from 'react';
import { monthColors } from '../theme';
import { clubAccountsEnabled } from '../data/club/config';
import { getSession } from '../lib/account';
import { loadMembership, mailingText, monthName, shortDate, type Membership, type MembershipMonth } from '../lib/club/membership';
import { firstMonth, firstResourceReviewed, homeState, kitItems, kitText, loadMeetingGuideSeen, nextStep, profileDeferred } from '../lib/club/onboarding';
import { clubResourceBySlug } from '../data/club/resources';
import { accountStore } from '../lib/club/store';
import { ageInMonth, monthOf, type Household } from '../lib/club/profile';
import { SETUP_STEPS, type FamilyProfile } from '../lib/club/family-profile';
import ClubNav from './club/ClubNav';
import WelcomeKitItems from './club/WelcomeKitItems';
import KitPreview from './club/KitPreview';
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
    "how": "Our Family Focus: one page with your family’s shared focus for the month, a small habit or two worth trying, and four Words of the Week.",
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
 * The Club in the app. `view="home"` (/app/club): signed out, the preview library (every month's sample); a member, her
 * Club Home (ClubHome below). `view="months"` (/app/club/months, "Monthly Resources"): every month's card, a member's
 * own months marked as hers and opening her family's version.
 */
export default function AppKitLibrary({ view = 'home' }: { view?: 'home' | 'months' }) {
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
    if (intro && view === 'home') intro.hidden = Boolean(me);
  }, [me]);

  if (view === 'home' && me && home) return <ClubHome me={me} {...home} />;
  return (
    <>
      {me && view === 'months' && <ClubNav current="months" />}
      <MonthGrid me={me} />
      {me && (
        <p className="ofc-member-account">
          <a href={routes.appClub}>Club Home</a> · <a href={routes.clubFamily}>My Family</a> · <a href={routes.clubDashboard}>Account &amp; Billing</a>
        </p>
      )}
    </>
  );
}

const monthIcon = (month: string) => month === 'February' ? laundryIcon
  : month === 'June' ? snackIcon
  : month === 'July' ? playIcon
  : icons[`../../assets/icons/ofc/month-icons/${month}-OFC-icon.png`];

/** Every month's card: what it builds, how, her own version when it's hers, its Family Meeting. */
function MonthGrid({ me }: { me: Membership | null }) {
  return (
    <div className="ofc-app-month-grid" id="months">
      {months.map((m, index) => {
        const src = monthIcon(m.month);
        const held = heldMonth(me, index);
        const coming = me?.next && Number(me.next.month.slice(5, 7)) === index + 1 && !held ? me.next : null;
        return (
          <article className="ofc-app-month" key={m.month} style={{ display: 'block' }}>
            <div className="ofc-app-month-header" style={{ backgroundColor: monthColors[index].hex }}>
              <div className="ofc-app-month-header-text">
                <p className="ofc-app-month-name">{m.month}</p>
                <h3>{m.title}</h3>
              </div>
              {src ? <div className="ofc-app-month-icon"><img src={src} alt="" loading="lazy" width="88" height="88" /></div> : null}
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
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
const listNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * The package's way to her door, moved only by what fulfillment records (status): prepared (submitted), printing,
 * mailed. "At your door" is never marked done: nothing here knows about delivery.
 */
function KitTracker({ status }: { status: string }) {
  const steps = ['Prepared', 'Printing', 'Mailed', 'At your door'];
  const done = status === 'mailed' ? 3 : status === 'printed' ? 2 : 1;
  return (
    <ol className="ofc-tracker" aria-label="Your Welcome Kit’s progress">
      {steps.map((label, i) => {
        const state = i < done ? 'done' : i === done ? 'current' : 'next';
        return (
          <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span aria-hidden="true">{state === 'done' ? '✓' : ''}</span>{label}
            {state === 'done' && <span className="sr-only"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Her three real printables, stacked like the package they arrive in (KitPreview miniatures). */
function KitPackage({ firstSlug }: { firstSlug: string | null }) {
  const sheets = [
    { id: 'guide', src: routes.clubMeetingGuide, target: '[data-meeting-guide-sheet]', label: 'Family Meeting Guide' },
    firstSlug ? { id: 'first', src: memberPlanHref(firstSlug), target: '.club-plan[data-plan-state="ready"] [data-plan-sheet]', label: 'Your first resource' } : null,
    { id: 'print', src: routes.clubFamilyVision, target: '#club-vision-content:not([hidden]) #fvp-art', label: 'Family Vision Print' },
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <div className="ofc-package" aria-hidden="true">
      {sheets.map((x) => <div key={x.id} className="ofc-package-sheet" data-sheet={x.id}><KitPreview src={x.src} target={x.target} label={x.label} /></div>)}
    </div>
  );
}

/**
 * Club Home (/app/club, signed in), in three parts: now (where her Welcome Kit or her month is), this week (one thing
 * to do together), and her year (one strip of months; every card lives on Monthly Resources, /app/club/months). Each
 * thing appears once. Never says shipped before the kit is marked mailed, and never guesses a delivery date.
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
  // The printed resource's name (src/data/club/resources.ts: what prints), else the month card's headline.
  const title = (m: { month: string; slug?: string | null }) => clubResourceBySlug(m.slug)?.title ?? months[Number(m.month.slice(5, 7)) - 1]?.title ?? 'Monthly resource';
  const short = (iso: string) => monthName(iso).split(' ')[0];
  const items = me.welcome ? kitItems(me, firstResourceReviewed(first?.slug, uid), (slug) => clubResourceBySlug(slug)?.title ?? null) : [];
  const kitOnItsWay = state === 'kit_submitted' || state === 'kit_mailed';
  const firstMeeting = kitOnItsWay && current && first && current.month === first.month;

  const monthCard = current?.slug && (
    <section className="ofc-month-feature" aria-labelledby="ofc-current-title" data-home-current>
      <a className="ofc-month-feature-preview" href={memberPlanHref(current.slug)} tabIndex={-1} aria-hidden="true">
        <KitPreview src={memberPlanHref(current.slug)} target='.club-plan[data-plan-state="ready"] [data-plan-sheet]' label={title(current)} />
      </a>
      <div className="ofc-month-feature-text">
        <p className="label text-[#71866c]">{current.month === me.current_month ? 'This month' : 'Your month'} · {monthName(current.month)}</p>
        <h2 id="ofc-current-title" className="ofc-month-feature-title">{title(current)}</h2>
        {people.length > 0 && <p className="ofc-kit-status">Made for {listNames(people.map((p) => p.firstName))}.</p>}
        {mailingText(current.mailing) && <p className="ofc-kit-status">Printed copy: {mailingText(current.mailing)}</p>}
        <div className="ofc-actions">
          <a className="ofc-member-cta" href={memberPlanHref(current.slug)}>Open &amp; edit</a>
          <a className="ofc-home-link" href={memberPlanHref(current.slug)}>Print it at home</a>
        </div>
      </div>
    </section>
  );

  return (
    <>
      <ClubNav current="home" />

      {/* ------------------------------------------------ now */}
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

      {kitOnItsWay && me.welcome && (
        <section className="ofc-kit-band" aria-labelledby="ofc-hero" data-home-state={state}>
          <div className="ofc-kit-band-text">
            <p className="label text-[#71866c]">Your Welcome Kit</p>
            <h1 id="ofc-hero" className="ofc-home-title">{state === 'kit_mailed' ? 'Your Welcome Kit is on its way.' : 'Your Welcome Kit is getting ready!'}</h1>
            <KitTracker status={me.welcome.status} />
            <p className="ofc-home-lede">
              {state === 'kit_mailed'
                ? `${day(me.welcome.mailed_at) ? `We mailed it on ${day(me.welcome.mailed_at)}.` : 'It’s in the mail.'} Your Family Vision Print, the Family Meeting Guide and your ${first ? short(first.month) : 'first'} plan, together in one package.`
                : me.welcome.status === 'printed' ? 'Your three printed resources are printed and getting ready to mail, together in one package.'
                : 'We’re preparing your three printed resources together and aim to mail them in one package within two business days.'}
            </p>
          </div>
          <KitPackage firstSlug={first?.slug ?? null} />
        </section>
      )}

      {state === 'ongoing' && monthCard}

      {/* ------------------------------------------------ this week */}
      {current?.slug && (kitOnItsWay || state === 'ongoing') && (
        <section className="ofc-this-week" aria-labelledby="ofc-week-title" data-home-week>
          <p className="label text-[#71866c]">This week with your family</p>
          <h2 id="ofc-week-title" className="ofc-this-week-title">{firstMeeting ? 'Hold your first family meeting.' : `This month’s family meeting`}</h2>
          <p className="ofc-home-lede">{firstMeeting
            ? `No need to wait for the mail. Ten minutes${people.length > 1 ? `, and ${listNames(people.map((p) => p.firstName))} each get a part` : ', and everyone gets a part'}.`
            : `Ten minutes to introduce ${title(current)} and give everyone a part.`}</p>
          <div className="ofc-actions">
            <a className="ofc-member-cta" href={routes.clubMeeting(short(current.month).toLowerCase())}>Start the family meeting</a>
            <a className="ofc-home-link" href={routes.clubMeetingGuide}>Read the Meeting Guide</a>
          </div>
        </section>
      )}

      {kitOnItsWay && monthCard}

      {/* ------------------------------------------------ her year */}
      <section className="ofc-year" aria-labelledby="ofc-year-title" data-home-year>
        <div className="ofc-year-head">
          <h2 id="ofc-year-title" className="family-panel-title">Your year</h2>
          <a className="ofc-home-link" href={routes.appClubMonths}>All monthly resources</a>
        </div>
        <ol className="ofc-year-strip">
          {months.map((m, index) => {
            const held = heldMonth(me, index);
            const coming = me.next && Number(me.next.month.slice(5, 7)) === index + 1 && !held ? me.next : null;
            const href = held?.state === 'available' && held.slug ? memberPlanHref(held.slug) : m.url;
            const tag = held ? (held.state === 'available' ? 'Yours' : 'Yours · coming soon')
              : coming ? (coming.payment_on ? `Opens ${SHORT.format(Date.parse(coming.payment_on))}` : 'Next') : 'Preview';
            return (
              <li key={m.month} data-month={m.month.toLowerCase()} data-held={held ? '' : undefined} data-next={coming ? '' : undefined}>
                <a href={href} style={{ borderTopColor: monthColors[index].hex }}>
                  <span className="ofc-year-month">{m.month}</span>
                  <span className="ofc-year-title">{held?.slug ? title(held) : m.title}</span>
                  <span className="ofc-year-tag">{tag}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ------------------------------------------------ her family and account */}
      <footer className="ofc-home-foot" data-club-home>
        <div className="ofc-home-family">
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
        {profileLeft > 0 && state !== 'setup' && state !== 'starts' && (
          <p className="ofc-kit-status">{profileLeft} optional family {profileLeft === 1 ? 'question' : 'questions'} left. <a className="ofc-home-link" href={`${routes.clubFamily}?setup=1`}>Finish your family profile</a></p>
        )}
        <p className="ofc-home-foot-links">
          {me.welcome && <><a href={routes.clubFamilyVision}>Your Family Vision Print</a> · <a href={routes.clubMeetingGuide}>Family Meeting Guide</a> · </>}
          <a href={routes.clubDashboard}>Account &amp; Billing</a>
        </p>
      </footer>
    </>
  );
}

import { useEffect, useState } from 'react';
import { monthColors } from '../theme';
import { clubAccountsEnabled } from '../data/club/config';
import { getSession, accountRpc } from '../lib/account';
import { loadMembership, monthName, shortDate, type Membership, type MembershipMonth } from '../lib/club/membership';
import { firstMonth, kitText, nextStep, stepHref } from '../lib/club/onboarding';
import { clubResourceBySlug } from '../data/club/resources';
import { routes } from '../routes';
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
  const [family, setFamily] = useState<string | null>(null);

  useEffect(() => {
    if (!clubAccountsEnabled()) return;
    getSession().then(async (s) => {
      if (!s) return;
      const m = await loadMembership();
      if (!m.member && !m.grant) return;
      const h = await accountRpc<{ display_name: string | null } | null>('club_household').catch(() => null);
      setFamily(h?.display_name ?? null);
      setMe(m);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const intro = document.getElementById('club-preview-intro');
    if (intro) intro.hidden = Boolean(me);
  }, [me]);

  return (
    <>
      {me && <MemberIntro me={me} family={family} />}
      <div className="ofc-app-month-grid">
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
          Your account: <a href={routes.clubDashboard}>billing, family and mailing address</a>
        </p>
      )}
    </>
  );
}

function MonthLink({ m, held }: { m: (typeof months)[number]; held: MembershipMonth | null }) {
  if (held?.state === 'available' && held.slug) return <a href={routes.clubResource(held.slug)}>Open your {m.month} plan <span aria-hidden="true">→</span></a>;
  if (held?.state === 'welcome_vision') return <a href={routes.clubFamilyVision}>See your print <span aria-hidden="true">→</span></a>;
  if (held) return <><p>Yours. We’re finishing it; it opens here when it’s ready.</p><a href={m.url}>Preview the tool <span aria-hidden="true">→</span></a></>;
  return <a href={m.url}>Preview the tool <span aria-hidden="true">→</span></a>;
}

/** Her Club's opening: her family, and her Welcome Kit until it's in the mail. */
function MemberIntro({ me, family }: { me: Membership; family: string | null }) {
  const step = nextStep(me);
  const first = firstMonth(me);
  const kit = me.welcome && !me.welcome.satisfies_month && me.welcome.status !== 'mailed' && me.welcome.status !== 'canceled';
  return (
    <>
      <header className="ofc-club-intro">
        <p className="label text-[#71866c]">ORGANIZED FAMILY CLUB{family ? ` · ${family.toUpperCase()}` : ''}</p>
        <h1 className="family-title mt-4">One small win <em className="ofc-rose-emphasis">each month.</em></h1>
        <p className="family-lede mt-4">Your family’s monthly resources live here, each one prepared with your family’s names. Open a month to print it, change it, or get the kids started.</p>
      </header>
      {kit && (
        <section className="ofc-member-kit" aria-labelledby="ofc-kit-title">
          <p className="label text-[#71866c]">Your Welcome Kit</p>
          <h2 id="ofc-kit-title" className="family-panel-title mt-1">Your first mailing, together</h2>
          <ul>
            <li>Your Family Vision watercolor print, our gift</li>
            {first && <li>{monthName(first.month)}: {clubResourceBySlug(first.slug)?.title ?? first.title ?? 'your first family resource'}</li>}
          </ul>
          <p className="ofc-kit-status">{kitText(me)}</p>
          {step === 'print' && <a className="ofc-member-cta" href={stepHref(me, 'print')}>Approve your welcome print</a>}
          {step === 'first_resource' && <a className="ofc-member-cta" href={stepHref(me, 'first_resource')}>See your first family resource</a>}
        </section>
      )}
      <h2 className="family-panel-title mt-9">Your year in the Club</h2>
      <p className="mt-2 text-sm text-warm-soft">Months marked “Yours” open your family’s own version. The others are a preview of what’s coming.</p>
    </>
  );
}

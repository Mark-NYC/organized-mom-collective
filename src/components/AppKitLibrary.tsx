import { monthColors } from '../theme';
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

export default function AppKitLibrary() {
  return (
    <div className="ofc-app-month-grid">
      {months.map((m, index) => {
        const src = m.month === 'February' ? laundryIcon
          : m.month === 'June' ? snackIcon
          : m.month === 'July' ? playIcon
          : icons[`../../assets/icons/ofc/month-icons/${m.month}-OFC-icon.png`];
        const calendarColor = monthColors[index].hex;
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
              <p><strong>Builds:</strong> {m.responsibility}</p>
              <p><strong>How:</strong> {m.how}</p>
              <a href={m.url}>Preview the tool <span aria-hidden="true">→</span></a>
            </div>
          </article>
        );
      })}
    </div>
  );
}

import { monthColors } from '../theme';
// The app Club library mirrors the benefit-first public Club month descriptions.
// Keep icons linked to the original artwork in assets/icons/ofc/month-icons.
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
    "title": "Connection You Don't Have to Plan",
    "responsibility": "Initiating connection",
    "how": "Four simple invitations help kids take the lead in spending time together.",
    "url": "/app/club/february/"
  },
  {
    "month": "March",
    "title": "Cleaning Without Managing Everyone",
    "responsibility": "Finishing a job",
    "how": "Each person gets a clear job, the steps, supplies, and what finished looks like.",
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
    "title": "Less Screen-Time Negotiating",
    "responsibility": "Respecting shared boundaries",
    "how": "Shared screen-time expectations and responsibilities make summer rules clear.",
    "url": "/app/club/june/"
  },
  {
    "month": "July",
    "title": "No More Packing for Everyone",
    "responsibility": "Preparing independently",
    "how": "Personal packing lists show each person what to pack, check, and put away.",
    "url": "/app/club/july/"
  },
  {
    "month": "August",
    "title": "Back to School Without the Scramble",
    "responsibility": "Taking initiative",
    "how": "A personalized countdown gives everyone their own school-ready responsibilities.",
    "url": "/club/august-preview/"
  },
  {
    "month": "September",
    "title": "Stop Being the Family's Calendar",
    "responsibility": "Planning together",
    "how": "A short weekly meeting helps everyone know the plan and own their commitments.",
    "url": "/club/september-preview/"
  },
  {
    "month": "October",
    "title": "Get Ahead of the Last-Minute Scramble",
    "responsibility": "Noticing what is needed",
    "how": "A seasonal readiness plan helps family members spot and handle needs early.",
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
    "title": "Christmas Without Doing It All",
    "responsibility": "Contributing to family traditions",
    "how": "A prepared holiday plan shares responsibility for gifts, traditions, and celebrations.",
    "url": "/club/december-preview/"
  }
];

export default function AppKitLibrary() {
  return (
    <div className="ofc-app-month-grid">
      {months.map((m, index) => {
        const src = icons[`../../assets/icons/ofc/month-icons/${m.month}-OFC-icon.png`];
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

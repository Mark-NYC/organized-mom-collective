/**
 * /app/family/meeting: the free weekly Family Meeting in Our Week. The standard guide's four parts, in its order, timing
 * and words (src/data/club/meeting-guide.ts: Our Focus 2 · Let's Talk 3 · Everyone's Part 3 · Let's Practice 2), with
 * the family's own week and agreements beside them. Nothing personalized: the monthly Family Focus, its questions and
 * age-fit suggestions are the Family Meeting Club's (linked for members, never sold here).
 *
 * Everyone's Part: the family writes down what each person agreed to (saved on this phone first, then the household;
 * src/lib/agreements). That's the guide's own instruction: "Write it down where everyone can see it."
 */
import { useEffect, useState } from 'react';
import { MEETING_GUIDE } from '../../data/club/meeting-guide';
import { RESPONSIBILITY_CATEGORIES } from '../../data/club/family-profile';
import { useCalendar } from '../../lib/calendar/client';
import { localToday } from '../../lib/calendar/recurrence';
import { useToday } from '../../lib/hooks';
import { agreementsByPerson, monthOf, weekAhead } from '../../lib/family-meeting-support';
import { useFamily } from '../../lib/family-meeting-client';
import { conflictText } from '../../lib/agreements/client';
import { accountStore } from '../../lib/club/store';
import { getSession } from '../../lib/account';
import AgreedParts from '../family/AgreedParts';
import type { ResponsibilityCategory } from '../../data/club/family-profile';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export default function WeeklyMeeting() {
  const today = useToday();
  const cal = useCalendar();
  const scope = cal.state.scope !== 'local' ? cal.state.scope : null;
  const fam = useFamily(scope);
  const [club, setClub] = useState(false);
  useEffect(() => {
    void getSession().then(async (s) => { if (s) setClub(Boolean((await accountStore.me().catch(() => null))?.access)); });
  }, []);
  const week = weekAhead(Object.values(cal.state.events), localToday(today), today);
  const people = (cal.household?.members ?? []).filter((m) => !m.archived && m.firstName.trim());
  const agreed = agreementsByPerson(cal.household, fam.profile);
  const [who, setWho] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ResponsibilityCategory>('other');
  const [msg, setMsg] = useState('');
  const parts = MEETING_GUIDE.parts;

  const add = async () => {
    if (!text.trim() || !who.length) return;
    setMsg('');
    try {
      await fam.saveAgreement({ category, text, ownerIds: who, month: monthOf(today) });
      setText(''); setWho([]);
      setMsg('Saved: agreed by our family.');
    } catch {
      setMsg('Sign in to save your family’s agreements.');
    }
  };

  return (
    <div className="family-brand mx-auto max-w-3xl space-y-8" data-weekly-meeting>
      <header>
        <a href="/app/family" className="family-link !min-h-0">← Family</a>
        <p className="label mt-5 text-[#71866c]">OUR FAMILY MEETING</p>
        <h1 className="family-title mt-3 !text-[2.1rem]">{MEETING_GUIDE.title}</h1>
        <p className="family-lede mt-3">{MEETING_GUIDE.subtitle}</p>
      </header>

      {parts.map((p, i) => (
        <section key={p.title} className="family-panel" aria-labelledby={`wm-${i}`} data-meeting-part={p.title}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`wm-${i}`} className="family-panel-title"><span className="mr-2 text-[#71866c]">{i + 1}</span>{p.title}</h2>
            <span className="text-sm text-warm-soft">{p.minutes} min</span>
          </div>
          <p className="mt-2 text-[0.95rem] leading-relaxed">{p.text}</p>

          {p.title === 'Let’s Talk' && week.count > 0 && (
            <details className="mt-4" data-meeting-week>
              <summary className="cursor-pointer text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#71866c]">This week on our calendar ▾</summary>
              <ul className="mt-2 space-y-1.5 text-[0.92rem]">
                {week.days.filter((d) => d.items.length).map((d) => (
                  <li key={d.date}><strong className="text-sm">{d.label}</strong>{d.items.map((x) => (
                    <span key={x.id + x.date} className="ml-2 inline-flex items-center gap-1.5 text-warm-soft">
                      <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ background: cal.colors[x.memberIds[0] ?? x.ownerId ?? '']?.hex ?? '#9aab8f' }} />
                      {x.time === 'All day' ? '' : `${x.time} `}{x.title}</span>))}</li>
                ))}
              </ul>
            </details>
          )}

          {p.title === 'Everyone’s Part' && (
            <div className="mt-4" data-meeting-parts-agreed>
              {agreed.length ? <AgreedParts people={agreed} colors={cal.colors} compact /> : <p className="text-sm text-warm-soft">Nothing written down yet.</p>}
              {cal.household ? (
                <form className="mt-5 border-t border-warm-rule pt-4" onSubmit={(e) => { e.preventDefault(); void add(); }} data-add-agreement>
                  <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">What we agreed
                    <input value={text} maxLength={160} onChange={(e) => setText(e.target.value)} placeholder="Feed the dog before school" className="mt-1 block min-h-[44px] w-full border border-warm-rule bg-white px-2 text-[0.95rem] normal-case tracking-normal text-warm-ink" data-agreement-new />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Whose part">
                    {people.map((m) => (
                      <button key={m.id} type="button" aria-pressed={who.includes(m.id)} onClick={() => setWho((w) => (w.includes(m.id) ? w.filter((x) => x !== m.id) : [...w, m.id]))} data-owner-chip={m.firstName}
                        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-sm ${who.includes(m.id) ? 'border-warm-ink bg-[#f3f6f1] font-semibold' : 'border-warm-rule bg-white'}`}>
                        <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: cal.colors[m.id]?.hex }} />{m.firstName}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">Kind of job
                    <select value={category} onChange={(e) => setCategory(e.target.value as ResponsibilityCategory)} className="mt-1 block min-h-[44px] w-full border border-warm-rule bg-white px-2 text-[0.95rem] normal-case tracking-normal text-warm-ink">
                      {RESPONSIBILITY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <button type="submit" className="family-action mt-4" disabled={!text.trim() || !who.length} data-save-new-agreement>We agreed</button>
                  <p role="status" className="mt-2 text-sm text-[#536e4e]">{msg}</p>
                  {fam.pending > 0 && fam.status === 'offline' && <p className="text-sm text-warm-soft">Saved on this phone. It will sync when you’re back online.</p>}
                  {fam.conflicts.map((c) => <p key={c.id + c.at} role="alert" className="text-sm">{conflictText(c)}</p>)}
                </form>
              ) : (
                <a href="/app/sign-in?next=/app/family/meeting" className="family-link mt-4">Sign in to write down your family’s parts →</a>
              )}
            </div>
          )}
        </section>
      ))}

      {club && (
        <a href={`/app/club/${MONTHS[today.getMonth()]}?view=meeting`} className="family-panel block" data-club-month-meeting>
          <p className="label text-[#71866c]">FAMILY MEETING CLUB</p>
          <h2 className="family-panel-title mt-3">This month’s Family Focus</h2>
          <p className="mt-2 text-sm text-warm-soft">Your personalized meeting for {MONTHS[today.getMonth()][0].toUpperCase() + MONTHS[today.getMonth()].slice(1)}, with ideas for each person.</p>
        </a>
      )}
    </div>
  );
}

/**
 * V16: the optional, small handoff to paper. Two real products, two real layouts:
 *   2027 Family Life Weekly Wall Calendar  → Mon–Fri boxes and a Sat/Sun row, each with its PRINTED cleaning zone
 *                                            label (src/data/cleaning.ts: the same words as the print), so cleaning
 *                                            jobs never need copying.
 *   2027 Family Schedule Monthly Wall Calendar → each week is a band of family-name rows × Mon–Sun, with To Do circles.
 * The preview writes only agreed parts and chosen priorities, in each person's own marker color. Nothing to check off.
 */
import { weekend, weeklySchedule } from '../../data/cleaning';
import { addDays, timeLabel } from '../../lib/calendar/recurrence';
import { currentPriorities, occurrenceOf, partDate, type Part } from '../../lib/v16/model';
import type { Ctx } from './shared';

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const zoneFor = (i: number) => (i < 4 ? weeklySchedule[i].zone : weekend.days[i - 4].zone);

function Hand({ ctx, who, text }: { ctx: Ctx; who: string | null; text: string }) {
  return <span className="v16-hand" style={{ color: who ? ctx.colors[who]?.hex : '#4d4544' }}>{who ? `${ctx.names[who]}: ` : ''}{text}</span>;
}

export default function WallCalendar({ ctx }: { ctx: Ctx }) {
  const { format, plan } = ctx.s.wall;
  const agreed = ctx.s.parts.filter((p) => p.status === 'agreed');
  // Weekly page: what goes in ink is preparation for an activity and the chosen priorities; cleaning is pre-printed.
  const weeklyItems = (date: string) => [
    ...currentPriorities(ctx.s).flatMap((p) => {
      const o = p.eventLink ? occurrenceOf(ctx.s, ctx.monday, p.eventLink) : null;
      return o && o.date === date ? [{ key: p.id, who: null, text: `${o.event.title} ${timeLabel(o.event).replace(/–.*/, '')}` }] : [];
    }),
    ...agreed.filter((p) => p.eventLink && partDate(ctx.s, ctx.monday, p) === date).map((p) => ({ key: p.id, who: p.ownerId, text: p.title })),
  ];
  const personCell = (memberId: string, date: string): Part[] =>
    agreed.filter((p) => p.ownerId === memberId && partDate(ctx.s, ctx.monday, p) === date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ctx.monday, i));
  const set = (patch: Partial<typeof ctx.s.wall>) => ctx.set((s) => ({ ...s, wall: { ...s.wall, ...patch } }));
  return (
    <section className="v16-section" aria-labelledby="wall-h" data-wall>
      <div className="flex items-center justify-between gap-3">
        <h2 className="v16-h3" id="wall-h">Put it on the wall</h2>
        <label className="v16-sr" htmlFor="wall-format">Which wall calendar</label>
        <select id="wall-format" className="v16-input !w-auto !min-h-[44px] !rounded-full" value={format} onChange={(e) => set({ format: e.target.value as 'weekly' | 'monthly' })} data-wall-format>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <p className="v16-meta mt-1">Optional. {format === 'weekly' ? '2027 Family Life Weekly Wall Calendar' : '2027 Family Schedule Monthly Wall Calendar'}, this week.</p>

      {format === 'weekly' ? (
        <div className="v16-paper" data-wall-preview="weekly" aria-label="Preview of this week on the weekly wall calendar">
          <div className="v16-weekly">
            {days.slice(0, 5).map((d, i) => (
              <div key={d}><span className="font-semibold">{DOW[i]} {d.slice(8)}</span>
                {weeklyItems(d).map((it) => <Hand key={it.key} ctx={ctx} who={it.who} text={it.text} />)}
                <span className="v16-zone">{zoneFor(i)}</span></div>
            ))}
          </div>
          <div className="v16-weekly-end">
            {days.slice(5).map((d, i) => (
              <div key={d}><span className="font-semibold">{DOW[5 + i]} {d.slice(8)}</span>
                {weeklyItems(d).map((it) => <Hand key={it.key} ctx={ctx} who={it.who} text={it.text} />)}
                <span className="v16-zone">{zoneFor(5 + i)}</span></div>
            ))}
          </div>
          <p className="mt-2 text-[0.6rem] text-[#8a807b]">Below this on the page: self-care habits, word of the week, family and friends, grateful for, meal plan, grocery list, to do, notes.</p>
        </div>
      ) : (
        <div className="v16-paper" data-wall-preview="monthly" aria-label="Preview of this week on the monthly wall calendar">
          <p className="v16-paper-title">{new Date(`${ctx.monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
          <div className="v16-monthly">
            <div className="v16-m-head !justify-start">Family Names</div>
            {days.map((d, i) => <div key={d} className="v16-m-head">{DOW[i].slice(0, 3)} {+d.slice(8)}</div>)}
            <div className="v16-m-head">To Do</div>
            {ctx.people.map((m) => [
              <div key={`${m.id}-n`} className="v16-hand" style={{ color: ctx.colors[m.id]?.hex }}>{m.firstName}</div>,
              ...days.map((d) => <div key={`${m.id}-${d}`}>{personCell(m.id, d).map((p) => <span key={p.id} className="v16-hand" style={{ color: ctx.colors[m.id]?.hex }}>{p.title}</span>)}</div>),
              <div key={`${m.id}-t`} className="v16-m-todo" />,
            ])}
          </div>
        </div>
      )}
      <p className="v16-meta mt-2">{format === 'weekly' ? 'Cleaning zones are already printed on every weekly page, so cleaning jobs don’t need copying. Different cleaning days in the app don’t change the print.' : 'One row per person, written in their own color. Their agreed parts go on the day they happen.'}</p>

      <fieldset className="mt-3" data-wall-plan>
        <legend className="v16-sr">How you’ll do it</legend>
        {([['together', 'We’ll add it together'], ['later', 'We’ll do it later'], ['other', 'We use another planner, or no paper']] as const).map(([v, label]) => (
          <label key={v} className="v16-radio"><input type="radio" name="wall-plan" checked={plan === v} onChange={() => set({ plan: v })} />{label}</label>
        ))}
      </fieldset>
      <p className="v16-meta">Kids can write, point, draw or help. Nothing here needs checking off to finish.</p>
    </section>
  );
}

/**
 * V16 Cleaning: the cleaning companion's whole routine, from src/data/cleaning.ts (never retyped): Daily Reset's five
 * tasks, the Mon–Thu zones with every task, Deep Cleaning / Home Project / Catch-Up on Fri–Sun with this month's home
 * project. Rhythm: follow the printed calendar, one main cleaning day, or not right now; Daily Reset on or off.
 * Moving this week's session moves the SAME session (same checks); next week is back on its usual day.
 * One check per task, the same one Today shows.
 */
import { useState } from 'react';
import { dailyEssentials, monthlyDeepClean, weekend, weeklySchedule } from '../../data/cleaning';
import { addDays, weekday } from '../../lib/calendar/recurrence';
import { DAY_NAMES, agreedParts, dailyKey, moveSession, sessionDay, sessionsOn, zoneKey, type CleaningMode } from '../../lib/v16/model';
import { Check, Person, fmtDate, type Ctx } from './shared';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function Cleaning({ ctx }: { ctx: Ctx }) {
  const [rhythm, setRhythm] = useState(false);
  const [week, setWeek] = useState<0 | 1>(0);
  const [wd, setWd] = useState(() => weekday(ctx.today));
  const monday = addDays(ctx.monday, week * 7);
  const date = addDays(monday, (wd + 6) % 7);
  const c = ctx.s.cleaning;
  const setC = (patch: Partial<typeof c>) => ctx.set((s) => ({ ...s, cleaning: { ...s.cleaning, ...patch } }));
  const toggle = (key: string) => ctx.set((s) => {
    const checks = { ...s.cleaning.checks };
    if (checks[key]) delete checks[key]; else checks[key] = true;
    return { ...s, cleaning: { ...s.cleaning, checks } };
  });
  const usual = weeklySchedule.find((z) => z.day === wd);
  const here = sessionsOn(ctx.s, monday, wd);
  const movedAway = usual && c.mode === 'printed' && sessionDay(ctx.s, monday, usual.day) !== wd ? sessionDay(ctx.s, monday, usual.day) : null;
  const end = weekend.days.find((d) => d.day === wd);
  const project = monthlyDeepClean.find((m) => m.month === Number(monday.slice(5, 7)) - 1);
  const owners = (taskId: string) => agreedParts(ctx.s).filter((p) => p.cleaningTask?.taskId === taskId);
  return (
    <section data-screen="cleaning">
      <div className="flex items-center justify-between gap-3 pt-2">
        <h1 className="v16-h1">Cleaning</h1>
        <button type="button" className="v16-choice" aria-expanded={rhythm} onClick={() => setRhythm(!rhythm)} data-rhythm>Rhythm</button>
      </div>
      {rhythm && (
        <div className="v16-editor mt-3" data-rhythm-panel>
          <p className="v16-h3">Our cleaning rhythm</p>
          {([['printed', 'Follow the printed calendar'], ['one-day', 'One main cleaning day'], ['off', 'Not right now']] as [CleaningMode, string][]).map(([v, label]) => (
            <label key={v} className="v16-radio"><input type="radio" name="mode" checked={c.mode === v} onChange={() => setC({ mode: v })} data-mode={v} />{label}</label>
          ))}
          {c.mode === 'one-day' && (
            <label className="v16-field">Our cleaning day
              <select className="v16-input" value={c.mainDay} onChange={(e) => setC({ mainDay: Number(e.target.value) })} data-main-day>
                {ORDER.map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
              </select></label>
          )}
          <label className="v16-radio"><input type="checkbox" checked={c.dailyReset} onChange={(e) => setC({ dailyReset: e.target.checked })} data-daily-toggle />Include Daily Reset</label>
          <button type="button" className="v16-choice w-full" onClick={() => setRhythm(false)}>Done</button>
          <p className="v16-meta">The printed calendar never changes. These choices only change what the app shows each day.</p>
        </div>
      )}
      <p className="v16-lede">One checklist. A routine the whole family can share.</p>

      {usual && c.mode === 'printed' && (
        <div className="v16-card" data-session-card>
          <div className="flex items-center gap-3">
            <img src={usual.icon} alt="" width="36" height="36" className="size-9" />
            <div><p className="v16-card-title">{usual.zone}</p><p className="text-[0.82rem]">{DAY_NAMES[usual.day]}, our usual day</p></div>
          </div>
          <div className="mt-2 flex items-center gap-2" data-move-row>
            <Check checked={sessionDay(ctx.s, monday, usual.day) === 6} label={`Move ${week === 0 ? 'this' : 'next'} week’s session to Saturday`}
              onChange={() => setC({ moved: moveSession(ctx.s, monday, usual.day, sessionDay(ctx.s, monday, usual.day) === 6 ? null : 6) })} />
            <span className="text-[0.95rem]" aria-hidden="true">Move {week === 0 ? 'this' : 'next'} week’s session to Saturday</span>
          </div>
          {movedAway !== null && <p className="text-[0.84rem]" role="status">Moved to {DAY_NAMES[movedAway]} for {week === 0 ? 'this' : 'that'} week only. The checklist moves with it; the week after, it’s back on {DAY_NAMES[usual.day]}.</p>}
        </div>
      )}

      <label className="v16-inline-field mt-3">View day
        <select className="v16-input" value={wd} onChange={(e) => setWd(Number(e.target.value))} data-view-day>
          {ORDER.map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
        </select></label>
      <div className="flex items-center justify-between gap-3">
        <p className="v16-meta">{fmtDate(date)}</p>
        <div className="of-seg" role="group" aria-label="Which week">
          <button type="button" aria-pressed={week === 0} onClick={() => setWeek(0)} data-view-week="0">This week</button>
          <button type="button" aria-pressed={week === 1} onClick={() => setWeek(1)} data-view-week="1">Next week</button>
        </div>
      </div>

      {c.dailyReset && c.mode !== 'off' && (
        <div className="v16-section !mt-5" data-daily-reset>
          <div className="flex items-center gap-2"><img src={dailyEssentials.icon} alt="" width="28" height="28" className="size-7" /><p className="v16-eyebrow">{dailyEssentials.title} · {dailyEssentials.minutes}</p></div>
          <ul className="v16-rows">{dailyEssentials.tasks.map((t) => {
            const key = dailyKey(date, t.id);
            return <li key={t.id} className="v16-row !min-h-[48px] !py-1"><Check checked={Boolean(c.checks[key])} label={t.label} onChange={() => toggle(key)} /><span className="v16-row-main">{t.label}</span></li>;
          })}</ul>
        </div>
      )}

      {here.map((z) => {
        const zone = weeklySchedule.find((x) => x.day === z)!;
        return (
          <div key={z} className="v16-section !mt-6" data-zone-session={zone.zone}>
            <div className="flex items-center gap-2"><img src={zone.icon} alt="" width="28" height="28" className="size-7" />
              <p className="v16-eyebrow">{zone.zone} · {zone.minutes}{z !== wd ? ` · moved from ${DAY_NAMES[z]}, this week only` : ''}</p></div>
            <ul className="v16-rows">{zone.tasks.map((t) => {
              const key = zoneKey(monday, z, t.id);
              const who = owners(t.id);
              return <li key={t.id} className="v16-row !min-h-[48px] !py-1"><Check checked={Boolean(c.checks[key])} label={t.label} onChange={() => toggle(key)} />
                <span className="v16-row-main">{t.label}</span>{who.map((p) => <span key={p.id} className="inline-flex items-center gap-1 text-[0.78rem]"><Person ctx={ctx} id={p.ownerId} />{ctx.names[p.ownerId!]}’s part</span>)}</li>;
            })}</ul>
          </div>
        );
      })}

      {end && c.mode === 'printed' && (
        <div className="v16-section !mt-6" data-weekend-zone={end.zone}>
          <div className="flex items-center gap-2"><img src={weekend.icon} alt="" width="28" height="28" className="size-7" /><p className="v16-eyebrow">{end.zone}</p></div>
          <p className="v16-meta mt-1">{weekend.description}</p>
          {project && <details className="v16-details"><summary>This month: {project.title}</summary>
            <ul className="v16-rows">{project.tasks.map((t) => {
              const key = `monthly:${monday.slice(0, 7)}:${t.id}`;
              return <li key={t.id} className="v16-row !min-h-[48px] !py-1"><Check checked={Boolean(c.checks[key])} label={t.label} onChange={() => toggle(key)} /><span className="v16-row-main">{t.label}</span></li>;
            })}</ul></details>}
        </div>
      )}
      {c.mode === 'off' && <p className="v16-card v16-card--quiet">Cleaning is paused. Turn it back on in Rhythm any time; nothing was lost.</p>}
      {c.mode !== 'off' && !here.length && !end && !c.dailyReset && <p className="v16-meta mt-4">Nothing scheduled this day.</p>}

      <details className="v16-details mt-6 border-t border-[color:var(--of-rule)]" data-full-week>
        <summary>The whole week</summary>
        <ul className="v16-rows">{ORDER.map((d) => {
          const zones = sessionsOn(ctx.s, monday, d).map((z) => weeklySchedule.find((x) => x.day === z)!.zone);
          const we = c.mode === 'printed' ? weekend.days.find((x) => x.day === d)?.zone : undefined;
          return <li key={d} className="v16-row !min-h-[44px]"><span className="w-24 font-semibold">{DAY_NAMES[d]}</span><span className="v16-meta">{[...zones, ...(we ? [we] : [])].join(' · ') || '—'}</span></li>;
        })}</ul>
      </details>
      <p className="v16-meta mt-4">Completion shows on Today. It doesn’t change anyone’s independence by itself.</p>
      <button type="button" className="of-btn of-btn--soft of-btn--block mt-5" onClick={() => ctx.go('today')}>Back to Today</button>
    </section>
  );
}

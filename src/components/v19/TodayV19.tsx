/**
 * V19 Today (docs/ios/V19_ATTENTION.md): maximum intelligence, minimum interruption. The same screen as V18, refined:
 *
 *   a short headline (no repeated subline) · "Something changed?" (a quiet link, not a card)
 *   one light brown card at most, or none · What matters ordered for today, earlier days receded
 *   Everyone's part (a part that needs backup carries one quiet line) · one Family Meeting row
 *
 * Every card resolves in one sheet that isolates what's affected and offers grounded options; nothing changes until
 * the family taps "Update our plan". Dismiss stays one tap; "Tell us more" is optional.
 */
import { useEffect, useMemo, useState } from 'react';
import { timeLabel } from '../../lib/calendar/recurrence';
import { dayName, sharedOccurrences, type Part, type V16State } from '../../lib/v16/model';
import { nextMeeting, pendingInterpretations, propose, type TodayInput } from '../../lib/v18/engine';
import { simulatedInterpreter, validateInterpretation } from '../../lib/v18/interpret';
import { buildTodayV19, matterRowsV19, type MatterRowV19 } from '../../lib/v19/engine';
import type { Report, SmartInsight } from '../../lib/v19/attention';
import { addFeedback, applyChoices, giveFeedback, markShown } from '../../lib/v19/resolve';
import { InsightSheet, PartLine, PrepLine, enginePeople } from '../v18/TodayV18';
import { PartRow } from '../v16/Parts';
import { Art, artFor, Person, Sheet, fmtDate, type Ctx, type Glyph } from '../v16/shared';
import { Chevron } from '../app/ui';
import { dailyEssentials, weeklySchedule } from '../../data/cleaning';
import { Badge, badgeFor, type BadgeName } from '../v20/Badge';

const AFFECTED_BADGE: Record<string, BadgeName> = { ride: 'car', dinner: 'cooking-pot', cleaning: 'spray-bottle-cloth', backup: 'helping-hands', intention: 'breakfast-bowl', simplify: 'home', part: 'calendar' };
const STEP = ['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice'];
const SHOWN_PARTS = 3;
const ICON: Record<SmartInsight['category'], Glyph> = {
  'heads-up': 'calendar', changed: 'sync', 'loose-end': 'chat', 'looking-ahead': 'calendar', helping: 'people', noticed: 'sparkle',
  opportunity: 'heart', celebrating: 'heart', 'further-ahead': 'calendar',
};

export function useTodayV19(ctx: Ctx) {
  const people = useMemo(() => enginePeople(ctx), [ctx.people, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const inp: TodayInput = { s: ctx.s, monday: ctx.monday, today: ctx.today, people };
  const model = useMemo(() => buildTodayV19(inp), [ctx.s, ctx.today, people]); // eslint-disable-line react-hooks/exhaustive-deps
  return { inp, model, people };
}

export default function TodayV19({ ctx }: { ctx: Ctx }) {
  const { inp, model } = useTodayV19(ctx);
  const intel = ctx.s.intel!;
  const meeting = nextMeeting(inp);
  const meetingDay = meeting ? dayName(meeting.date) : null;
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [dismissed, setDismissed] = useState<SmartInsight | null>(null);
  const [allParts, setAllParts] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);

  // The optional interpreter (V18's seam): weak rule matches only, once per fingerprint, cached.
  const interpreter = useMemo(() => simulatedInterpreter(() => Boolean(ctx.s.intel?.aiAvailable)), [ctx.s.intel?.aiAvailable]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = pendingInterpretations(inp);
  const pendingIds = pending.map((p) => p.fingerprint).join(',');
  useEffect(() => {
    // Production has no interpreter yet (docs/ios/V20_LAUNCH.md): the rules stand. The simulated one is preview-only.
    if (ctx.s.live) return;
    let live = true;
    for (const { fingerprint, input } of pending) {
      interpreter.interpret(input).then((raw) => {
        const v = validateInterpretation(raw, 'simulated');
        if (live && v) ctx.set((s) => ({ ...s, intel: { ...s.intel!, interpretations: { ...s.intel!.interpretations, [fingerprint]: v } } }));
      }).catch(() => { /* unavailable: the rules stand */ });
    }
    return () => { live = false; };
  }, [pendingIds, intel.aiAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  // The attention budget remembers what was shown, so an unchanged insight isn't presented again tomorrow.
  const card = model.card;
  useEffect(() => { if (card) ctx.set((s) => markShown(s, card, ctx.today)); }, [card?.key, card?.fingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (key: string) => setSheetKey(key);
  const dismiss = (i: SmartInsight) => { ctx.set((s) => giveFeedback(s, i, 'dismissed', ctx.today)); setDismissed(i); };
  const primary = (i: SmartInsight) => {
    if (i.flow === 'week') return ctx.go('plans');
    if (i.flow === 'topic') return ctx.set((s) => addFeedback(s, i, 'topic', ctx.today));
    open(i.key);
  };
  const { rows, earlier } = matterRowsV19(inp, model);
  // The family's own words for the week ("Calmer mornings"), shown before activities.
  const notes = (() => { const thisWeek = ctx.s.priorities.filter((p) => p.from === 'this-week'); return (thisWeek.length ? thisWeek : ctx.s.priorities).filter((p) => p.kind === 'note' && p.text); })();
  const parts = useMemo(() => {
    const shownEvents = new Set([...rows, ...earlier].map((r) => r.link));
    const order = (p: Part) => (p.ownerId === intel.viewer ? 0 : 1);
    return (ctx.s.parts.filter((p) => p.status === 'agreed' && !(p.eventLink && shownEvents.has(p.eventLink)) && (!p.onDate || p.onDate === ctx.today)))
      .sort((a, b) => order(a) - order(b) || Number(Boolean(model.partAttention[b.id])) - Number(Boolean(model.partAttention[a.id])));
  }, [ctx.s.parts, rows, earlier, intel.viewer, model.partAttention]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownParts = allParts ? parts : parts.slice(0, SHOWN_PARTS);
  const sheet = sheetKey ? model.all.find((i) => i.key === sheetKey) ?? null : null;
  const todayWd = new Date(`${ctx.today}T12:00:00Z`).getUTCDay();
  const dailyDone = dailyEssentials.tasks.filter((t) => ctx.s.cleaning.checks[`daily:${ctx.today}:${t.id}`]).length;

  return (
    <section data-screen="today" data-v19 data-headline={model.headline}>
      <p className="v16-kicker">{ctx.household.displayName?.replace(/^The /, '') ?? 'Our family'} · {fmtDate(ctx.today)}</p>
      <h1 className="v16-h1" data-v18-headline>{model.headline}</h1>
      {model.sub && !card && <p className="v18-sub" data-v18-sub>{model.sub}</p>}
      <button type="button" className="v19-changed" onClick={() => setChanged(true)} data-something-changed>Something changed?</button>

      {card && (
        <section className="v18-heads" aria-labelledby="v18-heads-title" data-heads-up={card.category} data-insight={card.key} data-source={card.source}>
          <p className="v18-heads-eyebrow"><Art name={ICON[card.category]} size="sm" />{card.eyebrow}</p>
          <h2 className="v18-heads-title" id="v18-heads-title">{card.title}</h2>
          {card.body && <p className="v18-heads-body">{card.body}</p>}
          <div className="v18-heads-actions">
            <button type="button" className="v18-heads-primary" onClick={() => primary(card)} data-heads-action={card.flow}>{card.actionLabel} <span aria-hidden="true">→</span></button>
            <button type="button" className="v18-heads-quiet v18-heads-dismiss" onClick={() => dismiss(card)} data-heads-dismiss>Dismiss</button>
          </div>
        </section>
      )}
      {!card && dismissed && <DismissedNote ctx={ctx} i={dismissed} onDone={() => setDismissed(null)} />}

      <div className="v16-section">
        <div className="v16-section-head">
          <h2 className="v16-h2">What matters</h2>
          <button type="button" className="v16-link" onClick={() => ctx.go('plans')} data-our-week>Our week <Chevron /></button>
        </div>
        {notes.map((n) => <div key={n.id} className="py-3" data-matter-note><p className="v16-meta">{n.from === 'last-meeting' ? 'Still your focus from last time' : 'This week'}</p><p className="v16-h3">{n.text}</p></div>)}
        {!rows.length && !earlier.length && !notes.length && <p className="v16-meta">Nothing chosen yet. Choose what matters together in your Family Meeting.</p>}
        <div className="v16-rows">{rows.map((r) => <Matter key={r.link} ctx={ctx} r={r} onOpen={open} />)}</div>
        {earlier.length > 0 && (
          <>
            <button type="button" className="v16-link mt-2" aria-expanded={earlierOpen} onClick={() => setEarlierOpen(!earlierOpen)} data-earlier>
              Earlier this week ({earlier.length}) <span aria-hidden="true" className={`v18-caret${earlierOpen ? ' is-open' : ''}`}>⌄</span>
            </button>
            {earlierOpen && <div className="v16-rows v19-earlier">{earlier.map((r) => <Matter key={r.link} ctx={ctx} r={r} onOpen={open} />)}</div>}
          </>
        )}
      </div>

      <div className="v16-section" data-everyones-part>
        <h2 className="v16-h2">Everyone’s part</h2>
        {!parts.length && <p className="v16-meta mt-1">What everyone agrees to do shows up here.</p>}
        <div className="v16-rows">
          {shownParts.map((p) => (
            <div key={p.id} data-part-line={p.id}>
              <PartLine ctx={ctx} p={p} />
              {model.partAttention[p.id] && <button type="button" className="v18-attention v19-attention-btn ml-[52px] -mt-1 mb-2" onClick={() => open(model.partAttention[p.id].key)} data-part-attention>{model.partAttention[p.id].text}</button>}
            </div>
          ))}
        </div>
        {parts.length > SHOWN_PARTS && (
          <button type="button" className="v16-link mt-2" aria-expanded={allParts} onClick={() => setAllParts(!allParts)} data-other-parts>
            {allParts ? 'Show fewer' : `See other responsibilities (${parts.length - SHOWN_PARTS})`} <span aria-hidden="true" className={`v18-caret${allParts ? ' is-open' : ''}`}>⌄</span>
          </button>
        )}
      </div>

      <MeetingRow ctx={ctx} agenda={model.agenda.length} occ={meeting} />

      <nav aria-label="More" className="v16-shortcuts">
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('plans')} data-shortcut="plans"><Art name="calendar" tile="blue" /> Plans <small>{sharedOccurrences(ctx.s, ctx.monday).filter((o) => o.date === ctx.today).length} today</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('cleaning')} data-shortcut="cleaning"><Art name="sparkle" tile="sage" /> Cleaning <small>{ctx.s.cleaning.dailyReset ? `Daily Reset ${dailyDone} of ${dailyEssentials.tasks.length}` : weeklySchedule.find((z) => z.day === todayWd)?.zone ?? 'This week'}</small></button>
        <button type="button" className="v16-shortcut" onClick={() => ctx.go('resources')} data-shortcut="resources"><Art name="book" tile="rose" /> Resources <small>{ctx.club ? ctx.club.resourceTitle : 'Family & guides'}</small></button>
      </nav>

      {sheet && sheet.flow === 'resolve' && <ResolveSheet ctx={ctx} i={sheet} meetingDay={meetingDay} onClose={() => setSheetKey(null)} />}
      {sheet && sheet.flow === 'needs' && (
        <InsightSheet ctx={ctx} i={sheet} meetingDay={meetingDay} onClose={() => setSheetKey(null)}
          onAction={(a) => { if (a === 'handled') ctx.set((s) => giveFeedback(s, sheet, 'handled', ctx.today)); if (a === 'bring-up') ctx.set((s) => addFeedback(s, sheet, 'topic', ctx.today)); setSheetKey(null); }} />
      )}
      {sheet && sheet.flow === 'part' && <PartSheet ctx={ctx} i={sheet} onClose={() => setSheetKey(null)} />}
      {sheetKey && !sheet && <Sheet title="All set" onClose={() => setSheetKey(null)}><p className="v18-sheet-lede" data-sheet-resolved>That’s planned.</p></Sheet>}
      {changed && <ChangedSheet ctx={ctx} onClose={() => setChanged(false)} />}
    </section>
  );
}

function Matter({ ctx, r, onOpen }: { ctx: Ctx; r: MatterRowV19; onOpen: (key: string) => void }) {
  return (
    <div className="py-3" data-matter={r.occ.event.title} data-group={r.group} data-priority={r.priority ? '' : undefined}>
      <div className="v17-lead">
        {(ctx.gen ?? 0) >= 20 ? <Badge name={badgeFor(r.occ.event.title)} /> : <Art name={artFor(r.occ.event.title)} />}
        <div className="min-w-0">
          <p className="v16-meta">{fmtDate(r.occ.date, { weekday: 'long' })} · {timeLabel(r.occ.event)}</p>
          <p className="v16-h3">{r.occ.event.title}</p>
          {r.attention && <button type="button" className="v18-attention v19-attention-btn" onClick={() => onOpen(r.attention!.key)} data-attention>{r.attention.text}</button>}
        </div>
      </div>
      {r.preps.length > 0 && <div className="v16-nested mt-2">{r.preps.map(({ part, date, done, doneYesterday }) => (
        <div key={part.id} className={done ? 'v19-done-prep' : undefined}><PrepLine ctx={ctx} p={part} date={date} doneYesterday={doneYesterday} /></div>
      ))}</div>}
    </div>
  );
}

function MeetingRow({ ctx, agenda, occ }: { ctx: Ctx; agenda: number; occ: ReturnType<typeof nextMeeting> }) {
  const m = ctx.s.meeting;
  if (m.started) {
    return (
      <button type="button" className="v18-meeting v18-meeting--resume" onClick={() => ctx.go('meeting')} data-meeting-row="resume">
        {(ctx.gen ?? 0) >= 20 ? <Badge name="family-meeting-around-a-table" /> : <Art name="people" />}
        <span className="min-w-0 flex-1"><span className="v18-meeting-title">Continue your Family Meeting</span><span className="v16-meta block">You stopped at {STEP[m.step]}.</span></span>
        <span aria-hidden="true" className="v18-meeting-go">→</span>
      </button>
    );
  }
  const go = () => (ctx.s.scenario === 'week4' && !m.checkInDone ? ctx.go('check-in') : ctx.go('meeting'));
  return (
    <button type="button" className="v18-meeting" onClick={go} data-meeting-row={occ ? 'next' : 'plan'}>
      {(ctx.gen ?? 0) >= 20 ? <Badge name="family-meeting-around-a-table" /> : <Art name="people" />}
      <span className="min-w-0 flex-1">
        <span className="v18-meeting-title">{occ ? `Next Family Meeting · ${dayName(occ.date)}, ${timeLabel(occ.event).split('–')[0].trim()}` : 'Plan this week together'}</span>
        {agenda > 0 && <span className="v16-meta block" data-meeting-topics={agenda}>{agenda === 1 ? '1 thing to talk about' : `${agenda} things to talk about`}</span>}
      </span>
      <Chevron />
    </button>
  );
}

/** After a plain Dismiss: optional, one line, never required. */
function DismissedNote({ ctx, i, onDone }: { ctx: Ctx; i: SmartInsight; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const say = (kind: 'handled' | 'not-relevant' | 'later' | 'never') => { ctx.set((s) => giveFeedback(s, i, kind, ctx.today)); onDone(); };
  return (
    <div className="v19-dismissed" role="status" data-dismissed-note>
      <span>Dismissed.</span>
      {!open ? <button type="button" className="v16-link" onClick={() => setOpen(true)} data-tell-more>Tell us more</button> : (
        <div className="v16-choices w-full" data-feedback-menu>
          <button type="button" className="v16-choice" onClick={() => say('handled')} data-fb="handled">Already taken care of</button>
          <button type="button" className="v16-choice" onClick={() => say('not-relevant')} data-fb="not-relevant">Not relevant to our family</button>
          <button type="button" className="v16-choice" onClick={() => say('later')} data-fb="later">Remind us later</button>
          <button type="button" className="v16-choice" onClick={() => say('never')} data-fb="never">Don’t suggest this again</button>
          <button type="button" className="v16-choice v16-choice--quiet" onClick={onDone} data-fb="dismiss">Just dismiss</button>
        </div>
      )}
    </div>
  );
}

/** Isolate what's affected; one grounded question per affected agreement; reassurance for what's already fine. */
export function ResolveSheet({ ctx, i, meetingDay, onClose }: { ctx: Ctx; i: SmartInsight; meetingDay: string | null; onClose: () => void }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [openParts, setOpenParts] = useState<string[] | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const viewer = ctx.s.intel!.viewer;
  const update = () => {
    const r = applyChoices(ctx.s, i, choices, { today: ctx.today, monday: ctx.monday, viewer });
    ctx.set(() => r.state);
    if (r.openParts.length) { setOpenParts(r.openParts); setOpenRow(r.openParts[0]); } else onClose();
  };
  const title = i.affected.length > 1 ? 'Review what’s affected' : i.actionLabel;
  return (
    <Sheet title={title} onClose={onClose}>
      <div data-resolve-sheet={i.key}>
        {!openParts && <>
          {i.affected.map((a) => (
            <div key={a.id} className="v19-affected" data-affected={a.kind}>
              {(ctx.gen ?? 0) >= 20 ? <div className="v17-lead"><Badge name={AFFECTED_BADGE[a.kind]} /><h3 className="v19-question">{a.question}</h3></div> : <h3 className="v19-question">{a.question}</h3>}
              {a.facts.map((f) => <p key={f} className="v16-meta mt-1">{f}</p>)}
              {a.current && (
                <div className="v19-current" data-current>
                  <p className="v16-eyebrow">Current agreement</p>
                  <div className="v17-lead mt-1"><Person ctx={ctx} id={a.current.ownerId} size="md" /><span><span className="block font-semibold">{a.current.ownerId ? ctx.names[a.current.ownerId] : 'Someone'} · {a.current.title}</span>{a.current.detail && <span className="v16-meta block">{a.current.detail}</span>}</span></div>
                </div>
              )}
              <p className="v16-eyebrow mt-3">Possible options</p>
              <div className="v19-options" role="radiogroup" aria-label={a.question}>
                {a.options.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={choices[a.id] === o.id} className="v19-option" onClick={() => setChoices((c) => ({ ...c, [a.id]: o.id }))} data-option={o.id}>
                    <span className="v19-radio" aria-hidden="true" />
                    <span><span className="block">{o.label}</span>{o.detail && <span className="v16-meta block">{o.detail}</span>}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="of-btn of-btn--block mt-5" disabled={!Object.keys(choices).length} onClick={update} data-update-plan>Update our plan</button>
          {i.reassurance.length > 0 && <ul className="v19-reassure" data-reassurance>{i.reassurance.map((r) => <li key={r}>{r}</li>)}</ul>}
          <div className="v18-sheet-foot">
            <button type="button" className="v16-choice v16-choice--quiet" onClick={() => { ctx.set((s) => giveFeedback(s, i, 'handled', ctx.today)); onClose(); }} data-sheet-handled>Already handled</button>
            {!i.urgent && <button type="button" className="v16-choice v16-choice--quiet" onClick={() => { ctx.set((s) => addFeedback(s, i, 'topic', ctx.today)); onClose(); }} data-sheet-bring-up>{meetingDay ? `Bring it up ${meetingDay}` : 'Bring it up at the meeting'}</button>}
          </div>
          <details className="v16-details mt-3" data-why>
            <summary className="!min-h-[40px] !text-[0.85rem] !font-semibold">Why am I seeing this?</summary>
            <ul className="v18-why">{i.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
          </details>
        </>}
        {openParts && <>
          <p className="v18-sheet-lede">Finish it together.</p>
          <p className="v16-meta mt-1">Choose who and when. Nothing is agreed until the person doing it says yes.</p>
          <div className="v16-rows mt-2">{openParts.map((id) => { const p = ctx.s.parts.find((x) => x.id === id); return p ? <PartRow key={id} ctx={ctx} part={p} prominent open={openRow === id} onToggle={() => setOpenRow(openRow === id ? null : id)} /> : null; })}</div>
          <button type="button" className="of-btn of-btn--soft of-btn--block mt-4" onClick={onClose} data-sheet-finish>Done</button>
        </>}
      </div>
    </Sheet>
  );
}

export function PartSheet({ ctx, i, onClose }: { ctx: Ctx; i: SmartInsight; onClose: () => void }) {
  const p = ctx.s.parts.find((x) => x.id === i.partIds[0]);
  const [open, setOpen] = useState(true);
  return (
    <Sheet title={i.actionLabel} onClose={onClose}>
      <div data-part-sheet={i.key}>
        <p className="v18-sheet-lede">{i.title}</p>
        {p && <div className="v16-rows mt-2"><PartRow ctx={ctx} part={p} prominent open={open} onToggle={() => setOpen(!open)} /></div>}
      </div>
    </Sheet>
  );
}

/** "Something changed?": tell the plan what happened; the plan suggests how to simplify. Nothing changes by itself. */
export function ChangedSheet({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [kind, setKind] = useState<Report['kind'] | null>(null);
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const viewer = ctx.s.intel!.viewer;
  const kinds: [Report['kind'], string][] = [['sick', 'Someone is sick'], ['behind', 'We’re running behind'], ['work-late', 'Work is running late'], ['lighter', 'We need a lighter day'], ['other', 'Something else']];
  const save = () => {
    if (!kind) return;
    const r: Report = { date: ctx.today, kind, by: viewer, memberId: kind === 'sick' || kind === 'work-late' ? who || (kind === 'work-late' ? viewer : undefined) : undefined, note: kind === 'other' ? note.trim().slice(0, 140) : undefined };
    ctx.set((s: V16State) => ({ ...s, intel: { ...s.intel!, reports: [...(s.intel!.reports ?? []), r] } }));
    onClose();
  };
  return (
    <Sheet title="Something changed?" onClose={onClose}>
      <div data-changed-sheet>
        <p className="v16-meta">Tell us what happened today. We’ll look at what could move, and nothing changes unless you choose.</p>
        <div className="v19-options mt-3" role="radiogroup" aria-label="What changed">
          {kinds.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="v19-option" onClick={() => setKind(k)} data-report={k}><span className="v19-radio" aria-hidden="true" />{label}</button>
          ))}
        </div>
        {(kind === 'sick' || kind === 'work-late') && (
          <label className="v16-field mt-3">Who?
            <select className="v16-input" value={who} onChange={(e) => setWho(e.target.value)} data-report-who>
              <option value="">{kind === 'work-late' ? 'Me' : 'Choose someone'}</option>
              {ctx.people.filter((m) => kind === 'sick' || m.kind === 'adult').map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}
            </select>
          </label>
        )}
        {kind === 'other' && <label className="v16-field mt-3">What happened?<input className="v16-input" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} data-report-note /></label>}
        <button type="button" className="of-btn of-btn--block mt-5" disabled={!kind || (kind === 'sick' && !who)} onClick={save} data-report-save>See what could change</button>
      </div>
    </Sheet>
  );
}

export { propose };

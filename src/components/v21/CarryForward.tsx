/**
 * V21 Family Meeting continuity (docs/ios/V21_PREVIEW.md): in Let's Talk, what the family left open since last time,
 * so nobody reconstructs it from memory. One at a time, in the same light brown card as the month's questions.
 * Deciding here is an in-person agreement (both adults are at the table), so "Meg will" makes it Meg's at once.
 */
import { useMemo, useState } from 'react';
import { makeUsual, requestsOf, takeIt } from '../../lib/v21/model';
import { carryForward } from '../../lib/v21/today';
import { talked } from '../../lib/v19/resolve';
import { decisionsOf } from '../../lib/v21/model';
import { enginePeople } from '../v18/TodayV18';
import type { Ctx } from '../v16/shared';
import { adultsOf } from './ui';

export default function CarryForward({ ctx }: { ctx: Ctx }) {
  const people = useMemo(() => enginePeople(ctx), [ctx.people, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = carryForward({ s: ctx.s, monday: ctx.monday, today: ctx.today, people });
  const [i, setI] = useState(0);
  if (!items.length) return null;
  const item = items[Math.min(i, items.length - 1)];
  const adults = adultsOf(ctx);
  const assign = (by: string) => ctx.set((s) => {
    const n = talked(s, item.key, ctx.today);
    if (item.key.startsWith('carry:req:')) {
      const r = requestsOf(n).find((x) => `carry:req:${x.id}` === item.key);
      return r ? takeIt(n, { by, title: r.title, subject: r.subject, date: r.date, time: r.time, today: ctx.today }) : n;
    }
    const d = decisionsOf(n).find((x) => `carry:each:${x.id}` === item.key);
    return d ? makeUsual(n, { decisionId: d.id, ownerId: by, time: null, today: ctx.today, by }) : n;
  });
  return (
    <section className="v18-heads v21-carry" aria-label="Since last time" data-carry={item.key} data-carry-kind={item.kind}>
      <p className="v18-heads-eyebrow">Since last time · {Math.min(i, items.length - 1) + 1} of {items.length}</p>
      <h2 className="v18-heads-title">{item.title}</h2>
      <p className="v18-heads-body">{item.detail}</p>
      <div className="v21-actions v21-actions--wrap">
        {(item.kind === 'declined' || item.kind === 'needs-owner') && adults.map((a) => (
          <button key={a.id} type="button" className="v21-btn" onClick={() => assign(a.id)} data-carry-owner={a.id}>{item.kind === 'needs-owner' ? `${a.firstName}, from now on` : `${a.firstName} will`}</button>
        ))}
        <button type="button" className="v21-btn v21-btn--outline" onClick={() => ctx.set((s) => talked(s, item.key, ctx.today))} data-carry-talked>{item.kind === 'needs-owner' ? 'Keep deciding each week' : 'Talked about it'}</button>
        {items.length > 1 && <button type="button" className="v21-link" onClick={() => setI((i + 1) % items.length)} data-carry-next>Next</button>}
      </div>
    </section>
  );
}

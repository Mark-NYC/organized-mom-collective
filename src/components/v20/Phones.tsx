/**
 * V20 preview harness, NOT product UI: two simulated lock screens (Ana's and Luis's phones) showing what the real
 * notification rules (src/lib/v20/notify.ts) would deliver from the shared household state, with the "I've got it"
 * action. Both phones read and write the same shared state, which is what real shared state + push would do across
 * two devices. Nothing is sent anywhere.
 */
import { useEffect, useMemo } from 'react';
import { enginePeople } from '../v18/TodayV18';
import { gotIt, markSent, notTonight, outbox, type PushNote } from '../../lib/v20/notify';
import type { Ctx } from '../v16/shared';

const LABEL: Record<PushNote['status'], string> = { deliver: 'Delivered', sent: 'Delivered', quiet: 'Delivered quietly', held: 'Held', scheduled: 'Scheduled', off: 'Off' };
const t12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

export function useOutbox(ctx: Ctx) {
  const people = useMemo(() => enginePeople(ctx), [ctx.people, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = ctx.s.intel?.clock ?? '14:30';
  const notes = useMemo(() => outbox({ s: ctx.s, monday: ctx.monday, today: ctx.today, people, now }), [ctx.s, ctx.today, people, now]); // eslint-disable-line react-hooks/exhaustive-deps
  return { notes, people, now };
}

export default function Phones({ ctx }: { ctx: Ctx }) {
  const { notes, people, now } = useOutbox(ctx);
  // Delivery is recorded in shared state, so the same facts never alert twice on any phone.
  const fresh = notes.filter((n) => n.status === 'deliver' || n.status === 'quiet').map((n) => n.key).join(',');
  useEffect(() => { if (fresh) ctx.set((s) => markSent(s, notes, ctx.today, now)); }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const adults = people.filter((p) => p.kind === 'adult');
  const act = (n: PushNote, a: 'got-it' | 'not-tonight' | 'open') => {
    if (a === 'got-it') ctx.set((s) => gotIt(s, n, { today: ctx.today, people }));
    if (a === 'not-tonight') ctx.set((s) => notTonight(s, n));
    if (a === 'open') { ctx.set((s) => ({ ...s, intel: { ...s.intel!, viewer: n.to } })); ctx.go('today'); }
  };
  return (
    <div className="v20-phones" data-phones aria-label="Simulated phones (preview only)">
      {adults.map((a) => {
        const mine = notes.filter((n) => n.to === a.id && n.status !== 'off');
        return (
          <div key={a.id} className="v20-phone" data-phone={a.id}>
            <p className="v20-phone-head"><span>{a.firstName}’s phone</span><span>{t12(now)}</span></p>
            {!mine.length && <p className="v20-phone-empty" data-phone-empty>No notifications</p>}
            {mine.map((n) => (
              <div key={n.key} className="v20-push" data-push={n.kind} data-push-status={n.status} data-purpose={n.purpose}>
                <p className="v20-push-app"><span className="v20-push-icon" aria-hidden="true">of</span>Organized Family<span className="ml-auto">{n.status === 'held' ? `after ${t12(n.at.time)}` : n.status === 'scheduled' ? `${n.at.date.slice(5)} · ${t12(n.at.time)}` : t12(n.at.time)}</span></p>
                <p className="v20-push-title">{n.title}</p>
                <p className="v20-push-body">{n.body}</p>
                <p className="v20-push-status" title={n.why}>{LABEL[n.status]}{n.status === 'held' || n.status === 'scheduled' || n.status === 'quiet' ? ` · ${n.why}` : ''}</p>
                {n.actions.length > 0 && (n.status === 'deliver' || n.status === 'sent' || n.status === 'quiet') && (
                  <div className="v20-push-actions">
                    {n.actions.includes('got-it') && <button type="button" onClick={() => act(n, 'got-it')} data-push-action="got-it">I’ve got it</button>}
                    {n.actions.includes('not-tonight') && <button type="button" onClick={() => act(n, 'not-tonight')} data-push-action="not-tonight">Not this time</button>}
                    {n.actions.includes('open') && <button type="button" onClick={() => act(n, 'open')} data-push-action="open">Open</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

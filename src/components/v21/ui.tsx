/** V21 small shared pieces: owner names (including "Together"), owner chips, the people a request can go to. */
import type { CSSProperties } from 'react';
import { TOGETHER } from '../../lib/v21/household';
import type { Ctx } from '../v16/shared';

export const ownerName = (ctx: Pick<Ctx, 'names'>, id: string | null | undefined) => (id === TOGETHER ? 'Together' : id ? ctx.names[id] ?? 'Someone' : 'Needs an owner');

/** A soft chip in the person's calendar color, black text. */
export function Chip({ ctx, id }: { ctx: Pick<Ctx, 'names' | 'colors'>; id: string | null | undefined }) {
  const hex = id && id !== TOGETHER ? ctx.colors[id]?.hex : '#8B5A2B';
  return <span className="v21-chip" style={{ '--chip': hex ?? '#8B5A2B' } as CSSProperties} data-chip={id ?? 'none'}>{ownerName(ctx, id)}</span>;
}

export const adultsOf = (ctx: Ctx) => ctx.people.filter((m) => m.kind === 'adult');
export const viewerOf = (ctx: Ctx) => ctx.s.intel?.viewer ?? adultsOf(ctx)[0]?.id ?? '';
/** The other adults this adult can ask. */
export const othersOf = (ctx: Ctx) => adultsOf(ctx).filter((m) => m.id !== viewerOf(ctx));

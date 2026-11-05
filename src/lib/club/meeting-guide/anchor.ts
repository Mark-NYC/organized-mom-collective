import type { ExperimentAnchor } from '../habits/types';

const cap = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/**
 * An experiment's "When" on the page: one reliable trigger. Several options become "Choose one … Keep it the same
 * each time", so nothing unconfirmed reads as a routine the family already has. Her own wording prints as she wrote it.
 */
export function anchorLine(a: ExperimentAnchor): string {
  const o = a.options ?? [];
  if (o.length > 1) return `${a.lead ? `${cap(a.lead)}. Choose one` : 'Choose one'}: ${o.join(' or ')}. Keep it the same each time.`;
  if (o.length === 1) return `${cap(a.lead ? `${a.lead}, ${o[0]}` : o[0])}.`;
  return `${cap(a.text)}.`;
}

/**
 * Her Welcome Kit's three printed pieces side by side (src/lib/club/onboarding.ts → kitItems): a miniature of the real
 * printable (KitPreview), its name, one sentence, its status and one action. Used on the Welcome Kit page
 * (/club/welcome-kit) and on Club Home while the kit is on its way.
 */
import { KIT_ITEM_STATUS, type KitItem } from '../../lib/club/onboarding';
import { memberPlanHref } from '../../lib/club/plan/account';
import { routes } from '../../routes';
import KitPreview from './KitPreview';

/** Where each piece's printable is drawn from, and which element on that page is the printed sheet. */
export function previewFor(item: KitItem, firstSlug: string | null): { src: string; target: string } | null {
  if (item.id === 'print') return { src: routes.clubFamilyVision, target: '#club-vision-content:not([hidden]) #fvp-art' };
  if (item.id === 'guide') return { src: routes.clubMeetingGuide, target: '[data-meeting-guide-sheet]' };
  if (!firstSlug || item.status === 'preparing') return null;
  return { src: memberPlanHref(firstSlug), target: '.club-plan[data-plan-state="ready"] [data-plan-sheet]' };
}

export default function WelcomeKitItems({ items, firstSlug, compact = false, startHere = null, justDone = null }: {
  items: KitItem[]; firstSlug: string | null; compact?: boolean;
  /** The first piece that needs her: tagged "Start here". */
  startHere?: KitItem['id'] | null;
  /** The piece she just approved (?done=): a short highlight. */
  justDone?: KitItem['id'] | null;
}) {
  return (
    <ol className={`wk-items${compact ? ' wk-items--compact' : ''}`} aria-label="Your Welcome Kit: three printed resources">
      {items.map((item, i) => {
        const p = previewFor(item, firstSlug);
        return (
          <li key={item.id} className="wk-item" data-kit-item={item.id} data-status={item.status} data-start={startHere === item.id ? '' : undefined} data-just-done={justDone === item.id ? '' : undefined}>
            <span className="wk-item-num" aria-hidden="true">{item.status === 'approved' ? '✓' : i + 1}</span>
            {startHere === item.id && <span className="wk-item-start">Start here</span>}
            <a className="wk-item-thumb" href={item.href} tabIndex={-1} aria-hidden="true">
              {p ? <KitPreview src={p.src} target={p.target} label={item.name} ratio="8.5 / 11" /> : <span className="kit-preview kit-preview--empty">{KIT_ITEM_STATUS.preparing}</span>}
            </a>
            <div className="wk-item-text">
              <p className="wk-item-status" data-status={item.status}>
                <span aria-hidden="true">{item.status === 'approved' ? '✓' : item.status === 'needs_review' ? '•' : ''}</span>{KIT_ITEM_STATUS[item.status]}
              </p>
              <h3 className="wk-item-name">{item.name}</h3>
              <p className="wk-item-about">{item.about}</p>
              <a className="wk-item-action" href={item.href} data-primary={item.status === 'needs_review' ? '' : undefined}>
                {item.action}<span className="sr-only">: {item.name}</span> <span aria-hidden="true">→</span>
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The first piece that still needs her, for one obvious next action. */
export const nextItem = (items: KitItem[]) => items.find((i) => i.status === 'needs_review') ?? null;

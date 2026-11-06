/** Canonical hand-drawn OMC artwork for the bathroom guide.
 * Import source assets through Vite so production URLs are fingerprinted and valid.
 * Keep one centralized map so HTML and print views cannot drift.
 */
import towel from '../../../assets/icons/ofc/routines/bath-or-shower.jpg?url';
import hamper from '../../../assets/icons/ofc/february/laundry-hamper.webp?url';
import sink from '../../../assets/icons/ofc/march/wipe-sink.webp?url';
import counter from '../../../assets/icons/ofc/march/wipe-surface.webp?url';
import toothbrush from '../../../assets/icons/ofc/supporting/toothbrush.png?url';
import bathroom from '../../../assets/icons/ofc/march/clean-bathroom.webp?url';
import floor from '../../../assets/icons/ofc/march/clean-floor.webp?url';
import trash from '../../../assets/icons/ofc/march/bathroom-trash.webp?url';
import clothes from '../../../assets/icons/ofc/march/clothes-away.webp?url';
import vacuum from '../../../assets/icons/ofc/march/vacuum.webp?url';

export const bathroomIcons = { towel, hamper, sink, counter, toothbrush, bathroom, floor, trash, clothes, vacuum } as const;

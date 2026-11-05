/**
 * Every month's Family Meeting guide content, by month. Adding February: write `2027-02.ts` (a GuideMonthContent,
 * src/lib/club/meeting-guide/types.ts) and add it here. docs/club/PERSONALIZATION.md has the steps.
 */
import type { GuideMonthContent } from '../../../lib/club/meeting-guide/types';
import { january2027 } from './2027-01';

export const GUIDE_MONTHS: readonly GuideMonthContent[] = [january2027];

export const guideMonth = (month: string): GuideMonthContent | null => GUIDE_MONTHS.find((m) => m.month === month.slice(0, 7)) ?? null;

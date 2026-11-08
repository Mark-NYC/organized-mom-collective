/**
 * How each Welcome Kit item is printed: the production assumptions in one place (owner decision D6, requirement 11 in
 * docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md). Shown on /admin/club → Welcome Kits beside the packing list. Every
 * value is a TARGET until `validated` is set after the owner confirms it with whoever prints; nothing in the site or
 * database depends on them. Change them here only.
 */
export interface PrintSpec {
  item: string;
  size: 'US Letter, 8.5 × 11 in';
  sides: 'single' | 'double';
  stock: string;
  finish: string;
  /** The owner confirmed it with the printer (date), or null while it's a target. */
  validated: string | null;
}

export const WELCOME_PRINT_SPECS: Record<'welcome_rhythm' | 'welcome_vision' | 'meeting_guide' | 'first_month', PrintSpec> = {
  welcome_rhythm: { item: 'Family Rhythm', size: 'US Letter, 8.5 × 11 in', sides: 'single', stock: 'Premium uncoated (target)', finish: 'Flat, unfolded', validated: null },
  welcome_vision: { item: 'Family Vision print', size: 'US Letter, 8.5 × 11 in', sides: 'single', stock: 'As printed today (not recorded in the repository)', finish: 'Flat, unfolded', validated: null },
  meeting_guide: { item: 'Family Meeting guide', size: 'US Letter, 8.5 × 11 in', sides: 'single', stock: 'As printed today (not recorded in the repository)', finish: 'Flat, unfolded', validated: null },
  first_month: { item: 'First month resource', size: 'US Letter, 8.5 × 11 in', sides: 'single', stock: 'As printed today (not recorded in the repository)', finish: 'Flat, unfolded', validated: null },
};

export const specLine = (s: PrintSpec) => `${s.item}: ${s.size}, ${s.sides}-sided, ${s.stock}, ${s.finish}${s.validated ? ` (confirmed ${s.validated})` : ' (not yet confirmed with the printer)'}`;

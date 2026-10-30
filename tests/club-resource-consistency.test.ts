/**
 * One product per month: the member's copy (/club/resources/<slug>: what she approves and what fulfillment prints),
 * the month's app page (/app/club/<month>, where the Family Meeting lives) and the meeting's own title must agree,
 * except for the months waiting on the owner's decision (docs/club/RESOURCE_CONSISTENCY.md).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { clubResources } from '../src/data/club/resources';
import { MEETING_MONTHS } from '../src/data/club/family-meeting';
import { kits } from '../src/data/club/kits';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const memberPage = readFileSync('src/pages/club/resources/[slug].astro', 'utf8');

/** resources.ts component key → the printable the member page renders for it. */
const memberPrintable = (key: string) => new RegExp(`c === '${key}' && <(\\w+)`).exec(memberPage)?.[1];
/** The printable on /app/club/<month> (the month's tool beside its meeting). */
const appPrintable = (month: string) => {
  const src = readFileSync(`src/pages/app/club/${month}.astro`, 'utf8');
  return /slot="printable"[\s\S]*?<(\w+) storageKey/.exec(src)?.[1] ?? null;
};
const nameOf = (m: string) => MONTHS[Number(m.slice(5)) - 1];

describe('monthly resources: one product per month', () => {
  it('every month has a member page, an app page and a meeting', () => {
    expect(clubResources.map((r) => nameOf(r.month)).sort()).toEqual([...MONTHS].sort());
    expect(MEETING_MONTHS).toHaveLength(12);
    for (const r of clubResources) expect(kits.some((k) => k.slug === r.slug), r.slug).toBe(true);
  });

  it('member copy and app tool are the same printable, except the months waiting on a decision', () => {
    const differ: string[] = [];
    for (const r of clubResources) {
      const month = nameOf(r.month);
      if (month === 'november') continue; // no plan page: its meeting page links straight to this member copy
      const same = memberPrintable(r.component) === appPrintable(month);
      expect(r.sameAsApp, `${month}: sameAsApp says ${r.sameAsApp}, member ${memberPrintable(r.component)} vs app ${appPrintable(month)}`).toBe(same);
      if (!same) differ.push(month);
    }
    // Decision pending (docs/club/RESOURCE_CONSISTENCY.md). Update this list only together with that decision.
    expect(differ).toEqual(['january', 'february', 'march', 'september']);
  });

  it('where they match, the meeting names the same product the member approves and receives', () => {
    for (const r of clubResources.filter((x) => x.sameAsApp)) {
      const meeting = MEETING_MONTHS.find((m) => m.month === Number(r.month.slice(5)))!;
      expect(meeting.resourceTitle, nameOf(r.month)).toBe(r.title);
    }
  });

  it('the Family Meeting is never part of the member copy or the fulfillment print', () => {
    expect(memberPage).not.toMatch(/ClubFamilyMeeting|data-meeting-sheet/);
  });

  it('the member copy prints only its sheets when the printable marks them', () => {
    expect(memberPage).toMatch(/data-plan-print-scope/);
    expect(memberPage).toMatch(/<ClubPrintStyles \/>/);
    for (const r of clubResources) {
      const comp = memberPrintable(r.component)!;
      const src = readFileSync(`src/components/club/${comp}.astro`, 'utf8');
      // November keeps its own print rules (two sheets, no markers); the rest mark their sheets.
      if (comp !== 'NovemberOwnershipPrintable') expect(src, comp).toMatch(/data-plan-sheet-end/);
    }
  });
});

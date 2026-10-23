/**
 * The December 2027 kit, Christmas Is a Family Affair: one letter, one action (a five-decision Family Christmas Plan,
 * no dates), one optional tool (the Family Christmas Traditions Picker, a site tool opened inside the Club).
 * August, October and November stay as they were.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as december } from '../src/data/club/kits/2027-12-christmas-family-affair';
import { kit as october } from '../src/data/club/kits/2027-10-home-works-together';
import { clubTools } from '../src/data/club/tools';
import {
  ageFocus, costLabel, defaultPrefs, fits, kidBand, pickTraditions, rankTraditions, swapTradition, traditionById, traditions, traditionsText,
  TRADITIONS_REMINDER, type TraditionPrefs,
} from '../src/data/christmas-traditions';
import { countdownText, lineDetail, lineText, planCountdown, readCountdown } from '../src/lib/club/countdown';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = december.action!;
const items = action.items;
const prefs = (p: Partial<TraditionPrefs>): TraditionPrefs => ({ ...defaultPrefs, ...p });
const names = (p: TraditionPrefs) => pickTraditions(p).map((t) => t.id);

describe('December: one letter, one plan, one optional traditions picker', () => {
  it('passes every kit check and is the newest kit', () => {
    expect(kitProblems(december)).toEqual([]);
    expect(december.theme).toBe('Christmas Is a Family Affair');
    expect(december.subtitle).toBe('More together. Less on Mom.');
    expect(kitBySlug('2027-12-christmas-family-affair')).toBe(december);
    expect(kits[kits.length - 1]).toBe(december);
  });

  it('has exactly the five decisions, each with its sentence, a helper blank, no dates, and wording she can change', () => {
    expect(action.kind).toBe('checklist');
    expect(action.title).toBe('Our Family Christmas Plan');
    expect(action.intro).toBe('Five little decisions to help everyone enjoy the season.');
    expect(items.map((i) => `${i.text} ${i.detail}`)).toEqual([
      'Choose what matters most. Pick two or three Christmas traditions your family really wants to enjoy.',
      'Put the important dates on the calendar. Add gatherings, school events, church activities, and celebrations.',
      'Share the gift preparations. Decide who’s handling shopping, wrapping, cards, and other gift-related jobs.',
      'Choose one way to give together. Find a simple way to bless, serve, or encourage someone outside your household.',
      'Share the Christmas-week jobs. Decide who can help with meals, preparing the house, and other responsibilities.',
    ]);
    expect(items.every((i) => i.daysBefore === undefined && !i.essential)).toBe(true);
    expect(action.helperLabel).toBe('Who’s helping?');
    expect(action.editable).toBe(true);
  });

  it('works whenever it arrives: no start date, no deadlines, and a note for families already planned', () => {
    expect(action.note).toBe('Already made your plans? Use this as a quick family check-in. Keep what matters, share what’s left, and let a few things go.');
    for (const today of ['2027-11-20', '2027-12-01', '2027-12-18']) {
      const plan = planCountdown(items, '', today);
      expect(plan.status).toBe('undated');
      expect(plan.lines.every((l) => l.date === null && !l.later)).toBe(true);
    }
    expect(JSON.stringify(december)).not.toMatch(/advent|countdown|\bday \d+\b|25 days/i);
  });

  it('copies as text with each sentence, her helpers, and her own wording in place of both', () => {
    const s = { ...readCountdown(null, 5), done: [true, true, false, false, false], helpers: ['Everyone', 'Luis', '', '', ''], texts: [null, 'Calendar night with the kids.', null, null, null] };
    expect(lineDetail(items, s, 0)).toBe(items[0].detail);
    expect(lineDetail(items, s, 1)).toBeUndefined();
    expect(lineText(items, s, 1)).toBe('Calendar night with the kids.');
    expect(countdownText(action.title, items, planCountdown(items, '', '2027-12-10'), s).split('\n').slice(0, 4)).toEqual([
      'Our Family Christmas Plan',
      '',
      '[x] Choose what matters most. Pick two or three Christmas traditions your family really wants to enjoy. (Everyone)',
      '[x] Calendar night with the kids. (Luis)',
    ]);
  });

  it('prints the plan and the letter, like October', () => {
    expect(december.printables.map((p) => [p.id, p.component])).toEqual([['christmas-plan', 'Action'], ['letter', 'Letter']]);
    expect(december.items).toEqual([]);
    expect(december.mailer.accent).toBe('evergreen');
  });

  it('stays its own month: celebrating, not a chore system', () => {
    expect(december.tool!.tool).not.toBe(october.tool!.tool);
    expect(december.mailer.fieldGuide.title).not.toBe(october.mailer.fieldGuide.title);
    expect(JSON.stringify(december.action)).not.toMatch(/chore/i);
  });
});

describe('December: the letter and the mailer', () => {
  const letter = december.mailer.letter!;
  it('is a 150–200 word draft for Megan, greets by name when known, and asks the family question', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('You Get to Enjoy Christmas, Too');
    expect(letter.namedGreeting).toBe('Hi {name},');
    expect(letter.signoff).toBe('Megan');
    expect(letter.draft).toBe(true);
    expect(schedulable(december)).toBe(false);
    expect(letter.body).toContain('What’s one thing we could each do to make Christmas special for someone else?');
    expect(letter.body).toMatch(/already made/);
  });

  it('puts the three principles, the question, the QR code and the calendar note on the back', () => {
    expect(december.mailer.fieldGuide.title).toBe('Making Christmas Together');
    expect(december.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Choose what matters.', 'Share the preparations.', 'Leave room to enjoy it.']);
    expect(december.mailer.conversation?.question).toBe('What’s one thing we could each do to make Christmas special for someone else?');
    expect(december.mailer.conversation?.placement ?? 'top').toBe('top');
    expect(december.mailer.invite?.title).toBe('Find Your Family’s Christmas Traditions');
    expect(december.mailer.calendarNote).toBe('Add your favorite traditions and important Christmas dates to the family wall calendar. Leave some open space, too.');
    expect(december.mailer.example).toBeUndefined();
  });

  it('points its QR code at this kit’s own page', () => {
    expect(december.mailer.qrPath).toBe(`${routes.clubKit(december.slug)}?source=mailer`);
    expect(qrUrl(december.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-12-christmas-family-affair?source=mailer');
    expect(readableUrl(december.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-12-christmas-family-affair');
    expect(qrMatrix(qrUrl(december.mailer.qrPath)).length).toBeGreaterThan(0);
  });

  it('is seeded as a draft in the migrations, opening December 1 like every month', () => {
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-12-christmas-family-affair', '2027-12-01', 'Christmas Is a Family Affair', 'draft', '2027-12-01/);
  });
});

describe('December: the tool is the Family Christmas Traditions Picker', () => {
  it('is a site tool the Club hosts for the whole family, with the children’s ages', () => {
    expect(december.tool).toMatchObject({ tool: 'traditions-picker', title: 'Choose Your Christmas Traditions', cta: 'Find Our Christmas Traditions' });
    expect(december.tool!.blurb).toBe('Find two or three simple ways to make Christmas special together. We’ll suggest ideas that fit your family.');
    expect(clubTools['traditions-picker']).toMatchObject({ path: routes.clubTool('traditions-picker'), perChild: false, familyAges: true });
    expect(readFileSync('src/pages/club/tools/traditions-picker.astro', 'utf8')).toContain("import TraditionsPicker from '../../../components/site/TraditionsPicker.astro'");
  });

  it('says fewer is better, in the tool and on its printout', () => {
    expect(TRADITIONS_REMINDER).toBe('Three meaningful traditions are better than twenty things you feel obligated to do.');
    const markup = readFileSync('src/components/site/TraditionsPicker.astro', 'utf8');
    expect(markup.match(/TRADITIONS_REMINDER/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('has small, ordinary ideas, each with a time, a cost and a part for every age', () => {
    expect(new Set(traditions.map((t) => t.id)).size).toBe(traditions.length);
    for (const t of traditions) {
      expect(t.name.length, t.id).toBeLessThanOrEqual(40);
      expect(words(t.about), t.id).toBeLessThanOrEqual(30);
      expect(t.about.split(/(?<=[.?!])\s/).length, t.id).toBeLessThanOrEqual(2);
      for (const band of ['little', 'young', 'older'] as const) expect(t.kids[band].trim(), `${t.id} ${band}`).toBeTruthy();
      // Nothing that assumes a local event exists without saying "you already know about".
      if (/market|concert|service or|light display/i.test(t.about)) expect(t.about, t.id).toMatch(/already know about|already like|giving tree|toy drive|coat drive/i);
    }
  });

  it('opens with three suggestions with no answers at all, one of them a way to give', () => {
    const three = pickTraditions(defaultPrefs);
    expect(three).toHaveLength(3);
    expect(new Set(three.map((t) => t.kind)).size).toBe(3);
    expect(three.some((t) => t.kind === 'giving')).toBe(true);
  });

  it('changes with time, budget and setting, and never goes over them', () => {
    const short = pickTraditions(prefs({ time: 'short' }));
    const half = pickTraditions(prefs({ time: 'half-day', cost: 'flexible' }));
    expect(short.every((t) => t.time === 'short')).toBe(true);
    expect(half.some((t) => t.time === 'half-day')).toBe(true);
    expect(names(prefs({ time: 'short' }))).not.toEqual(names(prefs({ time: 'half-day' })));
    expect(pickTraditions(prefs({ cost: 'free' })).every((t) => t.cost === 'free')).toBe(true);
    expect(names(prefs({ cost: 'free' }))).not.toEqual(names(prefs({ cost: 'flexible', time: 'half-day' })));
    expect(pickTraditions(prefs({ setting: 'out', time: 'half-day', cost: 'flexible' })).every((t) => t.setting === 'out')).toBe(true);
    expect(pickTraditions(prefs({ setting: 'home' })).every((t) => t.setting === 'home')).toBe(true);
    for (const time of ['short', 'hour', 'half-day'] as const) for (const cost of ['free', 'under-25', 'flexible'] as const) for (const setting of ['home', 'out', 'either'] as const) {
      const p = prefs({ time, cost, setting });
      const picks = pickTraditions(p);
      expect(picks.length, `${time} ${cost} ${setting}`).toBeGreaterThanOrEqual(setting === 'out' && time === 'short' ? 0 : 2);
      expect(picks.every((t) => fits(t, p))).toBe(true);
    }
  });

  it('suits the children’s ages: a part a toddler can do, nothing a toddler can’t, nothing babyish for teens', () => {
    expect(kidBand([4, 7, 10])).toBe('little');
    expect(kidBand([1, 6])).toBe('young');
    expect(kidBand([13, 16])).toBe('older');
    expect(kidBand([])).toBe('young');
    expect(ageFocus([14, 17])).toBe('teens');
    expect(ageFocus([])).toBeNull();
    const toddler = prefs({ ages: [2], time: 'hour' });
    expect(rankTraditions(toddler).some((t) => (t.minAge ?? 0) > 2)).toBe(false);
    expect(rankTraditions(prefs({ ages: [14, 16], time: 'short', cost: 'free' })).some((t) => t.id === 'paper-snowflakes')).toBe(false);
  });

  it('suggests different ideas for toddlers, school-age children and teens', () => {
    const little = names(prefs({ ages: [2, 4] }));
    const older = names(prefs({ ages: [10, 12] }));
    const teens = names(prefs({ ages: [14, 16], time: 'half-day' }));
    expect(little).not.toEqual(older);
    expect(older).not.toEqual(names(prefs({ ages: [14, 16] })));
    expect(teens.some((id) => traditionById(id)!.suits?.includes('teens'))).toBe(true);
    expect(little.every((id) => (traditionById(id)!.minAge ?? 0) <= 2)).toBe(true);
  });

  it('swaps one idea for another that fits, never one already showing, and keeps the ones she’s keeping', () => {
    const p = prefs({ ages: [4, 7, 10] });
    const shown = names(p);
    const next = swapTradition(p, shown, 1, [])!;
    expect(shown).not.toContain(next.id);
    expect(fits(next, p)).toBe(true);
    const after = pickTraditions(prefs({ ages: [4, 7, 10], time: 'short' }), [shown[0]]);
    expect(after[0].id).toBe(shown[0]);
    // Swapping again and again offers everything that fits before anything comes back.
    let cur = [...shown];
    const skipped: string[] = [];
    const seen = new Set(cur);
    for (let i = 0; i < rankTraditions(p).length - 3; i++) {
      const n = swapTradition(p, cur, 2, skipped)!;
      skipped.push(cur[2]);
      cur = [cur[0], cur[1], n.id];
      expect(seen.has(n.id)).toBe(false);
      seen.add(n.id);
    }
    expect(swapTradition(p, cur, 2, skipped)).toBeDefined();
  });

  it('copies her picks as plain text with the reminder', () => {
    const picks = ['cookies-neighbor', 'lights-walk'].map((id) => traditionById(id)!);
    const text = traditionsText(picks, 'little');
    expect(text.split('\n')[0]).toBe('Our Christmas Traditions');
    expect(text).toContain('1. Cookies for a neighbor');
    expect(text).toContain(`About an hour · ${costLabel['under-25']}`);
    expect(text).toContain('Kids can: Stir the dough and add the sprinkles.');
    expect(text.trim().endsWith(TRADITIONS_REMINDER)).toBe(true);
  });
});

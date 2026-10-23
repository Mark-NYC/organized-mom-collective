/**
 * The July 2027 kit, Ready to Go: one letter, one action (the five-step Ready-to-Go Challenge for one outing), one
 * optional tool (the Family Packing & Independence Builder, a site tool opened inside the Club). Above all: lists fit
 * the outing, children pack what suits their age, grown-ups keep medicine, documents and safety at every age, and the
 * shared work is spread between grown-ups.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as july } from '../src/data/club/kits/2027-07-ready-to-go';
import { clubTools } from '../src/data/club/tools';
import {
  assignShared, cannotOwnShared, clothingDays, defaultPrefs, OUTINGS, packCheckUnpack, personList, prefsFor, sharedList, stageOf, templateName,
  type Length, type Outing, type PackingInput,
} from '../src/data/packing';
import { responsibilityById } from '../src/data/responsibilities';
import { groupFor, type Helper } from '../src/lib/household-helpers';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = july.action!;
const people = (xs: [string, number | null, boolean?][]): Helper[] =>
  xs.map(([name, age, h], i) => ({ id: `p${i}`, name, group: groupFor(age), age, limits: [], ...(h ? { holder: true } : {}) }));
const rivera = people([['Ana', null, true], ['Luis', null], ['Sofia', 11], ['Mateo', 6], ['Elena', 4]]);
const brooks = people([['Jess', null, true], ['Max', 9], ['Lily', 6]]);
const chen = people([['Mei', null, true], ['David', null], ['Lin', null], ['Grace', 16], ['Owen', 14], ['Ivy', 8], ['Leo', 5]]);
const go = (outing: Outing, length?: Length, nights = 3, prefs = defaultPrefs(outing)): PackingInput => ({ outing, length: length ?? (outing === 'vacation' ? 'multi' : outing === 'pool' ? 'hours' : outing === 'sleepover' ? 'overnight' : 'day'), nights, prefs });
const titles = (h: Helper, o: PackingInput) => personList(h, o).map((x) => x.title);

describe('July: one letter, one outing, one optional packing tool', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(july)).toEqual([]);
    expect(july.theme).toBe('Ready to Go');
    expect(july.subtitle).toBe('Less packing for Mom. More independence for everyone.');
    expect(kitBySlug('2027-07-ready-to-go')).toBe(july);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has exactly the five steps, where and when above them, and the outing choices the builder knows', () => {
    expect(action.title).toBe('Our Ready-to-Go Challenge');
    expect(action.intro).toBe('One outing. Everyone gets ready together.');
    expect(action.items.map((i) => i.text)).toEqual([
      'Choose one upcoming outing.', 'Figure out what everyone needs.', 'Let everyone pack their own things.', 'Check together before leaving.', 'Unpack when you get home.',
    ]);
    expect(action.focus).toMatchObject({ printLabel: 'Where we’re going', whenLabel: 'When' });
    for (const s of action.focus!.suggestions) expect(OUTINGS).toContain(s.id);
    expect(JSON.stringify(july)).not.toMatch(/itinerary|streak|score|reward points|badge|dashboard/i);
  });
});

describe('July: the letter and the mailer', () => {
  const letter = july.mailer.letter!;
  it('is a 150–200 word draft for Megan, with the question, and no guilt, blame or vacation assumption', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('They Can Get Themselves Ready');
    expect(letter.draft).toBe(true);
    expect(schedulable(july)).toBe(false);
    expect(letter.body).toContain('What’s one thing you think you could get ready by yourself before we leave?');
    expect(letter.body).toMatch(/anything to do with safety/);
    expect(letter.body).not.toMatch(/\b(dad|husband|lazy|messy kids|vacation home|resort|flight)\b/i);
    expect(letter.body).not.toMatch(/\b(I|my|me)\b/);
  });

  it('puts the guide by age, Pack Check Unpack, the question, the builder, the gear note and the calendar note on the back', () => {
    expect(july.mailer.fieldGuide.title).toBe('Raising Kids Who Can Get Themselves Ready');
    expect(july.mailer.framework!.steps).toEqual([
      { word: 'Pack', text: 'Gather your things.' }, { word: 'Check', text: 'Make sure you have what you need.' }, { word: 'Unpack', text: 'Put everything away when you get home.' },
    ]);
    expect(july.mailer.ageGuide!.rows.length).toBe(4);
    expect(july.mailer.ageGuide!.note).toMatch(/Grown-ups keep medicine, documents and safety items/);
    expect(july.mailer.conversation!.question).toBe('What’s one thing you think you could get ready by yourself before we leave?');
    expect(july.mailer.invite!.title).toBe('Make Your Family’s Packing Lists');
    expect(july.mailer.invite!.body).toMatch(/^Choose where you’re going and who’s coming\. We’ll create packing lists that help everyone get ready/);
    expect(july.mailer.tip!.body).toBe('Check your family’s go-to travel bag, water bottles, and reusable supplies so they’re ready for next time.');
    expect(july.mailer.calendarNote).toBe('Add your upcoming outings and trips to the family calendar. Let everyone know when they’ll need to have their bags ready.');
  });

  it('points its QR code at this kit’s own page, and is seeded as a draft', () => {
    expect(qrUrl(july.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-07-ready-to-go?source=mailer');
    expect(readableUrl(july.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-07-ready-to-go');
    expect(qrMatrix(qrUrl(july.mailer.qrPath)).length).toBeGreaterThan(0);
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-07-ready-to-go', '2027-07-01', 'Ready to Go', 'draft', '2027-07-01/);
  });
});

describe('July: the Family Packing & Independence Builder', () => {
  it('is a site tool the Club hosts with the family, separate from the month’s copy, and leaves the travel checklist alone', () => {
    expect(july.tool).toMatchObject({ tool: 'packing', cta: 'Build Our Packing Lists' });
    expect(july.tool!.blurb).toBe('Tell us where you’re going, who’s coming, and how long you’ll be away. We’ll help everyone get ready.');
    expect(clubTools.packing).toMatchObject({ path: routes.clubTool('packing'), perChild: false, familyPeople: true });
    expect(readFileSync('src/components/site/packing-builder.ts', 'utf8')).not.toMatch(/club\/kits|July|2027/);
    expect(readFileSync('src/pages/travel-checklist.astro', 'utf8')).toMatch(/omc:travel:v1/);
  });

  it('fits the list to the outing: a pool afternoon isn’t a vacation, a day camp has no sleeping bag, a sleepover has no swim gear', () => {
    const mateo = rivera[3];
    const pool = titles(mateo, go('pool'));
    expect(pool).toEqual(expect.arrayContaining(['Swimsuit', 'Towel']));
    expect(pool.join()).not.toMatch(/Pajamas|Toothbrush|Outfits|Sleeping/);
    expect(titles(rivera[2], go('camp')).join()).not.toMatch(/Sleeping|Pajamas|Swimsuit/);
    expect(titles(rivera[2], go('camp', 'day', 0, ['outdoors', 'swim']))).toContain('Swimsuit');
    expect(titles(rivera[2], go('sleepover')).join()).toMatch(/Pajamas.*|Sleeping bag/);
    expect(titles(rivera[2], go('sleepover')).join()).not.toMatch(/Swimsuit|Towel|Sunscreen/);
    expect(sharedList(go('sleepover')).map((x) => x.itemId)).toEqual(['pickup']);
    expect(sharedList(go('pool')).map((x) => x.itemId)).not.toContain('documents');
    expect(sharedList(go('vacation')).map((x) => x.itemId)).toEqual(expect.arrayContaining(['documents', 'chargers', 'first-aid']));
  });

  it('counts clothing by the trip’s length, capped when there’s laundry', () => {
    expect(clothingDays(go('vacation', 'multi', 3))).toBe(4);
    expect(clothingDays(go('vacation', 'multi', 9))).toBe(10);
    expect(clothingDays(go('vacation', 'multi', 9, ['laundry']))).toBe(4);
    expect(clothingDays(go('sleepover'))).toBe(2);
    expect(titles(rivera[2], go('vacation', 'multi', 3))).toContain('Outfits for 4 days');
  });

  it('asks only the details that matter for the outing', () => {
    expect(prefsFor('pool', 'hours')).toEqual(['outdoors']);
    expect(prefsFor('camp', 'day')).toEqual(['swim', 'outdoors', 'cool', 'camp-list']);
    expect(prefsFor('vacation', 'multi')).toContain('laundry');
    expect(prefsFor('sleepover', 'overnight')).toEqual(['cool']);
  });

  it('never puts medicine, documents, forms or safety items in a child’s own section, teens included', () => {
    for (const fam of [rivera, brooks, chen]) for (const o of OUTINGS) for (const length of ['hours', 'day', 'overnight', 'multi'] as Length[]) {
      for (const h of fam.filter((x) => x.group !== 'adult')) {
        for (const x of personList(h, go(o, length))) if (x.critical) expect(x.section, `${h.name} ${o} ${length} ${x.title}`).toBe('help');
      }
      for (const h of fam.filter((x) => x.group === 'adult')) expect(personList(h, go(o, length)).every((x) => x.section === 'self')).toBe(true);
    }
  });

  it('gives each age a list it can manage: short for little ones, fuller and more independent as they grow', () => {
    const pool = go('pool');
    const elena = personList(rivera[4], pool);
    expect(elena.filter((x) => x.section === 'self').length).toBeLessThanOrEqual(6);
    expect(elena.find((x) => x.itemId === 'water')!.section).toBe('help');
    const six = personList(rivera[3], pool);
    expect(six.filter((x) => x.section === 'self').map((x) => x.itemId)).toEqual(expect.arrayContaining(['swimsuit', 'towel', 'water']));
    const camp = go('camp', 'day', 0, ['outdoors']);
    expect(personList(chen[4], camp).filter((x) => x.section === 'self').length).toBeGreaterThan(personList(chen[5], camp).filter((x) => x.section === 'self').length);
    expect(personList(chen[3], camp).map((x) => x.itemId)).toContain('teen-phone');
    expect(personList(chen[5], camp).map((x) => x.itemId)).not.toContain('teen-phone');
    expect(stageOf(rivera[4])).toBe('young');
    expect(stageOf(chen[3])).toBe('teen');
    expect(packCheckUnpack(rivera[4]).check).toMatch(/grown-up/);
    for (const x of personList(rivera[3], go('vacation'))) if (x.icon) expect(responsibilityById(x.icon)?.image, x.icon).toBe(true);
  });

  it('shares the shared list between grown-ups, not all to Mom or the first adult, and never a safety item to a child', () => {
    for (const fam of [rivera, chen]) for (const o of ['pool', 'roadtrip', 'vacation', 'camp'] as Outing[]) {
      const shared = assignShared(sharedList(go(o)), fam);
      const owners = new Set(shared.map((x) => x.owner));
      if (shared.length > 2) expect(owners.size, `${o}`).toBeGreaterThan(1);
      expect(shared.every((x) => x.owner === fam[0].id), `${o} all to Mom`).toBe(false);
      for (const x of shared) {
        const h = fam.find((p) => p.id === x.owner)!;
        expect(cannotOwnShared(x, h), `${o} ${x.title} → ${h.name}`).toBeNull();
        if (x.critical) expect(h.group).toBe('adult');
      }
    }
    // A single parent keeps what only a grown-up can do; nothing goes to a child under 13.
    const solo = assignShared(sharedList(go('roadtrip')), brooks);
    expect(solo.every((x) => x.owner === 'p0')).toBe(true);
    // Pinned owners stay.
    const pinned = assignShared(sharedList(go('pool')).map((x) => (x.itemId === 'snacks' ? { ...x, owner: 'p3', pinned: true as const } : x)), chen);
    expect(pinned.find((x) => x.itemId === 'snacks')!.owner).toBe('p3');
  });

  it('names a saved list the way a family would', () => {
    expect(templateName(go('pool'), [rivera[4]])).toBe('Elena’s Pool Bag');
    expect(templateName(go('camp'), [rivera[2]])).toBe('Sofia’s Camp Checklist');
    expect(templateName(go('roadtrip'), rivera)).toBe('Family Road Trip Essentials');
  });
});

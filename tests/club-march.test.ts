/**
 * The March 2027 kit, Spring Clean as a Team: one letter, one action (the five-step One-Room Family Reset), one
 * optional tool (the Family Spring Cleaning Builder, a site tool opened inside the Club). Above all: the builder's
 * plans are safe, fit the time, and share the work.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as march } from '../src/data/club/kits/2027-03-spring-clean-together';
import { clubTools } from '../src/data/club/tools';
import {
  canDo, cannotDo, cleaningRooms, coreJobs, groupFor, jobById, otherRoomJobs, paceFor, planRoom, roomById, sessionCount, sessionMinutes, suppliesFor,
  type Helper, type Limit, type SessionLength,
} from '../src/data/spring-cleaning';
import { focusLines, readCountdown } from '../src/lib/club/countdown';
import { qrMatrix } from '../src/lib/club/qr';
import { qrUrl, readableUrl } from '../src/lib/club/routines';
import { routes } from '../src/routes';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const action = march.action!;
const people = (xs: [string, number | null, (Limit[] | boolean)?][]): Helper[] =>
  xs.map(([name, age, more], i) => ({ id: `p${i}`, name, group: groupFor(age), age, limits: Array.isArray(more) ? more : [], ...(more === true ? { holder: true } : {}) }));
const okafor = people([['Ada', null, true], ['Tunde', null], ['Zara', 3]]);
const rivera = people([['Ana', null, true], ['Luis', null], ['Sofia', 11], ['Mateo', 7], ['Elena', 5]]);
const chenTeens = people([['Mei', null, true], ['Grace', 16], ['Owen', 14]]);
const allJobs = [...cleaningRooms.flatMap((r) => r.jobs), ...otherRoomJobs];

describe('March: one letter, one room, one optional cleaning plan', () => {
  it('passes every kit check and sits in month order', () => {
    expect(kitProblems(march)).toEqual([]);
    expect(march.theme).toBe('Spring Clean as a Team');
    expect(march.subtitle).toBe('Less cleaning for Mom. More helping hands.');
    expect(kitBySlug('2027-03-spring-clean-together')).toBe(march);
    expect(kits.map((k) => k.month)).toEqual([...kits.map((k) => k.month)].sort());
  });

  it('has exactly the five steps, the space and when written above them, optional helpers, and nothing scheduled', () => {
    expect(action.title).toBe('Our One-Room Family Reset');
    expect(action.intro).toBe('One room. Thirty minutes. Everyone has a part.');
    expect(action.items.map((i) => i.text)).toEqual([
      'Choose one room or shared space.',
      'Have everyone choose one job they can handle.',
      'Set a timer for 30 minutes.',
      'Work together and put things back where they belong.',
      'Enjoy the result and decide if you want to tackle another space.',
    ]);
    expect(action.helperLabel).toBe('Who’s helping?');
    expect(action.focus).toMatchObject({ printLabel: 'The space we’re resetting', whenLabel: 'When we’re doing it' });
    expect(action.focus!.suggestions.map((s) => s.id)).toEqual(cleaningRooms.map((r) => r.id));
    expect(action.note).toMatch(/try 15/);
    expect(JSON.stringify(march)).not.toMatch(/streak|score|points|badge|reminder|deadline/i);
  });

  it('saves the room and the day, and copies them without a check-in', () => {
    const s = readCountdown({ focus: { area: 'living', text: 'Living room', start: '2027-03-06' } }, 5);
    expect(focusLines('The space we’re resetting', s.focus, 'When we’re doing it')).toEqual(['The space we’re resetting: Living room', 'When we’re doing it: Saturday, March 6', '']);
  });

  it('prints the reset and the letter, with a leafy stem', () => {
    expect(march.printables.map((p) => [p.id, p.component])).toEqual([['one-room-reset', 'Action'], ['letter', 'Letter']]);
    expect(march.mailer.accent).toBe('spring');
  });
});

describe('March: the letter and the mailer', () => {
  const letter = march.mailer.letter!;
  it('is a 150–200 word draft for Megan, with the question, and no guilt or two-parent assumption', () => {
    const n = words([letter.greeting, letter.body, 'Warmly,', letter.signoff].join(' '));
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(200);
    expect(letter.title).toBe('This House Belongs to All of Us');
    expect(letter.namedGreeting).toBe('Hi {name},');
    expect(letter.draft).toBe(true);
    expect(schedulable(march)).toBe(false);
    expect(letter.body).toContain('This house belongs to all of us. Taking care of it can belong to all of us, too.');
    expect(letter.body).toContain('What’s one space in our home we could make better together?');
    expect(letter.body).not.toMatch(/\b(dad|husband|both parents|messy house|dirty)\b/i);
    expect(letter.body).not.toMatch(/\b(I|my|me)\b/);
  });

  it('puts the field guide, the optional decluttering ideas, the question, the builder and the calendar note on the back', () => {
    expect(march.mailer.fieldGuide.title).toBe('Your Spring Reset Field Guide');
    expect(march.mailer.fieldGuide.sections.map((s) => s.heading)).toEqual(['Start with one room.', 'Give everyone a real job.', 'Work in short sessions.']);
    expect(march.mailer.checklist!.items).toEqual(['Outgrown clothes and shoes', 'Toys, games and books', 'Paperwork and school papers', 'Unused household items']);
    expect(march.mailer.checklist!.note).toMatch(/not four more projects/);
    expect(march.mailer.invite?.title).toBe('Build Your Family Spring Cleaning Plan');
    expect(march.mailer.invite?.body).toMatch(/^Choose your rooms, who’s helping, and how much time you have\. We’ll help divide the work/);
    expect(march.mailer.calendarNote).toBe('Choose one cleaning session and put it on your wall calendar so everyone knows when it’s happening.');
  });

  it('points its QR code at this kit’s own page, and is seeded as a draft', () => {
    expect(qrUrl(march.mailer.qrPath)).toBe('https://www.organizedmomcollective.com/club/kits/2027-03-spring-clean-together?source=mailer');
    expect(readableUrl(march.mailer.qrPath)).toBe('organizedmomcollective.com/club/kits/2027-03-spring-clean-together');
    expect(qrMatrix(qrUrl(march.mailer.qrPath)).length).toBeGreaterThan(0);
    const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
    expect(sql).toMatch(/'2027-03-spring-clean-together', '2027-03-01', 'Spring Clean as a Team', 'draft', '2027-03-01/);
  });
});

describe('March: the Family Spring Cleaning Builder', () => {
  it('is a site tool the Club hosts with the family’s names and ages, separate from the month’s copy', () => {
    expect(march.tool).toMatchObject({ tool: 'spring-cleaning', title: 'Make a Family Cleaning Plan', cta: 'Build Our Cleaning Plan' });
    expect(clubTools['spring-cleaning']).toMatchObject({ path: routes.clubTool('spring-cleaning'), perChild: false, familyPeople: true });
    expect(readFileSync('src/components/site/spring-cleaning-builder.ts', 'utf8')).not.toMatch(/club\/kits|March|2027/);
  });

  it('offers the rooms asked for, each with a short starting list and more to add', () => {
    expect(cleaningRooms.map((r) => r.label)).toEqual(['Kitchen', 'Living room', 'Dining room', 'Bathroom', 'Bedrooms', 'Entryway or mudroom', 'Laundry area', 'Playroom', 'Home office', 'Closets']);
    expect(roomById('other')!.jobs).toBe(otherRoomJobs);
    expect(new Set(allJobs.map((x) => x.id)).size).toBe(allJobs.length);
    for (const r of cleaningRooms) {
      expect(coreJobs(r).length, r.id).toBeGreaterThanOrEqual(5);
      expect(coreJobs(r).length, r.id).toBeLessThanOrEqual(9);
    }
  });

  it('never suggests chemicals, ladders, heavy lifting, sharp tools, appliances or medicines to a child', () => {
    const risky = /cleaner|oven|toilet|tub|detergent|mattress|sofa|out the dryer|shred old|medicine|high|ceiling|light fixture|top shelf|step stool|up high|washer seal/i;
    for (const x of allJobs) if (risky.test(`${x.title} ${x.supplies ?? ''}`) && !/glass cleaner/.test(x.supplies ?? '')) expect(x.adultOnly, x.id).toBe(true);
    for (const x of allJobs.filter((y) => y.adultOnly)) for (const age of [3, 7, 11, 15, 17]) expect(canDo(x, { id: 'k', name: 'K', group: groupFor(age), age, limits: [] }), `${x.id} at ${age}`).toBe(false);
  });

  it('treats an age as a suggestion and a limit as a rule', () => {
    const vacuum = jobById('l-vacuum')!;
    expect(cannotDo(vacuum, { id: 'k', name: 'K', group: 'school', age: 8, limits: [] })).toBe('suggested from age 10');
    const grownup = (limits: Limit[]): Helper => ({ id: 'a', name: 'A', group: 'adult', age: null, limits });
    expect(canDo(vacuum, grownup([]))).toBe(true);
    expect(cannotDo(vacuum, grownup(['no-floor']))).toBe('floor work');
    expect(cannotDo(jobById('l-high')!, grownup(['no-high']))).toBe('high reaching');
    expect(cannotDo(jobById('l-sofa')!, grownup(['no-lift']))).toBe('heavy lifting');
    expect(cannotDo(jobById('b-toilet')!, grownup(['no-products']))).toBe('cleaning products');
    expect(cannotDo(jobById('l-dust')!, grownup(['seated']))).toBe('not a seated job');
    expect(canDo(jobById('la-socks')!, grownup(['seated']))).toBe(true);
  });

  it('gives each person only jobs they can do, in every room, at every length, for every sample family', () => {
    const families = [okafor, rivera, chenTeens, people([['Jess', null, true], ['Max', 9], ['Lily', 6]]), people([['Claire', null, true]]),
      people([['Mei', null, true], ['David', null], ['Lin', null, ['seated']], ['Grace', 16], ['Owen', 14], ['Ivy', 8], ['Leo', 5]])];
    for (const fam of families) for (const room of [...cleaningRooms, roomById('other')!]) for (const len of [15, 30, 60] as SessionLength[]) {
      const plan = planRoom(coreJobs(room), fam, len);
      expect(plan.length, room.id).toBe(coreJobs(room).length);
      for (const x of plan) {
        const h = fam.find((p) => p.id === x.owner);
        if (h) expect(canDo(jobById(x.jobId!)!, h), `${room.id} ${x.title} → ${h.name}`).toBe(true);
        else expect(fam.some((p) => canDo(jobById(x.jobId!)!, p)), `${x.title} left unassigned though someone could`).toBe(false);
      }
      // Every session fits its length, except a single job that's longer than the session on its own.
      for (let i = 0; i < sessionCount(plan); i++) {
        const jobs = plan.filter((x) => x.session === i);
        if (jobs.length > 1) expect(sessionMinutes(plan, fam, i), `${room.id} ${len} session ${i + 1}`).toBeLessThanOrEqual(len);
      }
    }
  });

  it('gives a young family a short, real 15-minute start, with the youngest helping', () => {
    const plan = planRoom(coreJobs(roomById('living')!), okafor, 15);
    expect(sessionMinutes(plan, okafor, 0)).toBeLessThanOrEqual(15);
    expect(plan.some((x) => x.owner === 'p2' && x.session === 0)).toBe(true);
    expect(plan.filter((x) => x.session === 0).length).toBeGreaterThanOrEqual(3);
  });

  it('works people side by side: a session is as long as its busiest person, not the sum', () => {
    const plan = planRoom(coreJobs(roomById('kitchen')!), rivera, 30);
    const total = plan.filter((x) => x.session === 0).reduce((n, x) => n + x.minutes, 0);
    expect(sessionMinutes(plan, rivera, 0)).toBeLessThan(total);
    expect(sessionCount(plan)).toBe(1);
  });

  it('shares the work: every helper who can do something gets a job, and Mom isn’t the catch-all', () => {
    for (const room of cleaningRooms) {
      const plan = planRoom(coreJobs(room), rivera, 30);
      const mine = plan.filter((x) => x.owner === 'p0').length;
      const most = Math.max(...rivera.map((p) => plan.filter((x) => x.owner === p.id).length));
      expect(mine, room.id).toBeLessThanOrEqual(most);
      expect(mine, room.id).toBeLessThanOrEqual(Math.ceil(plan.length / 3));
    }
    const kitchen = planRoom(coreJobs(roomById('kitchen')!), rivera, 30);
    for (const p of rivera) expect(kitchen.some((x) => x.owner === p.id), p.name).toBe(true);
  });

  it('splits a room into more sessions when there’s less time or fewer hands, never dropping a job', () => {
    const alone = people([['Claire', null, true]]);
    const short = planRoom(coreJobs(roomById('kitchen')!), alone, 15);
    const long = planRoom(coreJobs(roomById('kitchen')!), alone, 60);
    expect(sessionCount(short)).toBeGreaterThan(sessionCount(long));
    expect(short.length).toBe(long.length);
    expect(paceFor(rivera[4])).toBeGreaterThan(paceFor(rivera[0]));
  });

  it('lists what to have ready', () => {
    const plan = planRoom(coreJobs(roomById('living')!), rivera, 30);
    expect(suppliesFor(plan)).toEqual(expect.arrayContaining(['a basket', 'the vacuum']));
  });
});

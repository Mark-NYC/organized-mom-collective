/**
 * Opening one of the site's tools for someone, from another page: the reusable way an Organized Family Club kit hands
 * a child (name, age) and a starting choice to a public tool, so the tool itself stays one implementation.
 *
 * The opener calls setToolHandoff() and goes to the tool's page; the tool reads it with readToolHandoff() on load
 * (only pages that ask for one: a public tool page never does). Kept in this tab's sessionStorage, never in the URL,
 * so names don't reach addresses, logs or analytics, and a reload opens the same chart again.
 */

export interface ToolHandoff {
  /** The tool it's for, e.g. 'routine-chart'. */
  tool: string;
  /** Who and what it's for, opaque (e.g. a child's id and the routine): the tool keeps one saved copy per key. */
  key: string;
  /** First name, shown on the tool's output (a chart title). */
  name?: string;
  age?: number;
  /** A family tool's children's ages (the traditions picker), youngest first. */
  ages?: number[];
  /** A family tool's people, first names only (the habit builder's "who"). */
  people?: { name: string; adult: boolean }[];
  /** A starting answer in her own words (the habit builder: the family's one thing). */
  text?: string;
  /** A day she chose ('YYYY-MM-DD'; the habit builder: the start day). */
  date?: string;
  /** The tool's own starting choice, e.g. 'morning' or 'afterschool'. */
  variant?: string;
  /** Where "Back" goes. */
  back?: { href: string; label: string };
}

const KEY = 'omc:tool-handoff';
const ID = /^[A-Za-z0-9_-]{1,120}$/;

export function setToolHandoff(h: ToolHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* The tool opens without it: blank, as for any visitor. */
  }
}

/** Forget any handoff: pages other than a tool's call it, so a tool opened later (or another family's) starts clean. */
export function clearToolHandoff() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}

/** The handoff for `tool`, checked field by field; null when there's none (or it's for another tool). */
/**
 * `sample`: the Club sample household this page is showing (`?sample=<id>`; the hosted preview passes its own). A
 * handoff made for another household's key is ignored, so opening a tool's address as a different sample family in
 * the same tab never shows the last family's names. Keys start with the household id ('sample-rivera-…').
 */
export function readToolHandoff(tool: string, sample: string | null = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('sample')): ToolHandoff | null {
  let o: Partial<ToolHandoff> | null = null;
  try {
    o = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!o || o.tool !== tool || typeof o.key !== 'string' || !ID.test(o.key)) return null;
  if (sample ? !o.key.startsWith(`sample-${sample}-`) : o.key.startsWith('sample-')) return null;
  const name = typeof o.name === 'string' ? o.name.replace(/\s+/g, ' ').trim().slice(0, 30) : '';
  const back = o.back && typeof o.back.href === 'string' && o.back.href.startsWith('/') && !o.back.href.startsWith('//') && typeof o.back.label === 'string' ? { href: o.back.href, label: o.back.label.slice(0, 60) } : undefined;
  return {
    tool,
    key: o.key,
    ...(name ? { name } : {}),
    ...(typeof o.age === 'number' && Number.isInteger(o.age) && o.age >= 0 && o.age < 30 ? { age: o.age } : {}),
    ...(Array.isArray(o.ages) && o.ages.length ? { ages: o.ages.filter((a): a is number => Number.isInteger(a) && a >= 0 && a < 30).slice(0, 12).sort((a, b) => a - b) } : {}),
    ...(Array.isArray(o.people) && o.people.length ? { people: o.people.flatMap((p) => (p && typeof p.name === 'string' && p.name.trim() ? [{ name: p.name.replace(/\s+/g, ' ').trim().slice(0, 30), adult: p.adult === true }] : [])).slice(0, 12) } : {}),
    ...(typeof o.text === 'string' && o.text.trim() ? { text: o.text.replace(/\s+/g, ' ').trim().slice(0, 80) } : {}),
    ...(typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? { date: o.date } : {}),
    ...(typeof o.variant === 'string' && ID.test(o.variant) ? { variant: o.variant } : {}),
    ...(back ? { back } : {}),
  };
}

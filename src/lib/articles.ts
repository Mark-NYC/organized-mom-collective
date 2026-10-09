/** Reading the resource library (src/content/articles/) in one consistent way. */
import { getCollection, getEntries, getEntry, type CollectionEntry } from 'astro:content';
import type { PillarId } from '../data/pillars';

export type Article = CollectionEntry<'articles'>;

/** Published articles, newest first. Drafts show in `astro dev` only. */
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('articles', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

/** A pillar's articles: its pillar guide first, then newest first. */
export async function getPillarArticles(pillar: PillarId): Promise<Article[]> {
  return (await getArticles()).filter((a) => a.data.pillar === pillar).sort(guideFirst);
}

/** Related articles, dropping drafts in production. */
export async function getRelated(article: Article): Promise<Article[]> {
  const list = await getEntries(article.data.related);
  return list.filter((a) => import.meta.env.DEV || !a.data.draft);
}

export async function getNext(article: Article): Promise<Article | undefined> {
  if (!article.data.next) return undefined;
  const next = await getEntry(article.data.next);
  return next && (import.meta.env.DEV || !next.data.draft) ? next : undefined;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);


/** Sorts a pillar guide ahead of the rest, keeping the existing order otherwise. */
export const guideFirst = (a: Article, b: Article) => Number(b.data.pillarGuide) - Number(a.data.pillarGuide);

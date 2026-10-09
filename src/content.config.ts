/**
 * Resource library content. One .mdx file per article in src/content/articles/;
 * the file name is the URL slug (/resources/<file-name>).
 *
 * Rules for every field: docs/editorial/SEO_STRATEGY.md and ARTICLE_FORMAT.md.
 * `scripts/check-site.mjs` cross-checks each article against
 * docs/editorial/CONTENT_TRACKER.md after the build.
 */
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { pillarIds, pillars } from './data/pillars';

const prefixOf: Record<string, string> = Object.fromEntries(pillars.map((p) => [p.id, p.prefix]));

const articles = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/articles' }),
  schema: z
    .object({
      /** Tracker id from CONTENT_TRACKER.md, e.g. HC-01. Prefix must match the pillar. */
      trackerId: z.string().regex(/^[A-Z]{2}-\d{2}$/),
      /** The on-page H1. Written for the reader. */
      title: z.string(),
      /** The <title> tag, used as-is. Search-facing. */
      seoTitle: z.string().max(60),
      /** Meta description. Answers the search in one or two sentences. */
      description: z.string().min(70).max(160),
      /** One-line promise shown under the H1 and on cards. */
      summary: z.string().max(200),
      pillar: z.enum(pillarIds),
      /** True only for the pillar guide (one per pillar). */
      pillarGuide: z.boolean().default(false),
      published: z.coerce.date(),
      /** Set when the advice changes, not for typo fixes. */
      updated: z.coerce.date().optional(),
      /** The search query this article exists to answer. */
      primaryKeyword: z.string(),
      /** Up to three related articles for the end cards, most relevant first. */
      related: z.array(reference('articles')).max(3).default([]),
      /** The next-step article, shown after Your Next Small Win. */
      next: reference('articles').optional(),
      /** Which product the article mentions in its <ProductNote>, if any. */
      cta: z.enum(['calendar', 'app', 'none']),
      /** Drafts render in `astro dev` only. */
      draft: z.boolean().default(false),
    })
    .refine((d) => d.trackerId.startsWith(`${prefixOf[d.pillar]}-`), {
      message: 'trackerId prefix must match the pillar’s prefix in src/data/pillars.ts',
      path: ['trackerId'],
    }),
});

export const collections = { articles };

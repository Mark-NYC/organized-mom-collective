/**
 * OMC practical guides: single registry for the public /guides directory.
 * Add entries only when the guide is live, and use actual guide photography.
 * Guides teach a complete system; articles and interactive tools keep their own pages.
 */
export type Guide = {
  slug: string;
  title: string;
  teaser: string;
  area: 'Cleaning & resets' | 'Family responsibilities' | 'Routines' | 'Meal planning' | 'Home organization';
  image: string;
  imageAlt: string;
  pdf?: string;
  pages?: number;
  kicker: string;
};
export const guides: Guide[] = [
  {
    slug: 'family-bathroom-reset',
    title: 'The Family Bathroom Reset',
    teaser: 'Daily habits, six weekly jobs, and a simple way to share bathroom care with the whole family.',
    area: 'Cleaning & resets',
    kicker: 'Daily reset · Weekly jobs · Family handoff',
    image: '/images/guides/bathroom-guide-page-1.webp',
    imageAlt: 'First page of the illustrated Family Bathroom Reset printable',
    pdf: '/downloads/family-bathroom-reset.pdf',
    pages: 4,
  },
];
export const guideUrl = (guide: Pick<Guide,'slug'>) => '/guides/' + guide.slug + '/';

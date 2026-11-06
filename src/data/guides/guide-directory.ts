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
    slug: 'family-laundry-system',
    title: 'A Laundry System the Whole Family Can Help Keep Up With',
    teaser: 'Five steps from hamper to drawer, a realistic weekly rhythm, and a simple way to share the work.',
    area: 'Family responsibilities',
    kicker: 'Full laundry loop · Weekly rhythm · Family ownership',
    image: '/images/guides/laundry-guide-page-1.webp',
    imageAlt: 'Illustrated first page of the Family Laundry System printable',
    pdf: '/downloads/family-laundry-system-guide.pdf',
    pages: 4,
  },
  {
    slug: 'family-kitchen-reset',
    title: 'The Family Kitchen Reset',
    teaser: 'Five easy after-meal habits, shared cleanup jobs, and an illustrated family plan for keeping the kitchen ready.',
    area: 'Cleaning & resets',
    kicker: 'After-meal habits · Ten-minute reset · Weekly care',
    image: '/images/guides/kitchen-guide-page-1.webp',
    imageAlt: 'Illustrated preview of page one of the Family Kitchen Reset printable',
    pdf: '/downloads/family-kitchen-reset.pdf',
    pages: 4,
  },
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

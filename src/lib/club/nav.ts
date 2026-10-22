/**
 * How the Club's member pages move between pages, read the current query and print. On the site these are plain
 * browser navigation and window.print(). The single-page preview (src/preview/club-preview.tsx) swaps in its own
 * navigation and turns printing off (its frame can't open a print dialog; "Preview the printout" still works).
 */
export interface ClubNav {
  go(url: string, opts?: { replace?: boolean }): void;
  search(): string;
  reload(): void;
  canPrint: boolean;
}

let nav: ClubNav = {
  go: (url, opts) => (opts?.replace ? location.replace(url) : location.assign(url)),
  search: () => (typeof location === 'undefined' ? '' : location.search),
  reload: () => location.reload(),
  canPrint: true,
};

export const clubNav = () => nav;
export const setClubNav = (n: ClubNav) => {
  nav = n;
};

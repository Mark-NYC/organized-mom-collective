/**
 * The Organized Family Club member pages as one self-contained page, for viewing outside the site (a hosted preview).
 * Made-up sample households only (src/data/club/samples.ts); no sign-in, no database, nothing sent anywhere.
 * Built by scripts/build-club-preview.mjs. Navigation stays inside the page; printing is off (the page's frame can't
 * open a print dialog), and "Preview the printout" shows the real US Letter page.
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from '../components/club/Dashboard';
import FamilyPage from '../components/club/FamilyPage';
import KitPage from '../components/club/KitPage';
import { kits } from '../data/club/kits';
import { setClubNav } from '../lib/club/nav';

interface Route {
  path: string;
  search: string;
}

const KEY = 'omc:club-preview:route';
const parse = (url: string): Route => {
  const u = new URL(url, 'https://preview.invalid');
  return { path: u.pathname, search: u.search };
};
const saved = (): Route => {
  try {
    const r = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Route | null;
    if (r?.path?.startsWith('/club/')) return r;
  } catch {
    /* start at the sample list */
  }
  return parse('/club/dashboard');
};

// Illustrations are inlined by the build; the components ask for /images/responsibilities/…
const images = (globalThis as { __CLUB_IMAGES?: Record<string, string> }).__CLUB_IMAGES ?? {};
const swapImages = (root: ParentNode) => {
  for (const img of root.querySelectorAll<HTMLImageElement>('img[src^="/images/"]')) {
    const data = images[img.getAttribute('src')!];
    if (data) img.src = data;
  }
};
new MutationObserver(() => swapImages(document)).observe(document.documentElement, { childList: true, subtree: true });

function App() {
  const [route, setRoute] = useState<Route>(saved);

  setClubNav({
    go(url) {
      const next = parse(url);
      try {
        sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* this visit only */
      }
      setRoute(next);
      window.scrollTo(0, 0);
    },
    search: () => route.search,
    reload: () => location.reload(),
    canPrint: false,
  });

  // Links inside the pages (/club/…) move within the preview.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      const href = a?.getAttribute('href') ?? '';
      if (!href.startsWith('/')) return;
      e.preventDefault();
      if (href.startsWith('/club/')) {
        const next = parse(href);
        try {
          sessionStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* this visit only */
        }
        setRoute(next);
        window.scrollTo(0, 0);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const key = route.path + route.search;
  const kit = kits.find((k) => route.path === `/club/kits/${k.slug}`);
  return (
    <div className="min-h-full bg-ivory text-warm-ink">
      {route.path === '/club/start' ? <FamilyPage key={key} mode="start" />
        : route.path === '/club/family' ? <FamilyPage key={key} mode="edit" />
        : kit ? <KitPage key={key} slug={kit.slug} />
        : <Dashboard key={key} />}
    </div>
  );
}

createRoot(document.getElementById('club-preview')!).render(<App />);

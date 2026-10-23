/**
 * The Organized Family Club member pages as one self-contained page, for viewing outside the site (a hosted preview).
 * Made-up sample households only (src/data/club/samples.ts); no sign-in, no database, nothing sent anywhere.
 * Built by scripts/build-club-preview.mjs. Site tools the Club hosts (src/data/club/tools.ts) come in as the Club
 * page's built markup plus the tool's one behavior module. Navigation stays inside the page; printing is off (the page's frame can't
 * open a print dialog), and "Preview the printout" shows the real US Letter page.
 */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from '../components/club/Dashboard';
import FamilyPage from '../components/club/FamilyPage';
import KitPage from '../components/club/KitPage';
import ClubToolBar from '../components/club/ClubToolBar';
import { initRoutineChart } from '../components/site/routine-chart';
import { initChoreChart } from '../components/site/chore-chart';
import { initTraditionsPicker } from '../components/site/traditions-picker';
import { initHabitBuilder } from '../components/site/habit-builder';
import { initConnectionPlanner } from '../components/site/connection-planner';
import { readToolHandoff } from '../lib/tool-handoff';
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
// The hosted preview's frame can't download files itself; its host offers them through the `downloads` capability
// (with a confirmation). Site code still makes its usual download link; this hands that file over instead.
type Downloads = { save(r: { filename: string; data: Blob }): Promise<unknown> };
let downloads: Downloads | null = null;
(globalThis as { claude?: { use?: (n: string) => Promise<unknown> } }).claude?.use?.('downloads').then((d) => { downloads = d as Downloads | null; }, () => {});
const nativeClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  const href = this.href;
  if (downloads && this.download && /^(data|blob):/.test(href)) {
    const filename = this.download;
    fetch(href).then((r) => r.blob()).then((data) => downloads!.save({ filename, data })).catch(() => { /* declined or not allowed here */ });
    return;
  }
  nativeClick.call(this);
};

// Tools set image sources from script (the routine chart's illustrations): hand them the inlined copy directly.
const srcProp = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  ...srcProp,
  set(this: HTMLImageElement, v: string) {
    srcProp.set!.call(this, images[v] ?? v);
  },
});

// Site tools hosted in the Club: the markup the Club page renders (built into the preview), wired up with the same
// behavior module the site uses. One tool, two entry points; the preview only swaps how the page arrives.
const toolMarkup = (globalThis as { __CLUB_TOOLS?: Record<string, string> }).__CLUB_TOOLS ?? {};
// The preview's page address is the host's, so the sample family comes from the preview's own route.
let sample: string | null = null;
const toolInit: Record<string, (host: HTMLElement) => void> = {
  'routine-chart': (host) => initRoutineChart(host.querySelector<HTMLElement>('.mr-container')!, readToolHandoff('routine-chart', sample)),
  'chore-chart': (host) => initChoreChart(host.querySelector<HTMLElement>('.chore-chart-container')!, readToolHandoff('chore-chart', sample)),
  'traditions-picker': (host) => initTraditionsPicker(host.querySelector<HTMLElement>('.tp')!, readToolHandoff('traditions-picker', sample)),
  'habit-builder': (host) => initHabitBuilder(host.querySelector<HTMLElement>('.hb')!, readToolHandoff('habit-builder', sample)),
  'connection-planner': (host) => initConnectionPlanner(host.querySelector<HTMLElement>('.cn')!, readToolHandoff('connection-planner', sample)),
};

function ToolPage({ tool, search }: { tool: string; search: string }) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    if (host.current) {
      sample = new URLSearchParams(search).get('sample');
      swapImages(host.current);
      toolInit[tool]?.(host.current);
    }
  }, [tool]);
  return (
    <>
      <ClubToolBar tool={tool} />
      <section ref={host} id="club-tool-host" className="w-full pb-20 pt-4" dangerouslySetInnerHTML={{ __html: (toolMarkup[tool] ?? '').replace(/\/images\/[^"]+?\.webp/g, (p) => images[p] ?? p) }} />
    </>
  );
}

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
  const tool = route.path.startsWith('/club/tools/') ? route.path.slice('/club/tools/'.length) : '';
  return (
    <div className="min-h-full bg-ivory text-warm-ink">
      {route.path === '/club/start' ? <FamilyPage key={key} mode="start" />
        : route.path === '/club/family' ? <FamilyPage key={key} mode="edit" />
        : kit ? <KitPage key={key} slug={kit.slug} />
        : tool && toolMarkup[tool] ? <ToolPage key={key} tool={tool} search={route.search} />
        : <Dashboard key={key} />}
    </div>
  );
}

createRoot(document.getElementById('club-preview')!).render(<App />);

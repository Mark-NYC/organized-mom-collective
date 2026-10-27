/**
 * The printable, full-screen on small screens (ClubPrintableProof.astro). The print DOM never moves: opening
 * only adds `plan-proof-open` to the page root, which fixes the proof layer over the screen. Any element with
 * data-plan-open-proof opens it; data-plan-print prints. Sheets carry data-plan-sheet="front" | "back" | "sheet";
 * the Front/Back switch only hides a side on screen, never in print (ClubPrintStyles.astro).
 */
export function printPlan() {
  (document.activeElement as HTMLElement | null)?.blur();
  window.print();
}

export function mountPrintableProof(root: HTMLElement) {
  const proof = root.querySelector<HTMLElement>('[data-plan-proof]');
  const showSide = (side: string) => {
    root.dataset.planSide = side;
    root.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === side)));
    window.dispatchEvent(new Event('resize'));
  };
  root.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => b.addEventListener('click', () => showSide(b.dataset.side === 'back' ? 'back' : 'front')));
  if (root.querySelector('[data-side]')) showSide('front');

  let opener: HTMLElement | null = null;
  const behind = () =>
    [document.querySelector('body > header[data-chrome]'), document.querySelector('nav[data-chrome]'), root.querySelector('[data-plan-screen]')].filter((e): e is HTMLElement => e instanceof HTMLElement);
  const setProof = (open: boolean) => {
    if (!proof || open === root.classList.contains('plan-proof-open')) return;
    root.classList.toggle('plan-proof-open', open);
    if (open) {
      proof.setAttribute('role', 'dialog');
      proof.setAttribute('aria-modal', 'true');
      proof.setAttribute('aria-label', 'Your printable');
    } else {
      for (const a of ['role', 'aria-modal', 'aria-label']) proof.removeAttribute(a);
    }
    behind().forEach((e) => { e.inert = open; });
    document.body.style.overflow = open ? 'hidden' : '';
    window.dispatchEvent(new Event('resize'));
    if (open) proof.querySelector<HTMLElement>('[data-plan-close-proof]')?.focus();
    else opener?.focus();
  };
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const open = target.closest<HTMLElement>('[data-plan-open-proof]');
    if (open) { opener = open; setProof(true); }
    if (target.closest('[data-plan-close-proof]')) setProof(false);
    if (target.closest('[data-plan-print]')) printPlan();
  });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setProof(false); });
  window.matchMedia('(min-width:1100px)').addEventListener('change', (e) => { if (e.matches) setProof(false); });
  window.addEventListener('pagehide', () => { document.body.style.overflow = ''; }, { once: true });
  return { setProof, showSide };
}

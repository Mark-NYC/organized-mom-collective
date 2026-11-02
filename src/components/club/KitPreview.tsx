/**
 * A miniature of one real printable: its own page (/club/family-vision, /club/family-meeting-guide or her month's tool)
 * loaded in a frame with ?thumb=1 (BaseLayout marks the page `omc-thumb`; global.css hides everything but the
 * printable), then scaled so the printed sheet fills this box. Her family, her choices, her edits: the same page that
 * prints, never a stand-in image. Nothing in the frame can be clicked, focused or saved (the plan pages only save on
 * her own input; ClubNav, WelcomeKitConfirm and the kit panels skip ?thumb).
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** The printable's page. */
  src: string;
  /** The printed sheet in that page, matched only once it shows her family (e.g. `.club-plan[data-plan-state="ready"] [data-plan-sheet]`). */
  target: string;
  /** What it is, for the placeholder while it loads. */
  label: string;
  /** Box shape: the printed sheet's (Letter portrait by default). */
  ratio?: string;
  className?: string;
}

const FRAME = { width: 1200, height: 1700 };

export default function KitPreview({ src, target, label, ratio = '8.5 / 11', className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const url = `${src}${src.includes('?') ? '&' : '?'}thumb=1`;

  useEffect(() => {
    const f = frame.current;
    const b = box.current;
    if (!f || !b) return;
    let tries = 0;
    let timer = 0;
    let rect: { left: number; top: number; width: number; height: number } | null = null;
    const fit = () => {
      if (!rect) return;
      const s = Math.min(b.clientWidth / rect.width, b.clientHeight / rect.height);
      const x = (b.clientWidth - rect.width * s) / 2;
      const y = (b.clientHeight - rect.height * s) / 2;
      f.style.transform = `translate(${x}px, ${y}px) scale(${s}) translate(${-rect.left}px, ${-rect.top}px)`;
    };
    const measure = () => {
      try {
        const el = f.contentDocument?.querySelector<HTMLElement>(target);
        const r = el?.getBoundingClientRect();
        if (r && r.width > 40 && r.height > 40) {
          rect = { left: r.left, top: r.top, width: r.width, height: r.height };
          fit();
          setState('ready');
          return true;
        }
      } catch {
        /* not ready */
      }
      return false;
    };
    const poll = () => {
      // Keep measuring a little after the first match: fonts and images settle the sheet's final size.
      const found = measure();
      if (++tries < 60 && (!found || tries < 8)) timer = window.setTimeout(poll, found ? 600 : 400);
      else if (!found) setState('failed');
    };
    const onLoad = () => { tries = 0; poll(); };
    f.addEventListener('load', onLoad);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(b);
    return () => { f.removeEventListener('load', onLoad); clearTimeout(timer); ro?.disconnect(); };
  }, [url, target]);

  return (
    <div ref={box} className={`kit-preview ${className}`} style={{ aspectRatio: ratio }} data-state={state} aria-hidden="true">
      <iframe ref={frame} src={url} title={label} tabIndex={-1} loading="lazy" width={FRAME.width} height={FRAME.height} />
      {state !== 'ready' && <span className="kit-preview-wait">{state === 'failed' ? label : 'Preparing your preview…'}</span>}
    </div>
  );
}

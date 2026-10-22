/**
 * Holds one printable. Hidden on screen until she opens the preview, which shows the real US Letter page scaled to
 * fit; printing (src/lib/club/print.ts) shows it at full size with nothing else on the page.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fitChart } from '../../lib/club/print';

const PX_PER_IN = 96;

export default function PrintFrame({ open, orientation, children }: { open: boolean; orientation: 'portrait' | 'landscape'; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const pageWidth = (orientation === 'landscape' ? 10.3 : 7.8) * PX_PER_IN;

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el || !open) return;
    const measure = () => {
      const inner = el.querySelector<HTMLElement>('.club-print');
      if (!inner) return;
      if (inner.classList.contains('club-chart')) fitChart(inner);
      const s = Math.min(1, (el.clientWidth - 24) / pageWidth);
      inner.style.transform = `scale(${s})`;
      setScale(s);
      setHeight(inner.offsetHeight * s + 24);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, pageWidth, children]);

  return (
    <div ref={frame} className={`club-print-frame mt-4 ${open ? 'is-open' : ''}`} style={open ? { height } : undefined} data-scale={scale}>
      {children}
    </div>
  );
}

/**
 * Article element events: which saveable elements readers actually use, so we keep the ones that
 * earn their place (docs/editorial/SAVEABLE_ELEMENTS.md). Fires once per element per page view,
 * on a real action only. Never sends what the reader typed or chose.
 * Same vendor pattern as tool-engagement.ts: dataLayer, then gtag / Plausible / Umami if loaded.
 */
export type ElementAction = 'element_use' | 'element_complete' | 'element_print' | 'element_copy';

const sent = new Set<string>();

export function elementEvent(action: ElementAction, element: string, id: string) {
  if (typeof window === 'undefined') return;
  const key = `${action}:${element}:${id}`;
  if (sent.has(key)) return;
  sent.add(key);
  const detail = { event: action, element_type: element, element_id: id, page_path: location.pathname };
  const w = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (event: string, opts: { props: Record<string, string> }) => void;
    umami?: { track: (event: string, props: Record<string, string>) => void };
  };
  try {
    (w.dataLayer ??= []).push(detail);
    const { event, ...props } = detail;
    w.gtag?.('event', event, props);
    w.plausible?.(event, { props });
    w.umami?.track(event, props);
    window.dispatchEvent(new CustomEvent('omc:element', { detail }));
  } catch {
    /* Analytics must never interrupt the article. */
  }
}

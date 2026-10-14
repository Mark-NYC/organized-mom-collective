/**
 * Lightweight tool funnel events. Fires only on actions, never on typing values.
 * No personal names, chores, notes or other form content is sent.
 * Uses existing analytics vendors when present; otherwise the event remains in dataLayer.
 */
export type ToolAction = 'tool_start' | 'tool_first_action' | 'tool_download_click' | 'tool_related_click';
export function toolEvent(action: ToolAction, tool: string, source = 'tool_page') {
  if (typeof window === 'undefined') return;
  const detail = { event: action, tool_id: tool, source, page_path: location.pathname };
  const w = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (event: string, opts: { props: Record<string,string> }) => void;
    umami?: { track: (event: string, props: Record<string,string>) => void };
  };
  try {
    (w.dataLayer ??= []).push(detail);
    const { event, ...props } = detail;
    w.gtag?.('event', event, props);
    w.plausible?.(event, { props });
    w.umami?.track(event, props);
    window.dispatchEvent(new CustomEvent('omc:tool', { detail }));
  } catch { /* Analytics must never interrupt a tool. */ }
}

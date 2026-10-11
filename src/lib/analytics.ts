/**
 * CTA click tracking for public pages. No analytics vendor is installed yet, so every
 * event goes to `window.dataLayer` (what Google Tag Manager reads) and, if one is loaded
 * later, straight to gtag (GA4), Plausible or Umami. Nothing is sent anywhere until one
 * of those is added to PublicLayout. Listen for the `omc:cta` DOM event to hook in others.
 *
 * Mark a link with data-cta="<placement>" (e.g. "home-hero"); the tracker adds the
 * destination and device category. Public pages only: the companion app has no tracking.
 */

export type DeviceCategory = 'mobile' | 'tablet' | 'desktop';

export interface CtaEvent {
  event: 'cta_click';
  cta_placement: string;
  cta_label: string;
  /** Site-relative path for internal links ("/calendar#buy"), full URL for external ones. */
  cta_destination: string;
  device_category: DeviceCategory;
  page_path: string;
}

/** Same breakpoints as the layout: phones under 768px, tablets under 1024px. */
export function deviceCategory(width: number): DeviceCategory {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/** "/calendar#buy" for same-origin links, the full URL otherwise. */
export function destinationOf(href: string, origin: string): string {
  try {
    const url = new URL(href, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : url.href;
  } catch {
    return href;
  }
}

export function ctaEvent(
  link: { placement: string; label: string; href: string },
  page: { origin: string; path: string; width: number },
): CtaEvent {
  return {
    event: 'cta_click',
    cta_placement: link.placement,
    cta_label: link.label.replace(/\s+/g, ' ').trim(),
    cta_destination: destinationOf(link.href, page.origin),
    device_category: deviceCategory(page.width),
    page_path: page.path,
  };
}

type Vendors = {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  plausible?: (name: string, opts?: { props?: Record<string, string> }) => void;
  umami?: { track: (name: string, data?: Record<string, string>) => void };
};

/** Sends one event to every analytics tool on the page. Never throws. */
export function send(e: CtaEvent, w: Vendors & EventTarget = window as unknown as Vendors & EventTarget) {
  const { event, ...props } = e;
  try {
    (w.dataLayer ??= []).push(e);
    w.gtag?.('event', event, { ...props, transport_type: 'beacon' });
    w.plausible?.(event, { props });
    w.umami?.track(event, props);
    w.dispatchEvent(new CustomEvent('omc:cta', { detail: e }));
  } catch {
    // Tracking must never block a click.
  }
}

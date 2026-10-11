import { describe, expect, it } from 'vitest';
import { ctaEvent, destinationOf, deviceCategory, send } from '../src/lib/analytics';

describe('CTA tracking', () => {
  it('buckets the viewport width into a device category', () => {
    expect(deviceCategory(390)).toBe('mobile');
    expect(deviceCategory(767)).toBe('mobile');
    expect(deviceCategory(820)).toBe('tablet');
    expect(deviceCategory(1024)).toBe('desktop');
  });

  it('keeps internal destinations site-relative and external ones absolute', () => {
    const origin = 'https://organizedmomcollective.com';
    expect(destinationOf(`${origin}/calendar#buy`, origin)).toBe('/calendar#buy');
    expect(destinationOf('/calendar', origin)).toBe('/calendar');
    expect(destinationOf('https://www.etsy.com/listing/1/x', origin)).toBe('https://www.etsy.com/listing/1/x');
  });

  it('builds the event and hands it to every analytics tool present', () => {
    const e = ctaEvent(
      { placement: 'home-hero', label: '  See the\n Calendar ', href: 'https://organizedmomcollective.com/calendar' },
      { origin: 'https://organizedmomcollective.com', path: '/', width: 390 },
    );
    expect(e).toEqual({
      event: 'cta_click',
      cta_placement: 'home-hero',
      cta_label: 'See the Calendar',
      cta_destination: '/calendar',
      device_category: 'mobile',
      page_path: '/',
    });

    const gtagCalls: unknown[][] = [];
    const heard: unknown[] = [];
    const w = Object.assign(new EventTarget(), { dataLayer: [] as unknown[], gtag: (...a: unknown[]) => gtagCalls.push(a) });
    w.addEventListener('omc:cta', (ev) => heard.push((ev as CustomEvent).detail));
    send(e, w);
    expect(w.dataLayer).toEqual([e]);
    expect(gtagCalls[0][1]).toBe('cta_click');
    expect(heard).toEqual([e]);
  });

  it('never throws, even when a vendor does', () => {
    const w = Object.assign(new EventTarget(), {
      gtag: () => {
        throw new Error('blocked');
      },
    });
    expect(() => send(ctaEvent({ placement: 'x', label: 'x', href: '/' }, { origin: 'https://a.b', path: '/', width: 1200 }), w)).not.toThrow();
  });
});

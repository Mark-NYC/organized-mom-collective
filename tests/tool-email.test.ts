import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeEmail, validEmail, collectToolEmail, publicDownloadId } from '../src/lib/tool-email';
afterEach(() => vi.unstubAllGlobals());
describe('download signup', () => {
  it('covers published public generators and guide/article downloads, but never paid or member paths', () => {
    expect(publicDownloadId('/family-responsibility-builder')).toBe('family-responsibility-builder');
    expect(publicDownloadId('/family-meeting-agenda')).toBe('family-meeting-agenda');
    expect(publicDownloadId('/routine-chart/')).toBe('routine-chart');
    expect(publicDownloadId('/guides/family-kitchen-reset/')).toBe('guide-family-kitchen-reset');
    expect(publicDownloadId('/guides/family-laundry-system')).toBe('guide-family-laundry-system');
    expect(publicDownloadId('/resources/counter-clutter-reset')).toBe('guide-counter-clutter-reset');
    expect(publicDownloadId('/resources/topics/cleaning')).toBeNull();
    expect(publicDownloadId('/club/tools/routine-chart')).toBeNull();
    expect(publicDownloadId('/app/club')).toBeNull();
    expect(publicDownloadId('/checkout')).toBeNull();
    expect(publicDownloadId('/download')).toBeNull();
  });

  it('normalizes email and rejects invalid or oversized addresses', () => {
    expect(normalizeEmail('  MOM@Example.com ')).toBe('mom@example.com');
    expect(validEmail('mom@example.com')).toBe(true);
    for (const value of ['a', 'a@b', 'a b@c.com', 'a@@b.com', 'a'.repeat(255) + '@b.com']) expect(validEmail(value)).toBe(false);
  });
  it('sends only email, explicit consent, tool id and honeypot, never chart contents', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => 'ok' });
    vi.stubGlobal('fetch', fetcher);
    expect(await collectToolEmail(' MOM@example.com ', false, '', 'chore-chart')).toBe('ok');
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload).toEqual({ p_email: 'mom@example.com', p_marketing: false, p_tool: 'chore-chart', p_website: '', p_source: '', p_medium: '', p_campaign: '', p_content: '' });
  });
  it('does not treat failed persistence or an unexpected response as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await collectToolEmail('a@b.com', true, '', 'chore-chart')).toBe('error');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
    expect(await collectToolEmail('a@b.com', true, '', 'chore-chart')).toBe('error');
  });
  it('preserves rate-limit errors and avoids submitting malformed emails', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => 'rate_limited' });
    vi.stubGlobal('fetch', fetcher);
    expect(await collectToolEmail('a@b.com', true, '', 'chore-chart')).toBe('rate_limited');
    expect(await collectToolEmail('bad', true, '', 'chore-chart')).toBe('invalid');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

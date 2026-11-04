import { describe, expect, it } from 'vitest';
import { ADMIN_FUTURE, ADMIN_GROUPS, ADMIN_SECTIONS } from '../src/data/admin';

describe('admin workspace navigation', () => {
  it('contains only real, unique destinations grouped by operator job', () => {
    expect(ADMIN_GROUPS.map((group) => group.id)).toEqual(['home', 'operations', 'growth', 'system']);
    expect(ADMIN_SECTIONS.length).toBeGreaterThan(0);
    expect(new Set(ADMIN_SECTIONS.map((section) => section.id)).size).toBe(ADMIN_SECTIONS.length);
    expect(ADMIN_SECTIONS.every((section) => section.href.startsWith('/'))).toBe(true);
  });

  it('retains the core operational deep links', () => {
    expect(ADMIN_SECTIONS.find((s) => s.id === 'orders')?.href).toBe('/admin/orders');
    expect(ADMIN_SECTIONS.find((s) => s.id === 'products')?.href).toBe('/admin/orders?tab=inventory');
    expect(ADMIN_SECTIONS.find((s) => s.id === 'club')?.href).toBe('/admin/club');
  });

  it('does not display unbuilt areas as navigation', () => {
    const labels = ADMIN_SECTIONS.map((s) => s.label.toLowerCase()).join(' ');
    for (const future of ADMIN_FUTURE) {
      expect(labels).not.toContain(future.toLowerCase());
    }
  });
});

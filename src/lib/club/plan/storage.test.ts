import { describe, expect, it } from 'vitest';
import { planKey, readScoped } from './storage';

const isNum = (x: unknown): x is { n: number } => typeof (x as { n?: unknown })?.n === 'number';

describe('tab-scoped plan storage', () => {
  it('restores only the same family’s plan', () => {
    const raw = JSON.stringify({ current: planKey('rivera', 'h1'), state: { n: 3 } });
    expect(readScoped(raw, planKey('rivera', 'h1'), isNum)).toEqual({ n: 3 });
    expect(readScoped(raw, planKey('chen', 'h2'), isNum)).toBeNull();
    expect(readScoped(raw, planKey(null, 'h1'), isNum)).toBeNull();
  });
  it('rejects malformed or invalid state', () => {
    expect(readScoped('{oops', 'x', isNum)).toBeNull();
    expect(readScoped(JSON.stringify({ current: 'x', state: { n: '3' } }), 'x', isNum)).toBeNull();
    expect(readScoped(null, 'x', isNum)).toBeNull();
  });
});

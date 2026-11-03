import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ILLUSTRATION_STYLE,
  householdIllustrationStyle,
  isIllustrationStyle,
  resolveIllustrationStyle,
} from './illustration-style';

describe('Club illustration preference', () => {
  it('defaults existing households to hand-drawn', () => {
    expect(DEFAULT_ILLUSTRATION_STYLE).toBe('hand-drawn');
    expect(householdIllustrationStyle(undefined)).toBe('hand-drawn');
    expect(householdIllustrationStyle('unknown')).toBe('hand-drawn');
  });

  it('validates available styles', () => {
    expect(isIllustrationStyle('soft-color')).toBe(true);
    expect(isIllustrationStyle('hand-drawn')).toBe(true);
    expect(isIllustrationStyle('color')).toBe(false);
  });

  it('inherits the family preference when no month override exists', () => {
    expect(resolveIllustrationStyle('soft-color')).toBe('soft-color');
    expect(resolveIllustrationStyle('soft-color', null)).toBe('soft-color');
  });

  it('allows month overrides without changing the household default', () => {
    expect(resolveIllustrationStyle('soft-color', 'hand-drawn')).toBe('hand-drawn');
    expect(resolveIllustrationStyle('hand-drawn', 'soft-color')).toBe('soft-color');
    expect(resolveIllustrationStyle('soft-color', 'invalid')).toBe('soft-color');
  });
});

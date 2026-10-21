import { describe, it, expect } from 'vitest';
import { resolveDefaultTitle } from '../../shared/utils/seo-title';

describe('resolveDefaultTitle', () => {
  it('returns the configured default title', () => {
    expect(resolveDefaultTitle({ defaultTitle: 'Shop' }, 'Brand')).toBe('Shop');
  });

  it('falls back to the brand name when the default title is empty', () => {
    expect(resolveDefaultTitle({ defaultTitle: '' }, 'Brand')).toBe('Brand');
  });

  it('falls back to the brand name when the default title is absent', () => {
    expect(resolveDefaultTitle({}, 'Brand')).toBe('Brand');
    expect(resolveDefaultTitle({ defaultTitle: null }, 'Brand')).toBe('Brand');
    expect(resolveDefaultTitle(null, 'Brand')).toBe('Brand');
    expect(resolveDefaultTitle(undefined, 'Brand')).toBe('Brand');
  });
});

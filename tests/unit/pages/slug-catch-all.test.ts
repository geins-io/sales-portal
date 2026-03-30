import { describe, it, expect } from 'vitest';
import {
  normalizeSlugToPath,
  stripLocaleMarketPrefix,
} from '../../../shared/utils/locale-market';

/**
 * Tests the key computation logic used by [...slug].vue to ensure
 * different routes produce different component keys.
 *
 * The catch-all page uses normalizedPath as the :key for the dynamic component.
 * This must produce unique keys for different category/subcategory navigations
 * so Vue properly re-renders the component (resetting pagination, filters, etc).
 */
describe('[...slug] page — component key uniqueness', () => {
  function computeKey(slug: string[]): string {
    return stripLocaleMarketPrefix(normalizeSlugToPath(slug));
  }

  it('produces different keys for parent vs subcategory', () => {
    const parentKey = computeKey(['se', 'sv', 'material']);
    const subKey = computeKey(['se', 'sv', 'material', 'epoxy']);

    expect(parentKey).toBe('/material');
    expect(subKey).toBe('/material/epoxy');
    expect(parentKey).not.toBe(subKey);
  });

  it('produces different keys for different categories of same type', () => {
    const key1 = computeKey(['se', 'sv', 'material']);
    const key2 = computeKey(['se', 'sv', 'clothing']);

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for category vs brand', () => {
    const categoryKey = computeKey(['se', 'sv', 'shoes']);
    const brandKey = computeKey(['se', 'sv', 'nike']);

    // Both resolve to different paths (even though type differs)
    expect(categoryKey).not.toBe(brandKey);
  });

  it('strips locale/market prefix consistently', () => {
    const withPrefix = computeKey(['se', 'sv', 'material']);
    const withoutPrefix = computeKey(['material']);

    expect(withPrefix).toBe('/material');
    expect(withoutPrefix).toBe('/material');
  });

  it('handles single-segment paths', () => {
    const key = computeKey(['se', 'sv', 'about']);
    expect(key).toBe('/about');
  });

  it('handles root path', () => {
    const key = computeKey([]);
    expect(key).toBe('/');
  });
});

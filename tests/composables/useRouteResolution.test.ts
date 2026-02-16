import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeSlugToPath,
  prefetchRouteResolution,
  _routeCache,
} from '../../app/composables/useRouteResolution';

// Mock $fetch globally
let mockFetchImpl: ReturnType<typeof vi.fn>;
vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));

describe('normalizeSlugToPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('array input', () => {
    it('should normalize single segment array', () => {
      expect(normalizeSlugToPath(['category'])).toBe('/category');
    });

    it('should normalize multi-segment array', () => {
      expect(normalizeSlugToPath(['category', 'product'])).toBe(
        '/category/product',
      );
    });

    it('should normalize empty array to root path', () => {
      expect(normalizeSlugToPath([])).toBe('/');
    });

    it('should filter out empty strings from array', () => {
      expect(normalizeSlugToPath(['category', '', 'product'])).toBe(
        '/category/product',
      );
    });

    it('should handle array with only empty strings', () => {
      expect(normalizeSlugToPath(['', '', ''])).toBe('/');
    });
  });

  describe('string input', () => {
    it('should normalize single string segment', () => {
      expect(normalizeSlugToPath('category')).toBe('/category');
    });

    it('should handle empty string', () => {
      expect(normalizeSlugToPath('')).toBe('/');
    });
  });

  describe('undefined input', () => {
    it('should return root path for undefined', () => {
      expect(normalizeSlugToPath(undefined)).toBe('/');
    });
  });

  describe('complex scenarios', () => {
    it('should handle deeply nested paths', () => {
      expect(normalizeSlugToPath(['a', 'b', 'c', 'd', 'e'])).toBe('/a/b/c/d/e');
    });

    it('should handle slugs with special characters', () => {
      expect(normalizeSlugToPath(['category-name', 'product-slug'])).toBe(
        '/category-name/product-slug',
      );
    });

    it('should handle numeric-like strings', () => {
      expect(normalizeSlugToPath(['123', '456'])).toBe('/123/456');
    });
  });

  describe('edge cases', () => {
    it('should handle single empty string segment', () => {
      expect(normalizeSlugToPath([''])).toBe('/');
    });

    it('should handle mixed valid and empty segments', () => {
      expect(normalizeSlugToPath(['', 'valid', '', 'path', ''])).toBe(
        '/valid/path',
      );
    });

    it('should handle segments with hyphens', () => {
      expect(normalizeSlugToPath(['my-category', 'my-product-name'])).toBe(
        '/my-category/my-product-name',
      );
    });

    it('should handle segments with underscores', () => {
      expect(normalizeSlugToPath(['my_category', 'my_product'])).toBe(
        '/my_category/my_product',
      );
    });

    it('should handle unicode segments', () => {
      expect(normalizeSlugToPath(['kategori', 'produkt'])).toBe(
        '/kategori/produkt',
      );
    });

    it('should preserve case sensitivity', () => {
      expect(normalizeSlugToPath(['Category', 'PRODUCT'])).toBe(
        '/Category/PRODUCT',
      );
    });
  });
});

describe('prefetchRouteResolution', () => {
  beforeEach(() => {
    mockFetchImpl = vi.fn();
    _routeCache.clear();
  });

  it('should fetch and cache the route resolution', async () => {
    const mockResolution = {
      type: 'category',
      categoryId: '1',
      categorySlug: 'shoes',
    };
    mockFetchImpl.mockResolvedValueOnce(mockResolution);

    await prefetchRouteResolution('/shoes');

    expect(mockFetchImpl).toHaveBeenCalledWith('/api/resolve-route', {
      query: { path: '/shoes' },
    });
    expect(_routeCache.get('/shoes')).toEqual(mockResolution);
  });

  it('should not refetch if path is already cached', async () => {
    const mockResolution = {
      type: 'page' as const,
      pageId: '1',
      pageSlug: 'about',
    };
    _routeCache.set('/about', mockResolution);

    await prefetchRouteResolution('/about');

    expect(mockFetchImpl).not.toHaveBeenCalled();
  });

  it('should silently handle fetch errors', async () => {
    mockFetchImpl.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    await prefetchRouteResolution('/broken');

    expect(_routeCache.has('/broken')).toBe(false);
  });
});

describe('_routeCache', () => {
  beforeEach(() => {
    _routeCache.clear();
  });

  it('should be a Map', () => {
    expect(_routeCache).toBeInstanceOf(Map);
  });
});

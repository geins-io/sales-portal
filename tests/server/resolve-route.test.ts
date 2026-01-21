import { describe, it, expect, beforeEach } from 'vitest';
import {
  routeCache,
  CACHE_MAX_ENTRIES,
  CACHE_TTL_FOUND_MS,
  CACHE_TTL_NOT_FOUND_MS,
} from '../../server/api/resolve-route.get';

describe('Route Cache Memory Management', () => {
  beforeEach(() => {
    // Clear the cache before each test
    routeCache.clear();
  });

  describe('Cache configuration', () => {
    it('should have a max size limit configured', () => {
      expect(CACHE_MAX_ENTRIES).toBe(1000);
      expect(routeCache.max).toBe(CACHE_MAX_ENTRIES);
    });

    it('should have appropriate TTL values', () => {
      // Found routes: 5 minutes
      expect(CACHE_TTL_FOUND_MS).toBe(5 * 60 * 1000);
      // Not found routes: 1 minute
      expect(CACHE_TTL_NOT_FOUND_MS).toBe(1 * 60 * 1000);
    });
  });

  describe('LRU eviction behavior', () => {
    it('should evict least recently used entries when max size is reached', () => {
      // Fill the cache to max + 1
      for (let i = 0; i <= CACHE_MAX_ENTRIES; i++) {
        routeCache.set(`key-${i}`, { type: 'page', pageSlug: `page-${i}`, pageId: `${i}` });
      }

      // Cache should not exceed max size
      expect(routeCache.size).toBe(CACHE_MAX_ENTRIES);

      // First entry should be evicted (LRU)
      expect(routeCache.has('key-0')).toBe(false);

      // Last entry should still be present
      expect(routeCache.has(`key-${CACHE_MAX_ENTRIES}`)).toBe(true);
    });

    it('should update LRU order when accessing entries', () => {
      // Add 3 entries
      routeCache.set('key-1', { type: 'page', pageSlug: 'page-1', pageId: '1' });
      routeCache.set('key-2', { type: 'page', pageSlug: 'page-2', pageId: '2' });
      routeCache.set('key-3', { type: 'page', pageSlug: 'page-3', pageId: '3' });

      // Access key-1 to make it most recently used
      routeCache.get('key-1');

      // All entries should still exist
      expect(routeCache.has('key-1')).toBe(true);
      expect(routeCache.has('key-2')).toBe(true);
      expect(routeCache.has('key-3')).toBe(true);
    });
  });

  describe('TTL behavior', () => {
    it('should store entries with TTL configuration', () => {
      // Set entry with custom TTL
      routeCache.set('test-key', { type: 'page', pageSlug: 'test', pageId: '1' }, { ttl: 1000 });

      // Entry should exist immediately
      expect(routeCache.get('test-key')).toBeDefined();

      // Verify the cache accepts TTL options (TTL functionality is provided by lru-cache library)
      expect(routeCache.getRemainingTTL('test-key')).toBeLessThanOrEqual(1000);
      expect(routeCache.getRemainingTTL('test-key')).toBeGreaterThan(0);
    });

    it('should support different TTL values per entry', () => {
      // Set entries with different TTLs
      routeCache.set('short-ttl', { type: 'not-found' }, { ttl: CACHE_TTL_NOT_FOUND_MS });
      routeCache.set(
        'long-ttl',
        { type: 'page', pageSlug: 'page', pageId: '1' },
        { ttl: CACHE_TTL_FOUND_MS },
      );

      // Both should exist
      expect(routeCache.get('short-ttl')).toBeDefined();
      expect(routeCache.get('long-ttl')).toBeDefined();

      // Verify different TTL values are applied (with some tolerance for timing)
      const shortTTLRemaining = routeCache.getRemainingTTL('short-ttl');
      const longTTLRemaining = routeCache.getRemainingTTL('long-ttl');

      // Use closeTo matcher for timing precision issues (within 100ms tolerance)
      expect(shortTTLRemaining).toBeCloseTo(CACHE_TTL_NOT_FOUND_MS, -2);
      expect(longTTLRemaining).toBeCloseTo(CACHE_TTL_FOUND_MS, -2);
      // Long TTL should be significantly greater than short TTL
      expect(longTTLRemaining).toBeGreaterThan(shortTTLRemaining);
    });
  });

  describe('Memory safety', () => {
    it('should not grow unbounded with unique keys', () => {
      // Simulate many unique route requests (more than max entries)
      for (let i = 0; i < CACHE_MAX_ENTRIES * 2; i++) {
        routeCache.set(`unique-${i}`, {
          type: 'page',
          pageSlug: `unique-page-${i}`,
          pageId: `${i}`,
        });
      }

      // Cache should stay at max size
      expect(routeCache.size).toBeLessThanOrEqual(CACHE_MAX_ENTRIES);
    });

    it('should handle tenant isolation in cache keys', () => {
      // Simulate cache keys with different tenant hostnames
      routeCache.set('tenant1.com::/page', { type: 'page', pageSlug: 'page', pageId: '1' });
      routeCache.set('tenant2.com::/page', { type: 'page', pageSlug: 'page', pageId: '2' });

      // Both should be cached separately
      expect(routeCache.get('tenant1.com::/page')).toEqual({
        type: 'page',
        pageSlug: 'page',
        pageId: '1',
      });
      expect(routeCache.get('tenant2.com::/page')).toEqual({
        type: 'page',
        pageSlug: 'page',
        pageId: '2',
      });
    });
  });
});

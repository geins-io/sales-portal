import { defineEventHandler, getQuery, setResponseHeader } from 'h3';
import { LRUCache } from 'lru-cache';
import type { RouteResolution } from '#shared/types';
import { withErrorHandling } from '../utils/errors';
import { resolveRoute } from '../services/routes';

// =============================================================================
// Cache Configuration
// =============================================================================

const CACHE_TTL_FOUND_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_TTL_NOT_FOUND_MS = 1 * 60 * 1000; // 1 minute
const CACHE_MAX_ENTRIES = 1000; // Maximum number of entries to prevent unbounded growth

// Module-scoped in-memory LRU cache with max size limit
// This prevents memory leaks by automatically evicting least recently used entries
export const routeCache = new LRUCache<string, RouteResolution>({
  max: CACHE_MAX_ENTRIES,
  // TTL is set per-item in setCachedResolution for different cache durations
  // based on whether the route was found or not
});

// Export cache config constants for testing
export { CACHE_MAX_ENTRIES, CACHE_TTL_FOUND_MS, CACHE_TTL_NOT_FOUND_MS };

// =============================================================================
// Path Normalization
// =============================================================================

/**
 * Safely decode a URI component, falling back to raw value on error.
 */
function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Normalize a path string into a consistent format and extract segments.
 * - Defaults to "/" if missing or invalid
 * - Ensures path starts with "/"
 * - Removes trailing slashes (except "/" stays "/")
 * - Decodes URI components safely
 * - Returns both normalized path and segments
 */
function normalizePath(rawPath: unknown): {
  normalizedPath: string;
  segments: string[];
} {
  // Validate input is a string, default to "/"
  let path = typeof rawPath === 'string' ? rawPath : '/';

  // Ensure path starts with "/"
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Remove trailing slashes (but keep "/" as "/")
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }

  // Split into segments, filter empty, and decode each safely
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => safeDecodeURIComponent(segment));

  // Reconstruct normalized path from decoded segments
  const normalizedPath = segments.length > 0 ? '/' + segments.join('/') : '/';

  return { normalizedPath, segments };
}

// =============================================================================
// Cache Key Helpers
// =============================================================================

/**
 * Build a tenant-aware cache key.
 * Format: "hostname::path" to ensure isolation between tenants.
 */
function buildCacheKey(hostname: string, normalizedPath: string): string {
  return `${hostname}::${normalizedPath}`;
}

// =============================================================================
// Cache Helpers
// =============================================================================

/**
 * Get a cached entry if it exists and is not expired.
 * LRU cache automatically handles TTL expiration.
 */
function getCachedResolution(key: string): RouteResolution | null {
  return routeCache.get(key) ?? null;
}

/**
 * Store a resolution in cache with appropriate TTL.
 * Uses shorter TTL for not-found responses.
 */
function setCachedResolution(key: string, data: RouteResolution): void {
  const ttl =
    data.type === 'not-found' ? CACHE_TTL_NOT_FOUND_MS : CACHE_TTL_FOUND_MS;
  routeCache.set(key, data, { ttl });
}

// =============================================================================
// HTTP Cache Header Helpers
// =============================================================================

/**
 * Set appropriate Cache-Control headers based on resolution type.
 */
function setCacheHeaders(
  event: Parameters<typeof setResponseHeader>[0],
  resolution: RouteResolution,
): void {
  if (resolution.type === 'not-found') {
    // Shorter cache for not-found responses
    setResponseHeader(
      event,
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300',
    );
  } else {
    // Longer cache for found responses
    setResponseHeader(
      event,
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );
  }
}

// =============================================================================
// Event Handler
// =============================================================================

export default defineEventHandler((event) =>
  withErrorHandling(
    async () => {
      const query = getQuery(event);
      const rawPath = query.path;

      // Get tenant hostname for cache isolation
      const hostname = event.context.tenant?.hostname ?? 'default';

      // Normalize the input path
      const { normalizedPath, segments } = normalizePath(rawPath);

      // Build tenant-aware cache key
      const cacheKey = buildCacheKey(hostname, normalizedPath);

      // Check cache first
      const cached = getCachedResolution(cacheKey);
      if (cached) {
        setCacheHeaders(event, cached);
        return cached;
      }

      // Resolve the route
      const resolution = await resolveRoute(segments, event);

      // Cache the result
      setCachedResolution(cacheKey, resolution);

      // Set HTTP cache headers
      setCacheHeaders(event, resolution);

      return resolution;
    },
    { operation: 'resolve-route' },
  ),
);

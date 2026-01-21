import { defineEventHandler, getQuery, setResponseHeader } from 'h3';
import type { RouteResolution } from '#shared/types';

interface CacheEntry {
  expiresAt: number;
  data: RouteResolution;
}

// =============================================================================
// Cache Configuration
// =============================================================================

const CACHE_TTL_FOUND_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_TTL_NOT_FOUND_MS = 1 * 60 * 1000; // 1 minute

// Module-scoped in-memory cache
const routeCache = new Map<string, CacheEntry>();

// =============================================================================
// Lookup Stubs (TODO: Replace with real API calls)
// =============================================================================

/**
 * Lookup a category by its slug.
 * TODO: Replace with actual API call to backend/database.
 */
async function lookupCategoryBySlug(
  _slug: string,
): Promise<{ id: string; canonical?: string } | null> {
  // TODO: Implement real lookup - this stub returns mock data for development
  // When implementing, this should query the backend API or database
  // and return null if no category is found with the given slug
  return { id: '1', canonical: 'https://example.com/category-slug' };
}

/**
 * Lookup a page by its slug.
 * TODO: Replace with actual API call to backend/database.
 */
async function lookupPageBySlug(
  _slug: string,
): Promise<{ id: string; canonical?: string } | null> {
  // TODO: Implement real lookup - this stub returns mock data for development
  // When implementing, this should query the backend API or database
  // and return null if no page is found with the given slug
  return { id: '1', canonical: 'https://example.com/page-slug' };
}

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
// Route Resolution Logic
// =============================================================================

/**
 * Resolve a path to its route type and associated data.
 */
const tempSegmentPath = [
  { key: 'p', resolution: 'product' },
  { key: 'l', resolution: 'category' },
  { key: 'c', resolution: 'page' },
];

async function resolveRoute(segments: string[]): Promise<RouteResolution> {
  // Handle empty segments (root path)
  if (segments.length === 0) {
    return { type: 'not-found' };
  }

  // todo : TEMP:check if we cant get a resolution from the tempSegmentPath
  const resolution = tempSegmentPath.find((path) => path.key === segments[0]);

  // Two segments: assume product (category/product pattern)
  if (
    segments.join('/') === 'category-slug/product-slug' ||
    resolution?.resolution === 'product'
  ) {
    const [categorySlug, productSlug] = segments;
    return {
      type: 'product',
      productId: '1', // TODO: Replace with actual product lookup
      categorySlug,
      productSlug,
    };
  }

  if (
    segments.join('/') === 'category-slug/subcategory-slug/product-slug' ||
    resolution?.resolution === 'product'
  ) {
    const [_categorySlug, subcategorySlug, productSlug] = segments;
    return {
      type: 'product',
      categorySlug: subcategorySlug,
      productSlug,
      productId: '1',
      canonical:
        'https://example.com/category-slug/subcategory-slug/product-slug',
    };
  }

  // First segment is guaranteed to exist (early return for empty segments above)
  const slug = segments[0]!;

  // One segment: try category first, then page
  if (
    segments.join('/') === 'category-slug' ||
    segments.join('/') === 'category-slug/subcategory-slug' ||
    resolution?.resolution === 'category'
  ) {
    // Try category lookup
    const categoryResult = await lookupCategoryBySlug(slug);
    if (categoryResult) {
      return {
        type: 'category',
        categorySlug: slug,
        categoryId: categoryResult.id,
        canonical: categoryResult.canonical,
      };
    }
  }

  // Try page lookup
  const pageResult = await lookupPageBySlug(slug);
  if (pageResult || resolution?.resolution === 'page') {
    return {
      type: 'page',
      pageSlug: slug,
      pageId: pageResult?.id ?? '1',
      canonical: pageResult?.canonical ?? 'https://example.com/page-slug',
    };
  } else {
    // Neither found
    return { type: 'not-found' };
  }
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
 */
function getCachedResolution(key: string): RouteResolution | null {
  const entry = routeCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  // Clean up expired entry
  if (entry) {
    routeCache.delete(key);
  }
  return null;
}

/**
 * Store a resolution in cache with appropriate TTL.
 */
function setCachedResolution(key: string, data: RouteResolution): void {
  const ttl =
    data.type === 'not-found' ? CACHE_TTL_NOT_FOUND_MS : CACHE_TTL_FOUND_MS;
  routeCache.set(key, {
    expiresAt: Date.now() + ttl,
    data,
  });
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

export default defineEventHandler(async (event) => {
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
  const resolution = await resolveRoute(segments);

  // Cache the result
  setCachedResolution(cacheKey, resolution);

  // Set HTTP cache headers
  setCacheHeaders(event, resolution);

  return resolution;
});

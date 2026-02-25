import type { H3Event } from 'h3';
import type { RouteResolution } from '#shared/types';
import { getCategories } from './categories';
import { getBrands } from './brands';
import { getProduct } from './products';
import { getPage } from './cms';

// Cached category map — rebuilt every 5 minutes per tenant
const categoryMaps = new Map<
  string,
  { map: Map<string, string>; expires: number }
>();
const CATEGORY_CACHE_TTL = 5 * 60 * 1000;

async function getCategoryMap(event: H3Event): Promise<Map<string, string>> {
  const hostname = event.context.tenant?.hostname ?? 'default';
  const cached = categoryMaps.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.map;

  try {
    const categories = (await getCategories(event)) as Array<{
      alias?: string;
      categoryId?: number | string;
    }>;
    const map = new Map<string, string>();
    if (Array.isArray(categories)) {
      for (const cat of categories) {
        if (cat.alias) map.set(cat.alias, String(cat.categoryId));
      }
    }
    categoryMaps.set(hostname, {
      map,
      expires: Date.now() + CATEGORY_CACHE_TTL,
    });

    // Bound cache size
    if (categoryMaps.size > 100) {
      const oldest = categoryMaps.keys().next().value;
      if (oldest) categoryMaps.delete(oldest);
    }

    return map;
  } catch {
    return new Map();
  }
}

// Cached brand map — rebuilt every 5 minutes per tenant
const brandMaps = new Map<
  string,
  { map: Map<string, string>; expires: number }
>();

async function getBrandMap(event: H3Event): Promise<Map<string, string>> {
  const hostname = event.context.tenant?.hostname ?? 'default';
  const cached = brandMaps.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.map;

  try {
    const brands = (await getBrands(event)) as Array<{
      alias?: string;
      brandId?: number | string;
    }>;
    const map = new Map<string, string>();
    if (Array.isArray(brands)) {
      for (const brand of brands) {
        if (brand.alias) map.set(brand.alias, String(brand.brandId));
      }
    }
    brandMaps.set(hostname, {
      map,
      expires: Date.now() + CATEGORY_CACHE_TTL,
    });

    if (brandMaps.size > 100) {
      const oldest = brandMaps.keys().next().value;
      if (oldest) brandMaps.delete(oldest);
    }

    return map;
  } catch {
    return new Map();
  }
}

/**
 * Strip market/locale/type prefix segments from a Geins canonical URL.
 *
 * Geins generates canonical URLs like `/se/sv/p/category/product-alias` where:
 * - `se` = 2-letter market code
 * - `sv` = 2-letter locale code
 * - `p` = single-letter type indicator (p=product, c/l=category, b=brand)
 *
 * Returns the cleaned segments and any detected type hint.
 */
function stripUrlPrefixes(segments: string[]): {
  cleaned: string[];
  typeHint: 'product' | 'category' | 'brand' | null;
} {
  let i = 0;

  // Skip leading 2-letter segments (market/locale codes like 'se', 'sv', 'en', 'de')
  while (i < segments.length && /^[a-z]{2}$/.test(segments[i]!)) {
    i++;
  }

  // Check for single-letter type indicator
  let typeHint: 'product' | 'category' | 'brand' | null = null;
  if (i < segments.length) {
    const seg = segments[i]!;
    if (seg === 'p') {
      typeHint = 'product';
      i++;
    } else if (seg === 'c' || seg === 'l') {
      typeHint = 'category';
      i++;
    } else if (seg === 'b') {
      typeHint = 'brand';
      i++;
    }
  }

  return { cleaned: segments.slice(i), typeHint };
}

/**
 * Resolve a URL path to a route type.
 * Priority: category → brand → product → CMS page → 404
 */
export async function resolveRoute(
  segments: string[],
  event: H3Event,
): Promise<RouteResolution> {
  if (segments.length === 0) {
    return { type: 'not-found' };
  }

  // Strip market/locale/type prefixes from Geins canonical URLs
  const { cleaned, typeHint } = stripUrlPrefixes(segments);

  // If type hint indicates product, resolve product directly from last segment
  if (typeHint === 'product' && cleaned.length > 0) {
    const productSlug = cleaned[cleaned.length - 1]!;
    try {
      const product = (await getProduct({ alias: productSlug }, event)) as {
        alias?: string;
        productId?: number | string;
        canonicalUrl?: string;
      };
      if (product?.alias || product?.productId) {
        return {
          type: 'product',
          productId: String(product.productId ?? '1'),
          productSlug,
          categorySlug: cleaned.length >= 2 ? cleaned[0] : undefined,
          canonical: product.canonicalUrl,
        };
      }
    } catch {
      // Product not found, fall through
    }
  }

  // If type hint indicates category/brand, narrow the search
  if (typeHint === 'category' && cleaned.length > 0) {
    const categoryMap = await getCategoryMap(event);
    const slug = cleaned[cleaned.length - 1]!;
    const catId = categoryMap.get(slug);
    if (catId) {
      return { type: 'category', categoryId: catId, categorySlug: slug };
    }
  }

  if (typeHint === 'brand' && cleaned.length > 0) {
    const brandMap = await getBrandMap(event);
    const slug = cleaned[cleaned.length - 1]!;
    const brandId = brandMap.get(slug);
    if (brandId) {
      return { type: 'brand', brandId, brandSlug: slug };
    }
  }

  // If we stripped prefixes but couldn't resolve with the hint, return not-found
  // (the URL had a type indicator we recognized but the entity doesn't exist)
  if (typeHint && cleaned.length > 0) {
    return { type: 'not-found' };
  }

  // No prefix stripping needed — use the original segments for standard resolution
  const effectiveSegments = cleaned.length > 0 ? cleaned : segments;

  const categoryMap = await getCategoryMap(event);

  // Check if first segment is a category
  const firstSegment = effectiveSegments[0]!;
  const categoryId = categoryMap.get(firstSegment);

  if (categoryId && effectiveSegments.length === 1) {
    // Single-segment category
    return {
      type: 'category',
      categoryId,
      categorySlug: firstSegment,
    };
  }

  if (categoryId && effectiveSegments.length >= 2) {
    // Check if second segment is also a category (subcategory)
    const secondSegment = effectiveSegments[1]!;
    const subCategoryId = categoryMap.get(secondSegment);

    if (subCategoryId && effectiveSegments.length === 2) {
      return {
        type: 'category',
        categoryId: subCategoryId,
        categorySlug: secondSegment,
      };
    }

    // Last segment might be a product under this category
    const productSlug = effectiveSegments[effectiveSegments.length - 1]!;
    try {
      const product = (await getProduct({ alias: productSlug }, event)) as {
        alias?: string;
        productId?: number | string;
        canonicalUrl?: string;
      };
      if (product?.alias || product?.productId) {
        return {
          type: 'product',
          productId: String(product.productId ?? '1'),
          productSlug,
          categorySlug:
            effectiveSegments.length === 3
              ? effectiveSegments[1]
              : firstSegment,
          canonical: product.canonicalUrl,
        };
      }
    } catch {
      // Product not found, continue
    }
  }

  // Check if first segment is a brand
  const brandMap = await getBrandMap(event);
  const brandId = brandMap.get(firstSegment);

  if (brandId && effectiveSegments.length === 1) {
    return {
      type: 'brand',
      brandId,
      brandSlug: firstSegment,
    };
  }

  // Single segment: try product
  if (effectiveSegments.length === 1) {
    try {
      const product = (await getProduct({ alias: firstSegment }, event)) as {
        alias?: string;
        productId?: number | string;
        canonicalUrl?: string;
      };
      if (product?.alias || product?.productId) {
        return {
          type: 'product',
          productId: String(product.productId ?? '1'),
          productSlug: firstSegment,
          canonical: product.canonicalUrl,
        };
      }
    } catch {
      // Not a product
    }
  }

  // Try CMS page
  const pageSlug = effectiveSegments[effectiveSegments.length - 1]!;
  try {
    const page = (await getPage({ alias: pageSlug }, event)) as {
      id?: string | number;
      containers?: unknown[];
    };
    if (page?.containers?.length || page?.id) {
      return {
        type: 'page',
        pageId: String(page.id ?? '1'),
        pageSlug,
      };
    }
  } catch {
    // Not a page
  }

  return { type: 'not-found' };
}

/**
 * Clear the category cache. Exported for testing purposes only.
 */
export function clearCategoryCache(): void {
  categoryMaps.clear();
  brandMaps.clear();
}

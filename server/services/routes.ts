import type { H3Event } from 'h3';
import type { RouteResolution } from '#shared/types';
import { getCategories } from './categories';
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

/**
 * Resolve a URL path to a route type.
 * Priority: category → product → CMS page → 404
 */
export async function resolveRoute(
  segments: string[],
  event: H3Event,
): Promise<RouteResolution> {
  if (segments.length === 0) {
    return { type: 'not-found' };
  }

  const categoryMap = await getCategoryMap(event);

  // Check if first segment is a category
  const firstSegment = segments[0]!;
  const categoryId = categoryMap.get(firstSegment);

  if (categoryId && segments.length === 1) {
    // Single-segment category
    return {
      type: 'category',
      categoryId,
      categorySlug: firstSegment,
    };
  }

  if (categoryId && segments.length >= 2) {
    // Check if second segment is also a category (subcategory)
    const secondSegment = segments[1]!;
    const subCategoryId = categoryMap.get(secondSegment);

    if (subCategoryId && segments.length === 2) {
      return {
        type: 'category',
        categoryId: subCategoryId,
        categorySlug: secondSegment,
      };
    }

    // Last segment might be a product under this category
    const productSlug = segments[segments.length - 1]!;
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
          categorySlug: segments.length === 3 ? segments[1] : firstSegment,
          canonical: product.canonicalUrl,
        };
      }
    } catch {
      // Product not found, continue
    }
  }

  // Single segment: try product
  if (segments.length === 1) {
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
  const pageSlug = segments[segments.length - 1]!;
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
}

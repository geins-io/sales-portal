import type { H3Event } from 'h3';
import type { CategoryAncestor } from '#shared/utils/breadcrumb-trail';
import { ancestorsFromCategories } from '#shared/utils/breadcrumb-trail';
import { getCategoryTree, getChannelContext } from '../services/categories';
import { createTenantLogger } from './logger';

/**
 * The ancestors of a category, root first, for the list page's breadcrumb.
 *
 * Deriving the chain from `canonicalUrl` instead caps it at `MaxCategoryDepth`
 * segments (per-merchant, default 4): on elproman that truncated 598 of 1564
 * categories.
 *
 * The language fallback lives here, not in the fetcher. Per-language
 * publication is per category — sonoralab's de-DE tree holds 7 of 12 — so a
 * partial tree looks healthy to the fetcher, and the sitemap shares that
 * fetcher: falling back there made tenant-a advertise 80 Swedish-alias URLs
 * under its fi and nb prefixes.
 *
 * Never throws. A breadcrumb must not turn a rendering page into an error.
 */
export async function resolveEntityAncestors(
  categoryId: number | null | undefined,
  event: H3Event,
): Promise<CategoryAncestor[]> {
  if (typeof categoryId !== 'number') return [];

  try {
    const { vars, defaultLanguageId } = await getChannelContext(event);

    // A language with no tree throws; same fall-through as one that simply
    // lacks this category.
    const tree = await getCategoryTree(event, vars).catch(() => null);
    const chain = tree ? ancestorsFromCategories(tree, categoryId) : [];
    if (chain.length > 0) return chain;

    if (!defaultLanguageId || defaultLanguageId === vars.languageId) return [];

    const fallback = await getCategoryTree(event, {
      ...vars,
      languageId: defaultLanguageId,
    });
    return ancestorsFromCategories(fallback, categoryId);
  } catch (error) {
    createTenantLogger(event.context.tenant?.hostname ?? '').warn(
      'Category tree unavailable; rendering without ancestors',
      { error },
    );
    return [];
  }
}

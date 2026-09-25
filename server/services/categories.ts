import type { H3Event } from 'h3';
import type { CategoryNode } from '#shared/utils/breadcrumb-trail';
import { storefrontCacheKey, tenantConfigKey } from '../utils/tenant';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

/** Channel context for one GraphQL call, as `getChannelVariables` builds it. */
export interface ChannelVariables {
  channelId: string;
  languageId: string;
  marketId: string;
}

/**
 * Cache key for one tenant's category tree.
 *
 * Tenant AND language AND market, all three load-bearing: the tree carries
 * display names, and `canonicalUrl` carries the market.
 *
 * No `:` or `/`. unstorage reads both as path separators, so a key containing
 * one becomes nested directories instead of a file — entries stay distinct, but
 * they are far harder to find and delete when a stale one has to go, which is a
 * thing that happens (see the fetcher below). Flat keys mean one file per entry.
 *
 * Set explicitly for the usual reason too: the default key is a hash of the
 * arguments, and an `H3Event` does not serialise to anything meaningful.
 */
export function categoryTreeCacheKey(
  tenantKey: string,
  vars: ChannelVariables,
): string {
  return [tenantKey, 'categories', vars.languageId, vars.marketId]
    .join('_')
    .replace(/[:/]/g, '_');
}

export function resolveTenantCacheKey(event: H3Event): string {
  return tenantConfigKey(storefrontCacheKey(event));
}

/**
 * The tenant's whole category tree for one language and market, flat.
 *
 * Cached 60 s with SWR: PIM sends no change signal, and fetching per render was
 * measured at 0.21–0.28 s on the critical leg. Accepted staleness is parent
 * names and links; the category itself stays live, and links keep working
 * because the route reads only the last segment.
 *
 * TRAP: with `swr: true` an entry whose refresh keeps THROWING is served
 * forever. Nitro returns a stale entry as soon as it has a value and swallows
 * the refresh error, and it only sets a storage TTL when `maxAge && !swr`, so a
 * `staleMaxAge` would never apply and nothing expires the item. That is
 * tolerable here — a stale tree is still a valid tree, and a language with no
 * tree throws so `resolveEntityAncestors` falls back — but it means a bad entry
 * has to be deleted, not waited out. In dev the store is `.nuxt/cache` on disk
 * and survives every restart; with Redis it will survive deploys. Clear it
 * before measuring anything about this cache, or you are reading a previous
 * build's entries. (Measured: a tree written while an earlier revision still
 * had a fetch-level fallback kept being served for hours while every sibling
 * key refreshed normally.)
 */
const fetchCategoryTree = defineCachedFunction(
  async (
    _tenantKey: string,
    vars: ChannelVariables,
    event: H3Event,
  ): Promise<CategoryNode[]> => {
    const sdk = await getTenantSDK(event);

    const result = await wrapServiceCall(
      () =>
        sdk.core.graphql.query({
          queryAsString: loadQuery('categories/category-tree.graphql'),
          variables: { ...vars },
        }),
      'categories',
    ).then(unwrapGraphQL);

    // No language fallback here: the sitemap shares this fetcher, and retrying
    // into the default language made one merchant's sitemap advertise 80
    // Swedish-alias URLs under its fi and nb prefixes. The breadcrumb falls
    // back in `resolveEntityAncestors` instead.
    //
    // Thrown, not returned: Nitro caches a returned value, so one empty
    // response would erase every breadcrumb on the tenant for the whole
    // window — cluster-wide once Redis is attached.
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('Category tree unavailable');
    }

    return result as CategoryNode[];
  },
  {
    name: 'category-tree',
    base: 'cache',
    getKey: (tenantKey: string, vars: ChannelVariables) =>
      categoryTreeCacheKey(tenantKey, vars),
    swr: true,
    maxAge: 60,
  },
);

/**
 * The request's language and market, or an explicit channel context — the
 * sitemap iterates every market × locale and cannot use the request's.
 */
export async function getCategoryTree(
  event: H3Event,
  vars?: ChannelVariables,
): Promise<CategoryNode[]> {
  const sdk = await getTenantSDK(event);
  const channelVars = vars ?? getRequestChannelVariables(sdk, event);
  return fetchCategoryTree(resolveTenantCacheKey(event), channelVars, event);
}

/** The request's channel context plus the tenant's default language. */
export async function getChannelContext(event: H3Event): Promise<{
  vars: ChannelVariables;
  defaultLanguageId: string | undefined;
}> {
  const sdk = await getTenantSDK(event);
  return {
    vars: getRequestChannelVariables(sdk, event),
    defaultLanguageId: sdk.core.geinsSettings.locale,
  };
}

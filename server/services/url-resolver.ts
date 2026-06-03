import type { H3Event } from 'h3';
import { alternateEntityPath } from '#shared/utils/route-helpers';
import { getProduct } from './products';
import { getCategoryPage, getBrandPage } from './product-lists';
import { getTenantSDK, getRequestChannelVariables } from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';

/**
 * Inbound URL resolver: the 404-MISS SAFETY NET.
 *
 * This is NOT the per-navigation route resolver that ADR-015 removed. That one
 * (`/api/resolve-route` + `useRouteResolution`) ran on EVERY navigation to
 * classify URLs and was deleted on purpose. This resolver runs ONLY on the 404
 * miss path (catch-all, after the CMS page lookup fails) to recover prefix-less
 * entity URLs from old bookmarks, pasted Geins canonicals, search engines, and
 * renamed slugs. Typed-route navigation never touches it.
 *
 * Resolution strategy:
 *  1. Resolve the last-segment alias against product, category, and brand in
 *     parallel (Promise.allSettled, null- and throw-tolerant). Pick the first
 *     non-null match in deterministic priority PRODUCT -> CATEGORY -> BRAND.
 *     Rationale: a single alias rarely belongs to more than one entity type;
 *     product aliases are the most specific (full slug) and a stale product
 *     share is the most common inbound miss, so product wins a rare collision.
 *  2. If nothing matches by alias, ask Geins `urlHistory(url)` (renamed slugs)
 *     with the FULL inbound path and return a redirect to the new url.
 *  3. Otherwise null.
 *
 * Return shape: the service returns canonicalAppPath (a full app path WITH
 * /{market}/{locale}/ and the correct /p/ /c/ /b/ prefix) built by
 * alternateEntityPath so callers do not re-normalize. The raw Geins canonical
 * is never surfaced to callers.
 */

export type ResolvedEntityUrl =
  | { type: 'product' | 'category' | 'brand'; canonicalAppPath: string }
  | { redirect: string }
  | null;

type EntityType = 'product' | 'category' | 'brand';

interface UrlHistoryResult {
  urlHistory?: { oldUrl?: string | null; newUrl?: string | null } | null;
}

/**
 * Maps a settled resolver result to a normalized app path, or null when the
 * resolver threw, returned null, returned an entity without a usable
 * canonicalUrl, or when alternateEntityPath cannot build a valid app path
 * (malformed canonical). Treats all of these as no-match so downstream callers
 * never receive a half-built path.
 */
function appPathFrom(
  settled: PromiseSettledResult<unknown>,
  type: EntityType,
): string | null {
  if (settled.status !== 'fulfilled' || settled.value == null) return null;
  const value = settled.value as { canonicalUrl?: unknown };
  const rawCanonical = value.canonicalUrl;
  if (typeof rawCanonical !== 'string' || rawCanonical.length === 0) {
    return null;
  }
  // alternateEntityPath preserves market/locale, strips any Geins entity prefix
  // (/l/, /p/, etc.), and injects the correct app prefix (/c/, /p/, /b/).
  // Returns null for any malformed or unroutable input -> treat as no-match.
  return alternateEntityPath(rawCanonical, type);
}

export async function resolveEntityUrl(
  args: { path: string; alias: string; userToken?: string },
  event: H3Event,
): Promise<ResolvedEntityUrl> {
  const settled = await Promise.allSettled([
    getProduct({ alias: args.alias, userToken: args.userToken }, event),
    getCategoryPage({ alias: args.alias, userToken: args.userToken }, event),
    getBrandPage({ alias: args.alias, userToken: args.userToken }, event),
  ]);

  const order: EntityType[] = ['product', 'category', 'brand'];
  for (let i = 0; i < order.length; i++) {
    const canonicalAppPath = appPathFrom(settled[i]!, order[i]!);
    if (canonicalAppPath) {
      return { type: order[i]!, canonicalAppPath };
    }
  }

  // No entity matched the alias: try Geins urlHistory for a renamed slug.
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('url-history/url-history.graphql'),
        variables: {
          url: args.path,
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: args.userToken,
      }),
    'url-resolver',
  );
  const unwrapped = unwrapGraphQL(result) as
    | UrlHistoryResult['urlHistory']
    | UrlHistoryResult
    | null;

  // unwrapGraphQL collapses the single-key `{ urlHistory: {...} }` wrapper to
  // the inner value, but guard for both shapes in case it does not.
  const history =
    unwrapped && 'urlHistory' in unwrapped
      ? (unwrapped as UrlHistoryResult).urlHistory
      : (unwrapped as UrlHistoryResult['urlHistory']);

  const newUrl = history?.newUrl;
  if (typeof newUrl === 'string' && newUrl.length > 0) {
    return { redirect: newUrl };
  }

  return null;
}

import type { H3Event } from 'h3';
import { alternateEntityPath } from '#shared/utils/route-helpers';
import {
  parseLocaleMarketPrefix,
  stripLocaleMarketPrefix,
} from '#shared/utils/locale-market';
import { isSafeInternalPath } from '#shared/utils/redirect';
import { cmsTagForSlug } from '#shared/constants/cms';
import { getProduct } from './products';
import { getCategoryPage, getBrandPage } from './product-lists';
import { getPageLinkByTag } from './cms';
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
 *  0. Semantic CMS-slug recovery (TERMS, CONTACT, APPLY family): if the alias
 *     is a known legacy English slug, look up the merchant's localized CMS page
 *     by tag and redirect to it. Runs BEFORE the entity lookups because semantic
 *     slugs are unambiguous and cheap (one GraphQL call vs three in parallel).
 *     Note: when the CMS page DOES exist at the requested slug (e.g. alias
 *     "terms" resolves to a live "/terms" CMS page), the catch-all's
 *     /api/cms/page/{slug} fetch hits BEFORE recovery is called, so this branch
 *     is never reached for existing pages. No extra existence check is needed.
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
  requested?: { market: string; locale: string },
): string | null {
  if (settled.status !== 'fulfilled' || settled.value == null) return null;
  const value = settled.value as { canonicalUrl?: unknown };
  const rawCanonical = value.canonicalUrl;
  if (typeof rawCanonical !== 'string' || rawCanonical.length === 0) {
    return null;
  }
  // alternateEntityPath strips any Geins entity prefix (/l/, /p/, etc.) and
  // injects the correct app prefix (/c/, /p/, /b/). For recovery we pass the
  // REQUESTED market/locale so a default-locale canonicalUrl does not bounce
  // the user out of the locale they asked for; the slug tail still comes from
  // the canonical. Returns null for malformed/unroutable input -> no-match.
  const appPath = alternateEntityPath(rawCanonical, type, requested);
  // Safe by construction (leading slash, no //, fixed app prefix), but assert
  // the open-redirect invariant here too so the resolver never returns a path
  // that could 301 off-origin.
  if (appPath && !isSafeInternalPath(appPath)) return null;
  return appPath;
}

export async function resolveEntityUrl(
  args: { path: string; alias: string; userToken?: string },
  event: H3Event,
): Promise<ResolvedEntityUrl> {
  // ---------------------------------------------------------------------------
  // Step 0: semantic CMS-slug recovery.
  //
  // Check whether the alias is one of the reserved legacy English slugs
  // (terms, contact, contact-form, apply, apply-for-account). If it is, look
  // up the merchant's localized CMS page by tag. A CMS error or a null result
  // falls through to the entity/urlHistory branches below; it never breaks them.
  //
  // Loop-safety: getPageLinkByTag may return the SAME path the user requested
  // (e.g. a tenant whose terms page alias is literally "terms"). Strip the
  // locale/market prefix from both paths and compare the clean forms. Equal
  // clean paths mean we would redirect the browser to itself, so treat that as
  // a fall-through (no redirect). recoverEntityUrl enforces the same guard on
  // the composable side, but catching it here keeps the service self-contained.
  //
  // Open-redirect guard: getPageLinkByTag already validates the link via
  // isSafeInternalPath internally, but we re-check here as a defence-in-depth
  // boundary so the resolver never emits an off-origin redirect regardless of
  // what the CMS service returns.
  // ---------------------------------------------------------------------------
  const tag = cmsTagForSlug(args.alias);
  if (tag !== null) {
    try {
      const link = await getPageLinkByTag({ tag }, event);
      if (link !== null) {
        const incomingClean = stripLocaleMarketPrefix(args.path);
        const linkClean = stripLocaleMarketPrefix(link);
        if (incomingClean !== linkClean && isSafeInternalPath(link)) {
          return { redirect: link };
        }
        // Clean paths are equal (loop) or link is unsafe: fall through.
      }
      // link is null: no tagged page found, fall through to entity lookups.
    } catch {
      // CMS error: treat as a miss and let entity/urlHistory recovery proceed.
    }
  }

  const settled = await Promise.allSettled([
    getProduct({ alias: args.alias, userToken: args.userToken }, event),
    getCategoryPage({ alias: args.alias, userToken: args.userToken }, event),
    getBrandPage({ alias: args.alias, userToken: args.userToken }, event),
  ]);

  // Recover in the locale/market the inbound path asked for. A prefix-less path
  // (tenant-a dev) has no prefix, so requested is null and the canonical's own
  // market/locale is kept (unchanged behaviour).
  const requested = parseLocaleMarketPrefix(args.path) ?? undefined;

  const order: EntityType[] = ['product', 'category', 'brand'];
  for (let i = 0; i < order.length; i++) {
    const canonicalAppPath = appPathFrom(settled[i]!, order[i]!, requested);
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
  // The urlHistory redirect (renamed slug) returns Geins's newUrl verbatim and
  // is a separate concern from the requested-locale recovery above; it is not
  // re-localized here.
  // Open-redirect guard at the boundary: Geins urlHistory.newUrl is untrusted
  // input. localePath() passes http(s):// and protocol-relative // through
  // unchanged, so an absolute or off-origin newUrl would 301 the browser off
  // this origin. Only a safe in-app path may surface as a redirect; anything
  // else is treated as NO-MATCH (null -> 404) rather than an unsafe redirect.
  if (isSafeInternalPath(newUrl)) {
    return { redirect: newUrl };
  }

  return null;
}

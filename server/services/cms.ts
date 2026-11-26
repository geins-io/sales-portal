import type {
  ContentPageType,
  ContentAreaType,
  MenuType,
  GeinsCustomerType,
  GeinsPageWidgetPageTypeType,
} from '@geins/types';
import type { H3Event } from 'h3';
import { LRUCache } from 'lru-cache';
import {
  getTenantSDK,
  getChannelVariables,
  getRequestChannelVariables,
  buildRequestContext,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import {
  ANONYMOUS_IDENTITY,
  getRequestIdentity,
} from '../utils/request-identity';
import { hasPageTag } from '#shared/utils/cms-tags';
import { mergeContainersByVisibility } from '#shared/utils/cms-visibility';
import { isSafeInternalPath } from '#shared/utils/redirect';
import { parseLocaleMarketPrefix } from '#shared/utils/locale-market';
import { getPreviewToken } from '../utils/cookies';
import { toCmsPageAlias } from '../utils/cms-page-alias';
import type { CmsAreaContext, CmsContentArea } from '#shared/types/cms';
import { CMS_AREA_MAX_CATEGORY_IDS } from '../schemas/api-input';
import { logger } from '../utils/logger';

// =============================================================================
// Cache Configuration
// =============================================================================

const CACHE_TTL_MS = 60 * 1000; // 1 minute — short TTL for multi-locale correctness

/**
 * The last menu and area copies that answered, kept past the cache TTL: a read
 * that fails serves these instead of a page without its menu. Never filled or
 * read for preview.
 *
 * Anonymous copies, which every public render needs, have their own maps, so
 * signed-in sessions (a new identity on every renewal) cannot evict them. Each
 * map is bounded by the JSON size of its entries, not their count: measured on
 * the team tenant, a main menu is 2.4 kB as JSON and 3.1 kB on the heap, a
 * front-page area 0.5 kB and 0.8 kB, but a customer's can be far larger. At
 * the 1.6 heap-to-JSON ratio of the area, the 10 MB below is about 16 MB.
 */
function lastGoodCopies<V extends object>(maxSize: number) {
  return new LRUCache<string, V>({
    maxSize,
    sizeCalculation: (value) => JSON.stringify(value).length,
  });
}
const MB = 1024 * 1024;
const lastGoodMenu = {
  anonymous: lastGoodCopies<MenuType>(3 * MB),
  signedIn: lastGoodCopies<MenuType>(1 * MB),
};
const lastGoodArea = {
  anonymous: lastGoodCopies<CmsContentArea>(4 * MB),
  signedIn: lastGoodCopies<CmsContentArea>(2 * MB),
};

function lastGoodFor<V>(
  copies: { anonymous: V; signedIn: V },
  event: H3Event,
): V {
  return getRequestIdentity(event) === ANONYMOUS_IDENTITY
    ? copies.anonymous
    : copies.signedIn;
}

const menuCache = new LRUCache<string, MenuType>({
  max: 200,
});

const areaCache = new LRUCache<string, CmsContentArea>({
  max: 500,
});

// Cache for resolved page links keyed by tenant+locale+market+tag.
// Null results use an empty-string sentinel (PAGE_LINK_NULL_SENTINEL) because
// LRUCache<string, string> disallows null values. cache.has() distinguishes a
// cached miss from an uncached entry; get() returning "" means no page exists.
const PAGE_LINK_NULL_SENTINEL = '';
const pageLinkCache = new LRUCache<string, string>({ max: 300 });

const cmsPagesCache = new LRUCache<string, ListedCmsPage[]>({ max: 300 });

/**
 * Cache key prefix without an identity segment: tenant hostname, locale, market.
 * Uses getRequestLocale/getRequestMarket which handle both page routes
 * (resolvedLocaleMarket) and API routes (cookie fallback with BCP-47 expansion).
 *
 * Only for a read that sends no user token, so its response cannot vary by
 * caller — today that is getPageLinkByTag, whose query goes out without a
 * RequestContext. Giving such a read a context means moving it to
 * buildCachePrefix in the same change.
 */
function buildAnonymousCachePrefix(event: H3Event): string {
  const hostname = event.context?.tenant?.hostname ?? 'default';
  const locale = getRequestLocale(event) ?? 'default';
  const market = getRequestMarket(event) ?? 'default';
  return `${hostname}::${locale}::${market}`;
}

/**
 * Cache key prefix for a read that sends the caller's token.
 *
 * The Merchant API filters CMS collections by the account behind that token, so
 * an entry populated under one token must never be served under another — in
 * either direction: one account's content disclosed, or an account served the
 * empty result a non-matching caller got. The identity segment lives here so
 * every cache built on the prefix inherits it.
 */
function buildCachePrefix(event: H3Event): string {
  return `${buildAnonymousCachePrefix(event)}::${getRequestIdentity(event)}`;
}

/**
 * The request context for a widget read (menu, page, area). In a CMS preview
 * it carries the preview token in place of the session token: the token alone
 * makes Geins answer an area with its draft, spoofed date included. Never add
 * `preview: true` with it — Geins then answers EVERY area with the draft. Only
 * page reads send the flag (getPage, readPreviewPageDraft), because a page
 * draft comes with nothing less.
 */
function cmsRequestContext(event: H3Event) {
  const previewToken = getPreviewToken(event);
  const ctx = buildRequestContext(event);
  return previewToken ? { ...ctx, userToken: previewToken } : ctx;
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * The menu levels to fetch: the catalogue opens a column for a fourth level.
 * Every other layout shows three, the SDK's default, so it asks for none.
 */
function menuDepth(event: H3Event): number | undefined {
  return event.context?.tenant?.config?.layout?.menu?.type === 'catalogue'
    ? 4
    : undefined;
}

export async function getMenu(
  args: { menuLocationId: string },
  event: H3Event,
): Promise<MenuType> {
  // A preview's draft is no copy to cache or keep.
  if (getPreviewToken(event)) return readMenu(args, event);

  // The depth is in the key, so a layout switch never serves the other shape.
  const depth = menuDepth(event);
  const cacheKey = `${buildCachePrefix(event)}::menu::${args.menuLocationId}${depth ? `::d${depth}` : ''}`;
  const cached = menuCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const copies = lastGoodFor(lastGoodMenu, event);
  let result: MenuType;
  try {
    result = await readMenu(args, event);
    copies.set(cacheKey, result);
  } catch (error) {
    const lastGood = copies.get(cacheKey);
    if (!lastGood) throw error;
    logger.warn('[cms] menu read failed; serving the last good copy', {
      menuLocationId: args.menuLocationId,
    });
    result = lastGood;
  }
  menuCache.set(cacheKey, result, { ttl: CACHE_TTL_MS });
  return result;
}

async function readMenu(
  args: { menuLocationId: string },
  event: H3Event,
): Promise<MenuType> {
  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const ctx = cmsRequestContext(event);
  const depth = menuDepth(event);
  const menuArgs = depth ? { ...args, depth } : args;
  const queryArgs = { ...menuArgs, ...channelVars };

  let result = (await wrapServiceCall(
    () => sdk.cms.menu.get(queryArgs, ctx),
    'cms',
  )) as MenuType;

  // Fallback: if no menu for this language, retry without languageId override
  // so the SDK uses its default locale. Handles CMS content that was created
  // for a single language but should be visible to all users.
  // Must strip languageId from BOTH query vars AND RequestContext — the SDK
  // merges context after vars, so context.languageId would override the strip.
  if (!result?.menuItems?.length && channelVars.languageId) {
    const { languageId: _v, ...varsWithoutLang } = channelVars;
    const { languageId: _c, ...ctxWithoutLang } = ctx ?? {};
    const fallbackBase = { ...menuArgs, ...varsWithoutLang };
    const fallbackCtx = Object.keys(ctxWithoutLang).length
      ? ctxWithoutLang
      : undefined;

    const fbResult = (await wrapServiceCall(
      () => sdk.cms.menu.get(fallbackBase, fallbackCtx),
      'cms',
    )) as MenuType;
    if (fbResult?.menuItems?.length) {
      result = fbResult;
    }
  }

  return result;
}

export async function getPage(
  args: { alias: string; customerType?: GeinsCustomerType },
  event: H3Event,
): Promise<ContentPageType> {
  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const ctx = cmsRequestContext(event);
  const queryArgs = {
    ...args,
    ...channelVars,
    ...(args.customerType && { customerType: args.customerType }),
  };
  const read = (preview?: true) =>
    wrapServiceCall(
      () =>
        sdk.cms.page.get(
          preview ? { ...queryArgs, preview } : queryArgs,
          ctx,
        ) as Promise<ContentPageType>,
      'cms',
    );

  if (!getPreviewToken(event)) return read();

  // A page draft comes only with `preview: true`, and then for every alias and
  // with its own id, never the published page's: only its title ties it to a URL.
  const [own, draft] = await Promise.allSettled([read(), read(true)]);
  const match =
    draft.status === 'fulfilled'
      ? draftOfPage(
          draft.value,
          args.alias,
          own.status === 'fulfilled' ? own.value : undefined,
        )
      : null;
  if (match) return match;
  if (own.status === 'rejected') throw own.reason;
  return own.value;
}

/**
 * The answer when it is the page draft for this alias, else null: its title
 * gives the alias, or the published page on the alias has the same title.
 */
function draftOfPage(
  answer: ContentPageType,
  alias: string,
  own: ContentPageType | undefined,
): ContentPageType | null {
  if (!isPageDraft(answer)) return null;
  const draftAlias = toCmsPageAlias(answer.title);
  if (draftAlias === alias) return answer;
  if (own?.id && answer.title && own.title === answer.title) return answer;
  logger.warn('[cms] preview page draft is not this page', {
    alias,
    draftAlias,
  });
  return null;
}

/**
 * A page draft with blocks, not an area's. Measured: an area answers with its
 * family and a named page area; a page with no family and page area 0.
 */
function isPageDraft(answer: ContentPageType): boolean {
  return (
    Boolean(answer.containers?.length) &&
    !answer.familyName &&
    !answer.pageArea?.name &&
    !Number(answer.pageArea?.id ?? 0)
  );
}

/** The landing read is cut short: past it, the preview lands as before. */
const PREVIEW_LANDING_TIMEOUT_MS = 2500;

/**
 * The page draft a preview token carries, or null when it carries none: with
 * `preview: true` Geins answers the token's draft whatever the alias, so the
 * alias here is a placeholder the SDK insists on. Language and market come
 * from the path the preview lands under, never the cookie.
 */
export async function readPreviewPageDraft(
  event: H3Event,
  previewToken: string,
  path: string,
): Promise<ContentPageType | null> {
  try {
    const sdk = await getTenantSDK(event);
    const prefix = parseLocaleMarketPrefix(path);
    const channelVars = getChannelVariables(
      sdk,
      prefix?.locale,
      prefix?.market,
      event.context.tenant?.config?.channelSettings?.locales,
    );
    const answer = (await wrapServiceCall(
      () =>
        sdk.cms.page.get(
          { alias: 'preview', ...channelVars, preview: true },
          { userToken: previewToken },
          { timeoutMs: PREVIEW_LANDING_TIMEOUT_MS },
        ),
      'cms',
    )) as ContentPageType;
    return isPageDraft(answer) ? answer : null;
  } catch {
    return null;
  }
}

/** One entry of the Geins `filters` argument (PageWidgetCollectionFilterInputType). */
interface CmsWidgetFilter {
  key: 'Product' | 'Brand' | 'Category';
  value: string;
}

/**
 * Translates the page context into the Geins `filters` argument.
 *
 * Returns undefined rather than an empty array when there is no context, so a
 * surface without one (start page, portal hero) sends the query it sends today.
 *
 * Measured on the sonoralab test tenant 2026-09-21:
 * - A `Product` entry does not make Geins resolve that product's categories, so
 *   the whole closure from `product.categories` is sent, not the primary one —
 *   a container's filter may sit on any ancestor.
 * - Geins returns the single best-matching container, and a matching filtered
 *   container REPLACES an unfiltered one in the same area rather than stacking
 *   with it. An entry that matches nothing changes nothing.
 * - `Category` and `Brand` accept an alias as well as a numeric id; ids are used
 *   because `product.categories` carries ids and no alias.
 */
function buildAreaFilters(
  context: CmsAreaContext | undefined,
): CmsWidgetFilter[] | undefined {
  if (!context) return undefined;

  const filters: CmsWidgetFilter[] = [];
  if (context.productAlias) {
    filters.push({ key: 'Product', value: context.productAlias });
  }
  if (context.brandAlias) {
    filters.push({ key: 'Brand', value: context.brandAlias });
  }
  for (const id of (context.categoryIds ?? []).slice(
    0,
    CMS_AREA_MAX_CATEGORY_IDS,
  )) {
    filters.push({ key: 'Category', value: String(id) });
  }

  return filters.length ? filters : undefined;
}

/**
 * Stable cache-key segment for a filter set. Sorted so two callers that list
 * the same categories in a different order share one entry, and never empty so
 * a context-less fetch cannot collide with a filtered one.
 */
function filtersCacheSegment(filters: CmsWidgetFilter[] | undefined): string {
  if (!filters?.length) return 'none';
  return filters
    .map((f) => `${f.key}:${f.value}`)
    .sort()
    .join('|');
}

/**
 * Fetches one display-setting "leg" of a content area: the containers Geins
 * returns for the given `displaySetting` filter (a desktop leg returns the
 * always-visible plus desktop-only containers; a mobile leg returns the
 * always-visible plus mobile-only). getContentArea fetches both legs and
 * merges them.
 *
 * The query always carries `languageId`, so an area Geins filters to another
 * language stays empty instead of resolving to the account's default language.
 */
async function fetchAreaLeg(
  sdk: Awaited<ReturnType<typeof getTenantSDK>>,
  args: {
    family: string;
    areaName: string;
    customerType?: GeinsCustomerType;
    filters?: CmsWidgetFilter[];
  },
  channelVars: ReturnType<typeof getRequestChannelVariables>,
  ctx: ReturnType<typeof cmsRequestContext>,
  displaySetting: 'mobile' | 'desktop',
): Promise<ContentAreaType> {
  const queryArgs = {
    ...args,
    ...channelVars,
    displaySetting,
    ...(args.customerType && { customerType: args.customerType }),
  };

  return (await wrapServiceCall(
    () => sdk.cms.area.get(queryArgs, ctx) as Promise<ContentAreaType>,
    'cms',
  )) as ContentAreaType;
}

export async function getContentArea(
  args: {
    family: string;
    areaName: string;
    customerType?: GeinsCustomerType;
    context?: CmsAreaContext;
  },
  event: H3Event,
): Promise<CmsContentArea> {
  const filters = buildAreaFilters(args.context);
  // customerType is a query argument that changes the response, so it belongs
  // in the key beside family and areaName, even though it is decoded from the
  // token the identity segment already covers.
  //
  // The filters segment is what keeps one product's area out of the next
  // product's response: the same family/areaName now answers differently per
  // page, so without it the first PDP to populate the entry would serve every
  // other PDP for the whole TTL.
  const cacheKey = `${buildCachePrefix(event)}::area::${args.family}::${args.areaName}::${args.customerType ?? 'any'}::${filtersCacheSegment(filters)}`;

  // A preview's draft is no copy to cache or keep.
  if (getPreviewToken(event))
    return (await readArea(args, filters, event)).area;

  const cached = areaCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const copies = lastGoodFor(lastGoodArea, event);
  let result: CmsContentArea;
  try {
    const read = await readArea(args, filters, event);
    result = read.area;
    // An area that lost its mobile leg is served, but is no copy to fall back on.
    if (read.complete) copies.set(cacheKey, result);
  } catch (error) {
    const lastGood = copies.get(cacheKey);
    if (!lastGood) throw error;
    logger.warn('[cms] area read failed; serving the last good copy', {
      family: args.family,
      areaName: args.areaName,
    });
    result = lastGood;
  }
  areaCache.set(cacheKey, result, { ttl: CACHE_TTL_MS });
  return result;
}

async function readArea(
  args: {
    family: string;
    areaName: string;
    customerType?: GeinsCustomerType;
  },
  filters: CmsWidgetFilter[] | undefined,
  event: H3Event,
): Promise<{ area: CmsContentArea; complete: boolean }> {
  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const ctx = cmsRequestContext(event);

  // `context` is our own shape and must not reach the query — only the
  // `filters` it was translated into.
  const legArgs = {
    family: args.family,
    areaName: args.areaName,
    ...(args.customerType && { customerType: args.customerType }),
    ...(filters && { filters }),
  };

  // Geins enforces the per-container "Display settings" server-side via the
  // `displaySetting` filter and never returns mobile-only and desktop-only
  // containers in the same response. Fetch both legs and merge so every
  // container reaches the client regardless of viewport; CmsContainer then
  // gates each by breakpoint from the derived `visibility` tag (resize-aware,
  // not User-Agent based). The mobile leg is best-effort: if it fails we still
  // render the desktop set rather than blanking the area.
  const [desktopArea, mobileArea] = await Promise.all([
    fetchAreaLeg(sdk, legArgs, channelVars, ctx, 'desktop'),
    fetchAreaLeg(sdk, legArgs, channelVars, ctx, 'mobile').catch(() => null),
  ]);

  return {
    area: {
      ...desktopArea,
      containers: mergeContainersByVisibility(
        desktopArea?.containers ?? [],
        mobileArea?.containers ?? [],
      ),
    },
    complete: mobileArea !== null,
  };
}

export type ListedCmsPage = Pick<
  GeinsPageWidgetPageTypeType,
  'id' | 'name' | 'title' | 'meta'
> & { alias: string; tags: string[] };

/**
 * The `cmsPages` item for an alias, or null. Geins answers no widget area for a
 * published page without blocks, the same as for a missing page; `cmsPages`
 * still lists it, lists CMS pages only, and drops an unpublished page.
 *
 * The alias matches exactly, as `widgetArea` does. A failed or malformed read
 * answers null and is not cached, so the route keeps today's 404.
 */
export async function getListedCmsPage(
  args: { alias: string },
  event: H3Event,
): Promise<ListedCmsPage | null> {
  // Sent without a token, preview or not; a preview only skips the cache.
  const isCacheable = !getPreviewToken(event);
  const cacheKey = `${buildAnonymousCachePrefix(event)}::cmspages`;

  let pages = isCacheable ? cmsPagesCache.get(cacheKey) : undefined;
  if (!pages) {
    const read = await readCmsPages(event);
    if (!read) return null;
    pages = read;
    if (isCacheable) cmsPagesCache.set(cacheKey, pages, { ttl: CACHE_TTL_MS });
  }

  return pages.find((page) => page.alias === args.alias) ?? null;
}

async function readCmsPages(event: H3Event): Promise<ListedCmsPage[] | null> {
  let result: unknown;
  try {
    const sdk = await getTenantSDK(event);
    result = await wrapServiceCall(
      () =>
        sdk.core.graphql.query({
          queryAsString: loadQuery('cms/pages.graphql'),
          variables: getRequestChannelVariables(sdk, event),
        }),
      'cms',
    );
  } catch {
    logger.warn('[cms] cmsPages read failed; treating the alias as unlisted');
    return null;
  }

  const items = unwrapGraphQL(result);
  if (!Array.isArray(items)) {
    logger.warn(
      '[cms] cmsPages answer is not a list; treating the alias as unlisted',
    );
    return null;
  }

  return (items as Array<GeinsPageWidgetPageTypeType | null>).flatMap((item) =>
    item?.alias
      ? [
          {
            id: item.id,
            alias: item.alias,
            name: item.name,
            title: item.title,
            meta: item.meta,
            tags: (item.tags ?? []).filter(
              (tag): tag is string => typeof tag === 'string',
            ),
          },
        ]
      : [],
  );
}

/**
 * Resolves the localized link for the first CMS page tagged with the given tag,
 * preferring canonicalUrl and falling back to the page alias (as a validated
 * internal "/slug" path) when canonicalUrl is empty. Returns null when neither is
 * present, or when the alias does not yield a safe internal path.
 *
 * The query drives localization via getRequestChannelVariables so no locale
 * codes are hardcoded here. cmsPages already falls back to the default-language
 * page server-side; a single call is correct.
 *
 * Cache sentinel: null results are stored as an empty string in the
 * LRUCache (LRUCache<string, string> disallows null values). pageLinkCache.has()
 * is used to distinguish a cached miss from an uncached entry.
 */
export async function getPageLinkByTag(
  args: { tag: string },
  event: H3Event,
): Promise<string | null> {
  // Sent without a token, preview or not; a preview only skips the cache.
  const isCacheable = !getPreviewToken(event);
  const cacheKey = `${buildAnonymousCachePrefix(event)}::pagelink::${args.tag}`;

  if (isCacheable && pageLinkCache.has(cacheKey)) {
    const cached = pageLinkCache.get(cacheKey);
    // Map sentinel back to null: empty string means "confirmed no page for this tag".
    return cached === PAGE_LINK_NULL_SENTINEL ? null : (cached ?? null);
  }

  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);

  // Geins cmsPages includeTags is an exact, hash-sensitive string match: a
  // tenant may store the tag bare ("contact") or hash-prefixed ("#contact")
  // and the two do not cross-match. Query both forms so resolution works
  // regardless of how the merchant entered the tag in the admin.
  const bareTag = args.tag.replace(/^#+/, '');
  const includeTags = [bareTag, `#${bareTag}`];

  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('cms/page-by-tag.graphql'),
        variables: { includeTags, ...channelVars },
      }),
    'cms',
  );

  const pages = unwrapGraphQL(result) as
    | Array<{ alias?: string; tags?: string[]; canonicalUrl?: string }>
    | null
    | undefined;

  let resolved: string | null = null;

  if (Array.isArray(pages) && pages.length > 0) {
    // Prefer a tag-confirmed match so a stray result without the tag is ignored.
    // The API already filtered by includeTags; this is a defensive check.
    const tagMatch = pages.find((p) => hasPageTag(p, args.tag));
    const candidate = tagMatch ?? pages[0];
    const canonical = candidate?.canonicalUrl?.trim();
    const alias = candidate?.alias?.trim();

    if (canonical) {
      // Validate the canonicalUrl at the boundary: a malformed or injected
      // external URL must never be returned as a safe link. This mirrors the
      // isSafeInternalPath check applied to the alias branch below.
      resolved = isSafeInternalPath(canonical) ? canonical : null;
    } else if (alias) {
      // The alias is a bare slug. Build a clean internal path (a stray leading
      // slash would otherwise produce a protocol-relative "//slug") and validate
      // it at the boundary so a malformed alias is rejected here, keeping the
      // safe-link guarantee independent of every downstream consumer.
      const aliasPath = `/${alias.replace(/^\/+/, '')}`;
      resolved = isSafeInternalPath(aliasPath) ? aliasPath : null;
    }
  }

  if (isCacheable) {
    // Store sentinel for null so cache.has() returns true and avoids re-querying.
    pageLinkCache.set(cacheKey, resolved ?? PAGE_LINK_NULL_SENTINEL, {
      ttl: CACHE_TTL_MS,
    });
  }

  return resolved;
}

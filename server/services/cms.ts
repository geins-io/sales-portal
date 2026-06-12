import type {
  ContentPageType,
  ContentAreaType,
  MenuType,
  GeinsCustomerType,
} from '@geins/types';
import type { H3Event } from 'h3';
import { LRUCache } from 'lru-cache';
import {
  getTenantSDK,
  getRequestChannelVariables,
  buildRequestContext,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { hasPageTag } from '#shared/utils/cms-tags';

// =============================================================================
// Cache Configuration
// =============================================================================

const CACHE_TTL_MS = 60 * 1000; // 1 minute — short TTL for multi-locale correctness

const menuCache = new LRUCache<string, MenuType>({
  max: 200,
});

const areaCache = new LRUCache<string, ContentAreaType>({
  max: 500,
});

// Cache for resolved page links keyed by tenant+locale+market+tag.
// Null results use an empty-string sentinel (PAGE_LINK_NULL_SENTINEL) because
// LRUCache<string, string> disallows null values. cache.has() distinguishes a
// cached miss from an uncached entry; get() returning "" means no page exists.
const PAGE_LINK_NULL_SENTINEL = '';
const pageLinkCache = new LRUCache<string, string>({ max: 300 });

/**
 * Build a cache key prefix from event context (tenant hostname, locale, market).
 * Uses getRequestLocale/getRequestMarket which handle both page routes
 * (resolvedLocaleMarket) and API routes (cookie fallback with BCP-47 expansion).
 */
function buildCachePrefix(event: H3Event): string {
  const hostname = event.context?.tenant?.hostname ?? 'default';
  const locale = getRequestLocale(event) ?? 'default';
  const market = getRequestMarket(event) ?? 'default';
  return `${hostname}::${locale}::${market}`;
}

/**
 * Check if a widget area result has actual content. A container with zero
 * widgets counts as empty — the CMS can provision empty container shells in
 * one language while the translated sibling stays populated, and we want
 * the language fallback to kick in when the current language only returns
 * shells.
 */
function hasContent(area: ContentAreaType | null | undefined): boolean {
  const containers = area?.containers ?? [];
  return containers.some((c) => (c?.content?.length ?? 0) > 0);
}

/**
 * Detect display setting from User-Agent header.
 * Returns 'mobile' or 'desktop' for CMS widget area queries.
 * The Geins CMS can serve different widget configurations per display setting.
 */
function getDisplaySetting(event: H3Event): string {
  const ua = getRequestHeader(event, 'user-agent') ?? '';
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return isMobile ? 'mobile' : 'desktop';
}

// =============================================================================
// Service Functions
// =============================================================================

export async function getMenu(
  args: { menuLocationId: string },
  event: H3Event,
): Promise<MenuType> {
  const preview = getPreviewCookie(event);
  const isCacheable = !preview;
  const cacheKey = `${buildCachePrefix(event)}::menu::${args.menuLocationId}`;

  if (isCacheable) {
    const cached = menuCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const ctx = buildRequestContext(event);
  const queryArgs = { ...args, ...channelVars };

  if (preview) {
    try {
      return (await wrapServiceCall(
        () => sdk.cms.menu.get({ ...queryArgs, preview: true }, ctx),
        'cms',
      )) as MenuType;
    } catch {
      // Preview fetch failed — fall back to published content
    }
  }

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
    const fallbackBase = { ...args, ...varsWithoutLang };
    const fallbackCtx = Object.keys(ctxWithoutLang).length
      ? ctxWithoutLang
      : undefined;

    if (preview) {
      try {
        const pResult = (await wrapServiceCall(
          () =>
            sdk.cms.menu.get({ ...fallbackBase, preview: true }, fallbackCtx),
          'cms',
        )) as MenuType;
        if (pResult?.menuItems?.length) {
          result = pResult;
        }
      } catch {
        // Preview fallback failed
      }
    }

    if (!result?.menuItems?.length) {
      const fbResult = (await wrapServiceCall(
        () => sdk.cms.menu.get(fallbackBase, fallbackCtx),
        'cms',
      )) as MenuType;
      if (fbResult?.menuItems?.length) {
        result = fbResult;
      }
    }
  }

  if (isCacheable) {
    menuCache.set(cacheKey, result, { ttl: CACHE_TTL_MS });
  }

  return result;
}

export async function getPage(
  args: { alias: string; customerType?: GeinsCustomerType },
  event: H3Event,
): Promise<ContentPageType> {
  const sdk = await getTenantSDK(event);
  const preview = getPreviewCookie(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const ctx = buildRequestContext(event);
  const queryArgs = {
    ...args,
    ...channelVars,
    ...(args.customerType && { customerType: args.customerType }),
  };

  if (preview) {
    try {
      return await wrapServiceCall(
        () =>
          sdk.cms.page.get(
            { ...queryArgs, preview: true },
            ctx,
          ) as Promise<ContentPageType>,
        'cms',
      );
    } catch {
      // Preview fetch failed — fall back to published content
    }
  }

  return wrapServiceCall(
    () => sdk.cms.page.get(queryArgs, ctx) as Promise<ContentPageType>,
    'cms',
  );
}

export async function getContentArea(
  args: {
    family: string;
    areaName: string;
    customerType?: GeinsCustomerType;
    displaySetting?: string;
  },
  event: H3Event,
): Promise<ContentAreaType> {
  const preview = getPreviewCookie(event);
  const isCacheable = !args.customerType && !preview;
  const displaySetting = args.displaySetting ?? getDisplaySetting(event);
  const cacheKey = isCacheable
    ? `${buildCachePrefix(event)}::area::${args.family}::${args.areaName}::${displaySetting}`
    : '';

  if (isCacheable) {
    const cached = areaCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const ctx = buildRequestContext(event);
  const queryArgs = {
    ...args,
    ...channelVars,
    displaySetting,
    ...(args.customerType && { customerType: args.customerType }),
  };

  if (preview) {
    try {
      const previewResult = (await wrapServiceCall(
        () =>
          sdk.cms.area.get(
            { ...queryArgs, preview: true },
            ctx,
          ) as Promise<ContentAreaType>,
        'cms',
      )) as ContentAreaType;
      if (hasContent(previewResult)) return previewResult;
    } catch {
      // Preview fetch failed — fall back to published content
    }
  }

  let result = (await wrapServiceCall(
    () => sdk.cms.area.get(queryArgs, ctx) as Promise<ContentAreaType>,
    'cms',
  )) as ContentAreaType;

  // Fallback: if no content for this language, retry without languageId override
  // so the SDK uses its default locale. Handles CMS content that was created
  // for a single language but should be visible to all users.
  // Preserves preview flag so draft content still works in fallback.
  // Must strip languageId from BOTH query vars AND RequestContext — the SDK
  // merges context after vars, so context.languageId would override the strip.
  if (!hasContent(result) && channelVars.languageId) {
    const { languageId: _v, ...varsWithoutLang } = channelVars;
    const { languageId: _c, ...ctxWithoutLang } = ctx ?? {};
    const fallbackBase = {
      ...args,
      ...varsWithoutLang,
      displaySetting,
      ...(args.customerType && { customerType: args.customerType }),
    };
    const fallbackCtx = Object.keys(ctxWithoutLang).length
      ? ctxWithoutLang
      : undefined;

    // Try with preview first (if in preview mode), then without
    if (preview) {
      try {
        const pResult = (await wrapServiceCall(
          () =>
            sdk.cms.area.get(
              { ...fallbackBase, preview: true },
              fallbackCtx,
            ) as Promise<ContentAreaType>,
          'cms',
        )) as ContentAreaType;
        if (hasContent(pResult)) {
          result = pResult;
        }
      } catch {
        // Preview fallback failed — continue to non-preview fallback
      }
    }

    if (!hasContent(result)) {
      const fbResult = (await wrapServiceCall(
        () =>
          sdk.cms.area.get(
            fallbackBase,
            fallbackCtx,
          ) as Promise<ContentAreaType>,
        'cms',
      )) as ContentAreaType;
      if (hasContent(fbResult)) {
        result = fbResult;
      }
    }
  }

  if (isCacheable) {
    areaCache.set(cacheKey, result, { ttl: CACHE_TTL_MS });
  }

  return result;
}

/**
 * Resolves the localized link for the first CMS page tagged with the given tag,
 * preferring canonicalUrl and falling back to the page alias (prefixed with "/")
 * when canonicalUrl is empty; returns null when neither is present.
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
  const preview = getPreviewCookie(event);
  const isCacheable = !preview;
  // No preview variant: cmsPages has no preview arg; preview only disables caching here.
  const cacheKey = `${buildCachePrefix(event)}::pagelink::${args.tag}`;

  if (isCacheable && pageLinkCache.has(cacheKey)) {
    const cached = pageLinkCache.get(cacheKey);
    // Map sentinel back to null: empty string means "confirmed no page for this tag".
    return cached === PAGE_LINK_NULL_SENTINEL ? null : (cached ?? null);
  }

  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);

  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('cms/page-by-tag.graphql'),
        variables: { includeTags: [args.tag], ...channelVars },
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
    const canonical = candidate?.canonicalUrl;
    const alias = candidate?.alias;
    resolved =
      typeof canonical === 'string' && canonical !== ''
        ? canonical
        : typeof alias === 'string' && alias !== ''
          ? `/${alias}`
          : null;
  }

  if (isCacheable) {
    // Store sentinel for null so cache.has() returns true and avoids re-querying.
    pageLinkCache.set(cacheKey, resolved ?? PAGE_LINK_NULL_SENTINEL, {
      ttl: CACHE_TTL_MS,
    });
  }

  return resolved;
}

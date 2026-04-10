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
 * Check if a widget area result has actual content.
 */
function hasContent(area: ContentAreaType | null | undefined): boolean {
  return !!area?.containers?.length;
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

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

  const result = (await wrapServiceCall(
    () => sdk.cms.menu.get(queryArgs, ctx),
    'cms',
  )) as MenuType;

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
  args: { family: string; areaName: string; customerType?: GeinsCustomerType },
  event: H3Event,
): Promise<ContentAreaType> {
  const preview = getPreviewCookie(event);
  const isCacheable = !args.customerType && !preview;
  const cacheKey = isCacheable
    ? `${buildCachePrefix(event)}::area::${args.family}::${args.areaName}`
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
    ...(args.customerType && { customerType: args.customerType }),
  };

  if (preview) {
    try {
      return (await wrapServiceCall(
        () =>
          sdk.cms.area.get(
            { ...queryArgs, preview: true },
            ctx,
          ) as Promise<ContentAreaType>,
        'cms',
      )) as ContentAreaType;
    } catch {
      // Preview fetch failed — fall back to published content
    }
  }

  const result = (await wrapServiceCall(
    () => sdk.cms.area.get(queryArgs, ctx) as Promise<ContentAreaType>,
    'cms',
  )) as ContentAreaType;

  if (isCacheable) {
    areaCache.set(cacheKey, result, { ttl: CACHE_TTL_MS });
  }

  return result;
}

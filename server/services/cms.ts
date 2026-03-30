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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  const cacheKey = `${buildCachePrefix(event)}::menu::${args.menuLocationId}`;
  const cached = menuCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const sdk = await getTenantSDK(event);
  const channelVars = getRequestChannelVariables(sdk, event);
  const ctx = buildRequestContext(event);
  const result = (await wrapServiceCall(
    () => sdk.cms.menu.get({ ...args, ...channelVars }, ctx),
    'cms',
  )) as MenuType;

  menuCache.set(cacheKey, result, { ttl: CACHE_TTL_MS });
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
  return wrapServiceCall(
    () =>
      sdk.cms.page.get(
        {
          ...args,
          ...channelVars,
          ...(preview && { preview: true }),
          ...(args.customerType && { customerType: args.customerType }),
        },
        ctx,
      ) as Promise<ContentPageType>,
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
  const result = (await wrapServiceCall(
    () =>
      sdk.cms.area.get(
        {
          ...args,
          ...channelVars,
          ...(preview && { preview: true }),
          ...(args.customerType && { customerType: args.customerType }),
        },
        ctx,
      ) as Promise<ContentAreaType>,
    'cms',
  )) as ContentAreaType;

  if (isCacheable) {
    areaCache.set(cacheKey, result, { ttl: CACHE_TTL_MS });
  }

  return result;
}

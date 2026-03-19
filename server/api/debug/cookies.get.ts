import type { TenantConfig } from '#shared/types/tenant-config';
import { COOKIE_NAMES } from '#shared/constants/storage';

/**
 * Dev-only debug endpoint that returns current cookie state and tenant context.
 *
 * GET /api/debug/cookies
 *
 * Returns 404 in production builds.
 */
export default defineEventHandler((event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const locale = getCookie(event, COOKIE_NAMES.LOCALE);
  const market = getCookie(event, COOKIE_NAMES.MARKET);
  const tenantId = getCookie(event, COOKIE_NAMES.TENANT_ID);
  const cartId = getCookie(event, COOKIE_NAMES.CART_ID);

  const tenant = event.context.tenant as
    | { hostname?: string; tenantId?: string; config?: TenantConfig }
    | undefined;

  const config = tenant?.config;
  const geins = config?.geinsSettings;

  const availableLocales = geins?.availableLocales ?? [];
  const availableMarkets = geins?.availableMarkets ?? [];

  // Extract short locale codes for comparison
  const validShortLocales = availableLocales
    .map((l) => l.split('-')[0])
    .filter((s): s is string => !!s && /^[a-z]{2}$/.test(s));

  const localeValid = !locale || validShortLocales.includes(locale);
  const marketValid = !market || availableMarkets.includes(market);

  return {
    cookies: {
      locale: locale ?? null,
      market: market ?? null,
      tenant_id: tenantId ?? null,
      cart_id: cartId ?? null,
    },
    tenant: {
      resolvedId: tenant?.tenantId ?? null,
      hostname: tenant?.hostname ?? null,
    },
    supported: {
      locales: availableLocales,
      markets: availableMarkets,
    },
    valid: {
      locale: localeValid,
      market: marketValid,
      all: localeValid && marketValid,
    },
  };
});

import { createHash } from 'node:crypto';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { listBuyerMarkets } from '../utils/buyer-market';
import { loadUserForToken } from '../utils/load-user';

/**
 * Server-side guard that intercepts deep-link requests where an authenticated
 * buyer hits a market URL their pricelist isn't allowed on (e.g. pasting
 * `/no/sv/portal` while bound to the `se` market). Without this, SSR runs
 * against the wrong catalog and the first paint shows empty / wrong-currency
 * pages until the client-side self-heal fires a full reload.
 *
 * Runs AFTER `00.locale-market.ts` (filename order), so `event.context.localeMarket`
 * has already been populated for prefixed URLs. Anonymous users (no auth
 * cookie) pass straight through. Cache hits short-circuit the SDK lookup so
 * cost is bounded.
 *
 * Module-scope cache is keyed by SHA-256(token) + tenantId + channelId to
 * isolate across tenants sharing infra. Bounded to LRU_CAP entries to keep
 * the long-running Nitro process from accumulating unbounded state.
 */

type CacheEntry = { markets: string[]; expires: number };

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30_000;
const LRU_CAP = 5000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function setCacheEntry(key: string, entry: CacheEntry): void {
  // Map preserves insertion order. Delete + set re-positions to most-recent.
  if (CACHE.has(key)) CACHE.delete(key);
  CACHE.set(key, entry);
  while (CACHE.size > LRU_CAP) {
    const oldest = CACHE.keys().next().value;
    if (oldest === undefined) break;
    CACHE.delete(oldest);
  }
}

function getCacheEntry(key: string, now: number): CacheEntry | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (entry.expires <= now) {
    CACHE.delete(key);
    return null;
  }
  // Touch on access for LRU recency.
  CACHE.delete(key);
  CACHE.set(key, entry);
  return entry;
}

export default defineEventHandler(async (event) => {
  const fullPath = event.path || '/';

  // Strip query for path checks; redirect target preserves the original query.
  const queryIndex = fullPath.indexOf('?');
  const path = queryIndex >= 0 ? fullPath.slice(0, queryIndex) : fullPath;
  const query = queryIndex >= 0 ? fullPath.slice(queryIndex) : '';

  // Page-only filter: skip APIs, internal Nuxt routes, static assets,
  // sitemap/robots/healthz, and any path that looks like a file.
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt') ||
    path.startsWith('/favicon') ||
    path.startsWith('/robots.txt') ||
    path.startsWith('/sitemap') ||
    path.startsWith('/healthz') ||
    path.includes('.')
  ) {
    return;
  }

  const accept = getHeader(event, 'accept') || '';
  if (!accept.includes('text/html')) return;

  const token = getCookie(event, COOKIE_NAMES.AUTH_TOKEN);
  if (!token) return;

  const ctx = event.context as {
    localeMarket?: { market: string; locale: string };
    tenant?: {
      id?: string;
      config?: {
        geinsSettings?: { channel?: string | number; tld?: string };
      };
    };
  };

  const localeMarket = ctx.localeMarket;
  if (!localeMarket) return;
  const urlMarket = localeMarket.market;
  const urlLocale = localeMarket.locale;

  const tenantId = ctx.tenant?.id ?? 'unknown';
  const channel = ctx.tenant?.config?.geinsSettings?.channel ?? '';
  const tld = ctx.tenant?.config?.geinsSettings?.tld ?? '';
  const channelId = `${channel}|${tld}`;

  // Bail when we have no tenant + no channel: the cache key would collapse
  // across tenants and risk cross-tenant bleed.
  if (tenantId === 'unknown' && channelId === '|') return;

  const key = `${hashToken(token)}:${tenantId}:${channelId}`;
  const now = Date.now();

  let markets: string[] | null = null;
  const cached = getCacheEntry(key, now);
  if (cached) {
    markets = cached.markets;
  } else {
    try {
      const user = await loadUserForToken(event, token);
      markets = listBuyerMarkets(event, user);
      if (markets) {
        setCacheEntry(key, { markets, expires: now + TTL_MS });
      }
    } catch {
      // Fail open: never redirect on lookup error or stale tokens loop.
      return;
    }
  }

  if (!markets || markets.length === 0) return;
  if (markets.includes(urlMarket)) return;

  const targetMarket = markets[0]!;
  const segments = path.split('/').filter(Boolean);
  const rest = segments.slice(2).join('/');
  const target = `/${targetMarket}/${urlLocale}${rest ? '/' + rest : '/'}${query}`;
  return sendRedirect(event, target, 302);
});

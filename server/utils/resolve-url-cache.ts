/**
 * Storage mount for the /api/resolve-url response cache. Nitro's default
 * `cache` mount never evicts, and the resolver's keys follow whatever paths
 * callers send, so it gets its own LRU. An evicted entry costs one Geins
 * lookup on its next request.
 *
 * An entry is under 1 KB for a typical path and about 5 KB at the 500-char
 * path limit, so the cap holds the resolver below roughly 5 MB.
 *
 * nuxt.config.ts imports this file: keep it free of Nitro auto-imports.
 */
export const RESOLVE_URL_CACHE_BASE = 'resolve-url';

export const RESOLVE_URL_CACHE_MAX_ENTRIES = 1000;

export const resolveUrlCacheMount = {
  driver: 'lru-cache',
  max: RESOLVE_URL_CACHE_MAX_ENTRIES,
};

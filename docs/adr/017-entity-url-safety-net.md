---
title: Entity URL safety net
status: accepted
created: 2026-06-02
tags: [routing, urls, seo, redirects]
---

# ADR-017: Entity URL safety net

## Context

ADR-015 established type-prefixed routing: every navigable entity URL carries a single-letter (or two-letter) prefix after `/{market}/{locale}/` that identifies its content type (`/c/`, `/p/`, `/b/`, `/s/`, `/dc/`, `/l/`). The Geins API, by contrast, returns canonical URLs without these prefixes (for example `/se/sv/material/grenror`). Two failure modes follow from that mismatch.

**Outbound.** A page can read the Geins canonical (for example to set `<link rel="canonical">` or to call `history.replaceState`) and write the prefix-less value straight into the address bar. On a refresh or a copy/paste of that address, the request lands on the bare path, which no typed page owns. The catch-all then treats it as a CMS slug, finds nothing, and returns a 404. The PLP and PDP `replaceState` calls hit exactly this trap before they were normalized.

**Inbound.** Prefix-less entity URLs also arrive from outside the app: old bookmarks created before type prefixes existed, links shared by users, URLs indexed by search engines, raw Geins canonicals pasted in, and slugs that were renamed in Geins after the link was made. Each of these reaches the `[...slug].vue` catch-all, misses the CMS lookup, and would 404 even though the entity still exists.

## Decision

Treat the type prefix as an invariant on every navigable entity URL, and add a narrow inbound resolver to recover the URLs that predate or sidestep that invariant.

### Outbound: never write a raw canonical

Always normalize a Geins canonical through the route helpers in `shared/utils/route-helpers.ts` (`categoryPath`, `productPath`, `brandPath`, `searchPath`, `discountCampaignPath`) and then wrap the result with `localePath()` before it reaches an `href`, `navigateTo`, or `history.replaceState`. A raw, prefix-less canonical is never written to the DOM or the address bar. The in-page canonical `replaceState` in `ProductDetails.vue` and `ProductList.vue` now runs the Geins canonical through these helpers, so a refresh of the rewritten address lands on a typed route.

### Inbound: resolve prefix-less URLs on a CMS miss

The `app/pages/[...slug].vue` catch-all is the inbound safety net. When its CMS lookup misses, it calls `/api/resolve-url` (`server/services/url-resolver.ts`). The resolver tries to match the alias to an entity in priority order, product then category then brand, and if Geins reports the slug was renamed it consults Geins `urlHistory(url)` (`{ oldUrl, newUrl }`) to recover the current slug. On a hit it issues a 301 redirect to the correctly prefixed, locale-wrapped typed route. Only a true unknown, where no entity and no history entry matches, falls through to a 404.

Because the resolver always redirects to a typed route, and typed routes are owned by dedicated pages rather than the catch-all, there is no redirect loop.

## Consequences

**Positive:**

- Old bookmarks, shared links, search-engine results, pasted Geins canonicals, and renamed slugs resolve to the correct typed route instead of 404ing.
- The resolver runs only on the CMS-miss path, so it costs one batch of Geins lookups on a miss, not a lookup per navigation.
- The outbound invariant keeps the address bar and canonical tags consistent with the routes the app actually serves.

**Negative:**

- A genuine miss triggers up to three Geins lookups (product, category, brand) plus a possible `urlHistory` call. These misses are currently uncached.

**Relationship to ADR-015:**

- This is not a revival of the per-navigation route resolver that ADR-015 removed. That resolver classified every navigation up front with an extra API round-trip. This resolver runs only when the catch-all CMS lookup has already missed, purely as a 404 recovery step. In-app navigation still goes straight to a typed route built by the route helpers, with no resolution round-trip.

**Follow-up (not built):**

- Negative-caching of resolver misses. Because a true miss runs three Geins lookups and is uncached, a hammered bad URL (for example from a crawler) repeats those round-trips on every request. A short-TTL, no-store-aware miss cache (or a KV-backed equivalent) would absorb repeated lookups for the same unknown alias. Recorded here as a known optimization, intentionally deferred.

/**
 * Ralph-style route path prefixes.
 *
 * These type-indicator prefixes appear between the /{market}/{locale}/
 * segment and the entity alias in every storefront URL:
 *
 *   /se/sv/c/epoxy         → category PLP
 *   /se/sv/p/epoxy/item    → product PDP
 *   /se/sv/b/brand-name    → brand PLP
 *   /se/sv/s/search-query  → search results
 *   /se/sv/l/some-list     → generic list
 *   /se/sv/dc/campaign     → discount campaign
 *
 * CMS content pages use NO prefix and are caught by the [...slug] catch-all.
 */
export const ROUTE_PATHS = {
  category: '/c',
  product: '/p',
  brand: '/b',
  list: '/l',
  search: '/s',
  discountCampaign: '/dc',
} as const;

export type RoutePathPrefix = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

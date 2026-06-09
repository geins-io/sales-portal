/**
 * Translates the un-localized identity of a Geins `FilterFacet` into a
 * locale-aware header for the PLP filter sidebar.
 *
 * Geins returns system filters (Brand / Category / Price / Sku / StockStatus)
 * with `group: null` and their identity carried in `type` / `filterId`, while
 * product-parameter filters instead carry a merchant-defined name in `group` /
 * `label`. Either way the strings arrive as hardcoded English that bleeds
 * through on non-English storefronts. Rather than hold the API to a translation
 * contract, we keep a small dictionary in user-land and normalise the facet's
 * identity before lookup.
 *
 * Unknown groups (dynamic product-parameter filters like "Color" / "Material")
 * fall back to the facet's own label so the storefront still renders something
 * useful when the backend surfaces a new filter type.
 */
import type { FilterFacet } from '#shared/types/commerce';

/**
 * Maps normalised facet identity strings to i18n keys under
 * `product.filter_groups.*`. Normalisation: trim → lowercase → collapse any
 * runs of whitespace into a single underscore, so `"Stock status"` and
 * `"stock_status"` both resolve to `stock_status`.
 */
const GROUP_KEY_MAP: Record<string, string> = {
  category: 'categories',
  categories: 'categories',
  brand: 'brands',
  brands: 'brands',
  price: 'price',
  sku: 'skus',
  skus: 'skus',
  size: 'skus',
  sizes: 'skus',
  stock_status: 'stock_status',
  stockstatus: 'stock_status',
  discount: 'discount',
  sale: 'discount',
  campaign: 'campaigns',
  campaigns: 'campaigns',
};

/**
 * Normalises a raw identity string and returns the matching
 * `product.filter_groups.*` key, or `undefined` when it is empty or unknown.
 */
function resolveGroupKey(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return GROUP_KEY_MAP[normalized];
}

/** The identity fields a facet header can be derived from. */
type FacetIdentity = Pick<FilterFacet, 'group' | 'label' | 'type' | 'filterId'>;

/**
 * Looks up a localized header for a filter facet.
 *
 * Resolution order: the first of `group`, `type`, `filterId` that maps to a
 * known group key wins and is translated. This is what fixes English headers
 * on non-English storefronts: system filters arrive with `group: null` and
 * their identity in `type` / `filterId` (e.g. `type: "Brand"`), so feeding
 * only `group` to the dictionary always missed and bled the raw English
 * through. Product-parameter filters still carry their identity in `group`.
 *
 * When no identity field maps to a known key (a custom parameter filter), the
 * facet's own `label` is returned, falling back through `group` / `type` /
 * `filterId` and finally `""`.
 *
 * @param facet The facet's identity fields from the `FilterFacet` payload.
 * @param t The i18n translate callback (e.g. from `useI18n()`).
 */
export function getFilterGroupLabel(
  facet: FacetIdentity,
  t: (key: string) => string,
): string {
  for (const candidate of [facet.group, facet.type, facet.filterId]) {
    const key = resolveGroupKey(candidate);
    if (key) return t(`product.filter_groups.${key}`);
  }
  return facet.label || facet.group || facet.type || facet.filterId || '';
}

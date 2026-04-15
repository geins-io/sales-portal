/**
 * Translates the un-localized English `group` string from the Geins
 * `FilterFacet` payload into a locale-aware header for the PLP filter
 * sidebar.
 *
 * The Geins API returns `FilterFacet.group` / `FilterFacet.label` as hardcoded
 * English strings ("Brand", "Category", "Sku", "Stock status", "Price") that
 * bleed through on non-English storefronts. Rather than hold the API to a
 * translation contract, we keep a small dictionary in user-land and normalise
 * incoming strings before lookup.
 *
 * Unknown groups (dynamic product-parameter filters like "Color" / "Material")
 * pass through unchanged so the storefront still renders something useful
 * when the backend surfaces a new filter type.
 */

/**
 * Maps normalised API filter group strings to i18n keys under
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
 * Looks up a localized label for an API filter group string.
 *
 * - `null` / `undefined` / `""` → returns `""` (no `t()` call).
 * - Known group (after normalisation) → returns `t('product.filter_groups.<key>')`.
 * - Unknown group → returns the raw input unchanged.
 *
 * @param group The raw group/label string from the `FilterFacet` payload.
 * @param t The i18n translate callback (e.g. from `useI18n()`).
 */
export function getFilterGroupLabel(
  group: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!group) return '';
  const normalized = group.trim().toLowerCase().replace(/\s+/g, '_');
  const key = GROUP_KEY_MAP[normalized];
  if (!key) return group;
  return t(`product.filter_groups.${key}`);
}

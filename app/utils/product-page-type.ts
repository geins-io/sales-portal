/**
 * Which page component a product gets.
 *
 * One rule for product types rather than a special case per type: the route
 * asks this, and the page it names renders. A third type is one more member
 * here and one more branch in the page — never a condition inside a page.
 */
export type ProductPageType = 'ordinary' | 'configurable';

/**
 * The configurator needs both halves: a product the configurator stands
 * behind, and a buyer the access rule lets configure. A buyer it refuses gets
 * the ordinary page, not a 404 — the product exists either way.
 *
 * The flag is compared to `true` rather than read for truthiness: it is
 * derived server-side and typed `boolean | undefined`, so anything else that
 * arrives is drift, and drift must not open a page.
 */
export function resolveProductPageType(
  product: { configurable?: boolean } | null | undefined,
  mayConfigure: boolean,
): ProductPageType {
  return product?.configurable === true && mayConfigure
    ? 'configurable'
    : 'ordinary';
}

import { canConfigure, type UserContext } from '#shared/utils/feature-access';

/**
 * Which page component a product gets.
 *
 * One rule for product types rather than a special case per type: the route
 * asks this, and the page it names renders. A third type is one more member
 * here and one more branch in the page — never a condition inside a page.
 */
export type ProductPageType =
  | 'ordinary'
  | 'configurable'
  | 'sign-in-to-configure';

/**
 * A signed-in buyer gets the configurator for a configurable product and a
 * guest is asked to sign in — never a plain add, which would land a line
 * without a configuration at catalogue price.
 *
 * The flag is compared to `true` rather than read for truthiness: it is
 * derived server-side and typed `boolean | undefined`, so anything else that
 * arrives is drift, and drift must not open a page.
 */
export function resolveProductPageType(
  product: { configurable?: boolean } | null | undefined,
  user: UserContext,
): ProductPageType {
  if (product?.configurable !== true) return 'ordinary';
  return canConfigure(user) ? 'configurable' : 'sign-in-to-configure';
}

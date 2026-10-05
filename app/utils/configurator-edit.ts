import type { CartLineRef } from '~/composables/useConfiguratorSession';

// ---------------------------------------------------------------------------
// Editing a configured cart line lives in the product page's URL, as ids only,
// so a reload or a new tab still knows which line is being edited.
// ---------------------------------------------------------------------------

const CART = 'cart';
const LINE = 'line';

/** The product page editing a line: the page's path plus the two ids. */
export function editLineHref(path: string, line: CartLineRef): string {
  const query = new URLSearchParams({
    [CART]: line.cartId,
    [LINE]: line.itemId,
  });
  return `${path}?${query.toString()}`;
}

/**
 * The line a product page's query names, when it names one in the buyer's own
 * cart. `stale` is a link that names a line the page cannot edit — another
 * cart, an order since placed, half a link — which the page says rather than
 * ignore.
 */
export function editTarget(
  query: Record<string, unknown>,
  cartId: string | null,
): { line: CartLineRef | null; stale: boolean } {
  if (!(CART in query) && !(LINE in query)) return { line: null, stale: false };
  const cart = query[CART];
  const item = query[LINE];
  if (
    typeof cart !== 'string' ||
    typeof item !== 'string' ||
    item === '' ||
    cart !== cartId
  ) {
    return { line: null, stale: true };
  }
  return { line: { cartId: cart, itemId: item }, stale: false };
}

/** The query without the edit, for the page once the edit is over. */
export function withoutEdit<T extends Record<string, unknown>>(
  query: T,
): Omit<T, typeof CART | typeof LINE> {
  const { [CART]: _cart, [LINE]: _line, ...rest } = query;
  return rest;
}

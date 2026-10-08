import type { StockType } from '#shared/types/commerce';
import { getStockStatus } from '#shared/types/commerce';

/** The fields of a cart line the count reads. */
interface CartLine {
  id?: string;
  skuId?: number | string | null;
  quantity?: number | null;
}

/** Units of one SKU over every line of the cart, but the line `except` names. */
export function quantityInCart(
  items: readonly CartLine[] | null | undefined,
  skuId: number | null | undefined,
  except?: string | null,
): number {
  if (!skuId) return 0;
  return (items ?? [])
    .filter(
      (i) =>
        String(i.skuId) === String(skuId) &&
        (except == null || i.id !== except),
    )
    .reduce((sum, i) => sum + (i.quantity ?? 0), 0);
}

/**
 * Units still to add: the stock less what the cart already holds. Oversellable
 * and static (on-demand) stock is not limited, and neither is a stock nobody
 * sent.
 */
export function stockLeft(
  stock: StockType | null | undefined,
  inCart: number,
): number {
  if (!stock) return Number.POSITIVE_INFINITY;
  if (stock.oversellable > 0 || stock.static > 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, (stock.totalStock ?? 0) - inCart);
}

/** Why nothing more can be added, named by its `product.*` copy. */
export type StockBlock = 'out_of_stock' | 'max_in_cart';

/** What stops an add, as the ordinary product page shows it, or `null`. */
export function stockBlock(
  stock: StockType | null | undefined,
  inCart: number,
): StockBlock | null {
  if (!stock) return null;
  if (getStockStatus(stock) === 'out-of-stock') return 'out_of_stock';
  return stockLeft(stock, inCart) === 0 ? 'max_in_cart' : null;
}

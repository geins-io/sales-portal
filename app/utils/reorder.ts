import type { LineConfigurationSummary } from '#shared/types/commerce';
import type { ProductPageType } from '~/utils/product-page-type';

/** An order row, as far as reorder reads it. */
interface ReorderRow {
  skuId?: number | null;
  quantity?: number | null;
  product?: { configurable?: boolean } | null;
  configuration?: LineConfigurationSummary;
}

/**
 * What "Beställ igen" puts in the cart. A row that is not an ordinary product
 * for this buyer is left out and counted, as a saved list's "add all" does; so
 * is a configured row, since a plain add of it would come back without its
 * configuration.
 */
export function reorderLines(
  items: readonly (ReorderRow | null)[],
  pageTypeOf: (product: ReorderRow['product']) => ProductPageType,
): { lines: { skuId: number; quantity: number }[]; skipped: number } {
  const lines: { skuId: number; quantity: number }[] = [];
  let skipped = 0;
  for (const item of items) {
    if (!item) continue;
    if (item.configuration || pageTypeOf(item.product) !== 'ordinary') {
      skipped++;
    } else if (item.skuId) {
      lines.push({ skuId: item.skuId, quantity: item.quantity ?? 1 });
    }
  }
  return { lines, skipped };
}

import type { ListProduct } from '#shared/types/commerce';

export type QuickAddChoice =
  { skuId: number } | { blocked: 'configurable' | 'variants' | 'no-sku' };

/**
 * What quick add can put on a draft from a search hit. A configurable product
 * needs a configuration first, and a product with several variants needs the
 * buyer to pick one, so both are shown without an add.
 */
export function quickAddChoice(
  product: Pick<ListProduct, 'configurable'> & {
    skus: { skuId?: number | null }[];
  },
): QuickAddChoice {
  if (product.configurable) return { blocked: 'configurable' };
  if (product.skus.length > 1) return { blocked: 'variants' };
  const skuId = product.skus[0]?.skuId;
  return typeof skuId === 'number' ? { skuId } : { blocked: 'no-sku' };
}

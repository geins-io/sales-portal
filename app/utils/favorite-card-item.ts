import type { ProductCardItem } from '~/components/shared/ProductCard.vue';

// Minimal product shape returned by /api/products/by-aliases. We only need
// the fields consumed by the card + add-to-cart handler.
export interface FavoriteProduct {
  alias?: string | null;
  name?: string | null;
  articleNumber?: string | null;
  productImages?: Array<{ fileName?: string | null } | null> | null;
  unitPrice?: {
    isDiscounted?: boolean | null;
    regularPriceIncVat?: number | null;
    regularPriceIncVatFormatted?: string | null;
    sellingPriceIncVat?: number | null;
    sellingPriceIncVatFormatted?: string | null;
  } | null;
  skus?: Array<{ skuId?: number | null } | null> | null;
  configurable?: boolean;
}

export function toFavoriteCardItem(product: FavoriteProduct): ProductCardItem {
  const unitPrice = product.unitPrice;
  const regular = unitPrice?.regularPriceIncVat ?? null;
  const selling = unitPrice?.sellingPriceIncVat ?? null;
  const hasDiscount =
    unitPrice?.isDiscounted === true ||
    (regular != null && selling != null && regular > selling);

  return {
    name: product.name ?? '',
    imageFileName: product.productImages?.[0]?.fileName ?? null,
    price: hasDiscount
      ? (unitPrice?.regularPriceIncVatFormatted ?? null)
      : (unitPrice?.sellingPriceIncVatFormatted ?? null),
    salePrice: hasDiscount
      ? (unitPrice?.sellingPriceIncVatFormatted ?? null)
      : null,
    articleNumber: product.articleNumber ?? null,
    alias: product.alias ?? null,
    ...(product.configurable === true && { configurable: true }),
  };
}
